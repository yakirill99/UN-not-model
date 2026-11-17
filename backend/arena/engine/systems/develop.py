"""develop: city investments and ecological programs (GAME_RULES.md section 12, step 6).

Numbers come from ``actions.invest.effect.development`` and
``actions.eco_program.effect.ecology``; ``clamp`` bounds the result afterwards.

v2 (``params.invest_returns``): diminishing returns — while a city is below the
tier's ``up_to`` the tier's ``gain`` applies, so helping laggards beats pumping
one leader (GAME_RULES_2.md 13). ``None`` keeps the flat v1 effect.
"""

from __future__ import annotations

from arena.engine.events import CityInvested, EcologyChanged, Event
from arena.engine.orders import OrderBook
from arena.engine.rules import InvestReturn
from arena.engine.state import GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("develop")
class DevelopSystem(BaseSystem):
    def _gain(self, development: int) -> int:
        """The investment gain for a city at ``development`` percent."""
        tiers = self.rules.params.invest_returns
        if tiers is None:
            return self.rules.effect("invest", "development")
        tier: InvestReturn | None = None
        for t in tiers:
            tier = t
            if t.up_to is None or development < t.up_to:
                break
        return tier.gain if tier is not None else 0

    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        events: list[Event] = []
        eco_gain = self.rules.effect("eco_program", "ecology")
        for country in state.countries:
            approved = ctx.approved[country.id]
            for city_id in approved.invest:
                city = country.city(city_id)
                before = city.development
                city.development += self._gain(before)
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
