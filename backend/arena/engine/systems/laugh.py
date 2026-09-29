"""laugh: the host's pick of the round gets +laugh_bonus (GAME_RULES.md 4.10, section 12 step 12).

The coefficient accumulates over the game. It is read by ``life_level``; with the
v1.0 pipeline order it therefore affects the *next* round's life level.
"""

from __future__ import annotations

from arena.engine.events import Event, LaughAwarded, OrderRejected
from arena.engine.orders import OrderBook
from arena.engine.state import GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("laugh")
class LaughSystem(BaseSystem):
    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        winner_id = orders.host.laugh_winner
        if winner_id is None:
            return []
        try:
            winner = state.country(winner_id)
        except KeyError:
            return [
                OrderRejected(
                    round=ctx.round,
                    actor=None,
                    target=winner_id,
                    action="laugh",
                    reason="unknown_country",
                )
            ]
        bonus = self.rules.params.laugh_bonus
        winner.laugh += bonus
        return [
            LaughAwarded(round=ctx.round, target=winner_id, bonus=bonus, laugh_after=winner.laugh)
        ]
