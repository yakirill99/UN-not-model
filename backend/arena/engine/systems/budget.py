"""budget: check every paid order, execute by priority while money lasts, reject the rest.

GAME_RULES.md section 12, steps 2-3, and section 17, decision 13. A country's budget
never goes negative: each unit of an action (one investment, one shield, one bomb,
one aid transfer) is either paid in full or rejected with a reason the delegation
sees in its report.

The result is written to ``ctx.approved[country_id]``; the systems that execute
orders (develop, build, aid, ...) read only that.
"""

from __future__ import annotations

from dataclasses import dataclass

from arena.engine.events import BudgetSpent, Event, OrderRejected
from arena.engine.orders import CountryOrders, OrderBook
from arena.engine.state import Country, GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@dataclass(frozen=True, slots=True)
class Unit:
    """One payable unit of an order."""

    action: str
    target: str | None
    cost: int
    amount: int = 0  # aid only


@register("budget")
class BudgetSystem(BaseSystem):
    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        events: list[Event] = []
        for country in state.countries:
            requested = ctx.approved[country.id]
            approved = requested.model_copy(deep=True)
            self._clear_paid(approved)
            units, events_ = self._validate(country, requested, state, ctx.round)
            events.extend(events_)
            for unit in self._by_priority(units):
                if unit.cost > country.budget:
                    events.append(
                        OrderRejected(
                            round=ctx.round,
                            actor=country.id,
                            target=unit.target,
                            action=unit.action,
                            reason="insufficient_budget",
                            detail={"cost": unit.cost, "budget": country.budget},
                        )
                    )
                    continue
                country.budget -= unit.cost
                self._grant(approved, unit)
                events.append(
                    BudgetSpent(
                        round=ctx.round,
                        actor=country.id,
                        target=unit.target,
                        action=unit.action,
                        amount=unit.cost,
                        budget_after=country.budget,
                    )
                )
            ctx.approved[country.id] = approved
        return events

    # --- helpers --------------------------------------------------------------

    def _paid_actions(self) -> list[str]:
        return [
            a for a in self.rules.params.budget_priority if self.rules.cost(a) > 0 or a == "aid"
        ]

    def _clear_paid(self, orders: CountryOrders) -> None:
        """Reset the fields that this system re-grants unit by unit."""
        orders.invest = []
        orders.eco_programs = 0
        orders.nuclear_tech = False
        orders.bombs = 0
        orders.shields = []
        orders.aid = {}

    def _by_priority(self, units: list[Unit]) -> list[Unit]:
        rank = {a: i for i, a in enumerate(self.rules.params.budget_priority)}
        return sorted(units, key=lambda u: rank.get(u.action, len(rank)))

    def _grant(self, orders: CountryOrders, unit: Unit) -> None:
        match unit.action:
            case "invest" if unit.target:
                orders.invest.append(unit.target)
            case "eco_program":
                orders.eco_programs += 1
            case "nuclear_tech":
                orders.nuclear_tech = True
            case "bomb":
                orders.bombs += 1
            case "shield" if unit.target:
                orders.shields.append(unit.target)
            case "aid" if unit.target:
                orders.aid[unit.target] = unit.amount
            case _:
                raise ValueError(f"budget cannot grant unknown paid action {unit.action!r}")

    def _validate(
        self, country: Country, o: CountryOrders, state: GameState, round_no: int
    ) -> tuple[list[Unit], list[Event]]:
        """Structural checks that decide whether a unit is payable at all."""
        units: list[Unit] = []
        rejected: list[Event] = []
        rules = self.rules

        def reject(action: str, target: str | None, reason: str, **detail: int | str) -> None:
            rejected.append(
                OrderRejected(
                    round=round_no,
                    actor=country.id,
                    target=target,
                    action=action,
                    reason=reason,
                    detail=dict(detail),
                )
            )

        own_alive = {c.id for c in country.alive_cities}
        own_all = {c.id for c in country.cities}

        def own_city_ok(action: str, city_id: str) -> bool:
            if city_id not in own_all:
                reject(action, city_id, "not_own_city")
                return False
            if city_id not in own_alive:
                reject(action, city_id, "city_destroyed")
                return False
            return True

        for city_id in o.shields:
            if own_city_ok("shield", city_id):
                if country.city(city_id).shield or city_id in [u.target for u in units]:
                    reject("shield", city_id, "already_shielded")
                else:
                    units.append(Unit("shield", city_id, rules.cost("shield")))

        invest_limit = rules.action("invest").max_per_city_per_round
        per_city: dict[str, int] = {}
        for city_id in o.invest:
            if not own_city_ok("invest", city_id):
                continue
            per_city[city_id] = per_city.get(city_id, 0) + 1
            if invest_limit is not None and per_city[city_id] > invest_limit:
                reject("invest", city_id, "limit_exceeded", limit=invest_limit)
                continue
            units.append(Unit("invest", city_id, rules.cost("invest")))

        units += [Unit("eco_program", None, rules.cost("eco_program"))] * o.eco_programs

        if o.nuclear_tech:
            if country.nuclear_tech:
                reject("nuclear_tech", None, "already_owned")
            else:
                units.append(Unit("nuclear_tech", None, rules.cost("nuclear_tech")))

        if o.bombs:
            if not country.nuclear_tech and not o.nuclear_tech:
                reject("bomb", None, "requires_nuclear_tech")
            else:
                limit = rules.action("bomb").max_per_round
                allowed = o.bombs if limit is None else min(o.bombs, limit)
                if allowed < o.bombs:
                    reject("bomb", None, "limit_exceeded", limit=limit or 0, requested=o.bombs)
                units += [Unit("bomb", None, rules.cost("bomb"))] * allowed

        known = {c.id for c in state.countries}
        min_aid = rules.action("aid").min_amount or 1
        for recipient, amount in o.aid.items():
            if recipient == country.id:
                reject("aid", recipient, "self_target")
            elif recipient not in known:
                reject("aid", recipient, "unknown_country")
            elif amount < min_aid:
                reject("aid", recipient, "below_minimum", minimum=min_aid)
            else:
                units.append(Unit("aid", recipient, amount, amount=amount))

        return units, rejected
