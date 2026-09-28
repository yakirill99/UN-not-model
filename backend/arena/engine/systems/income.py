"""income: credit each country with the income of its cities (section 12, step 11).

    city income = (k_development x development + k_ecology x ecology) / 100

with coefficients from ``params.income``. Example from the rules: development 65,
ecology 100 -> 65 + 150 = 215 $. A destroyed city earns nothing. Income is computed
from the *new* indicators, so this system runs after develop/strikes/clamp.
"""

from __future__ import annotations

from arena.engine.events import Event, IncomeCredited
from arena.engine.orders import OrderBook
from arena.engine.state import City, GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("income")
class IncomeSystem(BaseSystem):
    def city_income(self, city: City, ecology: int) -> int:
        if city.destroyed:
            return 0
        k = self.rules.params.income
        return (k.k_development * city.development + k.k_ecology * ecology) // 100

    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        events: list[Event] = []
        for country in state.countries:
            amount = sum(self.city_income(c, state.ecology) for c in country.cities)
            country.budget += amount
            events.append(
                IncomeCredited(
                    round=ctx.round, actor=country.id, amount=amount, budget_after=country.budget
                )
            )
        return events
