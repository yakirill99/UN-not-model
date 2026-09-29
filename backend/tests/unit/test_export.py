"""The database-built GameLog replays without divergence, bots' orders included."""

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from arena.db.migrate import create_all
from arena.engine.orders import CountryOrders
from arena.seed_demo import parse_bots, seed
from arena.services.export import export_log, replay_game
from arena.services.games import BotSlot, CreateGame, create_game
from arena.services.rounds import resolve_round, set_laugh_winner, submit_orders
from arena.settings import Settings
from tests.conftest import TEST_JWT_SECRET

SETTINGS = Settings(env="test", database_url="sqlite+aiosqlite://", jwt_secret=TEST_JWT_SECRET)


@pytest.fixture
async def session():  # type: ignore[no-untyped-def]
    engine = create_async_engine("sqlite+aiosqlite://")
    await create_all(engine)
    async with async_sessionmaker(engine, expire_on_commit=False)() as s:
        yield s
    await engine.dispose()


async def test_exported_log_replays_cleanly(session) -> None:  # type: ignore[no-untyped-def]
    g = await create_game(
        session,
        CreateGame(
            scenario="smolny",
            seed=4,
            bots=[
                BotSlot(country_id="dprk", bot="aggressor"),
                BotSlot(country_id="iran", bot="random"),
            ],
        ),
        SETTINGS,
    )
    await submit_orders(session, g.id, "russia", CountryOrders(invest=["moscow"], shields=["spb"]))
    await set_laugh_winner(session, g.id, "usa")
    await resolve_round(session, g.id, expected_round=1)
    await submit_orders(session, g.id, "usa", CountryOrders(eco_programs=2))
    await resolve_round(session, g.id, expected_round=2)
    await resolve_round(session, g.id, expected_round=3)

    log = await export_log(session, g.id)
    assert log.rules_version == "1.0.0" and log.scenario_id == "smolny" and log.seed == 4
    assert [r.round for r in log.rounds] == [1, 2, 3]
    assert log.rounds[0].orders.for_country("russia").shields == ["spb"]
    assert log.rounds[0].orders.host.laugh_winner == "usa"
    assert not log.rounds[0].orders.for_country("dprk").is_empty  # bot orders were persisted
    assert log.rounds[0].events and log.rounds[0].events[0].round == 1
    assert log.final_state.round == 4
    assert await replay_game(session, g.id) == []  # the API resolved exactly like the engine
    # and the log round-trips through JSON like any headless log
    from arena.engine.runner import GameLog

    assert GameLog.model_validate_json(log.model_dump_json()) == log


async def test_seed_demo_prints_codes() -> None:
    settings = Settings(env="test", database_url="sqlite+aiosqlite://", jwt_secret=TEST_JWT_SECRET)
    # in-memory sqlite: create tables through the same Database the seeder will use
    from arena.db import Database
    from arena.db.migrate import create_all as _create_all

    db = Database(settings)
    await _create_all(db.engine)
    text = await seed(settings, CreateGame(scenario="equal", bots=parse_bots(["usa:idle"])), db)
    await db.dispose()
    assert "host code:  HOST-" in text and "usa      США" in text and "bot (bot)" in text
    with pytest.raises(SystemExit):
        parse_bots(["usa"])
