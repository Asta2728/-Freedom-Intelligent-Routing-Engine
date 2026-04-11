"""Base Pydantic schemas."""

from datetime import datetime
from typing import Any, Generic, TypeVar, Optional, Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


def serialize_datetime(dt: datetime) -> str:
    """Serialize datetime to ISO format with timezone.

    Ensures all datetimes have explicit timezone (defaults to UTC).
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo("UTC"))
    return dt.isoformat()


class BaseSchema(BaseModel):
    """Base schema with common configuration."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        json_encoders={datetime: serialize_datetime},
    )

    def serializable_dict(self, **kwargs: Any) -> dict[str, Any]:
        """Return a dict with only JSON-serializable fields."""
        from fastapi.encoders import jsonable_encoder

        return jsonable_encoder(self.model_dump(**kwargs))


class TimestampSchema(BaseModel):
    """Schema with timestamp fields."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
        json_encoders={datetime: serialize_datetime},
    )

    created_at: datetime
    updated_at: datetime | None = None


class BaseResponse(BaseModel):
    """Standard API response."""

    success: bool = True
    message: str | None = None


class ErrorResponse(BaseModel):
    """Standard error response."""

    success: bool = False
    error: str
    detail: str | None = None
    code: str | None = None
class PaginatedResponse(BaseModel, Generic[T]):
    """Generic schema for paginated responses."""

    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool


class PaginationParams(BaseModel):
    """Common pagination and sorting parameters."""

    page: int = Field(1, ge=1)
    page_size: int = Field(100, ge=1, le=1000)
    sort_by: Optional[str] = None
    sort_dir: Literal["asc", "desc"] = "desc"
