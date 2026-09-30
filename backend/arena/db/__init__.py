"""Database access: async engine, session factory and the FastAPI dependency.

Postgres (asyncpg) in dev/prod, SQLite (aiosqlite) in fast tests - one code path,
switched by ARENA_DATABASE_URL. Models live in arena.db.models (sprint 4, task 2).
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from arena.settings import Settings


class Base(DeclarativeBase):
    """Declarative base for every table."""


def make_engine(settings: Settings) -> AsyncEngine:
    kwargs: dict[str, object] = {"echo": settings.log_sql}
    if settings.is_sqlite:
        from sqlalchemy.pool import StaticPool

        # one in-memory database shared by every session of the test process
        kwargs |= {"connect_args": {"check_same_thread": False}, "poolclass": StaticPool}
    return create_async_engine(settings.database_url, **kwargs)


def make_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


class Database:
    """Holds the engine and session factory for the lifetime of the app."""

    def __init__(self, settings: Settings) -> None:
        self.engine = make_engine(settings)
        self.sessions = make_session_factory(self.engine)

    async def dispose(self) -> None:
        await self.engine.dispose()

    async def session(self) -> AsyncIterator[AsyncSession]:
        async with self.sessions() as session:
            yield session
