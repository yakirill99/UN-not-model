"""clamp: keep ecology inside params.ecology and city development >= 0 (section 12, step 9)."""

from __future__ import annotations

from arena.engine.events import EcologyChanged, Event
from arena.engine.orders import OrderBook
from arena.engine.state import GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("clamp")
class ClampSystem(BaseSystem):
    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        events: list[Event] = []
        bounds = self.rules.params.ecology
        clamped = min(max(state.ecology, bounds.min), bounds.max)
        if clamped != state.ecology:
            delta = clamped - state.ecology
            state.ecology = clamped
            events.append(
                EcologyChanged(round=ctx.round, cause="clamp", delta=delta, ecology_after=clamped)
            )
        for country in state.countries:
            for city in country.cities:
                if city.development < 0:
                    city.development = 0
        return events
