"""develop: city investments and ecological programs (GAME_RULES.md section 12, step 6).

Numbers come from ``actions.invest.effect.development`` and
``actions.eco_program.effect.ecology``; ``clamp`` bounds the result afterwards.
"""

from __future__ import annotations

from arena.engine.events import CityInvested, EcologyChanged, Event
from arena.engine.orders import OrderBook
from arena.engine.state import GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("develop")
class DevelopSystem(BaseSystem):
    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        events: list[Event] = []
        gain = self.rules.effect("invest", "development")
        eco_gain = self.rules.effect("eco_program", "ecology")
        for country in state.countries:
            approved = ctx.approved[country.id]
            for city_id in approved.invest:
                city = country.city(city_id)
                before = city.development
                city.development += gain
                events.append(
                    CityInvested(
                        round=ctx.round,
                        actor=country.id,
                        target=city_id,
                        development_before=before,
                        development_after=city.development,
                    )
                )
            for _ in range(approved.eco_programs):
                state.ecology += eco_gain
                events.append(
                    EcologyChanged(
                        round=ctx.round,
                        actor=country.id,
                        cause="eco_program",
                        delta=eco_gain,
                        ecology_after=state.ecology,
                    )
                )
        return events
