"""Real Postgres only: six simultaneous resolves of round 1 produce ONE resolution.

Without ``expected_round`` the row lock alone would serialise the calls into rounds
1..6 - each caller resolving the next round. That is exactly the double-click bug this
test guards against.

Runs with Docker (testcontainers); skipped otherwise. Locally:
    uv run pytest -m postgres tests/api/test_postgres_concurrency.py
"""

import asyncio
from collections.abc import Iterator

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from arena.db.migrate import upgrade_head
from arena.db.models import StateSnapshot
from arena.services.errors import Conflict
from arena.services.games import BotSlot, CreateGame, create_game
from arena.services.rounds import resolve_round
from arena.settings import Settings
from tests.conftest import TEST_JWT_SECRET

pytestmark = pytest.mark.postgres


@pytest.fixture(scope="module")
def postgres_url() -> Iterator[str]:
    try:
        try:
            from testcontainers.community.postgres import PostgresContainer  # type: ignore[import-not-found,unused-ignore]  # noqa: I001
        except ImportError:  # older testcontainers
            from testcontainers.postgres import PostgresContainer  # type: ignore[import-not-found,unused-ignore,no-redef]  # noqa: I001
    except ImportError:  # pragma: no cover
        pytest.skip("testcontainers not installed")
    try:
        container = PostgresContainer("postgres:17-alpine", driver="asyncpg")
        container.start()
    except Exception as exc:
        pytest.skip(f"Docker not available: {type(exc).__name__}")
    try:
        url = container.get_connection_url()
        upgrade_head(url)
        yield url
    finally:
        container.stop()


async def test_concurrent_resolve_is_single(postgres_url: str) -> None:
    settings = Settings(env="test", database_url=postgres_url, jwt_secret=TEST_JWT_SECRET)
    engine = create_async_engine(postgres_url)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with sessions() as s:
            game = await create_game(
                s,
                CreateGame(
                    scenario="equal",
                    seed=1,
                    bots=[
                        BotSlot(country_id=c, bot="economist")
                        for c in ("russia", "usa", "france", "iran", "dprk")
                    ],
                ),
                settings,
            )

        async def attempt() -> str:
            async with sessions() as s:
                try:
                    r = await resolve_round(s, game.id, expected_round=1)
                    return f"resolved:{r.round}"
                except Conflict as exc:
                    return f"conflict:{exc}"

        results = await asyncio.gather(*(attempt() for _ in range(6)))
        resolved = [r for r in results if r.startswith("resolved")]
        conflicts = [r for r in results if r.startswith("conflict")]
        assert len(resolved) == 1, results  # exactly one winner
        assert len(conflicts) == 5 and all("already resolved" in c for c in conflicts), results
        async with sessions() as s:
            n = (
                await s.execute(
                    select(func.count())
                    .select_from(StateSnapshot)
                    .where(StateSnapshot.game_id == game.id)
                )
            ).scalar_one()
        assert n == 2  # initial + round 1, no duplicate
    finally:
        await engine.dispose()
