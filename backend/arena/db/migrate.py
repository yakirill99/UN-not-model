"""Run Alembic programmatically (tests, seed scripts, entrypoints)."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.ext.asyncio import AsyncEngine

from arena.db import Base

BACKEND_DIR = Path(__file__).resolve().parents[2]


def alembic_config(database_url: str) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", database_url)
    return cfg


def upgrade_head(database_url: str) -> None:
    command.upgrade(alembic_config(database_url), "head")


async def create_all(engine: AsyncEngine) -> None:
    """Schema straight from the models - for in-memory test databases only.

    Migrations are the source of truth for real databases; tests check that both
    give the same schema (tests/unit/test_db_models.py).
    """
    import arena.db.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
