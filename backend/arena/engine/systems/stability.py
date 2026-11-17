"""stability: political stability, the round update (GAME_RULES_2.md 4, 15 step 12).

    ΔУстойчивость = Динамика + Уровень + Потрясения + Действия

Runs after ``life_level`` (needs this round's average life) and before ``income``
(the income modifier reads the resulting stability). Every term is written into
the event, so the player sees «почему упала устойчивость» without doing any math.

A result of exactly 0 is «Смена власти»: the team does not leave the game, but
the budget halves, the next round's strikes (and votes) are refused, stability
restarts from the reset value and the final score carries -10 per collapse.
"""

from __future__ import annotations

from arena.engine.events import Event, PowerChanged, StabilityChanged
from arena.engine.orders import OrderBook
from arena.engine.state import GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register, round_half_away


@register("stability")
class StabilitySystem(BaseSystem):
    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        p = self.rules.params.stability
        t = self.rules.params.traits
        events: list[Event] = []
        for country in state.countries:
            approved = ctx.approved[country.id]
            before = country.stability
            avg = country.average_life_level  # hundredths of a percent

            # Динамика: the people react to the change of life, not only to its level
            # — a fast fall from a high level angers more than stable poverty. The
            # electoral_cycle trait (USA) makes the reaction sharper (0.75, not 0.5).
            dynamics_percent = p.dynamics_percent
            if self.rules.is_v2() and country.has("electoral_cycle"):
                dynamics_percent = t.electoral_dynamics_percent
            dynamics = 0
            if country.average_life_prev is not None:
                dynamics = round_half_away(
                    (avg - country.average_life_prev) * dynamics_percent, 10000
                )

            # Уровень: how life feels right now.
            avg_percent = avg / 100
            level_effect = (
                p.good_bonus
                if avg_percent >= p.good_life
                else p.poor_penalty
                if avg_percent < p.poor_life
                else 0
            )

            # Потрясения: every active sanction (unless the mobilization economy
            # shrugs them off, or «Опыт жизни под санкциями» halves them), and
            # cities lost this round — the first loss rallies the nation around
            # the flag, the next ones hurt. The eco_agenda trait (France) drains
            # stability while the world is in the unstable band.
            shocks = 0
            if not (self.rules.is_v2() and country.has("mobilization_economy")):
                sanction_penalty = p.sanction_penalty
                if self.rules.is_v2() and country.has("sanctions_experience"):
                    sanction_penalty = round_half_away(
                        sanction_penalty * t.sanction_resist_percent, 100
                    )
                shocks += len(country.sanctioned_by) * sanction_penalty
            if (
                self.rules.is_v2()
                and country.has("eco_agenda")
                and state.ecology < self.rules.params.climate.unstable_below
            ):
                shocks += self.rules.params.traits.eco_agenda_penalty
            prior_lost = country.cities_lost - country.cities_lost_this_round
            for i in range(country.cities_lost_this_round):
                shocks += p.first_city_loss if prior_lost + i == 0 else p.city_loss
            country.cities_lost_this_round = 0

            # Действия: the social program and the national pride of the own nuclear tech.
            actions = 0
            if approved.social_program:
                actions += self.rules.effect("social_program", "stability")
            if approved.nuclear_tech:
                actions += self.rules.effect("nuclear_tech", "stability")

            value = max(0, min(100, before + dynamics + level_effect + shocks + actions))
            country.average_life_prev = avg

            if value == 0:
                country.powers_lost += 1
                country.in_transition = True
                country.budget //= 2
                country.stability = p.transition_stability
                events.append(
                    PowerChanged(
                        round=ctx.round,
                        target=country.id,
                        stability_reset=p.transition_stability,
                        budget_after=country.budget,
                    )
                )
            else:
                country.stability = value
                country.in_transition = False

            events.append(
                StabilityChanged(
                    round=ctx.round,
                    target=country.id,
                    value_before=before,
                    value_after=country.stability,
                    dynamics=dynamics,
                    level_effect=level_effect,
                    shocks=shocks,
                    actions=actions,
                )
            )
        return events
