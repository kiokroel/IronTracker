from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from users_service.src.models.user import UserModel
from users_service.src.repositories.base import BaseRepository
from users_service.src.schemas.user import UserRegister, UserUpdate


class UserRepository(BaseRepository[UserModel, UserRegister, UserUpdate]):
    """Specialized async repository for user entity management."""

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db=db, model=UserModel)

    async def get_by_email(self, email: str) -> UserModel | None:
        """Fetch user by unique email address."""
        stmt = select(UserModel).where(UserModel.email == email.lower().strip())
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: UUID) -> UserModel | None:
        """Fetch user by primary key UUID."""
        return await self.get(user_id)

    async def create_user(
        self,
        email: str,
        username: str,
        hashed_password: str,
    ) -> UserModel:
        """Create and commit a new athlete user with pre-hashed password."""
        user = UserModel(
            email=email.lower().strip(),
            username=username.strip(),
            hashed_password=hashed_password,
        )
        try:
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
            return user
        except Exception:
            await self.db.rollback()
            raise
