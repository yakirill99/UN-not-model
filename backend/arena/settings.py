"""Configuration from environment variables (12-factor). See .env.example."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ARENA_", env_file=".env", extra="ignore")

    env: Literal["dev", "test", "prod"] = "dev"
    database_url: str = Field(
        default="postgresql+asyncpg://arena:arena@localhost:5432/arena",
        description="SQLAlchemy async URL; sqlite+aiosqlite:///... for tests",
    )
    jwt_secret: str = Field(default="dev-only-secret-change-me-before-prod-0000", min_length=32)
    jwt_ttl_hours: int = 12
    rules_dir: str = Field(default="../rules", description="Relative to the backend directory")
    scenarios_dir: str = "../scenarios"
    log_sql: bool = False

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
