"""end_of_round: release pending resources, lift yearly effects, advance the round.

Section 12 step 13 plus decisions 10 and 14: bombs produced this round become
usable, aid received this round becomes spendable, sanctions of this year are
reset. Shields stay until a strike consumes them. ``round`` is incremented last.
"""

from __future__ import annotations

from arena.engine.events import Event, RoundEnded
from arena.engine.orders import OrderBook
from arena.engine.state import GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("end_of_round")
class EndOfRoundSystem(BaseSystem):
    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        events: list[Event] = []
        for c in state.countries:
            bombs, aid, lifted = c.bombs_pending, c.aid_pending, len(c.sanctioned_by)
            c.bombs += bombs
            c.bombs_pending = 0
            c.budget += aid
            c.aid_pending = 0
            c.sanctioned_by = []
            events.append(
                RoundEnded(
                    round=ctx.round,
                    actor=c.id,
                    bombs_released=bombs,
                    aid_credited=aid,
                    sanctions_lifted=lifted,
                    budget_after=c.budget,
                )
            )
        state.round += 1
        return events
