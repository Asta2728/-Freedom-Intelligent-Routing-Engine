import argparse
import asyncio
import html
import json
import re
from pathlib import Path

import pandas as pd
from sqlalchemy import select

from app.db.models.fire import Manager, Ticket
from app.db.session import get_db_context


DEFAULT_IPYNB = Path("../notebooks/notebookcec3666748__2.ipynb")
DEFAULT_REPORT = Path("./scripts/_tmp/notebook2_ipynb_vs_worker_compare.csv")


def _norm_text(value: object) -> str:
	if value is None:
		return ""
	text = str(value).strip()
	if text.lower() == "nan":
		return ""
	return text


def _extract_from_html(html_text: str) -> pd.DataFrame | None:
	thead_match = re.search(r"<thead>(.*?)</thead>", html_text, flags=re.IGNORECASE | re.DOTALL)
	tbody_match = re.search(r"<tbody>(.*?)</tbody>", html_text, flags=re.IGNORECASE | re.DOTALL)
	if not thead_match or not tbody_match:
		return None

	def _strip_cell(raw: str) -> str:
		no_tags = re.sub(r"<.*?>", "", raw, flags=re.DOTALL)
		return _norm_text(html.unescape(no_tags))

	header_cells = re.findall(r"<th[^>]*>(.*?)</th>", thead_match.group(1), flags=re.IGNORECASE | re.DOTALL)
	headers = [_strip_cell(cell) for cell in header_cells]
	if not headers:
		return None

	row_blocks = re.findall(r"<tr[^>]*>(.*?)</tr>", tbody_match.group(1), flags=re.IGNORECASE | re.DOTALL)
	records: list[dict[str, str]] = []
	for block in row_blocks:
		cells = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", block, flags=re.IGNORECASE | re.DOTALL)
		values = [_strip_cell(cell) for cell in cells]
		if len(values) != len(headers):
			continue
		record = dict(zip(headers, values, strict=False))
		records.append(record)

	if not records:
		return None

	table = pd.DataFrame(records)
	cols = {str(c).strip().lower(): c for c in table.columns}
	guid_col = cols.get("guid_клиента") or cols.get("guid клиента") or cols.get("guid")
	manager_col = cols.get("assigned_manager")
	if guid_col and manager_col:
		return pd.DataFrame(
			{
				"guid": table[guid_col].map(_norm_text),
				"expected_manager": table[manager_col].map(_norm_text),
			}
		)
	return None


def _extract_from_text(plain_text: str) -> pd.DataFrame:
	pattern = re.compile(
		r"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}).*?(Менеджер\s+\d+)",
		re.IGNORECASE,
	)
	rows = []
	for match in pattern.finditer(plain_text):
		rows.append({"guid": _norm_text(match.group(1)), "expected_manager": _norm_text(match.group(2))})
	return pd.DataFrame(rows)


def _load_expected_from_ipynb(ipynb_path: Path) -> pd.DataFrame:
	data = json.loads(ipynb_path.read_text(encoding="utf-8"))
	cells = data.get("cells", [])

	for cell in reversed(cells):
		outputs = cell.get("outputs", [])
		for output in outputs:
			output_data = output.get("data", {})

			html_payload = output_data.get("text/html")
			if html_payload:
				html_text = "".join(html_payload if isinstance(html_payload, list) else [html_payload])
				expected = _extract_from_html(html_text)
				if expected is not None and not expected.empty:
					expected = expected[expected["guid"] != ""].drop_duplicates("guid")
					return expected.reset_index(drop=True)

			text_payload = output_data.get("text/plain") or output.get("text")
			if text_payload:
				plain_text = "".join(text_payload if isinstance(text_payload, list) else [text_payload])
				expected = _extract_from_text(plain_text)
				if not expected.empty:
					expected = expected[expected["guid"] != ""].drop_duplicates("guid")
					return expected.reset_index(drop=True)

	raise ValueError("Could not extract guid/assigned_manager pairs from notebook outputs")


async def _load_worker_rows() -> dict[str, str]:
	async with get_db_context() as db:
		stmt = (
			select(Ticket.guid, Manager.full_name)
			.select_from(Ticket)
			.outerjoin(Manager, Ticket.assigned_manager_id == Manager.id)
		)
		result = await db.execute(stmt)

	rows: dict[str, str] = {}
	for guid, manager_name in result.all():
		key = _norm_text(guid)
		if key:
			rows[key] = _norm_text(manager_name)
	return rows


async def compare(ipynb_path: Path, report_csv: Path) -> int:
	expected = _load_expected_from_ipynb(ipynb_path)
	worker = await _load_worker_rows()

	rows = []
	matched = 0
	mismatched = 0
	missing_in_worker = 0

	for item in expected.to_dict(orient="records"):
		guid = item["guid"]
		expected_manager = item["expected_manager"]
		worker_manager = worker.get(guid, "")

		if guid not in worker:
			status = "missing_in_worker"
			missing_in_worker += 1
		elif worker_manager == expected_manager:
			status = "match"
			matched += 1
		else:
			status = "mismatch"
			mismatched += 1

		rows.append(
			{
				"guid": guid,
				"expected_manager": expected_manager,
				"worker_manager": worker_manager,
				"status": status,
			}
		)

	report = pd.DataFrame(rows)
	report_csv.parent.mkdir(parents=True, exist_ok=True)
	report.to_csv(report_csv, index=False, encoding="utf-8-sig")

	print("=== notebookcec3666748__2.ipynb vs Worker ===")
	print(f"Expected rows (from notebook output): {len(expected)}")
	print(f"Matches: {matched}")
	print(f"Mismatches: {mismatched}")
	print(f"Missing in worker DB: {missing_in_worker}")
	print(f"Report: {report_csv.resolve()}")

	return 0 if mismatched == 0 and missing_in_worker == 0 else 1


def main() -> None:
	parser = argparse.ArgumentParser(
		description="Compare notebookcec3666748__2.ipynb output assignments with worker DB assignments"
	)
	parser.add_argument("--ipynb", type=Path, default=DEFAULT_IPYNB)
	parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
	args = parser.parse_args()

	code = asyncio.run(compare(args.ipynb, args.report))
	raise SystemExit(code)


if __name__ == "__main__":
	main()
