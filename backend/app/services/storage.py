"""Storage adapter module.

Provides a clean architecture abstraction for file storage.
Supports local file system and AWS S3 strategies.
"""

import os
import shutil
from abc import ABC, abstractmethod
from typing import BinaryIO

from app.core.config import settings


class BaseStorage(ABC):
    """Abstract base class for storage adapters."""

    @abstractmethod
    async def save(self, file_obj: BinaryIO, filename: str) -> str:
        """Save a file and return its URL/Path."""
        pass

    @abstractmethod
    async def delete(self, filename: str) -> bool:
        """Delete a file by its reference."""
        pass
        
    @abstractmethod
    async def read(self, filename: str) -> bytes:
        """Read a file by its reference."""
        pass

    @abstractmethod
    def get_url(self, filename: str) -> str:
        """Get the public viewable URL of a file."""
        pass


class LocalStorage(BaseStorage):
    """Local file system storage adapter."""

    def __init__(self, base_dir: str = settings.UPLOAD_DIR):
        self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)

    def _get_abs_path(self, filename: str) -> str:
        return os.path.join(self.base_dir, filename)

    async def save(self, file_obj: BinaryIO, filename: str) -> str:
        file_path = self._get_abs_path(filename)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        # Note: in a pure async environment, ideally wrap with run_in_threadpool
        # unless using aiofiles. Here we use basic shutil for simplicity.
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file_obj, buffer)
        return self.get_url(filename)

    async def delete(self, filename: str) -> bool:
        file_path = self._get_abs_path(filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
        
    async def read(self, filename: str) -> bytes:
        file_path = self._get_abs_path(filename)
        with open(file_path, "rb") as f:
            return f.read()

    def get_url(self, filename: str) -> str:
        # Assuming a FastAPI route /media/{filename} exists
        return f"/media/{filename}"


class S3Storage(BaseStorage):
    """AWS S3 storage adapter stub."""

    def __init__(self):
        # Initialize boto3 client here using settings
        # e.g., self.client = boto3.client('s3', region_name=settings.AWS_REGION)
        # self.bucket = settings.AWS_BUCKET_NAME
        pass

    async def save(self, file_obj: BinaryIO, filename: str) -> str:
        # Upload object to S3
        raise NotImplementedError("S3 integration is stubbed")

    async def delete(self, filename: str) -> bool:
        # Delete object from S3
        raise NotImplementedError("S3 integration is stubbed")
        
    async def read(self, filename: str) -> bytes:
        raise NotImplementedError("S3 integration is stubbed")

    def get_url(self, filename: str) -> str:
        # Generate presigned URL or public bucket URL
        raise NotImplementedError("S3 integration is stubbed")


def get_storage_adapter() -> BaseStorage:
    """Factory function to get the configured storage adapter."""
    if settings.STORAGE_TYPE == "s3":
        return S3Storage()
    return LocalStorage()
