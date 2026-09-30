import pytest
from httpx import AsyncClient

from arena.settings import Settings


async def test_healthz(client: AsyncClient) -> None:
    r = await client.get("/healthz")
    assert r.status_code == 200 and r.json()["status"] == "ok"


async def test_readyz_with_database(client: AsyncClient) -> None:
    r = await client.get("/readyz")
    assert r.status_code == 200 and r.json() == {"status": "ready"}


async def test_readyz_without_database() -> None:
    from httpx import ASGITransport

    from arena.main import create_app

    app = create_app(Settings(database_url="postgresql+asyncpg://nobody@127.0.0.1:1/none"))
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c,
    ):
        r = await c.get("/readyz")
    assert r.status_code == 503 and r.json()["status"] == "unavailable"


def test_settings_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ARENA_DATABASE_URL", "sqlite+aiosqlite:///x.db")
    monkeypatch.setenv("ARENA_JWT_TTL_HOURS", "3")
    s = Settings()
    assert s.is_sqlite and s.jwt_ttl_hours == 3


async def test_openapi_lists_ops(client: AsyncClient) -> None:
    spec = (await client.get("/openapi.json")).json()
    assert {"/healthz", "/readyz"} <= set(spec["paths"])
