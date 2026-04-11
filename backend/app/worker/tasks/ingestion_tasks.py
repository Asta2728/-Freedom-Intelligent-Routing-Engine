"""Compatibility shim for old task import path.

Keeps Taskiq task names under `app.worker.tasks.ingestion_tasks:*` available
while implementation lives in `notebook2_taskiq_tasks`.
"""

from app.worker.tasks.notebook2_taskiq_tasks import process_bulk_ingestion, process_ticket_batch_task

__all__ = ["process_bulk_ingestion", "process_ticket_batch_task"]
