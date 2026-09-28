"""life_level: recompute the life level of every city (GAME_RULES.md section 5).

    life_level x 100 = w_d x development + w_e x ecology + w_l x laugh

with all indicators in percent and weights from ``params.life_weights`` (33 means
0.33). Example from the rules: development 65, ecology 100, laugh 0 -> 5445 = 54.45 %.
A destroyed city has life level 0 and still counts in the country's average.
"""

from __future__ import annotations

from arena.engine.events import Event, LifeLevelComputed
from arena.engine.orders import OrderBook
from arena.engine.state import GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("life_level")
class LifeLevelSystem(BaseSystem):
    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        w = self.rules.params.life_weights
        events: list[Event] = []
        for country in state.countries:
            for city in country.cities:
                if city.destroyed:
                    city.life_level = 0
                else:
                    city.life_level = (
                        w.development * city.development
                        + w.ecology * state.ecology
                        + w.laugh * country.laugh
                    )
                events.append(
                    LifeLevelComputed(
                        round=ctx.round,
                        actor=country.id,
                        target=city.id,
                        life_level=city.life_level,
                    )
                )
        return events
