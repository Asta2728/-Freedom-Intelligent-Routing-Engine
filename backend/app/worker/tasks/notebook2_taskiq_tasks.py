"""Notebook2-style FIRE ingestion tasks running in Taskiq.

This module intentionally follows Notebook 2 behavior for AI analysis,
geocoding fallback, and routing sequence.
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import random
import re
import time
from datetime import date
from typing import Any, Literal
from uuid import UUID

import pandas as pd
from geopy.distance import geodesic
from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from yandex_geocoder import Client

from app.core.config import settings
from app.db.models.fire import (
    AssignmentMethod,
    BackgroundTask,
    BusinessUnit,
    Manager,
    RoutingResult,
    TaskAction,
    TaskLog,
    TaskStatus,
    Ticket,
    TicketAIAnalysis,
    TicketType,
)
from app.db.session import get_db_context
from app.services.storage import get_storage_adapter
from app.worker.taskiq_app import broker

logger = logging.getLogger(__name__)
_RR_STATE: dict[tuple[str, ...], int] = {}
_GEMINI_VISION_MODEL: Any | None = None
_GEMINI_VISION_INIT_FAILED = False


class _TicketAnalysisSchema(BaseModel):
    type: Literal[
        "Жалоба",
        "Смена данных",
        "Консультация",
        "Претензия",
        "Неработоспособность приложения",
        "Мошеннические действия",
        "Спам",
    ] = Field(description="Категория обращения")
    tone: Literal["Позитивный", "Нейтральный", "Негативный"] = Field(description="Тон сообщения")
    priority: int = Field(ge=1, le=10, description="Приоритет от 1 до 10")
    language: str = Field(description="Язык")
    summary: str = Field(description="1-2 предложения: суть + рекомендация")


SYSTEM_PROMPT = """Ты — аналитик банка. Проанализируй обращение клиента и верни СТРОГО JSON-объект без markdown.
Формат:
{
  \"type\": \"Жалоба|Смена данных|Консультация|Претензия|Неработоспособность приложения|Мошеннические действия|Спам\",
  \"tone\": \"Позитивный|Нейтральный|Негативный\",
  \"priority\": 1..10,
  \"language\": \"RU|KZ|ENG|UZ|...\",
  \"summary\": \"краткое резюме\"
}
Без дополнительного текста.
"""


def _fallback_analysis(description: str) -> dict[str, Any]:
    return {
        "type": "Консультация",
        "tone": "Нейтральный",
        "priority": 5,
        "language": "RU",
        "summary": "Описание отсутствует." if not description else "Ошибка анализа.",
    }


def _resolve_provider_and_model() -> tuple[str, str | None, str | None, str]:
    provider = "deepseek"
    api_key = settings.DEEPSEEK_API_KEY
    base_url = settings.DEEPSEEK_BASE_URL
    default_model = "deepseek-chat"

    model_name = (settings.AI_MODEL or default_model).strip()
    if model_name.lower().startswith(("gpt-", "o1", "o3", "o4")):
        logger.warning(
            "AI_MODEL '%s' is OpenAI-specific while provider is DeepSeek; using 'deepseek-chat' instead.",
            model_name,
        )
        model_name = "deepseek-chat"

    return provider, api_key, base_url, model_name


def _get_llm_client() -> OpenAI | None:
    _, api_key, base_url, _ = _resolve_provider_and_model()

    if not api_key:
        return None
    return OpenAI(api_key=api_key, base_url=base_url)


_LLM_CLIENT = _get_llm_client()


def _extract_json_object(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    if not text:
        raise ValueError("Empty model response")
    try:
        return json.loads(text)
    except Exception:
        pass

    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("JSON object not found")
    return json.loads(match.group(0))


def _call_model(messages: list[dict[str, str]]) -> str:
    if _LLM_CLIENT is None:
        raise RuntimeError("LLM client is not configured")

    _, _, _, model = _resolve_provider_and_model()
    try:
        response = _LLM_CLIENT.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0,
            response_format={"type": "json_object"},
        )
    except Exception:
        response = _LLM_CLIENT.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0,
        )

    return (response.choices[0].message.content or "").strip()


def _analyze_ticket_notebook2(description: str, retries: int = 2) -> dict[str, Any]:
    if not description or str(description).strip() == "":
        return _fallback_analysis(description)

    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": str(description)},
            ]
            raw = _call_model(messages)
            payload = _extract_json_object(raw)
            validated = _TicketAnalysisSchema.model_validate(payload).model_dump()
            if validated.get("type") == "Спам":
                validated["priority"] = 1
            return validated
        except (ValidationError, ValueError, json.JSONDecodeError) as exc:
            last_error = exc
        except Exception as exc:
            last_error = exc

        if attempt < retries:
            time.sleep(0.7)

    logger.warning("Notebook2-style AI fallback used: %s", last_error)
    return _fallback_analysis(description)


def _normalize_text(value: str | None) -> str:
    return str(value or "").strip().lower()


def _is_vip_or_priority(segment: str | None) -> bool:
    return str(segment or "").strip().upper() in {"VIP", "PRIORITY"}


def _skills_upper(skills: list[str] | None) -> set[str]:
    return {str(skill).strip().upper() for skill in (skills or []) if str(skill).strip()}


def _role_is_chief(role: str | None) -> bool:
    return "глав" in _normalize_text(role)


def _clean_cols(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = (
        df.columns.astype(str)
        .str.strip()
        .str.lower()
        .str.replace(" ", "_", regex=False)
        .str.replace("(", "", regex=False)
        .str.replace(")", "", regex=False)
    )
    return df


def _get_value(row: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in row:
            value = row.get(key)
            if value is not None:
                return value
    return default


def _to_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    text = str(value).strip()
    return text if text else None


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        parsed = pd.to_datetime(text, errors="coerce")
        if pd.isna(parsed):
            return None
        return parsed.date()
    except Exception:
        return None


def _parse_skills(value: Any) -> list[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    text = str(value).strip()
    if not text:
        return []
    text = text.strip("[]")
    parts = [part.strip().strip("'").strip('"') for part in text.split(",")]
    return [part.upper() for part in parts if part]


def _parse_attachment_candidates(attachment_path: str | None) -> list[str]:
    text = str(attachment_path or "").strip()
    if not text:
        return []
    tokens = [token.strip() for token in re.split(r"[;,]", text) if token.strip()]
    return [os.path.basename(token) for token in tokens if token]


def _get_gemini_vision_model() -> Any | None:
    global _GEMINI_VISION_MODEL, _GEMINI_VISION_INIT_FAILED

    if _GEMINI_VISION_MODEL is not None:
        return _GEMINI_VISION_MODEL
    if _GEMINI_VISION_INIT_FAILED:
        return None
    if not settings.GEMINI_API_KEY:
        _GEMINI_VISION_INIT_FAILED = True
        return None

    try:
        from google import genai

        _GEMINI_VISION_MODEL = genai.Client(api_key=settings.GEMINI_API_KEY)
        return _GEMINI_VISION_MODEL
    except ImportError as exc:
        _GEMINI_VISION_INIT_FAILED = True
        logger.warning("Gemini vision disabled: install 'google-genai' package (%s)", exc)
        return None
    except Exception as exc:
        _GEMINI_VISION_INIT_FAILED = True
        logger.warning("Gemini vision init failed: %s", exc)
        return None


def _describe_image_bytes(image_bytes: bytes) -> str:
    client = _get_gemini_vision_model()
    if client is None or not image_bytes:
        return ""

    try:
        from PIL import Image

        with Image.open(io.BytesIO(image_bytes)) as image:
            prompt = "Describe this image simply in about 50 to 100 tokens."
            response = client.models.generate_content(
                model=settings.GEMINI_VISION_MODEL,
                contents=[prompt, image],
            )
        description = str(getattr(response, "text", "") or "").strip()
        if not description:
            return ""
        return f"\n[Описание прикрепленного изображения]: {description}"
    except Exception as exc:
        logger.warning("Image description failed: %s", exc)
        return ""


async def _process_single_image_key(
    storage: Any,
    key: str,
) -> tuple[str, str] | None:
    """Fetch one image from storage and return (storage_key, description_context) or None."""
    try:
        image_bytes = await storage.read(key)
        image_context = await asyncio.to_thread(_describe_image_bytes, image_bytes)
        if not image_context:
            return None
        return key, image_context
    except Exception as exc:
        logger.warning("Unable to process image key '%s': %s", key, exc)
        return None


async def _build_image_descriptions_by_name(
    storage: Any,
    image_file_keys: list[str] | None,
) -> dict[str, str]:
    keys = [str(key).strip() for key in (image_file_keys or []) if str(key).strip()]
    if not keys:
        return {}

    # Process all images concurrently instead of sequentially
    results = await asyncio.gather(
        *[_process_single_image_key(storage, key) for key in keys],
        return_exceptions=False,
    )

    descriptions: dict[str, str] = {}
    for result in results:
        if result is None:
            continue
        key, image_context = result
        base_name = os.path.basename(key)
        descriptions[base_name.lower()] = image_context
        # Also register under original filename (strips leading "001_" prefix added at upload)
        stripped_name = re.sub(r"^\d+_", "", base_name)
        if stripped_name != base_name:
            descriptions[stripped_name.lower()] = image_context

    return descriptions


def _build_analysis_description(
    description: str | None,
    attachment_path: str | None,
    image_descriptions_by_name: dict[str, str] | None,
) -> str:
    base_description = str(description or "").strip()
    if not image_descriptions_by_name:
        return base_description

    # Collect ALL matching image contexts (ticket may reference multiple attachments via ";" or ",")
    matched_contexts: list[str] = []
    seen: set[str] = set()
    for candidate in _parse_attachment_candidates(attachment_path):
        image_context = image_descriptions_by_name.get(candidate.lower())
        if image_context and image_context not in seen:
            matched_contexts.append(image_context)
            seen.add(image_context)

    if not matched_contexts:
        return base_description

    return (base_description + "".join(matched_contexts)).strip()


def _clean_address(text: str | None) -> str:
    if not text:
        return ""
    return re.split(
        r"этаж|офис|кв\.|крыло|бц|бизнес-центр|зд\.",
        str(text),
        flags=re.IGNORECASE,
    )[0].strip().rstrip(",")


def _geocode_office(client: Client | None, office_name: str, address: str) -> tuple[float | None, float | None]:
    if not client:
        return None, None

    city = (office_name or "").strip()
    address_part = _clean_address(address)
    query = f"Казахстан, {city}, {address_part}".strip(", ")

    try:
        coords = client.coordinates(query)
        time.sleep(0.1)
        return float(coords[1]), float(coords[0])
    except Exception:
        try:
            coords = client.coordinates(f"Казахстан, {city}")
            return float(coords[1]), float(coords[0])
        except Exception:
            return None, None


async def _append_log(task_id: UUID, action: TaskAction, message: str, data: dict[str, Any] | None = None) -> None:
    async with get_db_context() as db:
        db.add(TaskLog(task_id=task_id, action=action, message=message, data=data))


async def _set_task_status(
    task_id: UUID,
    status: TaskStatus,
    *,
    error_message: str | None = None,
    payload_patch: dict[str, Any] | None = None,
) -> None:
    async with get_db_context() as db:
        result = await db.execute(select(BackgroundTask).where(BackgroundTask.id == task_id))
        task = result.scalar_one_or_none()
        if not task:
            return
        task.status = status
        task.error_message = error_message
        payload = dict(task.payload or {})
        if payload_patch:
            payload.update(payload_patch)
        task.payload = payload


async def enrich_ticket_direct(db: Any, ticket: Ticket) -> TicketAIAnalysis:
    existing = await db.execute(select(TicketAIAnalysis).where(TicketAIAnalysis.ticket_id == ticket.id))
    analysis = existing.scalar_one_or_none()
    if analysis:
        return analysis

    payload = await asyncio.to_thread(_analyze_ticket_notebook2, str(ticket.description or "").strip())
    analysis = TicketAIAnalysis(
        ticket_id=ticket.id,
        ai_type=payload.get("type"),
        ai_tone=payload.get("tone"),
        ai_priority=int(payload.get("priority") or 5),
        ai_language=payload.get("language") or "RU",
        ai_summary=payload.get("summary") or "",
        ai_recommendation=payload.get("summary") or "",
        model_name=settings.AI_MODEL,
    )
    db.add(analysis)
    await db.flush()
    return analysis


async def _upsert_ticket_analysis_from_payload(db: Any, ticket: Ticket, payload: dict[str, Any]) -> TicketAIAnalysis:
    existing = await db.execute(select(TicketAIAnalysis).where(TicketAIAnalysis.ticket_id == ticket.id))
    analysis = existing.scalar_one_or_none()
    if analysis:
        return analysis

    analysis = TicketAIAnalysis(
        ticket_id=ticket.id,
        ai_type=payload.get("type"),
        ai_tone=payload.get("tone"),
        ai_priority=int(payload.get("priority") or 5),
        ai_language=payload.get("language") or "RU",
        ai_summary=payload.get("summary") or "",
        ai_recommendation=payload.get("summary") or "",
        model_name=settings.AI_MODEL,
    )
    db.add(analysis)
    await db.flush()
    return analysis


async def _prepare_ticket_for_routing(
    ticket: Ticket,
    yandex_client: Client | None,
    image_descriptions_by_name: dict[str, str] | None = None,
) -> dict[str, Any]:
    analysis_input = _build_analysis_description(
        ticket.description,
        ticket.attachment_path,
        image_descriptions_by_name,
    )
    payload = await asyncio.to_thread(_analyze_ticket_notebook2, analysis_input)
    await geocode_ticket_direct(ticket, yandex_client)
    return payload


async def geocode_ticket_direct(ticket: Ticket, yandex_client: Client | None) -> tuple[float | None, float | None]:
    if not yandex_client:
        return None, None

    city = str(ticket.client_city or "").strip()
    street = str(ticket.client_street or "").strip()
    house = str(ticket.client_building or "").strip()
    missing = {"nan", "none", "", "0", "0.0"}
    address_part = f"{street} {house}".strip() if street.lower() not in missing else ""
    query = f"Казахстан, {city}, {address_part}".strip(", ")

    def _get_coords(q: str) -> tuple[float | None, float | None]:
        try:
            coords = yandex_client.coordinates(q)
            time.sleep(0.1)
            return float(coords[1]), float(coords[0])
        except Exception:
            try:
                coords = yandex_client.coordinates(f"Казахстан, {city}")
                return float(coords[1]), float(coords[0])
            except Exception:
                return None, None

    lat, lon = await asyncio.get_event_loop().run_in_executor(None, _get_coords, query)
    ticket.latitude = lat
    ticket.longitude = lon
    return lat, lon


async def _get_target_office_direct(db: Any, ticket: Ticket) -> tuple[BusinessUnit | None, float | None, AssignmentMethod]:
    offices_result = await db.execute(select(BusinessUnit))
    offices = list(offices_result.scalars().all())
    if not offices:
        return None, None, AssignmentMethod.NO_ELIGIBLE_MANAGER

    if ticket.latitude is None or ticket.longitude is None:
        preferred = [office for office in offices if str(office.name or "").strip().lower() in {"астана", "алматы"}]
        if preferred:
            selected = random.choice(preferred)
            method = (
                AssignmentMethod.GEO_FALLBACK_ASTANA
                if str(selected.name or "").strip().lower() == "астана"
                else AssignmentMethod.GEO_FALLBACK_ALMATY
            )
            return selected, None, method
        return random.choice(offices), None, AssignmentMethod.GEO_NEAREST

    client_coords = (ticket.latitude, ticket.longitude)
    nearest: BusinessUnit | None = None
    min_distance: float | None = None
    for office in offices:
        if office.latitude is None or office.longitude is None:
            continue
        distance = geodesic(client_coords, (office.latitude, office.longitude)).km
        if min_distance is None or distance < min_distance:
            min_distance = distance
            nearest = office

    if nearest is not None:
        return nearest, min_distance, AssignmentMethod.GEO_NEAREST

    return random.choice(offices), None, AssignmentMethod.GEO_NEAREST


async def route_ticket_direct(db: Any, ticket: Ticket, analysis: TicketAIAnalysis) -> RoutingResult:
    existing_result = await db.execute(select(RoutingResult).where(RoutingResult.ticket_id == ticket.id).limit(1))
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        return existing

    if analysis.ai_type == TicketType.SPAM:
        routing = RoutingResult(
            ticket_id=ticket.id,
            assignment_method=AssignmentMethod.SKIPPED_SPAM,
            routing_error="Spam ticket skipped",
        )
        db.add(routing)
        await db.flush()
        return routing

    target_office, distance_km, method = await _get_target_office_direct(db, ticket)
    if target_office is None:
        routing = RoutingResult(
            ticket_id=ticket.id,
            assignment_method=AssignmentMethod.NO_ELIGIBLE_MANAGER,
            routing_error="No business units available",
        )
        db.add(routing)
        await db.flush()
        return routing

    pool_result = await db.execute(select(Manager).where(Manager.business_unit_id == target_office.id))
    pool = list(pool_result.scalars().all())

    if _is_vip_or_priority(ticket.client_segment):
        pool = [manager for manager in pool if "VIP" in _skills_upper(manager.skills)]

    if analysis.ai_type == TicketType.DATA_CHANGE:
        pool = [manager for manager in pool if _role_is_chief(manager.role)]

    language = str(analysis.ai_language or "RU").upper()
    if language in {"KZ", "ENG"}:
        pool = [manager for manager in pool if language in _skills_upper(manager.skills)]

    if not pool:
        routing = RoutingResult(
            ticket_id=ticket.id,
            business_unit_id=target_office.id,
            office_distance_km=distance_km,
            assignment_method=AssignmentMethod.NO_ELIGIBLE_MANAGER,
            routing_error="No eligible manager for routing rules",
        )
        db.add(routing)
        await db.flush()
        return routing

    top_candidates = sorted(pool, key=lambda manager: (manager.current_load, manager.full_name))[:2]
    candidate_names = tuple(sorted(manager.full_name for manager in top_candidates))
    current_idx = _RR_STATE.get(candidate_names, 0)
    selected_name = candidate_names[current_idx % len(candidate_names)]
    _RR_STATE[candidate_names] = current_idx + 1

    selected_manager = next(manager for manager in top_candidates if manager.full_name == selected_name)
    selected_manager.current_load = int(selected_manager.current_load or 0) + 1
    ticket.assigned_manager_id = selected_manager.id

    routing = RoutingResult(
        ticket_id=ticket.id,
        assigned_manager_id=selected_manager.id,
        business_unit_id=target_office.id,
        office_distance_km=distance_km,
        assignment_method=method,
        round_robin_position=current_idx % len(candidate_names),
        manager_load_at_assignment=selected_manager.current_load,
    )
    db.add(routing)
    await db.flush()
    return routing


@broker.task(task_name="app.worker.tasks.ingestion_tasks:process_bulk_ingestion")
async def process_bulk_ingestion(
    task_id: str,
    bu_file_key: str,
    mgr_file_key: str,
    tkt_file_key: str,
    image_file_keys: list[str] | None = None,
) -> dict[str, Any]:
    parsed_task_id = UUID(task_id)
    storage = get_storage_adapter()
    yandex_client = Client(settings.YANDEX_API_KEY) if settings.YANDEX_API_KEY else None

    await _set_task_status(parsed_task_id, TaskStatus.RUNNING)
    await _append_log(parsed_task_id, TaskAction.INFO, "Started notebook2-style bulk ingestion task.")

    try:
        bu_df = _clean_cols(pd.read_csv(io.BytesIO(await storage.read(bu_file_key))))
        mgr_df = _clean_cols(pd.read_csv(io.BytesIO(await storage.read(mgr_file_key))))
        tkt_df = _clean_cols(pd.read_csv(io.BytesIO(await storage.read(tkt_file_key))))
        image_descriptions_by_name = await _build_image_descriptions_by_name(storage, image_file_keys)
        if image_descriptions_by_name:
            await _append_log(
                parsed_task_id,
                TaskAction.INFO,
                f"Prepared image context for {len(image_descriptions_by_name)} image name mappings.",
            )

        async with get_db_context() as db:
            bu_by_name: dict[str, BusinessUnit] = {}
            for record in bu_df.to_dict(orient="records"):
                office = _to_text(_get_value(record, "офис", "office", "name"))
                if not office:
                    continue
                address = _to_text(_get_value(record, "адрес", "address")) or ""
                lat, lon = _geocode_office(yandex_client, office, address)

                existing_result = await db.execute(select(BusinessUnit).where(BusinessUnit.name == office).limit(1))
                business_unit = existing_result.scalar_one_or_none()
                if business_unit is None:
                    business_unit = BusinessUnit(name=office)
                    db.add(business_unit)

                if lat is None or lon is None:
                    if business_unit.latitude is not None and business_unit.longitude is not None:
                        lat, lon = business_unit.latitude, business_unit.longitude
                    else:
                        lat, lon = 0.0, 0.0

                business_unit.country = "Kazakhstan"
                business_unit.city = office
                business_unit.address = address
                business_unit.latitude = lat
                business_unit.longitude = lon
                await db.flush()
                bu_by_name[office] = business_unit

            for record in mgr_df.to_dict(orient="records"):
                full_name = _to_text(_get_value(record, "фио", "full_name", "manager_name"))
                office = _to_text(_get_value(record, "офис", "office", "business_unit"))
                if not full_name or not office:
                    continue

                business_unit = bu_by_name.get(office)
                if business_unit is None:
                    continue

                role = _to_text(_get_value(record, "должность", "role")) or "Специалист"
                skills = _parse_skills(_get_value(record, "навыки", "skills"))

                existing_result = await db.execute(
                    select(Manager)
                    .where(Manager.full_name == full_name, Manager.business_unit_id == business_unit.id)
                    .limit(1)
                )
                manager = existing_result.scalar_one_or_none()
                if manager is None:
                    manager = Manager(full_name=full_name, business_unit_id=business_unit.id)
                    db.add(manager)

                manager.role = role
                manager.skills = skills
                manager.current_load = 0

            await db.flush()

            ticket_objects: list[Ticket] = []
            for record in tkt_df.to_dict(orient="records"):
                guid = _to_text(_get_value(record, "guid_клиента", "guid", "guid_klienta"))
                if not guid:
                    continue

                existing_result = await db.execute(select(Ticket).where(Ticket.guid == guid).limit(1))
                ticket = existing_result.scalar_one_or_none()
                if ticket is None:
                    ticket = Ticket(guid=guid)
                    db.add(ticket)

                ticket.client_gender = _to_text(_get_value(record, "пол_клиента", "client_gender"))
                ticket.client_dob = _parse_date(_get_value(record, "дата_рождения", "client_dob"))
                ticket.description = _to_text(_get_value(record, "описание", "description")) or ""
                ticket.attachment_path = _to_text(_get_value(record, "вложения", "attachment_path"))
                ticket.client_segment = _to_text(_get_value(record, "сегмент_клиента", "сегмент", "client_segment")) or "Mass"
                ticket.client_country = _to_text(_get_value(record, "страна", "client_country"))
                ticket.client_region = _to_text(_get_value(record, "область", "client_region"))
                ticket.client_city = _to_text(_get_value(record, "населённый_пункт", "населенный_пункт", "client_city"))
                ticket.client_street = _to_text(_get_value(record, "улица", "client_street"))
                ticket.client_building = _to_text(_get_value(record, "дом", "client_building"))
                ticket_objects.append(ticket)

            await db.flush()

            processed = 0
            assigned = 0
            skipped_spam = 0
            batch_size = 5
            total_batches = (len(ticket_objects) + batch_size - 1) // batch_size if ticket_objects else 0
            slow_ticket_threshold_sec = 2.0

            for batch_idx, start in enumerate(range(0, len(ticket_objects), batch_size), start=1):
                batch = ticket_objects[start : start + batch_size]
                batch_start = time.perf_counter()
                batch_guids = [str(ticket.guid) for ticket in batch]
                await _append_log(
                    parsed_task_id,
                    TaskAction.INFO,
                    f"Processing batch {batch_idx}/{total_batches} ({len(batch)} tickets)",
                    data={"batch": batch_idx, "total_batches": total_batches, "guids": batch_guids},
                )

                prepared_payloads = await asyncio.gather(
                    *[
                        _prepare_ticket_for_routing(
                            ticket,
                            yandex_client,
                            image_descriptions_by_name=image_descriptions_by_name,
                        )
                        for ticket in batch
                    ],
                    return_exceptions=True,
                )

                for ticket, prepared in zip(batch, prepared_payloads, strict=False):
                    ticket_start = time.perf_counter()
                    if isinstance(prepared, Exception):
                        logger.warning("Ticket preparation failed for %s: %s", ticket.guid, prepared)
                        await _append_log(
                            parsed_task_id,
                            TaskAction.WARN,
                            f"Ticket preparation failed for {ticket.guid}; fallback analysis used.",
                        )
                        payload = _fallback_analysis(str(ticket.description or ""))
                    else:
                        payload = prepared

                    analysis = await _upsert_ticket_analysis_from_payload(db, ticket, payload)
                    route = await route_ticket_direct(db, ticket, analysis)
                    processed += 1
                    if route.assignment_method == AssignmentMethod.SKIPPED_SPAM:
                        skipped_spam += 1
                    elif route.assigned_manager_id:
                        assigned += 1

                    ticket_elapsed = time.perf_counter() - ticket_start
                    if ticket_elapsed >= slow_ticket_threshold_sec:
                        await _append_log(
                            parsed_task_id,
                            TaskAction.WARN,
                            f"Slow ticket processing: {ticket.guid} took {ticket_elapsed:.2f}s",
                            data={"ticket_guid": str(ticket.guid), "elapsed_sec": round(ticket_elapsed, 3)},
                        )

                await db.flush()
                batch_elapsed = time.perf_counter() - batch_start
                await _append_log(
                    parsed_task_id,
                    TaskAction.INFO,
                    f"Completed batch {batch_idx}/{total_batches} in {batch_elapsed:.2f}s",
                    data={
                        "batch": batch_idx,
                        "elapsed_sec": round(batch_elapsed, 3),
                        "processed_tickets": processed,
                        "assigned_tickets": assigned,
                        "spam_skipped": skipped_spam,
                    },
                )

        await _set_task_status(
            parsed_task_id,
            TaskStatus.COMPLETED,
            payload_patch={
                "processed_tickets": processed,
                "assigned_tickets": assigned,
                "spam_skipped": skipped_spam,
            },
        )
        return {
            "status": "completed",
            "task_id": task_id,
            "processed_tickets": processed,
            "assigned_tickets": assigned,
            "spam_skipped": skipped_spam,
        }

    except Exception as exc:
        logger.exception("Notebook2-style bulk ingestion task failed")
        await _append_log(parsed_task_id, TaskAction.ERROR, f"Ingestion failed: {exc}")
        await _set_task_status(parsed_task_id, TaskStatus.FAILED, error_message=str(exc))
        return {
            "status": "failed",
            "task_id": task_id,
            "error": str(exc),
        }


@broker.task(task_name="app.worker.tasks.ingestion_tasks:process_ticket_batch_task")
async def process_ticket_batch_task(task_id: str, ticket_guid: str) -> dict[str, Any]:
    parsed_task_id = UUID(task_id)
    yandex_client = Client(settings.YANDEX_API_KEY) if settings.YANDEX_API_KEY else None
    try:
        async with get_db_context() as db:
            result = await db.execute(select(Ticket).where(Ticket.guid == ticket_guid).limit(1))
            ticket = result.scalar_one_or_none()
            if ticket is None:
                await _append_log(parsed_task_id, TaskAction.WARN, f"Ticket not found: {ticket_guid}")
                return {"status": "not_found", "ticket_guid": ticket_guid}

            analysis = await enrich_ticket_direct(db, ticket)
            await geocode_ticket_direct(ticket, yandex_client=yandex_client)
            await route_ticket_direct(db, ticket, analysis)

        await _append_log(parsed_task_id, TaskAction.SUCCESS, f"Processed ticket: {ticket_guid}")
        return {"status": "completed", "ticket_guid": ticket_guid}
    except Exception as exc:
        logger.exception("Single-ticket process task failed")
        await _append_log(parsed_task_id, TaskAction.ERROR, f"Ticket processing failed: {exc}")
        return {"status": "failed", "ticket_guid": ticket_guid, "error": str(exc)}
