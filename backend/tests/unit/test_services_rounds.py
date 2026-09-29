"""Rounds: observation/action space, order validation and replacement, resolve, idempotency."""

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from arena.db.migrate import create_all
from arena.db.models import Event, StateSnapshot
from arena.engine.orders import CountryOrders
from arena.services.errors import Conflict, NotFound
from arena.services.games import BotSlot, CreateGame, create_game, load_state
from arena.services.rounds import (
    OrdersRejected,
    get_action_space,
    get_observation,
    get_round_status,
    resolve_round,
    set_laugh_winner,
    submit_orders,
)
from arena.settings import Settings
from tests.conftest import TEST_JWT_SECRET

SETTINGS = Settings(
    env="test",
    database_url="sqlite+aiosqlite://",
    jwt_secret=TEST_JWT_SECRET,
)


@pytest.fixture
async def session():  # type: ignore[no-untyped-def]
    engine = create_async_engine("sqlite+aiosqlite://")
    await create_all(engine)
    async with async_sessionmaker(engine, expire_on_commit=False)() as s:
        yield s
    await engine.dispose()


@pytest.fixture
async def game(session):  # type: ignore[no-untyped-def]
    return await create_game(
        session,
        CreateGame(
            scenario="equal",
            seed=5,
            bots=[
                BotSlot(country_id="iran", bot="aggressor"),
                BotSlot(country_id="dprk", bot="economist"),
            ],
        ),
        SETTINGS,
    )


async def test_observation_and_action_space(session, game) -> None:  # type: ignore[no-untyped-def]
    obs = await get_observation(session, game.id, "usa")
    assert obs.me.id == "usa" and obs.round == 1 and obs.news == []
    assert {o.id for o in obs.others} == {"russia", "france", "iran", "dprk"}
    space = await get_action_space(session, game.id, "usa")
    assert space.budget == 1000 and space.actions["invest"].targets
    with pytest.raises(NotFound):
        await get_observation(session, game.id, "mars")


async def test_submit_validates_and_replaces(session, game) -> None:  # type: ignore[no-untyped-def]
    with pytest.raises(OrdersRejected) as exc:
        await submit_orders(session, game.id, "usa", CountryOrders(invest=["moscow"], bombs=1))
    reasons = {(e.action, e.reason) for e in exc.value.errors}
    assert ("invest", "invalid_target") in reasons and ("bomb", "requires_nuclear_tech") in reasons
    assert await submit_orders(session, game.id, "usa", CountryOrders(invest=["washington"])) == []
    assert (
        await submit_orders(session, game.id, "usa", CountryOrders(eco_programs=1)) == []
    )  # replaces
    status = await get_round_status(session, game.id)
    assert status.submitted == {
        "dprk": True,
        "france": False,
        "iran": True,
        "russia": False,
        "usa": True,
    }
    with pytest.raises(Conflict, match="bot"):
        await submit_orders(session, game.id, "iran", CountryOrders())


async def test_resolve_round_applies_orders_and_bots(session, game) -> None:  # type: ignore[no-untyped-def]
    await submit_orders(session, game.id, "usa", CountryOrders(invest=["washington", "chicago"]))
    await set_laugh_winner(session, game.id, "france")
    result = await resolve_round(session, game.id)
    assert (
        result.round == 1 and result.next_round == 2 and not result.finished and result.events > 0
    )
    state = await load_state(session, game.id)
    assert state.round == 2
    assert state.find_city("washington")[1].development == 75
    assert 1000 - 300 < state.country("usa").budget < 1000 - 300 + 4 * 210  # income at eco < 100
    assert state.country("france").laugh == 20
    assert state.country("iran").nuclear_tech  # the aggressor bot acted
    assert state.country("dprk").budget < 1000 + 840  # the economist bot invested
    status = await get_round_status(session, game.id)
    assert status.round == 2 and status.phase == "orders" and status.laugh_winner is None
    obs = await get_observation(session, game.id, "france")
    assert any(e.type == "laugh_awarded" for e in obs.news)
    n_events = (await session.execute(select(func.count()).select_from(Event))).scalar_one()
    assert n_events == result.events
    snaps = (
        (
            await session.execute(
                select(StateSnapshot.round_number).order_by(StateSnapshot.round_number)
            )
        )
        .scalars()
        .all()
    )
    assert snaps == [0, 1]


async def test_resolve_is_idempotent_and_orders_close(session, game) -> None:  # type: ignore[no-untyped-def]
    await resolve_round(session, game.id, expected_round=1)
    with pytest.raises(Conflict, match="round 1 is already resolved"):
        await resolve_round(session, game.id, expected_round=1)  # the double click
    for n in range(2, 7):
        await resolve_round(session, game.id, expected_round=n)
    with pytest.raises(Conflict, match="finished"):
        await resolve_round(session, game.id)
    with pytest.raises(Conflict, match="closed"):
        await submit_orders(session, game.id, "usa", CountryOrders())
    snaps = (await session.execute(select(func.count()).select_from(StateSnapshot))).scalar_one()
    assert snaps == 7  # initial + 6 rounds


async def test_full_game_matches_engine(session) -> None:  # type: ignore[no-untyped-def]
    """An all-bot game through the services equals the same game driven by the engine directly.

    The service re-creates bots every round (they keep no memory between requests), so
    the reference loop does the same; a GameLog replay in #47 is the second check.
    """
    from arena.agents.bots import make_bot
    from arena.engine.actions import legal_actions
    from arena.engine.observe import observe
    from arena.engine.orders import OrderBook
    from arena.engine.pipeline import resolve_round as engine_resolve
    from arena.engine.rules import load_rules
    from arena.engine.scenario import load_scenario
    from tests.conftest import REPO_ROOT

    lineup = {
        "dprk": "economist",
        "france": "ecologist",
        "iran": "aggressor",
        "russia": "avenger",
        "usa": "random",
    }
    g = await create_game(
        session,
        CreateGame(
            scenario="smolny",
            seed=9,
            bots=[BotSlot(country_id=c, bot=b) for c, b in lineup.items()],
        ),
        SETTINGS,
    )
    while not (await resolve_round(session, g.id)).finished:
        pass
    via_api = await load_state(session, g.id)

    rules = load_rules("v1.0", REPO_ROOT / "rules")
    state = load_scenario(REPO_ROOT / "scenarios" / "smolny.yaml").initial_state()
    news: list = []  # type: ignore[type-arg]
    for _ in range(rules.params.rounds):
        book = {}
        for i, (c, b) in enumerate(sorted(lineup.items())):
            bot = make_bot(b, seed=9 * 100 + i)
            book[c] = bot.act(observe(state, c, news), legal_actions(state, c, rules))
        state, news = engine_resolve(state, OrderBook(orders=book), rules, 9)
    assert via_api == state
