"""build: nuclear technology, shields and bomb production (section 12, step 5).

Everything here was validated and paid by ``budget``. Shields protect in the same
round (decision 10); bombs go to ``bombs_pending`` and become usable next round.
Ecology effects come from ``actions.nuclear_tech.effect`` and ``actions.bomb.effect``.
"""

from __future__ import annotations

from arena.engine.events import BombsProduced, EcologyChanged, Event, ShieldBuilt, TechDeveloped
from arena.engine.orders import OrderBook
from arena.engine.state import GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("build")
class BuildSystem(BaseSystem):
    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        events: list[Event] = []
        tech_eco = self.rules.effect("nuclear_tech", "ecology")
        bomb_eco = self.rules.effect("bomb", "ecology")
        for country in state.countries:
            approved = ctx.approved[country.id]
            if approved.nuclear_tech:
                country.nuclear_tech = True
                events.append(TechDeveloped(round=ctx.round, actor=country.id, tech="nuclear"))
                if tech_eco:
                    state.ecology += tech_eco
                    events.append(
                        EcologyChanged(
                            round=ctx.round,
                            actor=country.id,
                            cause="nuclear_tech",
                            delta=tech_eco,
                            ecology_after=state.ecology,
                        )
                    )
            for city_id in approved.shields:
                country.city(city_id).shield = True
                events.append(ShieldBuilt(round=ctx.round, actor=country.id, target=city_id))
            if approved.bombs:
                country.bombs_pending += approved.bombs
                events.append(
                    BombsProduced(
                        round=ctx.round,
                        actor=country.id,
                        count=approved.bombs,
                        bombs_pending_after=country.bombs_pending,
                    )
                )
                delta = bomb_eco * approved.bombs
                if delta:
                    state.ecology += delta
                    events.append(
                        EcologyChanged(
                            round=ctx.round,
                            actor=country.id,
                            cause="bomb_production",
                            delta=delta,
                            ecology_after=state.ecology,
                        )
                    )
        return events
