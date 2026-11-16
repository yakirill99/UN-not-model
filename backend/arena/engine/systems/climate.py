"""climate: world ecology thresholds (GAME_RULES_2.md 7, section 15 step 9).

Ecology 60-100 % is fine. 30-59 % is instability: one random alive city of every
country loses development — the harm is spread, announced in the news and visible
in advance on the ecology scale. Below 30 % is a catastrophe: everyone loses
stability and income (the income penalty is applied by the income system, which
reads the same ecology). 0 % is collapse — the same penalties, and the pool of
private capital dries up (the capital system reads ecology too).

Runs late in the v2 pipeline (after sanctions, before ``clamp``), so the lost
development lands in the same round's life level.
"""

from __future__ import annotations

from arena.engine.events import ClimateThreshold, Event
from arena.engine.orders import OrderBook
from arena.engine.state import GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("climate")
class ClimateSystem(BaseSystem):
    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        p = self.rules.params.climate
        eco = state.ecology
        if eco >= p.unstable_below:
            return []
        events: list[Event] = []
        rng = self.rng(ctx)
        if eco < p.catastrophe_below:
            level = "collapse" if eco == 0 else "catastrophe"
            for country in state.countries:
                country.stability = max(0, min(100, country.stability + p.catastrophe_stability))
                events.append(
                    ClimateThreshold(
                        round=ctx.round,
                        target=country.id,
                        level=level,
                        stability_delta=p.catastrophe_stability,
                    )
                )
        else:
            for country in state.countries:
                alive = country.alive_cities
                if not alive:
                    continue
                city = alive[int(rng.integers(len(alive)))]
                city.development -= p.unstable_city_loss
                events.append(
                    ClimateThreshold(
                        round=ctx.round,
                        target=city.id,
                        level="unstable",
                        development_delta=-p.unstable_city_loss,
                    )
                )
        return events
