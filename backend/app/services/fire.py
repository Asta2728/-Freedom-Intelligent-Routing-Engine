"""FIRE core services: AI Enrichment, Geocoding, and Routing.

Rewritten to match the original notebook logic step-by-step.
See: notebooks/notebookcec3666748.ipynb

Key differences from the previous version that caused incorrect results:
1. AI prompt now uses the notebook's simple system+user template (ChatPromptTemplate).
2. VIP/Priority filter uses .upper() for case-insensitive matching.
3. Data Change filter uses substring "Глав" (case-insensitive), not enum equality.
4. Round Robin picks TOP 2 by load and alternates (stateful dict), matching the spec §3.2 rule 3.
5. Geocoding includes a 0.1s sleep to avoid Yandex rate limits.
"""

import asyncio
import logging
import random
import re
import time
from typing import Optional, Tuple

from geopy.distance import geodesic
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from typing import Literal
from yandex_geocoder import Client

from app.core.config import settings
from app.db.models.fire import (
    AssignmentMethod,
    BusinessUnit,
    Manager,
    RoutingResult,
    Ticket,
    TicketAIAnalysis,
    TicketType,
)

logger = logging.getLogger(__name__)


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


def _normalize_role(role: str | None) -> str:
    """Normalize manager role labels from CSV/spec variants."""
    value = str(role or "").strip().lower()
    if "глав" in value:
        return "главный специалист"
    if "вед" in value:
        return "ведущий специалист"
    if "спец" in value:
        return "специалист"
    return value


def _skills_set(skills: list[str] | None) -> set[str]:
    """Upper-cased, trimmed skill set for robust matching."""
    return {str(skill).strip().upper() for skill in (skills or []) if str(skill).strip()}


# ---------------------------------------------------------------------------
# Step 3 — AI Enrichment  (notebook cell 4)
# ---------------------------------------------------------------------------

# Schema identical to the notebook's TicketAnalysis
class _TicketAnalysisSchema(BaseModel):
    """LLM output schema — mirrors the notebook exactly."""
    type: Literal[
        "Жалоба", "Смена данных", "Консультация", "Претензия",
        "Неработоспособность приложения", "Мошеннические действия", "Спам",
    ] = Field(description="Категория обращения")
    tone: Literal["Позитивный", "Нейтральный", "Негативный"] = Field(description="Тон сообщения")
    priority: int = Field(ge=1, le=10, description="Приоритет от 1 до 10.")
    language: Literal["KZ", "ENG", "RU"] = Field(description="Язык обращения")
    summary: str = Field(description="1-2 предложения: суть + рекомендация")


# Prompt template — identical to the notebook
_ANALYSIS_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "Ты — аналитик банка. Проанализируй обращение клиента.",
    ),
    ("user", "{description}"),
])


class AIService:
    """Step 3: AI Enrichment §3.1 — matches notebook cell 4."""

    def __init__(self):
        self._chain = None
        provider, api_key, base_url, model_name = _resolve_provider_and_model()

        if not api_key:
            logger.warning("%s API key is empty; AI enrichment will use fallback defaults.", provider.upper())
            return

        try:
            self._chain = (
                _ANALYSIS_PROMPT
                | ChatOpenAI(
                    model=model_name,
                    api_key=api_key,
                    base_url=base_url,
                    temperature=0,
                ).with_structured_output(_TicketAnalysisSchema)
            )
        except Exception:
            logger.exception("Failed to initialize AI chain; fallback defaults will be used.")

    def _fallback_analysis(self, description: str, reason: str) -> _TicketAnalysisSchema:
        logger.warning(
            "Using fallback AI analysis due to %s. Description length=%s",
            reason,
            len(description),
        )
        return _TicketAnalysisSchema(
            type="Консультация",
            tone="Нейтральный",
            priority=5,
            language="RU",
            summary="Описание отсутствует." if not description else "Ошибка анализа.",
            recommendation="Запросить у клиента дополнительные данные для дальнейшей обработки.",
        )

    async def enrich_ticket(self, db: Session, ticket: Ticket) -> TicketAIAnalysis:
        """Analyze ticket description via LLM and persist TicketAIAnalysis."""

        # Skip if already enriched
        existing = await db.execute(
            select(TicketAIAnalysis).where(TicketAIAnalysis.ticket_id == ticket.id)
        )
        if analysis := existing.scalar_one_or_none():
            return analysis

        description = str(ticket.description or "").strip()
        if not description:
            result = self._fallback_analysis(description, reason="empty_description")
        else:
            if self._chain is None:
                result = self._fallback_analysis(description, reason="ai_chain_unavailable")
            else:
                try:
                    result = await self._chain.ainvoke({"description": description})
                except Exception:
                    logger.exception(f"AI Enrichment failed for ticket {ticket.id}")
                    result = self._fallback_analysis(description, reason="llm_inference_error")

        # Spam always gets priority 1 (notebook: tickets.loc[type=='Спам','priority']=1)
        priority = 1 if result.type == "Спам" else result.priority

        analysis = TicketAIAnalysis(
            ticket_id=ticket.id,
            ai_type=result.type,
            ai_tone=result.tone,
            ai_priority=priority,
            ai_language=result.language,
            ai_summary=result.summary,
            ai_recommendation=result.summary,
            model_name=settings.AI_MODEL,
        )
        db.add(analysis)
        await db.flush()
        return analysis


# ---------------------------------------------------------------------------
# Step 4 — Geocoding  (notebook cell 5)
# ---------------------------------------------------------------------------

def _clean_address(text: str) -> str:
    """Strip floor/office/etc. from an address — identical to notebook."""
    if not text:
        return ""
    return re.split(
        r'этаж|офис|кв\.|крыло|бц|бизнес-центр|зд\.',
        str(text), flags=re.IGNORECASE,
    )[0].strip().rstrip(",")


class GeocodingService:
    """Step 4: Geocoding §3.1 — matches notebook cell 5."""

    RATE_LIMIT_SLEEP = 0.1  # seconds — same as notebook's time.sleep(0.1)

    def __init__(self):
        self._client = Client(settings.YANDEX_API_KEY) if settings.YANDEX_API_KEY else None

    async def geocode_ticket(
        self, db: Session, ticket: Ticket,
    ) -> Tuple[Optional[float], Optional[float]]:
        """Geocode ticket address via Yandex. Returns (lat, lon) or (None, None)."""
        if not self._client:
            logger.warning("Yandex API key not set, skipping geocoding")
            return None, None

        city = str(ticket.client_city or "").strip()
        street = str(ticket.client_street or "").strip()
        house = str(ticket.client_building or "").strip()

        missing = {"nan", "none", "", "0", "0.0"}
        address_part = f"{street} {house}".strip() if street.lower() not in missing else ""

        query = f"Казахстан, {city}, {address_part}".strip(", ")

        def _get_coords(q: str):
            """Synchronous geocoding (runs in executor). Mirrors notebook exactly."""
            try:
                coords = self._client.coordinates(q)
                time.sleep(self.RATE_LIMIT_SLEEP)  # Rate-limit guard
                return float(coords[1]), float(coords[0])
            except Exception:
                # Fallback to city only — same as notebook
                try:
                    coords = self._client.coordinates(f"Казахстан, {city}")
                    return float(coords[1]), float(coords[0])
                except Exception:
                    return None, None

        try:
            loop = asyncio.get_event_loop()
            lat, lon = await loop.run_in_executor(None, _get_coords, query)
            ticket.latitude = lat
            ticket.longitude = lon
            return lat, lon
        except Exception as e:
            logger.error(f"Geocoding failed for ticket {ticket.id}: {e}")
            return None, None


# ---------------------------------------------------------------------------
# Step 5 — Routing Cascade  (notebook cell 7)
# ---------------------------------------------------------------------------

class RoutingService:
    """Step 5: Routing §3.2 — matches notebook cells 6-7 exactly.

    Critical: the spec says "pick TOP 2 candidates by lowest load,
    then alternate between them (Round Robin)". This is implemented
    via a stateful `_rr_state` dict keyed by the sorted pair of
    candidate names — identical to the notebook.
    """

    def __init__(self):
        # Stateful round-robin tracker — same as notebook's `rr_state = {}`
        self._rr_state: dict[tuple, int] = {}

    async def route_ticket(
        self, db: Session, ticket: Ticket, analysis: TicketAIAnalysis,
    ) -> RoutingResult:
        """Route ticket following the notebook's find_manager_final logic."""

        # ── 1. Spam → skip  (notebook: if type == "Спам": return None)
        if analysis.ai_type == TicketType.SPAM:
            result = RoutingResult(
                ticket_id=ticket.id,
                assignment_method=AssignmentMethod.SKIPPED_SPAM,
                routing_error="Spam ticket skipped",
            )
            db.add(result)
            return result

        # ── 2. Find nearest office  (notebook: get_target_office)
        nearest_bu, method = await self._get_target_office(db, ticket)

        if not nearest_bu:
            err = RoutingResult(ticket_id=ticket.id, routing_error="No business unit found")
            db.add(err)
            return err

        # ── 3. Filter managers in that office  (notebook: find_manager_final)
        mgr_result = await db.execute(
            select(Manager).where(Manager.business_unit_id == nearest_bu.id)
        )
        pool = list(mgr_result.scalars().all())

        if not pool:
            err = RoutingResult(
                ticket_id=ticket.id, business_unit_id=nearest_bu.id,
                routing_error=f"No managers in office '{nearest_bu.name}'",
            )
            db.add(err)
            return err

        # ── 3a. VIP/Priority filter  (notebook: сегмент.upper() in ["VIP","PRIORITY"])
        segment_upper = str(ticket.client_segment or "").strip().upper()
        if segment_upper in ("VIP", "PRIORITY"):
            pool = [m for m in pool if "VIP" in _skills_set(m.skills)]

        # ── 3b. Data Change filter  (notebook: должность.str.contains("Глав", case=False))
        if analysis.ai_type == TicketType.DATA_CHANGE:
            pool = [m for m in pool if _normalize_role(m.role) == "главный специалист"]

        # ── 3c. Language filter  (notebook: lang in skills_list)
        lang = str(analysis.ai_language or "RU").upper()
        if lang in ("KZ", "ENG"):
            pool = [m for m in pool if lang in _skills_set(m.skills)]

        if not pool:
            err = RoutingResult(
                ticket_id=ticket.id, business_unit_id=nearest_bu.id,
                routing_error="No eligible manager after skill filtering",
            )
            db.add(err)
            return err

        # ── 4. Round Robin — top 2 by load, alternate (notebook logic exactly)
        #
        # notebook:
        #   top_candidates = pool.sort_values(by="load", ascending=True).head(2)
        #   candidates_names = sorted(top_candidates["фио"].tolist())
        #   rr_key = tuple(candidates_names)
        #   current_idx = rr_state.get(rr_key, 0)
        #   winner_name = candidates_names[current_idx % len(candidates_names)]
        #   rr_state[rr_key] = current_idx + 1
        #   managers_with_geo.loc[...,"load"] += 1

        pool.sort(key=lambda m: (m.current_load, m.full_name))
        top2 = pool[:2]
        top2_names = sorted([m.full_name for m in top2])
        rr_key = tuple(top2_names)

        current_idx = self._rr_state.get(rr_key, 0)
        winner_name = top2_names[current_idx % len(top2_names)]
        self._rr_state[rr_key] = current_idx + 1

        # Get the Manager ORM object matching the winner
        winner = next(m for m in top2 if m.full_name == winner_name)

        # ── 5. Assign
        ticket.assigned_manager_id = winner.id
        winner.current_load += 1

        res = RoutingResult(
            ticket_id=ticket.id,
            assigned_manager_id=winner.id,
            business_unit_id=nearest_bu.id,
            assignment_method=method,
            manager_load_at_assignment=winner.current_load,
            round_robin_position=current_idx % len(top2_names),
        )
        db.add(res)
        return res

    # ── Helpers ──────────────────────────────────────────────────────────

    async def _get_target_office(
        self, db: Session, ticket: Ticket,
    ) -> Tuple[Optional[BusinessUnit], AssignmentMethod]:
        """Find nearest office — notebook: get_target_office.

        Returns (BusinessUnit, AssignmentMethod).
        If ticket has no coords → random Astana/Almaty fallback (§3.2 rule 2).
        """
        country = str(ticket.client_country or "").strip().lower()
        is_foreign = bool(country) and country not in {"kazakhstan", "казахстан"}

        if is_foreign or ticket.latitude is None or ticket.longitude is None:
            # Fallback 50/50  (notebook: random.choice(['Астана','Алматы']))
            target_city = random.choice(["Астана", "Алматы"])
            bu_result = await db.execute(
                select(BusinessUnit).where(BusinessUnit.name == target_city).limit(1)
            )
            bu = bu_result.scalar_one_or_none()
            method = (
                AssignmentMethod.GEO_FALLBACK_ASTANA
                if target_city == "Астана"
                else AssignmentMethod.GEO_FALLBACK_ALMATY
            )
            return bu, method

        # Find geographically nearest BU
        result = await db.execute(select(BusinessUnit))
        bus = result.scalars().all()
        if not bus:
            return None, AssignmentMethod.GEO_NEAREST

        ticket_pos = (ticket.latitude, ticket.longitude)
        nearest = min(
            bus,
            key=lambda bu: geodesic(ticket_pos, (bu.latitude, bu.longitude)).km,
        )
        return nearest, AssignmentMethod.GEO_NEAREST


# ---------------------------------------------------------------------------
# Module-level singletons  (imported by ingestion_tasks.py)
# ---------------------------------------------------------------------------

ai_service = AIService()
geocoding_service = GeocodingService()
routing_service = RoutingService()
