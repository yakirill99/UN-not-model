"""sanctions: -N development to every alive city of the target (section 12, step 8).

Free action, so ``budget`` does not see it; validation lives here. Sanctions from
several countries stack; a duplicate target in one order counts once. The target
learns who sanctioned it (``sanctioned_by``), reset by ``end_of_round``.
"""

from __future__ import annotations

from arena.engine.events import Event, OrderRejected, SanctionApplied
from arena.engine.orders import OrderBook
from arena.engine.state import GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("sanctions")
class SanctionsSystem(BaseSystem):
    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        events: list[Event] = []
        delta = self.rules.effect("sanction", "development_all_cities")
        known = {c.id for c in state.countries}
        for actor in state.countries:
            seen: set[str] = set()
            for target_id in ctx.approved[actor.id].sanctions:
                reason = None
                if target_id == actor.id:
                    reason = "self_target"
                elif target_id not in known:
                    reason = "unknown_country"
                elif target_id in seen:
                    reason = "duplicate"
                if reason:
                    events.append(
                        OrderRejected(
                            round=ctx.round,
                            actor=actor.id,
                            target=target_id,
                            action="sanction",
                            reason=reason,
                        )
                    )
                    continue
                seen.add(target_id)
                target = state.country(target_id)
                for city in target.alive_cities:
                    city.development += delta
                target.sanctioned_by.append(actor.id)
                events.append(
                    SanctionApplied(round=ctx.round, actor=actor.id, target=target_id, delta=delta)
                )
        return events
