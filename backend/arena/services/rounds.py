"""Round lifecycle: what a country sees and may do, order submission, round resolution.

``resolve_round`` is the one place where the engine changes persisted state. It runs
in a single transaction with the game row locked (``SELECT ... FOR UPDATE`` on
Postgres), so two simultaneous "resolve" clicks produce one resolution: the second
caller finds the round already resolved and gets a Conflict.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from arena.agents.bots import make_bot
from arena.db.models import Event as EventRow
from arena.db.models import Game, Order, Player, Round, StateSnapshot
from arena.engine.actions import ActionSpace, OrderError, legal_actions, validate
from arena.engine.events import Event, dump_events, load_events
from arena.engine.observe import Observation, observe
from arena.engine.orders import CountryOrders, HostInput, OrderBook
from arena.engine.pipeline import resolve_round as engine_resolve
from arena.engine.state import STATE_SCHEMA_VERSION, GameState
from arena.services.errors import Conflict, InvalidInput, NotFound
from arena.services.games import get_game, load_state, rules_of


class OrdersRejected(InvalidInput):
    def __init__(self, errors: list[OrderError]) -> None:
        super().__init__("orders rejected")
        self.errors = errors


class RoundStatus(BaseModel):
    round: int
    phase: str
    status: str
    submitted: dict[str, bool]  # country -> has submitted (bots always True)
    laugh_winner: str | None


class RoundResult(BaseModel):
    round: int
    events: int
    next_round: int | None
    finished: bool
    standings: list[tuple[str, int]]


# --- reads --------------------------------------------------------------------


async def get_action_space(
    session: AsyncSession, game_id: uuid.UUID, country_id: str
) -> ActionSpace:
    game = await get_game(session, game_id)
    state = await load_state(session, game_id)
    _check_country(state, country_id)
    return legal_actions(state, country_id, rules_of(game))


async def get_observation(
    session: AsyncSession, game_id: uuid.UUID, country_id: str
) -> Observation:
    game = await get_game(session, game_id)
    state = await load_state(session, game_id)
    _check_country(state, country_id)
    news = await load_round_events(session, game_id, game.current_round - 1)
    return observe(state, country_id, news)


async def load_round_events(
    session: AsyncSession, game_id: uuid.UUID, round_number: int
) -> list[Event]:
    if round_number < 1:
        return []
    rows = (
        await session.execute(
            select(EventRow)
            .where(EventRow.game_id == game_id, EventRow.round_number == round_number)
            .order_by(EventRow.seq)
        )
    ).scalars()
    return list(load_events([r.payload for r in rows]))


async def get_round_status(session: AsyncSession, game_id: uuid.UUID) -> RoundStatus:
    game = await get_game(session, game_id)
    rnd = await _current_round(session, game)
    submitted = {
        o.country_id
        for o in (
            await session.execute(
                select(Order).where(
                    Order.game_id == game_id, Order.round_number == game.current_round
                )
            )
        ).scalars()
    }
    return RoundStatus(
        round=game.current_round,
        phase=game.phase,
        status=game.status,
        submitted={
            p.country_id: p.kind != "human" or p.country_id in submitted for p in game.players
        },
        laugh_winner=rnd.laugh_winner,
    )


# --- writes -------------------------------------------------------------------


async def submit_orders(
    session: AsyncSession, game_id: uuid.UUID, country_id: str, orders: CountryOrders
) -> list[OrderError]:
    """Validate against the ActionSpace and store; a resubmission replaces the previous one."""
    game = await get_game(session, game_id)
    if game.phase != "orders":
        raise Conflict(f"orders are closed: game is in phase {game.phase!r}")
    player = next((p for p in game.players if p.country_id == country_id), None)
    if player is None:
        raise NotFound(f"no country {country_id!r} in this game")
    if player.kind != "human":
        raise Conflict(f"{country_id} is controlled by a {player.kind}")
    state = await load_state(session, game_id)
    errors = validate(orders, legal_actions(state, country_id, rules_of(game)))
    if errors:
        raise OrdersRejected(errors)
    row = (
        await session.execute(
            select(Order).where(
                Order.game_id == game_id,
                Order.round_number == game.current_round,
                Order.country_id == country_id,
            )
        )
    ).scalar_one_or_none()
    payload = orders.model_dump(mode="json")
    if row is None:
        session.add(
            Order(
                game_id=game_id,
                round_number=game.current_round,
                country_id=country_id,
                payload=payload,
            )
        )
    else:
        row.payload = payload
        row.submitted_at = datetime.now(UTC)
    await session.commit()
    return []


async def set_laugh_winner(
    session: AsyncSession, game_id: uuid.UUID, country_id: str | None
) -> None:
    game = await get_game(session, game_id)
    if country_id is not None and country_id not in {p.country_id for p in game.players}:
        raise NotFound(f"no country {country_id!r} in this game")
    rnd = await _current_round(session, game)
    rnd.laugh_winner = country_id
    await session.commit()


async def resolve_round(
    session: AsyncSession, game_id: uuid.UUID, expected_round: int | None = None
) -> RoundResult:
    """Resolve the current round atomically.

    ``expected_round`` is the round the caller believes is open (the one the host sees
    on screen). If the game has already moved on - a second click, a retried request,
    a concurrent host tab - the call fails with Conflict instead of resolving the next
    round. Concurrent calls queue on the game row lock, so the check is exact.
    """
    # Lock the game row for the whole transaction (no-op on SQLite, real lock on Postgres).
    game = (
        await session.execute(select(Game).where(Game.id == game_id).with_for_update())
    ).scalar_one_or_none()
    if game is None:
        raise NotFound(f"game {game_id} not found")
    if game.phase == "done":
        raise Conflict("game is finished")
    if expected_round is not None and expected_round != game.current_round:
        raise Conflict(
            f"round {expected_round} is already resolved; current round is {game.current_round}"
        )
    rnd = await _current_round(session, game)
    if rnd.status == "resolved":
        raise Conflict(f"round {rnd.number} is already resolved")
    rules = rules_of(game)
    state = await load_state(session, game_id, round_number=game.current_round - 1)
    players = (
        (await session.execute(select(Player).where(Player.game_id == game_id))).scalars().all()
    )
    orders = await _collect_orders(session, game, state, players, rules_of(game))
    orders = orders.model_copy(update={"host": HostInput(laugh_winner=rnd.laugh_winner)})

    game.phase = "resolving"
    rnd.status = "resolving"
    await session.flush()

    new_state, events = engine_resolve(state, orders, rules, game.seed)

    session.add_all(
        EventRow(
            game_id=game_id,
            round_number=rnd.number,
            seq=i,
            type=e["type"],
            schema_version=e["schema_version"],
            actor=e.get("actor"),
            target=e.get("target"),
            payload=e,
        )
        for i, e in enumerate(dump_events(events))
    )
    session.add(
        StateSnapshot(
            game_id=game_id,
            round_number=rnd.number,
            state_schema_version=STATE_SCHEMA_VERSION,
            state=new_state.model_dump(mode="json"),
        )
    )
    rnd.status = "resolved"
    rnd.resolved_at = datetime.now(UTC)
    finished = rnd.number >= rules.params.rounds
    if finished:
        game.status, game.phase = "finished", "done"
        next_round = None
    else:
        game.status, game.phase = "running", "orders"
        game.current_round = rnd.number + 1
        session.add(Round(game_id=game_id, number=game.current_round))
        next_round = game.current_round
    await session.commit()
    standings = sorted(
        ((c.id, c.average_life_level) for c in new_state.countries), key=lambda x: -x[1]
    )
    return RoundResult(
        round=rnd.number,
        events=len(events),
        next_round=next_round,
        finished=finished,
        standings=standings,
    )


# --- helpers ------------------------------------------------------------------


def _check_country(state: GameState, country_id: str) -> None:
    try:
        state.country(country_id)
    except KeyError:
        raise NotFound(f"no country {country_id!r} in this game") from None


async def _current_round(session: AsyncSession, game: Game) -> Round:
    rnd = (
        await session.execute(
            select(Round).where(Round.game_id == game.id, Round.number == game.current_round)
        )
    ).scalar_one_or_none()
    if rnd is None:
        raise NotFound(f"round {game.current_round} of game {game.id} not found")
    return rnd


async def _collect_orders(
    session: AsyncSession,
    game: Game,
    state: GameState,
    players: Sequence[Player],
    rules: object,
) -> OrderBook:
    """Human orders from the database; bot orders from the bot, given the same views."""
    from arena.engine.rules import RuleSet

    assert isinstance(rules, RuleSet)
    stored = {
        o.country_id: CountryOrders.model_validate(o.payload)
        for o in (
            await session.execute(
                select(Order).where(
                    Order.game_id == game.id, Order.round_number == game.current_round
                )
            )
        ).scalars()
    }
    news = await load_round_events(session, game.id, game.current_round - 1)
    book: dict[str, CountryOrders] = {}
    for i, p in enumerate(sorted(players, key=lambda p: p.country_id)):
        if p.kind == "human":
            if p.country_id in stored:
                book[p.country_id] = stored[p.country_id]
        elif p.kind == "bot":
            # Bots are re-created every round from the persisted config: they keep no memory
            # between HTTP requests (Avenger's grudges reset each round - accepted for v1.0).
            bot = make_bot(str(p.agent_config.get("bot", "idle")), seed=game.seed * 100 + i)
            obs = observe(state, p.country_id, news)
            book[p.country_id] = bot.act(obs, legal_actions(state, p.country_id, rules))
    return OrderBook(orders=book)
