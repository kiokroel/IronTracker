from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from workout_service.src.config import get_settings


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy 2.0 models in Workout Service."""


def create_engine_and_session_factory(
    database_url: str | None = None,
    echo: bool | None = None,
) -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """Create async SQLAlchemy engine and session factory with connection pooling."""
    settings = get_settings()
    url = database_url or settings.database_url
    engine_echo = settings.db_echo if echo is None else echo

    created_engine = create_async_engine(
        url,
        echo=engine_echo,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        future=True,
    )
    created_session_factory = async_sessionmaker(
        bind=created_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    return created_engine, created_session_factory


# Default application-wide engine and sessionmaker
engine, async_session_factory = create_engine_and_session_factory()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding a scoped transactional async database session."""
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
