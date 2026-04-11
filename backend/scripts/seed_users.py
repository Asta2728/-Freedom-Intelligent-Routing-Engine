"""Seed script: create a superadmin and a manager user with password123.

Usage (from the backend directory):
    uv run python scripts/seed_users.py
"""

import asyncio
import sys
from pathlib import Path

# Allow imports from the app package when run directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import get_password_hash
from app.db.models.user import User, UserRole
from app.db.session import get_db_context


USERS_TO_SEED = [
    {
        "email": "admin@datasaur.dev",
        "full_name": "Super Admin",
        "role": UserRole.ADMIN.value,
        "is_superuser": True,
        "is_active": True,
    },
    {
        "email": "manager@datasaur.dev",
        "full_name": "Test Manager",
        "role": UserRole.MANAGER.value,
        "is_superuser": False,
        "is_active": True,
    },
]

PASSWORD = "password123"


async def seed() -> None:
    hashed_pw = get_password_hash(PASSWORD)

    async with get_db_context() as db:
        from sqlalchemy import select

        for data in USERS_TO_SEED:
            # Skip if already exists
            result = await db.execute(select(User).where(User.email == data["email"]))
            existing = result.scalar_one_or_none()
            if existing:
                print(f"[skip]  {data['email']} already exists")
                continue

            user = User(
                email=data["email"],
                full_name=data["full_name"],
                role=data["role"],
                is_superuser=data["is_superuser"],
                is_active=data["is_active"],
                hashed_password=hashed_pw,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            print(f"[ok]    Created user: {user.email}  (role={user.role})")

    print("\nDone! All users seeded with password: password123")


if __name__ == "__main__":
    asyncio.run(seed())
