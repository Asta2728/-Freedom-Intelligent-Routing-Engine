"""Pagination utility for FastAPI routes."""

import math
from typing import Any, Generic, List, TypeVar, Type

from sqlalchemy import select, func, asc, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from app.schemas.base import PaginatedResponse

T = TypeVar("T")


async def paginate(
    db: AsyncSession,
    query: Select,
    page: int = 1,
    page_size: int = 100,
    sort_by: Any = None,
    sort_dir: str = "desc",
) -> dict[str, Any]:
    """Helper to apply pagination and ordering to a SQLAlchemy query."""
    
    # Get total count before pagination
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply ordering
    if sort_by is not None:
        if sort_dir == "asc":
            query = query.order_by(asc(sort_by))
        else:
            query = query.order_by(desc(sort_by))
            
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    result = await db.execute(query)
    items = result.scalars().all()
    
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }
