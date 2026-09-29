"""legal_actions(state, country_id, rules) -> ActionSpace; structural validation of orders.

``ActionSpace`` is what the order form, the bots and the LLM prompt are built from:
for every action in the rules — can it be used now, what does it cost, which
targets are allowed, how many times. ``validate`` checks a ``CountryOrders`` against
it and returns the problems as a list, so the API can reject a malformed order
before the round. The budget system stays the authority on money: ``validate``
only reports an order that cannot possibly be affordable.
"""

from __future__ import annotations

from pydantic import Field

from arena.engine.orders import CountryOrders
from arena.engine.rules import RuleSet, UiSpec
from arena.engine.state import ArenaModel, GameState


class ActionOption(ArenaModel):
    id: str
    ui: UiSpec
    cost: int = 0
    available: bool = True
    reason: str | None = Field(default=None, description="Why unavailable, if not available")
    requires: str | None = None
    targets: list[str] | None = Field(default=None, description="Allowed target ids, if targeted")
    max_count: int | None = Field(default=None, description="Max units this round, if limited")
    max_per_target: int | None = None
    min_amount: int | None = None


class ActionSpace(ArenaModel):
    round: int
    country_id: str
    budget: int
    actions: dict[str, ActionOption]

    def option(self, action_id: str) -> ActionOption:
        return self.actions[action_id]


class OrderError(ArenaModel):
    action: str
    target: str | None = None
    reason: str


def legal_actions(state: GameState, country_id: str, rules: RuleSet) -> ActionSpace:
    me = state.country(country_id)
    own_alive = [c.id for c in me.alive_cities]
    foreign_alive = [
        c.id
        for country in state.countries
        if country.id != country_id
        for c in country.alive_cities
    ]
    others = [c.id for c in state.countries if c.id != country_id]
    opts: dict[str, ActionOption] = {}

    for action_id, spec in rules.actions.items():
        o = ActionOption(id=action_id, ui=spec.ui, cost=spec.cost, requires=spec.requires)
        match action_id:
            case "invest":
                o.targets = own_alive
                o.max_per_target = spec.max_per_city_per_round
            case "eco_program":
                pass
            case "nuclear_tech":
                if me.nuclear_tech:
                    o.available, o.reason = False, "already_owned"
            case "bomb":
                o.max_count = spec.max_per_round
                if not me.nuclear_tech:
                    o.available, o.reason = False, "requires_nuclear_tech"
            case "strike":
                o.targets = foreign_alive
                o.max_per_target = spec.max_per_target_city_per_round
                o.max_count = _min(spec.max_per_round, me.bombs)
                if me.bombs == 0:
                    o.available, o.reason = False, "no_bombs"
            case "shield":
                o.targets = [c.id for c in me.alive_cities if not c.shield]
                o.max_per_target = 1
            case "sanction":
                o.targets = others
                o.max_per_target = 1
            case "aid":
                o.targets = others
                o.min_amount = spec.min_amount
            case _:
                o.available, o.reason = False, "unsupported_by_engine"
        if o.available and o.cost and me.budget < o.cost:
            o.available, o.reason = False, "insufficient_budget"
        if o.targets is not None and not o.targets and o.available:
            o.available, o.reason = False, "no_targets"
        opts[action_id] = o

    return ActionSpace(round=state.round, country_id=country_id, budget=me.budget, actions=opts)


def validate(orders: CountryOrders, space: ActionSpace) -> list[OrderError]:
    """Structural problems of an order against its ActionSpace (empty list = fine)."""
    errors: list[OrderError] = []
    a = space.actions

    def check_targets(action: str, targets: list[str]) -> None:
        o = a[action]
        for t in targets:
            if o.targets is not None and t not in o.targets:
                errors.append(OrderError(action=action, target=t, reason="invalid_target"))
        if o.max_per_target is not None:
            for t in set(targets):
                if targets.count(t) > o.max_per_target:
                    errors.append(OrderError(action=action, target=t, reason="limit_exceeded"))
        if o.max_count is not None and len(targets) > o.max_count:
            errors.append(OrderError(action=action, reason="limit_exceeded"))

    def check_available(action: str, used: bool) -> None:
        if used and not a[action].available:
            errors.append(OrderError(action=action, reason=a[action].reason or "unavailable"))

    check_available("invest", bool(orders.invest))
    check_targets("invest", orders.invest)
    check_available("eco_program", orders.eco_programs > 0)
    check_available("nuclear_tech", orders.nuclear_tech)
    check_available("bomb", orders.bombs > 0)
    if a["bomb"].max_count is not None and orders.bombs > a["bomb"].max_count:
        errors.append(OrderError(action="bomb", reason="limit_exceeded"))
    check_available("strike", bool(orders.strikes))
    check_targets("strike", orders.strikes)
    check_available("shield", bool(orders.shields))
    check_targets("shield", orders.shields)
    check_available("sanction", bool(orders.sanctions))
    check_targets("sanction", orders.sanctions)
    check_available("aid", bool(orders.aid))
    check_targets("aid", list(orders.aid))
    min_aid = a["aid"].min_amount or 1
    for t, amount in orders.aid.items():
        if amount < min_aid:
            errors.append(OrderError(action="aid", target=t, reason="below_minimum"))

    total = (
        len(orders.invest) * a["invest"].cost
        + orders.eco_programs * a["eco_program"].cost
        + (a["nuclear_tech"].cost if orders.nuclear_tech else 0)
        + orders.bombs * a["bomb"].cost
        + len(orders.shields) * a["shield"].cost
        + sum(orders.aid.values())
    )
    if total > space.budget:
        errors.append(OrderError(action="*", reason="over_budget"))
    return errors


def _min(*values: int | None) -> int | None:
    present = [v for v in values if v is not None]
    return min(present) if present else None
