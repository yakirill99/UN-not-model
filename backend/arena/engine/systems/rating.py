"""rating: the investment rating (GAME_RULES_2.md 5, section 15 step 13).

    Оценка = 0.5 x Устойчивость + 0.5 x Средний УЖ + Модификаторы

The score is kept in hundredths of a point (the state convention), the published
``score`` is whole points. Nuclear strikes are deliberately absent: they are
anonymous, and a rating drop would give the attacker away (the exception — an
attacker exposed by an investigation — arrives with the resolutions module).

Runs after ``stability`` (fresh stability) and before ``income``/``capital``:
``capital`` splits the pool by the weights printed here.
"""

from __future__ import annotations

from arena.engine.events import Event, RatingUpdated
from arena.engine.orders import OrderBook
from arena.engine.state import GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register, round_half_away


@register("rating")
class RatingSystem(BaseSystem):
    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        p = self.rules.params.rating
        bands = sorted(p.levels, key=lambda b: -b.min)
        events: list[Event] = []
        for country in state.countries:
            approved = ctx.approved[country.id]
            # 0.5 x stability + 0.5 x average life, in hundredths of a point.
            score = 50 * country.stability + country.average_life_level // 2
            # Modifiers are whole points; sanctions stack per active sanction.
            score += 100 * (
                len(country.sanctioned_by) * p.sanction
                + (p.nuclear_tech if country.nuclear_tech else 0)
                + approved.bombs * p.bomb
                + (p.eco_program if approved.eco_programs else 0)
            )

            level, weight = bands[-1].level, bands[-1].weight
            for band in bands:
                if score / 100 >= band.min:
                    level, weight = band.level, band.weight
                    break
            country.rating_score = round_half_away(score, 100)
            country.rating = level
            country.rating_weight = weight
            events.append(
                RatingUpdated(
                    round=ctx.round,
                    target=country.id,
                    score=country.rating_score,
                    level=level,
                    weight=weight,
                )
            )
        return events
