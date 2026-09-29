"""API test fixtures: the app on an in-memory SQLite database, an httpx client."""

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from arena.main import create_app
from arena.settings import Settings


@pytest.fixture
def settings() -> Settings:
    return Settings(env="test", database_url="sqlite+aiosqlite://", jwt_secret="test-secret-123")


@pytest.fixture
async def client(settings: Settings) -> AsyncIterator[AsyncClient]:
    app = create_app(settings)
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c,
    ):
        yield c
