"""API test fixtures: the app on an in-memory SQLite database, an httpx client."""

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from arena.db.migrate import create_all
from arena.main import create_app
from arena.settings import Settings
from tests.conftest import TEST_JWT_SECRET


@pytest.fixture
def settings() -> Settings:
    return Settings(
        env="test",
        database_url="sqlite+aiosqlite://",
        jwt_secret=TEST_JWT_SECRET,
    )


@pytest.fixture
async def client(settings: Settings) -> AsyncIterator[AsyncClient]:
    app = create_app(settings)
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c,
    ):
        await create_all(app.state.db.engine)  # in-memory SQLite starts empty
        yield c
