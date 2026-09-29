"""Models and the first migration agree; constraints hold; JSON round-trips."""

import uuid
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from arena.db import Base
from arena.db.migrate import create_all, upgrade_head
from arena.db.models import Event, Game, Order, Player, Round, StateSnapshot


def test_migration_matches_models(tmp_path: Path) -> None:
    """After `alembic upgrade head` autogenerate has nothing left to add."""
    url = f"sqlite:///{tmp_path / 'm.db'}"
    upgrade_head(url.replace("sqlite://", "sqlite+aiosqlite://"))
    engine = create_engine(url)
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn, opts={"compare_type": True, "render_as_batch": True})
        diff = compare_metadata(ctx, Base.metadata)
    assert diff == [], diff


@pytest.fixture
async def session():  # type: ignore[no-untyped-def]
    engine = create_async_engine("sqlite+aiosqlite://")
    await create_all(engine)
    async with async_sessionmaker(engine, expire_on_commit=False)() as s:
        yield s
    await engine.dispose()


def _game() -> Game:
    return Game(
        rules_version="1.0.0",
        rules_snapshot={"version": "1.0.0"},
        scenario_id="equal",
        seed=7,
        host_code="HOST-1",
    )


async def test_game_players_rounds_round_trip(session) -> None:  # type: ignore[no-untyped-def]
    g = _game()
    g.players = [
        Player(country_id="russia", join_code="RU-1"),
        Player(country_id="usa", join_code="US-1", kind="bot", agent_config={"bot": "aggressor"}),
    ]
    g.rounds = [Round(number=1)]
    session.add(g)
    await session.commit()
    loaded = (await session.execute(select(Game))).scalar_one()
    assert loaded.id == g.id and loaded.status == "lobby" and loaded.current_round == 1
    players = (await session.execute(select(Player).order_by(Player.country_id))).scalars().all()
    assert [p.country_id for p in players] == ["russia", "usa"]
    assert players[1].agent_config == {"bot": "aggressor"}


async def test_unique_constraints(session) -> None:  # type: ignore[no-untyped-def]
    g = _game()
    session.add(g)
    await session.commit()
    gid = g.id  # after a rollback the instance is expired: read ids before, never after
    session.add(Order(game_id=gid, round_number=1, country_id="usa", payload={}))
    await session.commit()
    session.add(Order(game_id=gid, round_number=1, country_id="usa", payload={"invest": ["x"]}))
    with pytest.raises(IntegrityError):
        await session.commit()
    await session.rollback()
    session.add(Player(game_id=gid, country_id="usa", join_code="A"))
    session.add(Player(game_id=gid, country_id="usa", join_code="B"))
    with pytest.raises(IntegrityError):
        await session.commit()
    await session.rollback()


async def test_events_and_snapshots_keep_json(session) -> None:  # type: ignore[no-untyped-def]
    g = _game()
    session.add(g)
    await session.commit()
    session.add(
        StateSnapshot(
            game_id=g.id,
            round_number=0,
            state_schema_version=1,
            state={"round": 1, "countries": []},
        )
    )
    session.add_all(
        Event(
            game_id=g.id,
            round_number=1,
            seq=i,
            type="budget_spent",
            schema_version=1,
            actor="usa",
            payload={"amount": i},
        )
        for i in range(3)
    )
    await session.commit()
    events = (await session.execute(select(Event).order_by(Event.seq))).scalars().all()
    assert [e.payload["amount"] for e in events] == [0, 1, 2] and events[0].id is not None
    snap = (await session.execute(select(StateSnapshot))).scalar_one()
    assert snap.state["round"] == 1


async def test_cascade_delete(session) -> None:  # type: ignore[no-untyped-def]
    g = _game()
    g.players = [Player(country_id="iran", join_code="IR")]
    session.add(g)
    await session.commit()
    await session.delete(g)
    await session.commit()
    assert (await session.execute(select(Player))).scalars().all() == []
    assert uuid.UUID(str(g.id))
