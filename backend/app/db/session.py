"""Async PostgreSQL database session."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

def create_db_engine():
    engine_kwargs = {"echo": settings.SQL_ECHO}
    
    if settings.DB_TYPE == "postgres":
        engine_kwargs.update({
            "pool_size": settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_timeout": settings.DB_POOL_TIMEOUT,
        })
    elif settings.DB_TYPE == "sqlite":
        from sqlalchemy.pool import NullPool
        engine_kwargs.update({
            "poolclass": NullPool,
        })

    return create_async_engine(settings.DATABASE_URL, **engine_kwargs)

engine = create_db_engine()

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

async def close_db() -> None:
    await engine.dispose()
