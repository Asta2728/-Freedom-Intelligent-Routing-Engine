"""File upload API endpoints."""

import os
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.models.user import User
from app.services.storage import BaseStorage, get_storage_adapter

router = APIRouter()
media_router = APIRouter()


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: Annotated[UploadFile, File(...)],
    current_user: User = Depends(get_current_user),
    storage: BaseStorage = Depends(get_storage_adapter),
) -> dict[str, str]:
    """Upload a file securely to the configured storage adapter.
    
    Generates a unique prefix to avoid filename collisions and assigns it to a private user partition.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename not provided")
        
    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path_key = f"private/{current_user.id}/{unique_filename}"
    
    try:
        url = await storage.save(file.file, file_path_key)
        return {
            "filename": unique_filename,
            "file_path": file_path_key,
            "original_name": file.filename,
            "url": url,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")


@media_router.get("/{file_path:path}", response_class=FileResponse)
async def get_file(
    file_path: str,
    current_user: User = Depends(get_current_user),
    storage: BaseStorage = Depends(get_storage_adapter),
):
    """Serve a file dynamically enforcing authorization.
    
    If exploring a private file, enforces current_user token matches the path partition.
    """
    if file_path.startswith("private/"):
        if not file_path.startswith(f"private/{current_user.id}/"):
            raise HTTPException(status_code=403, detail="Not authorized to access this file")
            
    if settings.STORAGE_TYPE == "local":
        abs_path = os.path.join(settings.UPLOAD_DIR, file_path)
        if not os.path.exists(abs_path):
            raise HTTPException(status_code=404, detail="File not found")
        # Ensure the path stays within the base directory (prevent directory traversal)
        base_dir = os.path.abspath(settings.UPLOAD_DIR)
        if not os.path.abspath(abs_path).startswith(base_dir):
             raise HTTPException(status_code=400, detail="Invalid file path")
        return FileResponse(path=abs_path)
        
    raise HTTPException(
        status_code=501, 
        detail="Direct file serve not implemented via API for non-local storage"
    )


@router.delete("/{file_path:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_path: str,
    current_user: User = Depends(get_current_user),
    storage: BaseStorage = Depends(get_storage_adapter),
):
    """Delete a file enforcing authorization."""
    if file_path.startswith("private/"):
        if not file_path.startswith(f"private/{current_user.id}/"):
            raise HTTPException(status_code=403, detail="Not authorized to delete this file")
            
    deleted = await storage.delete(file_path)
    if not deleted:
        raise HTTPException(status_code=404, detail="File not found or could not be deleted")
