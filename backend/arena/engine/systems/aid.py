"""aid: transfer approved aid to recipients (section 12, step 4; decision 14).

Money was already deducted from the sender by ``budget``; here it lands in the
recipient's ``aid_pending`` and becomes spendable in ``end_of_round``. The total
amount of money in the world is preserved.
"""

from __future__ import annotations

from arena.engine.events import AidTransferred, Event
from arena.engine.orders import OrderBook
from arena.engine.state import GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("aid")
class AidSystem(BaseSystem):
    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        events: list[Event] = []
        for sender in state.countries:
            for recipient_id, amount in ctx.approved[sender.id].aid.items():
                state.country(recipient_id).aid_pending += amount
                events.append(
                    AidTransferred(
                        round=ctx.round, actor=sender.id, target=recipient_id, amount=amount
                    )
                )
        return events
