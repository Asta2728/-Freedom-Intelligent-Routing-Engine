"""FIRE CSV Ingestion API routes.

Provides a single endpoint to upload 3 CSV files and ingest them
into the FIRE database tables in the correct FK order.
"""

from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, File, UploadFile, status, HTTPException, Depends, Query
from sqlalchemy import select, and_, delete

from app.api.deps import DBSession
from app.api.pagination import paginate
from app.db.models.fire import (
    Ticket,
    Manager,
    BusinessUnit,
    TicketAIAnalysis,
    RoutingResult,
    BackgroundTask,
    TaskLog,
    TaskStatus,
    TaskAction,
)
from app.schemas.ingestion import IngestionResponse
from app.schemas.fire import (
    BackgroundTaskRead, 
    TaskLogRead,
    PaginatedTasks,
    PaginatedTaskLogs,
    BulkDeleteSchema
)
from app.repositories.base import BaseRepository
from app.core.config import settings
from app.services.storage import BaseStorage, get_storage_adapter
from app.worker.tasks.notebook2_taskiq_tasks import process_bulk_ingestion

router = APIRouter()


def _iter_ingestion_payload_files(payload: dict | None) -> list[str]:
    """Extract known ingestion file keys from a task payload."""
    if not payload:
        return []

    file_keys: list[str] = []
    for key in ("bu_file", "mgr_file", "tkt_file"):
        value = payload.get(key)
        if value:
            file_keys.append(value)

    image_files = payload.get("image_files")
    if isinstance(image_files, list):
        file_keys.extend(str(item) for item in image_files if item)
    return file_keys


@router.post("/ingest", response_model=IngestionResponse, status_code=status.HTTP_201_CREATED)
async def ingest_csv_files(
    db: DBSession,
     business_units: UploadFile = File(..., description="business_units.csv"),
    managers: UploadFile = File(..., description="managers.csv"),
    tickets: UploadFile = File(..., description="tickets.csv"),
    images: Optional[List[UploadFile]] = File(None, description="Optional ticket-related images"),
    storage: BaseStorage = Depends(get_storage_adapter),
):
    """Upload and ingest 3 CSV files into the FIRE database with optional images."""
    import uuid
    bg_task_id = uuid.uuid4()
    
    bu_key = f"ingestion/{bg_task_id}/business_units.csv"
    mgr_key = f"ingestion/{bg_task_id}/managers.csv"
    tkt_key = f"ingestion/{bg_task_id}/tickets.csv"

    await storage.save(business_units.file, bu_key)
    await storage.save(managers.file, mgr_key)
    await storage.save(tickets.file, tkt_key)

    image_keys: list[str] = []
    if images:
        for idx, image in enumerate(images, start=1):
            file_name = (image.filename or f"image_{idx}").replace("\\", "_").replace("/", "_")
            image_key = f"ingestion/{bg_task_id}/images/{idx:03d}_{file_name}"
            await storage.save(image.file, image_key)
            image_keys.append(image_key)

    task_model = BackgroundTask(
        id=bg_task_id,
        task_name="bulk_ingestion",
        status=TaskStatus.PENDING,
        payload={
            "bu_file": bu_key,
            "mgr_file": mgr_key,
            "tkt_file": tkt_key,
            "image_files": image_keys,
        }
    )
    db.add(task_model)
    await db.commit()

    log_entry = TaskLog(
        task_id=task_model.id,
        action=TaskAction.START,
        message="Files uploaded and background ingestion task dispatched."
    )
    db.add(log_entry)
    await db.commit()

    kiq_msg = await process_bulk_ingestion.kiq(
        task_id=str(task_model.id),
        bu_file_key=bu_key,
        mgr_file_key=mgr_key,
        tkt_file_key=tkt_key,
        image_file_keys=image_keys,
    )

    task_model.task_id = kiq_msg.task_id
    await db.commit()

    return IngestionResponse(
        message="Ingestion process started in the background.",
        task_id=str(task_model.id),
    )


@router.get("/tasks", response_model=PaginatedTasks)
async def list_tasks(
    db: DBSession,
    status: Optional[TaskStatus] = Query(None),
    task_name: Optional[str] = Query(None),
    ticket_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
):
    """List all background tasks with filtering and pagination."""
    query = select(BackgroundTask)
    
    filters = []
    if status:
        filters.append(BackgroundTask.status == status)
    if task_name:
        filters.append(BackgroundTask.task_name == task_name)
    if ticket_id:
        filters.append(BackgroundTask.ticket_id == ticket_id)

    if filters:
        query = query.where(and_(*filters))

    from sqlalchemy import inspect
    # Dynamic sort by col if exists
    order_col = BackgroundTask.created_at
    if sort_by and hasattr(BackgroundTask, sort_by):
        order_col = getattr(BackgroundTask, sort_by)

    return await paginate(
        db,
        query,
        page=page,
        page_size=page_size,
        sort_by=order_col,
        sort_dir=sort_dir
    )


@router.get("/tasks/{task_id}", response_model=BackgroundTaskRead)
async def get_task(
    task_id: UUID,
    db: DBSession,
):
    """Get a single background task by ID."""
    task = await db.get(BackgroundTask, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.get("/tickets/{ticket_id}/tasks", response_model=PaginatedTasks)
async def get_ticket_tasks(
    ticket_id: UUID, 
    db: DBSession,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
):
    """Get all background tasks for a specific ticket with pagination."""
    query = select(BackgroundTask).where(BackgroundTask.ticket_id == ticket_id)
    return await paginate(db, query, page=page, page_size=page_size)


@router.get("/tasks/{task_id}/logs", response_model=PaginatedTaskLogs)
async def get_task_logs(
    task_id: UUID, 
    db: DBSession,
    action: Optional[TaskAction] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
):
    """Get all logs for a specific background task with pagination and filtering."""
    query = select(TaskLog).where(TaskLog.task_id == task_id)
    
    if action:
        query = query.where(TaskLog.action == action)
        
    return await paginate(db, query, page=page, page_size=page_size, sort_by=TaskLog.created_at, sort_dir="asc")


@router.get("/logs", response_model=PaginatedTaskLogs)
async def list_all_logs(
    db: DBSession,
    task_id: Optional[UUID] = Query(None),
    action: Optional[TaskAction] = Query(None),
    message_query: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    sort_by: str = Query("created_at"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
):
    """Global logs list for system monitoring with advanced filtering."""
    query = select(TaskLog)
    
    filters = []
    if task_id:
        filters.append(TaskLog.task_id == task_id)
    if action:
        filters.append(TaskLog.action == action)
    if message_query:
        filters.append(TaskLog.message.ilike(f"%{message_query}%"))
        
    if filters:
        query = query.where(and_(*filters))
        
    order_col = TaskLog.created_at
    if sort_by and hasattr(TaskLog, sort_by):
        order_col = getattr(TaskLog, sort_by)
        
    return await paginate(
        db, 
        query, 
        page=page, 
        page_size=page_size, 
        sort_by=order_col, 
        sort_dir=sort_dir
    )


@router.delete("/tasks", status_code=status.HTTP_200_OK)
async def bulk_delete_tasks(
    db: DBSession,
    data: BulkDeleteSchema,
    storage: BaseStorage = Depends(get_storage_adapter)
):
    """Bulk delete background tasks by IDs, including their logs and storage files."""
    from sqlalchemy import select, delete
    
    # 1. Fetch tasks to get payloads (for storage cleanup)
    result = await db.execute(select(BackgroundTask).where(BackgroundTask.id.in_(data.ids)))
    tasks = result.scalars().all()
    
    # 2. Extract and delete files from storage
    deleted_files = 0
    for task in tasks:
        for file_key in _iter_ingestion_payload_files(task.payload):
            if await storage.delete(file_key):
                deleted_files += 1
    
    # 3. Delete the tasks themselves
    # Note: TaskLog records are deleted automatically via DB-level ON DELETE CASCADE
    stmt = delete(BackgroundTask).where(BackgroundTask.id.in_(data.ids))
    del_result = await db.execute(stmt)
    await db.commit()
    
    return {
        "deleted_tasks": del_result.rowcount,
        "deleted_files": deleted_files,
        "message": f"Deleted {del_result.rowcount} tasks and {deleted_files} files. Logs cleared via cascade."
    }


@router.delete("/logs", status_code=status.HTTP_200_OK)
async def clear_all_logs(db: DBSession):
    """Clear all task logs from the database."""
    from sqlalchemy import delete
    result = await db.execute(delete(TaskLog))
    await db.commit()
    return {"deleted": result.rowcount}


@router.delete("/storage", status_code=status.HTTP_200_OK)
async def clear_ingestion_storage(
    storage: BaseStorage = Depends(get_storage_adapter)
):
    """Clear all files in the ingestion storage directory."""
    # Note: LocalStorage.base_dir is settings.UPLOAD_DIR
    import shutil
    import os
    
    ingestion_dir = os.path.join(settings.UPLOAD_DIR, "ingestion")
    if os.path.exists(ingestion_dir):
        # We use shutil.rmtree for efficiency, then recreate the folder
        shutil.rmtree(ingestion_dir)
        os.makedirs(ingestion_dir, exist_ok=True)
        return {"message": "Ingestion storage cleared."}
    
    return {"message": "Ingestion storage already empty or not found."}


@router.delete("/reset-all", status_code=status.HTTP_200_OK)
async def reset_all_fire_data(
    db: DBSession,
    storage: BaseStorage = Depends(get_storage_adapter),
):
    """Fully reset FIRE data, task logs/tasks, and ingestion storage."""
    import os
    import shutil

    # Clear DB entities in FK-safe order.
    task_logs_deleted = (await db.execute(delete(TaskLog))).rowcount or 0
    tasks_deleted = (await db.execute(delete(BackgroundTask))).rowcount or 0
    routing_deleted = (await db.execute(delete(RoutingResult))).rowcount or 0
    analyses_deleted = (await db.execute(delete(TicketAIAnalysis))).rowcount or 0
    tickets_deleted = (await db.execute(delete(Ticket))).rowcount or 0
    managers_deleted = (await db.execute(delete(Manager))).rowcount or 0
    business_units_deleted = (await db.execute(delete(BusinessUnit))).rowcount or 0

    # Clear ingestion storage directory.
    ingestion_dir = os.path.join(settings.UPLOAD_DIR, "ingestion")
    storage_cleared = False
    if os.path.exists(ingestion_dir):
        shutil.rmtree(ingestion_dir)
        os.makedirs(ingestion_dir, exist_ok=True)
        storage_cleared = True

    await db.commit()

    return {
        "message": "FIRE data reset completed.",
        "deleted": {
            "task_logs": task_logs_deleted,
            "tasks": tasks_deleted,
            "routing_results": routing_deleted,
            "ticket_ai_analyses": analyses_deleted,
            "tickets": tickets_deleted,
            "managers": managers_deleted,
            "business_units": business_units_deleted,
        },
        "storage_cleared": storage_cleared,
    }
