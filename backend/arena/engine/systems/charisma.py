"""charisma: the host's pick of the round gains stability (GAME_RULES_2.md 4, 13).

Replaces the v1 laugh coefficient («Коэффициент смеха»): the bonus moves from the
life level to stability, so a funny team no longer bends the main indicator —
«каждое нововведение что-то заменяет». Same host input (``HostInput.laugh_winner``,
persisted as ``Round.laugh_winner``), same slot in the pipeline.
"""

from __future__ import annotations

from arena.engine.events import CharismaAwarded, Event, OrderRejected
from arena.engine.orders import OrderBook
from arena.engine.state import GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("charisma")
class CharismaSystem(BaseSystem):
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
                    target=winner_id,
                    action="charisma",
                    reason="unknown_country",
                )
            ]
        bonus = self.rules.params.charisma_bonus
        winner.stability = max(0, min(100, winner.stability + bonus))
        return [
            CharismaAwarded(
                round=ctx.round, target=winner_id, bonus=bonus, stability_after=winner.stability
            )
        ]
