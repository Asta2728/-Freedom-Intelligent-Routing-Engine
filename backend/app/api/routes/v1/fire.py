"""FIRE Advanced Filtering API routes."""

from typing import Optional, List
from uuid import UUID
from datetime import date

from fastapi import APIRouter, Query, Depends, HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession
from app.api.pagination import paginate
from app.db.models.fire import (
    Ticket, 
    Manager, 
    BusinessUnit, 
    TicketAIAnalysis, 
    RoutingResult,
    TicketType,
    TicketTone,
    TicketLanguage,
    ClientSegment,
    BackgroundTask,
    TaskLog
)
from app.schemas.fire import (
    TicketRead, 
    ManagerRead, 
    BusinessUnitRead,
    PaginatedTickets,
    PaginatedManagers,
    PaginatedBusinessUnits,
    BulkDeleteSchema,
    DashboardAnalyticsResponse,
    PriorityBucket,
    LanguageSlice,
    RoutingMethodSlice,
    TicketGeoPoint,
)
from app.repositories.base import BaseRepository

router = APIRouter()

ticket_repo = BaseRepository(Ticket)
manager_repo = BaseRepository(Manager)
bu_repo = BaseRepository(BusinessUnit)

@router.get("/tickets", response_model=PaginatedTickets)
async def list_tickets(
    db: DBSession,
    ids: Optional[List[UUID]] = Query(None),
    client_segment: Optional[ClientSegment] = Query(None),
    assigned_manager_id: Optional[UUID] = Query(None),
    client_city: Optional[str] = Query(None),
    ai_type: Optional[TicketType] = Query(None),
    ai_tone: Optional[TicketTone] = Query(None),
    ai_priority_min: Optional[int] = Query(None, ge=1, le=10),
    ai_priority_max: Optional[int] = Query(None, ge=1, le=10),
    ai_language: Optional[TicketLanguage] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
):
    """List tickets with advanced filtering, nested data, and pagination."""
    query = select(Ticket).options(
        selectinload(Ticket.ai_analysis),
        selectinload(Ticket.assigned_manager).selectinload(Manager.business_unit),
        selectinload(Ticket.routing_result).selectinload(RoutingResult.business_unit),
        selectinload(Ticket.routing_result)
        .selectinload(RoutingResult.assigned_manager)
        .selectinload(Manager.business_unit),
    )

    filters = []
    if ids:
        filters.append(Ticket.id.in_(ids))
    if client_segment:
        filters.append(Ticket.client_segment == client_segment)
    if assigned_manager_id:
        filters.append(Ticket.assigned_manager_id == assigned_manager_id)
    if client_city:
        filters.append(Ticket.client_city.ilike(f"%{client_city}%"))

    # Join with AI Analysis for its fields
    if any([ai_type, ai_tone, ai_priority_min, ai_priority_max, ai_language]):
        query = query.join(Ticket.ai_analysis)
        if ai_type:
            filters.append(TicketAIAnalysis.ai_type == ai_type)
        if ai_tone:
            filters.append(TicketAIAnalysis.ai_tone == ai_tone)
        if ai_priority_min:
            filters.append(TicketAIAnalysis.ai_priority >= ai_priority_min)
        if ai_priority_max:
            filters.append(TicketAIAnalysis.ai_priority <= ai_priority_max)
        if ai_language:
            filters.append(TicketAIAnalysis.ai_language == ai_language)

    if filters:
        query = query.where(and_(*filters))

    # Column for sorting
    order_col = getattr(Ticket, sort_by, Ticket.created_at)
    
    return await paginate(
        db, 
        query, 
        page=page, 
        page_size=page_size, 
        sort_by=order_col, 
        sort_dir=sort_dir
    )


@router.get("/managers", response_model=PaginatedManagers)
async def list_managers(
    db: DBSession,
    ids: Optional[List[UUID]] = Query(None),
    role: Optional[str] = Query(None),
    business_unit_id: Optional[UUID] = Query(None),
    current_load_min: Optional[int] = Query(None, ge=0),
    current_load_max: Optional[int] = Query(None, ge=0),
    skill: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    sort_by: str = Query("current_load"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
):
    """List managers with filtering and pagination."""
    query = select(Manager).options(selectinload(Manager.business_unit))
    
    filters = []
    if ids:
        filters.append(Manager.id.in_(ids))
    if role:
        normalized = role.strip().lower()
        if "глав" in normalized:
            filters.append(Manager.role.ilike("%глав%"))
        elif "вед" in normalized:
            filters.append(Manager.role.ilike("%вед%"))
        elif "спец" in normalized:
            filters.append(Manager.role.ilike("%спец%"))
        else:
            filters.append(Manager.role.ilike(f"%{role.strip()}%"))
    if business_unit_id:
        filters.append(Manager.business_unit_id == business_unit_id)
    if current_load_min is not None:
        filters.append(Manager.current_load >= current_load_min)
    if current_load_max is not None:
        filters.append(Manager.current_load <= current_load_max)
    if skill:
        filters.append(Manager.skills.any(skill.upper()))

    if filters:
        query = query.where(and_(*filters))

    order_col = getattr(Manager, sort_by, Manager.current_load)

    return await paginate(
        db,
        query,
        page=page,
        page_size=page_size,
        sort_by=order_col,
        sort_dir=sort_dir
    )


@router.get("/business-units", response_model=PaginatedBusinessUnits)
async def list_business_units(
    db: DBSession,
    ids: Optional[List[UUID]] = Query(None),
    city: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    sort_by: str = Query("name"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
):
    """List business units with filtering and pagination."""
    query = select(BusinessUnit)
    
    filters = []
    if ids:
        filters.append(BusinessUnit.id.in_(ids))
    if city:
        filters.append(BusinessUnit.city.ilike(f"%{city}%"))
    if country:
        filters.append(BusinessUnit.country.ilike(f"%{country}%"))

    if filters:
        query = query.where(and_(*filters))

    order_col = getattr(BusinessUnit, sort_by, BusinessUnit.name)

    return await paginate(
        db,
        query,
        page=page,
        page_size=page_size,
        sort_by=order_col,
        sort_dir=sort_dir
    )


@router.delete("/tickets", status_code=status.HTTP_200_OK)
async def bulk_delete_tickets(
    db: DBSession,
    data: BulkDeleteSchema
):
    """Bulk delete tickets by IDs."""
    count = await ticket_repo.delete_multi(db, ids=data.ids)
    await db.commit()
    return {"deleted": count}


@router.delete("/managers", status_code=status.HTTP_200_OK)
async def bulk_delete_managers(
    db: DBSession,
    data: BulkDeleteSchema
):
    """Bulk delete managers by IDs."""
    count = await manager_repo.delete_multi(db, ids=data.ids)
    await db.commit()
    return {"deleted": count}


@router.delete("/business-units", status_code=status.HTTP_200_OK)
async def bulk_delete_business_units(
    db: DBSession,
    data: BulkDeleteSchema
):
    """Bulk delete business units by IDs."""
    count = await bu_repo.delete_multi(db, ids=data.ids)
    await db.commit()
    return {"deleted": count}


@router.get("/analytics", response_model=DashboardAnalyticsResponse)
async def get_dashboard_analytics(db: DBSession):
    """Single aggregated endpoint for the main dashboard charts.

    Returns all data needed for the 4-card analytics grid:
    - Geographic map (tickets with lat/lon)
    - Priority histogram (1-10)
    - Language breakdown (RU / KZ / ENG)
    - Routing method donut (geo_nearest / fallback / no_manager / etc.)
    """

    # --- 1. Priority histogram (GROUP BY ai_priority) ---
    priority_rows = (await db.execute(
        select(TicketAIAnalysis.ai_priority, func.count().label("cnt"))
        .where(TicketAIAnalysis.ai_priority.isnot(None))
        .group_by(TicketAIAnalysis.ai_priority)
        .order_by(TicketAIAnalysis.ai_priority)
    )).all()
    priority_distribution = [
        PriorityBucket(priority=row.ai_priority, count=row.cnt)
        for row in priority_rows
    ]

    # --- 2. Language breakdown (GROUP BY ai_language) ---
    language_rows = (await db.execute(
        select(TicketAIAnalysis.ai_language, func.count().label("cnt"))
        .where(TicketAIAnalysis.ai_language.isnot(None))
        .group_by(TicketAIAnalysis.ai_language)
        .order_by(func.count().desc())
    )).all()
    language_distribution = [
        LanguageSlice(language=row.ai_language or "UNKNOWN", count=row.cnt)
        for row in language_rows
    ]

    # --- 3. Routing method donut (GROUP BY assignment_method) ---
    routing_rows = (await db.execute(
        select(RoutingResult.assignment_method, func.count().label("cnt"))
        .group_by(RoutingResult.assignment_method)
        .order_by(func.count().desc())
    )).all()
    routing_method_distribution = [
        RoutingMethodSlice(method=row.assignment_method, count=row.cnt)
        for row in routing_rows
    ]

    # --- 4. Geo points (tickets with both lat and lon populated) ---
    geo_rows = (await db.execute(
        select(
            Ticket.id,
            Ticket.latitude,
            Ticket.longitude,
            Ticket.client_city,
            Ticket.client_segment,
            TicketAIAnalysis.ai_priority,
        )
        .outerjoin(Ticket.ai_analysis)
        .where(Ticket.latitude.isnot(None))
        .where(Ticket.longitude.isnot(None))
        .limit(2000)  # Limit for frontend performance
    )).all()
    geo_points = [
        TicketGeoPoint(
            ticket_id=row.id,
            latitude=row.latitude,
            longitude=row.longitude,
            client_city=row.client_city,
            client_segment=row.client_segment,
            ai_priority=row.ai_priority,
        )
        for row in geo_rows
    ]

    # --- 5. Summary counters ---
    total_tickets = (await db.execute(select(func.count()).select_from(Ticket))).scalar_one()
    total_managers = (await db.execute(select(func.count()).select_from(Manager))).scalar_one()
    total_bus = (await db.execute(select(func.count()).select_from(BusinessUnit))).scalar_one()
    routed_count = (await db.execute(
        select(func.count()).select_from(RoutingResult)
        .where(RoutingResult.assigned_manager_id.isnot(None))
    )).scalar_one()
    unrouted_count = total_tickets - routed_count

    return DashboardAnalyticsResponse(
        geo_points=geo_points,
        priority_distribution=priority_distribution,
        language_distribution=language_distribution,
        routing_method_distribution=routing_method_distribution,
        total_tickets=total_tickets,
        total_managers=total_managers,
        total_business_units=total_bus,
        routed_count=routed_count,
        unrouted_count=unrouted_count,
    )
