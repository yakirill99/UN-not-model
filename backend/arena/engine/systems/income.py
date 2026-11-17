"""income: credit each country with the income of its cities (section 12, step 11).

    city income = (k_development x development + k_ecology x ecology) / 100

with coefficients from ``params.income``. Example from the rules: development 65,
ecology 100 -> 65 + 150 = 215 $. A destroyed city earns nothing. Income is computed
from the *new* indicators, so this system runs after develop/strikes/clamp.

v2 applies two percent modifiers (``income_percent``): the stability band of the
country and the climate catastrophe penalty — both in effect only when the rules
carry the ``v2_core`` module, so v1 games keep their exact v1 numbers.
"""

from __future__ import annotations

from arena.engine.events import Event, IncomeCredited
from arena.engine.orders import OrderBook
from arena.engine.state import City, Country, GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("income")
class IncomeSystem(BaseSystem):
    def city_income(self, city: City, ecology: int) -> int:
        if city.destroyed:
            return 0
        k = self.rules.params.income
        return (k.k_development * city.development + k.k_ecology * ecology) // 100

    def income_percent(self, country: Country, ecology: int) -> int:
        """v2 modifiers (GAME_RULES_2.md 4, 7) as whole percent; 0 in v1.

        Stability band (70+ -> +10 %, crisis -> -30 %) plus the climate penalty
        when the world is below the catastrophe line. Both numbers live in Params.
        """
        if "v2_core" not in self.rules.modules:
            return 0
        total = 0
        for band in sorted(self.rules.params.stability.income_levels, key=lambda b: -b.min):
            if country.stability >= band.min:
                total += band.income_percent
                break
        if ecology < self.rules.params.climate.catastrophe_below:
            total += self.rules.params.climate.catastrophe_income
        return total

    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        events: list[Event] = []
        for country in state.countries:
            gross = sum(self.city_income(c, state.ecology) for c in country.cities)
            percent = self.income_percent(country, state.ecology)
            amount = max(0, (gross * (100 + percent)) // 100)
            # v2 trait (GAME_RULES_2.md 9): «Ресурсная держава» — Russia sells
            # resources whatever happens, a flat bonus on top of the city income.
            if self.rules.is_v2() and country.has("resource_power"):
                amount += self.rules.params.traits.resource_income
            country.budget += amount
            events.append(
                IncomeCredited(
                    round=ctx.round, actor=country.id, amount=amount, budget_after=country.budget
                )
            )
        return events
