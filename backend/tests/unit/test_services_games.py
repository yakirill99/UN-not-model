"""create_game freezes rules and state; codes join the right role; bots are pre-joined."""

import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from arena.db.migrate import create_all
from arena.services.auth import Principal, decode_token, issue_token, new_code
from arena.services.errors import Conflict, Forbidden, InvalidInput, NotFound
from arena.services.games import (
    BotSlot,
    CreateGame,
    create_game,
    get_game,
    join,
    load_state,
    rules_of,
)
from arena.settings import Settings

SETTINGS = Settings(env="test", database_url="sqlite+aiosqlite://", jwt_secret="test-secret-123")


@pytest.fixture
async def session():  # type: ignore[no-untyped-def]
    engine = create_async_engine("sqlite+aiosqlite://")
    await create_all(engine)
    async with async_sessionmaker(engine, expire_on_commit=False)() as s:
        yield s
    await engine.dispose()


async def test_create_game_freezes_rules_and_initial_state(session) -> None:  # type: ignore[no-untyped-def]
    info = await create_game(
        session,
        CreateGame(
            rules="v1.0",
            scenario="smolny",
            seed=3,
            overrides={"actions": {"bomb": {"cost": 300}}},
            bots=[BotSlot(country_id="dprk", bot="aggressor")],
        ),
        SETTINGS,
    )
    assert (
        info.status == "lobby"
        and info.current_round == 1
        and info.rounds_total == 6
        and info.phase == "orders"
    )
    assert info.host_code and info.host_code.startswith("HOST-")
    assert [p.country_id for p in info.players] == ["dprk", "france", "iran", "russia", "usa"]
    dprk = next(p for p in info.players if p.country_id == "dprk")
    assert dprk.kind == "bot" and dprk.joined and dprk.join_code
    game = await get_game(session, info.id)
    assert rules_of(game).cost("bomb") == 300  # override applied to the frozen snapshot
    state = await load_state(session, info.id)
    assert (
        state.round == 1
        and state.country("dprk").nuclear_tech
        and state.country("russia").budget == 1445
    )


async def test_create_game_validates_input(session) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(InvalidInput, match="not found"):
        await create_game(session, CreateGame(rules="v9.9"), SETTINGS)
    with pytest.raises(InvalidInput, match="unknown countries"):
        await create_game(
            session, CreateGame(bots=[BotSlot(country_id="mars", bot="idle")]), SETTINGS
        )
    with pytest.raises(InvalidInput, match="unknown bots"):
        await create_game(
            session, CreateGame(bots=[BotSlot(country_id="usa", bot="hal")]), SETTINGS
        )
    with pytest.raises(InvalidInput):
        await create_game(session, CreateGame(overrides={"params": {"roundz": 1}}), SETTINGS)


async def test_join_with_codes(session) -> None:  # type: ignore[no-untyped-def]
    info = await create_game(
        session,
        CreateGame(scenario="equal", bots=[BotSlot(country_id="iran", bot="idle")]),
        SETTINGS,
    )
    assert info.host_code is not None
    host = await join(session, info.host_code.lower())  # case-insensitive
    assert host.role == "host" and host.game_id == info.id and host.country_id is None
    usa_code = next(p.join_code for p in info.players if p.country_id == "usa")
    assert usa_code is not None
    player = await join(session, usa_code)
    assert player.role == "player" and player.country_id == "usa"
    assert (await get_game(session, info.id)).players and next(
        p for p in (await get_game(session, info.id)).players if p.country_id == "usa"
    ).joined_at
    with pytest.raises(NotFound):
        await join(session, "NOPE-XXXXXX")
    iran_code = next(p.join_code for p in info.players if p.country_id == "iran")
    with pytest.raises(Conflict, match="bot"):
        await join(session, iran_code or "")


def test_jwt_round_trip_and_tamper() -> None:
    p = Principal(game_id=uuid.uuid4(), role="player", country_id="usa")
    token = issue_token(p, SETTINGS)
    assert decode_token(token, SETTINGS) == p
    with pytest.raises(Forbidden):
        decode_token(token + "x", SETTINGS)
    with pytest.raises(Forbidden):
        decode_token(token, SETTINGS.model_copy(update={"jwt_secret": "another-secret-1"}))
    with pytest.raises(Forbidden):
        Principal(game_id=p.game_id, role="host").require_country()


def test_codes_are_readable_and_unique() -> None:
    codes = {new_code("RUS") for _ in range(200)}
    assert len(codes) == 200 and all(c.startswith("RUS-") and len(c) == 10 for c in codes)
    assert not any(ch in "0O1I" for c in codes for ch in c[4:])
