import asyncio
import pandas as pd
from pathlib import Path
from sqlalchemy import select
from app.db.session import get_db_context
from app.db.models.fire import BusinessUnit, Manager, Ticket
import logging
from datetime import datetime

# Disable noise
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

# Paths to datasets
DATASETS_DIR = Path("c:/Users/osman/Desktop/OSMANPROJECTS/datasaur-project/notebooks/datasets")
BU_CSV = DATASETS_DIR / "business_units.csv"
MGR_CSV = DATASETS_DIR / "managers.csv"
TKT_CSV = DATASETS_DIR / "tickets.csv"

def _clean(value) -> str:
    if pd.isna(value):
        return ""
    val = str(value).strip().strip("\ufeff")
    # Normalize "4.0" -> "4"
    if val.endswith(".0"):
        try:
            float(val)
            return val[:-2]
        except ValueError:
            pass
    return val

def _parse_skills(skills_raw: str) -> list[str]:
    raw = _clean(skills_raw)
    if not raw or raw.lower() == "nan":
        return []
    return [s.strip().upper() for s in raw.strip("[]").replace("'", "").split(",") if s.strip()]

def _parse_date(date_raw):
    raw = _clean(date_raw)
    if not raw:
        return None
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw.split(" ")[0], fmt).date()
        except (ValueError, IndexError):
            continue
    return None

async def deep_analyze():
    print("=== Deep Field-by-Field Consistency Check ===")
    
    async with get_db_context() as db:
        # 1. Business Units
        print("\n[1/3] Checking Business Units...")
        bu_csv = pd.read_csv(BU_CSV, encoding="utf-8-sig")
        bu_db_res = await db.execute(select(BusinessUnit))
        bu_db_map = {bu.name: bu for bu in bu_db_res.scalars().all()}
        
        bu_mismatches = 0
        for _, row in bu_csv.iterrows():
            name = _clean(row.get("Офис"))
            if not name: continue
            bu = bu_db_map.get(name)
            if not bu:
                print(f"  ❌ Missing BU in DB: {name}")
                bu_mismatches += 1
                continue
            
            csv_addr = _clean(row.get("Адрес"))
            if bu.address != csv_addr:
                print(f"  ⚠️ Address mismatch for {name}: CSV='{csv_addr}', DB='{bu.address}'")
                bu_mismatches += 1
            
            if bu.latitude is None or bu.longitude is None:
                print(f"  ❌ Missing geocoding for BU: {name}")
                bu_mismatches += 1
        
        if bu_mismatches == 0:
            print("  ✅ All Business Units match and are geocoded.")

        # 2. Managers
        print("\n[2/3] Checking Managers...")
        mgr_csv = pd.read_csv(MGR_CSV, encoding="utf-8-sig")
        mgr_db_res = await db.execute(select(Manager).join(BusinessUnit))
        db_mgr_list = mgr_db_res.scalars().all()
        mgr_db_map = {(m.full_name, m.business_unit.name): m for m in db_mgr_list}
        
        mgr_mismatches = 0
        for _, row in mgr_csv.iterrows():
            name = _clean(row.get("ФИО"))
            office = _clean(row.get("Офис"))
            if not name: continue
            mgr = mgr_db_map.get((name, office))
            if not mgr:
                print(f"  ❌ Missing Manager in DB: {name} ({office})")
                mgr_mismatches += 1
                continue
            
            csv_role = _clean(row.get("Должность"))
            if mgr.role != csv_role:
                print(f"  ⚠️ Role mismatch for {name}: CSV='{csv_role}', DB='{mgr.role}'")
                mgr_mismatches += 1
            
            csv_skills = _parse_skills(row.get("Навыки"))
            if sorted(mgr.skills) != sorted(csv_skills):
                print(f"  ⚠️ Skills mismatch for {name}: CSV={csv_skills}, DB={mgr.skills}")
                mgr_mismatches += 1
        
        if mgr_mismatches == 0:
            print("  ✅ All Managers (Role/Skills) match perfectly.")

        # 3. Tickets
        print("\n[3/3] Checking Tickets...")
        tkt_csv = pd.read_csv(TKT_CSV, encoding="utf-8-sig")
        tkt_db_res = await db.execute(select(Ticket))
        tkt_db_map = {t.guid: t for t in tkt_db_res.scalars().all()}
        
        tkt_mismatches = 0
        checked_count = 0
        for _, row in tkt_csv.iterrows():
            guid = _clean(row.get("GUID клиента"))
            if not guid: continue
            tkt = tkt_db_map.get(guid)
            if not tkt:
                print(f"  ❌ Missing Ticket in DB: {guid}")
                tkt_mismatches += 1
                continue
            checked_count += 1
            
            fields = [
                ("description", "Описание"),
                ("client_segment", "Сегмент клиента"),
                ("client_gender", "Пол"),
                ("client_country", "Страна"),
                ("client_region", "Область"),
                ("client_city", "Населённый пункт"),
                ("client_street", "Улица"),
                ("client_building", "Дом"),
            ]
            for db_field, csv_col in fields:
                db_val = _clean(getattr(tkt, db_field))
                csv_val = _clean(row.get(csv_col))
                if db_val != csv_val:
                    if db_field == "description" and db_val.strip() == csv_val.strip(): continue
                    print(f"  ⚠️ {db_field} mismatch for GUID {guid}: CSV='{csv_val}', DB='{db_val}'")
                    tkt_mismatches += 1
            
            db_dob = tkt.client_dob
            csv_dob = _parse_date(row.get("Дата рождения"))
            if db_dob != csv_dob:
                print(f"  ⚠️ client_dob mismatch for GUID {guid}: CSV='{csv_dob}', DB='{db_dob}'")
                tkt_mismatches += 1
                
            if tkt.latitude is None or tkt.longitude is None:
                print(f"  ❌ Missing geocoding for Ticket GUID: {guid}")
                tkt_mismatches += 1

        print(f"  Processed {checked_count} tickets.")
        if tkt_mismatches == 0:
            print("  ✅ All Tickets match and are geocoded.")
        else:
            print(f"  ❌ Total Ticket mismatches: {tkt_mismatches}")

    print("\n=== Deep Check Complete ===")

if __name__ == "__main__":
    asyncio.run(deep_analyze())
