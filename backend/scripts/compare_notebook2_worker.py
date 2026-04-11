import argparse
import asyncio
from pathlib import Path

import pandas as pd
from sqlalchemy import select

from app.db.models.fire import BusinessUnit, Manager, RoutingResult, Ticket, TicketAIAnalysis
from app.db.session import get_db_context


DEFAULT_EXPECTED = Path("../notebooks/datasets/tickets_with_manager__output.csv")
DEFAULT_REPORT = Path("./scripts/_tmp/notebook2_vs_worker_compare.csv")


def _norm_text(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if text.lower() == "nan":
        return ""
    return text


async def _load_worker_rows() -> dict[str, dict[str, str]]:
    async with get_db_context() as db:
        stmt = (
            select(
                Ticket.guid,
                Manager.full_name,
                BusinessUnit.name,
                RoutingResult.assignment_method,
                TicketAIAnalysis.ai_type,
                TicketAIAnalysis.ai_language,
            )
            .select_from(Ticket)
            .outerjoin(Manager, Ticket.assigned_manager_id == Manager.id)
            .outerjoin(BusinessUnit, Manager.business_unit_id == BusinessUnit.id)
            .outerjoin(RoutingResult, RoutingResult.ticket_id == Ticket.id)
            .outerjoin(TicketAIAnalysis, TicketAIAnalysis.ticket_id == Ticket.id)
        )
        result = await db.execute(stmt)

    worker: dict[str, dict[str, str]] = {}
    for guid, manager_name, office_name, assignment_method, ai_type, ai_language in result.all():
        key = _norm_text(guid)
        if not key:
            continue
        worker[key] = {
            "worker_manager": _norm_text(manager_name),
            "worker_office": _norm_text(office_name),
            "assignment_method": _norm_text(assignment_method),
            "ai_type": _norm_text(ai_type),
            "ai_language": _norm_text(ai_language),
        }
    return worker


def _build_manager_office_map() -> dict[str, str]:
    managers_csv = Path("../notebooks/datasets/managers.csv")
    if not managers_csv.exists():
        return {}

    df = pd.read_csv(managers_csv, encoding="utf-8-sig")
    cols = {str(c).strip().lower(): c for c in df.columns}
    name_col = cols.get("фио") or cols.get("full_name")
    office_col = cols.get("офис") or cols.get("office")
    if not name_col or not office_col:
        return {}

    mapping: dict[str, str] = {}
    for _, row in df.iterrows():
        name = _norm_text(row.get(name_col))
        office = _norm_text(row.get(office_col))
        if name:
            mapping[name] = office
    return mapping


def _load_expected(expected_csv: Path) -> pd.DataFrame:
    df = pd.read_csv(expected_csv, encoding="utf-8-sig")
    cols = {str(c).strip().lower(): c for c in df.columns}

    guid_col = cols.get("guid_клиента") or cols.get("guid клиента") or cols.get("guid")
    manager_col = cols.get("assigned_manager")

    if not guid_col or not manager_col:
        raise ValueError(
            "Expected CSV must contain columns: 'guid_клиента' and 'assigned_manager'"
        )

    out = pd.DataFrame(
        {
            "guid": df[guid_col].map(_norm_text),
            "expected_manager": df[manager_col].map(_norm_text),
        }
    )
    return out[out["guid"] != ""].reset_index(drop=True)


async def compare(expected_csv: Path, report_csv: Path) -> int:
    expected = _load_expected(expected_csv)
    worker = await _load_worker_rows()
    expected_office_map = _build_manager_office_map()

    rows = []
    matched = 0
    mismatched = 0
    missing_in_worker = 0

    for item in expected.to_dict(orient="records"):
        guid = item["guid"]
        expected_manager = item["expected_manager"]
        worker_row = worker.get(guid)

        if worker_row is None:
            status = "missing_in_worker"
            missing_in_worker += 1
            worker_manager = ""
            worker_office = ""
            assignment_method = ""
            ai_type = ""
            ai_language = ""
        else:
            worker_manager = worker_row["worker_manager"]
            worker_office = worker_row["worker_office"]
            assignment_method = worker_row["assignment_method"]
            ai_type = worker_row["ai_type"]
            ai_language = worker_row["ai_language"]

            if worker_manager == expected_manager:
                status = "match"
                matched += 1
            else:
                status = "mismatch"
                mismatched += 1

        rows.append(
            {
                "guid": guid,
                "expected_manager": expected_manager,
                "expected_office": expected_office_map.get(expected_manager, ""),
                "worker_manager": worker_manager,
                "worker_office": worker_office,
                "status": status,
                "assignment_method": assignment_method,
                "ai_type": ai_type,
                "ai_language": ai_language,
            }
        )

    report_df = pd.DataFrame(rows)
    report_csv.parent.mkdir(parents=True, exist_ok=True)
    report_df.to_csv(report_csv, index=False, encoding="utf-8-sig")

    total = len(expected)
    print("=== Notebook2 vs Worker Comparison ===")
    print(f"Expected rows (Notebook2 output): {total}")
    print(f"Matches: {matched}")
    print(f"Mismatches: {mismatched}")
    print(f"Missing in worker DB: {missing_in_worker}")
    print(f"Report: {report_csv.resolve()}")

    return 0 if mismatched == 0 and missing_in_worker == 0 else 1


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compare Notebook2 output assignments with worker DB assignments."
    )
    parser.add_argument(
        "--expected",
        type=Path,
        default=DEFAULT_EXPECTED,
        help="Path to notebook output CSV (default: ../notebooks/datasets/tickets_with_manager__output.csv)",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=DEFAULT_REPORT,
        help="Path to write detailed comparison CSV report.",
    )
    args = parser.parse_args()

    exit_code = asyncio.run(compare(args.expected, args.report))
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
