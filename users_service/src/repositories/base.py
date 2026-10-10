from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from users_service.src.core.database import Base


class BaseRepository[T: Base, CreateSchemaType: BaseModel, UpdateSchemaType: BaseModel]:
    """Generic async repository providing CRUD operations for SQLAlchemy models."""

    def __init__(self, db: AsyncSession, model: type[T]) -> None:
        self.db = db
        self.model = model

    async def get(self, id: UUID) -> T | None:
        """Fetch model by primary key UUID."""
        stmt = select(self.model).filter_by(id=id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 100) -> list[T]:
        """Fetch all models with offset pagination."""
        stmt = select(self.model).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj_in: CreateSchemaType) -> T:
        """Persist a new entity from a Pydantic schema."""
        obj_data = obj_in.model_dump()
        db_obj = self.model(**obj_data)
        try:
            self.db.add(db_obj)
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except Exception:
            await self.db.rollback()
            raise

    async def update(self, db_obj: T, obj_in: UpdateSchemaType) -> T:
        """Update existing entity fields from a schema."""
        obj_data = obj_in.model_dump(exclude_unset=True)
        for field, value in obj_data.items():
            setattr(db_obj, field, value)
        try:
            self.db.add(db_obj)
            await self.db.commit()
            await self.db.refresh(db_obj)
            return db_obj
        except Exception:
            await self.db.rollback()
            raise

    async def delete(self, id: UUID) -> bool:
        """Delete entity by UUID."""
        db_obj = await self.get(id)
        if db_obj is None:
            return False
        try:
            await self.db.delete(db_obj)
            await self.db.commit()
            return True
        except Exception:
            await self.db.rollback()
            raise
