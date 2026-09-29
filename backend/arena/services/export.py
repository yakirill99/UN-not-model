"""Export a game from the database as an engine GameLog, and replay it.

The log is built only from what the database holds - snapshots, orders (humans and
bots), host input and events - so a clean replay proves the API resolved every round
exactly as the engine would.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from arena.db.models import Order, Round, StateSnapshot
from arena.engine.orders import CountryOrders, HostInput, OrderBook
from arena.engine.runner import Divergence, GameLog, RoundRecord
from arena.engine.runner import replay as engine_replay
from arena.engine.state import GameState
from arena.services.errors import NotFound
from arena.services.games import get_game, rules_of
from arena.services.rounds import load_round_events


async def export_log(session: AsyncSession, game_id: uuid.UUID) -> GameLog:
    game = await get_game(session, game_id)
    snaps = {
        s.round_number: GameState.model_validate(s.state)
        for s in (
            await session.execute(select(StateSnapshot).where(StateSnapshot.game_id == game_id))
        ).scalars()
    }
    if 0 not in snaps:
        raise NotFound(f"game {game_id} has no initial snapshot")
    rounds = {
        r.number: r
        for r in (await session.execute(select(Round).where(Round.game_id == game_id))).scalars()
    }
    orders_rows = (await session.execute(select(Order).where(Order.game_id == game_id))).scalars()
    orders_by_round: dict[int, dict[str, CountryOrders]] = {}
    for o in orders_rows:
        orders_by_round.setdefault(o.round_number, {})[o.country_id] = CountryOrders.model_validate(
            o.payload
        )
    log = GameLog(
        rules_version=game.rules_version,
        rules_snapshot=rules_of(game),
        scenario_id=game.scenario_id,
        seed=game.seed,
        initial_state=snaps[0],
    )
    for n in sorted(k for k in snaps if k > 0):
        rnd = rounds.get(n)
        log.rounds.append(
            RoundRecord(
                round=n,
                orders=OrderBook(
                    orders=orders_by_round.get(n, {}),
                    host=HostInput(laugh_winner=rnd.laugh_winner if rnd else None),
                ),
                events=await load_round_events(session, game_id, n),
                state_after=snaps[n],
            )
        )
    return log


async def replay_game(session: AsyncSession, game_id: uuid.UUID) -> list[Divergence]:
    return engine_replay(await export_log(session, game_id))
