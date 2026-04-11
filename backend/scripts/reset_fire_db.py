"""Database reset script for FIRE system tables.

This script drops all FIRE-specific tables and clears the alembic_version
to allow for a clean 'alembic upgrade head'.
"""
import asyncio
from sqlalchemy import text
from app.core.config import settings
from sqlalchemy.ext.asyncio import create_async_engine

async def reset_db():
    engine = create_async_engine(settings.DATABASE_URL)
    
    # Tables to drop in reverse dependency order
    tables = [
        "task_logs",
        "background_tasks",
        "routing_results",
        "ticket_ai_analyses",
        "tickets",
        "managers",
        "business_units",
        "alembic_version"
    ]
    
    print(f"🗑️  Dropping FIRE tables from {settings.DB_TYPE} database...")
    
    async with engine.begin() as conn:
        for table in tables:
            try:
                await conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
                print(f"  ✅ Dropped {table}")
            except Exception as e:
                print(f"  ❌ Failed to drop {table}: {e}")
    
    await engine.dispose()
    print("\n✨ Database cleared. Run 'uv run alembic upgrade head' next.")

if __name__ == "__main__":
    asyncio.run(reset_db())
