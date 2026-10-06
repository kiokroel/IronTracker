from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from workout_service.src.core.database import Base


class BaseRepository[T: Base, CreateSchemaType: BaseModel, UpdateSchemaType: BaseModel]:
    """Базовый репозиторий с асинхронными CRUD операциями."""

    def __init__(self, db: AsyncSession, model: type[T]) -> None:
        self.db = db
        self.model = model

    async def get(self, id: UUID) -> T | None:
        """Получить сущность по ID."""
        stmt = select(self.model).filter_by(id=id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 100) -> list[T]:
        """Получить все сущности с пагинацией."""
        stmt = select(self.model).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj_in: CreateSchemaType) -> T:
        """Создать новый объект в базе данных."""
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
        """Обновить объект в базе данных."""
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
        """Удалить сущность по ID."""
        db_obj = await self.get(id)
        if db_obj:
            try:
                await self.db.delete(db_obj)
                await self.db.commit()
                return True
            except Exception:
                await self.db.rollback()
                raise
        return False
