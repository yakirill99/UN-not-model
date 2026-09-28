"""System registry, build_pipeline(rules) and resolve_round(state, orders, rules, seed).

``resolve_round`` is the only entry point of the engine and it is pure: the input
state is never modified, the same inputs always give the same output.
"""

from __future__ import annotations

from arena.engine.events import Event
from arena.engine.orders import OrderBook
from arena.engine.rng import RngFactory
from arena.engine.rules import RuleSet
from arena.engine.state import GameState
from arena.engine.systems import SYSTEMS, RoundContext, System


class PipelineError(ValueError):
    """The rules name a system the engine does not have."""


def build_pipeline(rules: RuleSet) -> list[System]:
    missing = [name for name in rules.pipeline if name not in SYSTEMS]
    if missing:
        raise PipelineError(
            f"rules {rules.version} use unregistered systems {missing}; "
            f"registered: {sorted(SYSTEMS)}"
        )
    return [SYSTEMS[name](rules) for name in rules.pipeline]


def resolve_round(
    state: GameState, orders: OrderBook, rules: RuleSet, seed: int
) -> tuple[GameState, list[Event]]:
    """Apply every system of ``rules.pipeline`` in order to a copy of ``state``."""
    pipeline = build_pipeline(rules)  # fail before touching anything
    work = state.model_copy(deep=True)
    ctx = RoundContext(
        rules=rules,
        rng=RngFactory(seed, state.round),
        round=state.round,
        approved={c.id: orders.for_country(c.id) for c in state.countries},
    )
    events: list[Event] = []
    for system in pipeline:
        events.extend(system.apply(work, orders, ctx))
    return work, events
