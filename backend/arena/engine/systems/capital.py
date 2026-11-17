"""capital: the world pool of private capital (GAME_RULES_2.md 5, section 15 step 15).

    Пул = base x экология / 100
    Доля = Пул x вес страны / Сумма весов x (1 ± колебания)

The pool breathes with the planet's health: when ecology collapses, private
capital vanishes for everyone. The share follows the investment rating set by
``rating`` earlier in the pipeline. Market noise (±jitter %) is drawn from this
system's own RNG stream, so replays and golden tests stay exact.

Runs right after ``income``; the money lands in the budget with a private event —
only the recipient sees its amount, like every other budget line.
"""

from __future__ import annotations

from arena.engine.events import Event, PrivateInvestmentsCredited
from arena.engine.orders import OrderBook
from arena.engine.state import GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("capital")
class CapitalSystem(BaseSystem):
    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        p = self.rules.params.private_pool
        pool = p.base * state.ecology // 100 if state.ecology > 0 else 0
        if pool <= 0:
            return []  # collapse: no private capital, no news line
        total_weight = sum(c.rating_weight for c in state.countries)
        if total_weight <= 0:
            return []
        events: list[Event] = []
        rng = self.rng(ctx)
        # Sorted by id: the same seed always draws the same jitter for the same country.
        for country in sorted(state.countries, key=lambda c: c.id):
            # v2 trait (GAME_RULES_2.md 9): «Финансовый центр» — the financial
            # market earns the USA one extra weight unit in the pool.
            weight = country.rating_weight
            if self.rules.is_v2() and country.has("financial_center"):
                weight += 1
            share = pool * weight / total_weight
            jitter = 1.0 + float(rng.uniform(-p.jitter_percent, p.jitter_percent)) / 100
            amount = round(share * jitter)
            if amount <= 0:
                continue
            country.budget += amount
            events.append(
                PrivateInvestmentsCredited(
                    round=ctx.round,
                    actor=country.id,
                    amount=amount,
                    pool=pool,
                    budget_after=country.budget,
                )
            )
        return events
