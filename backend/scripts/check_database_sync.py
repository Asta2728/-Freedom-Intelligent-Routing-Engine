import asyncio
import csv
import io
import pandas as pd
from pathlib import Path
from sqlalchemy import select, func
from app.db.session import get_db_context
from app.db.models.fire import BusinessUnit, Manager, Ticket
import logging
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

# Paths to datasets
path_relative = "../" 
DATASETS_DIR = Path("c:/Users/osman/Desktop/OSMANPROJECTS/datasaur-project/notebooks/datasets")
BU_CSV = DATASETS_DIR / "business_units.csv"
MGR_CSV = DATASETS_DIR / "managers.csv"
TKT_CSV = DATASETS_DIR / "tickets.csv"

def _clean(value: str) -> str:
    return value.strip().strip("\ufeff") if value else ""

async def analyze_sync():
    print("=== Data Consistency Check ===")
    
    async with get_db_context() as db:
        # 1. Business Units
        print("\n[1/3] Business Units")
        bu_csv_df = pd.read_csv(BU_CSV, encoding="utf-8-sig")
        csv_bu_count = len(bu_csv_df)
        
        db_bu_count_res = await db.execute(select(func.count(BusinessUnit.id)))
        db_bu_count = db_bu_count_res.scalar()
        
        print(f"  CSV: {csv_bu_count} records")
        print(f"  DB:  {db_bu_count} records")
        
        if csv_bu_count != db_bu_count:
            print(f"  ⚠️ MISMATCH: Difference of {abs(csv_bu_count - db_bu_count)}")
            # Identify missing
            db_names_res = await db.execute(select(BusinessUnit.name))
            db_names = set(db_names_res.scalars().all())
            csv_names = set(bu_csv_df["Офис"].dropna().apply(_clean))
            
            missing_in_db = csv_names - db_names
            if missing_in_db:
                print(f"  Missing in DB: {missing_in_db}")
        else:
            print("  ✅ Counts match.")

        # 2. Managers
        print("\n[2/3] Managers")
        mgr_csv_df = pd.read_csv(MGR_CSV, encoding="utf-8-sig")
        csv_mgr_count = len(mgr_csv_df)
        
        db_mgr_count_res = await db.execute(select(func.count(Manager.id)))
        db_mgr_count = db_mgr_count_res.scalar()
        
        print(f"  CSV: {csv_mgr_count} records")
        print(f"  DB:  {db_mgr_count} records")
        
        if csv_mgr_count != db_mgr_count:
            print(f"  ⚠️ MISMATCH: Difference of {abs(csv_mgr_count - db_mgr_count)}")
            db_names_res = await db.execute(select(Manager.full_name))
            db_names = set(db_names_res.scalars().all())
            csv_names = set(mgr_csv_df["ФИО"].dropna().apply(_clean))
            
            missing_in_db = csv_names - db_names
            if missing_in_db:
                print(f"  Missing in DB (sample): {list(missing_in_db)[:5]}...")
        else:
            print("  ✅ Counts match.")

        # 3. Tickets
        print("\n[3/3] Tickets")
        tkt_csv_df = pd.read_csv(TKT_CSV, encoding="utf-8-sig")
        csv_tkt_count = len(tkt_csv_df)
        
        db_tkt_count_res = await db.execute(select(func.count(Ticket.id)))
        db_tkt_count = db_tkt_count_res.scalar()
        
        print(f"  CSV: {csv_tkt_count} records")
        print(f"  DB:  {db_tkt_count} records")
        
        if csv_tkt_count != db_tkt_count:
            print(f"  ⚠️ MISMATCH: Difference of {abs(csv_tkt_count - db_tkt_count)}")
            db_guids_res = await db.execute(select(Ticket.guid))
            db_guids = set(db_guids_res.scalars().all())
            csv_guids = set(tkt_csv_df["GUID клиента"].dropna().apply(_clean))
            
            missing_in_db = csv_guids - db_guids
            if missing_in_db:
                print(f"  Missing in DB (sample): {list(missing_in_db)[:5]}...")
        else:
            print("  ✅ Counts match.")

    print("\n=== Check Complete ===")

if __name__ == "__main__":
    asyncio.run(analyze_sync())
