"""Headless game runner: agents, run_game, GameLog and replay.

``run_game`` plays a whole game without a server: every round it asks each agent
for orders (giving it only its ``Observation`` and ``ActionSpace``), resolves the
round and records orders, events and the resulting state in a ``GameLog``.
``replay`` re-runs a log from its initial state and reports where the engine's
result diverged from what was recorded — the basis of golden tests and of the
Smolny replay.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from typing import Protocol

from pydantic import Field

from arena.engine.actions import ActionSpace, legal_actions
from arena.engine.events import AnyEvent, Event
from arena.engine.observe import Observation, observe
from arena.engine.orders import CountryOrders, HostInput, OrderBook
from arena.engine.pipeline import resolve_round
from arena.engine.rules import RuleSet
from arena.engine.state import ArenaModel, GameState


class Agent(Protocol):
    def act(self, obs: Observation, legal: ActionSpace) -> CountryOrders: ...


class IdleAgent:
    """Submits nothing. The baseline every other agent must beat."""

    def act(self, obs: Observation, legal: ActionSpace) -> CountryOrders:
        return CountryOrders()


class ScriptedAgent:
    """Plays a fixed script: round number -> orders. Missing rounds = idle."""

    def __init__(self, script: dict[int, CountryOrders]) -> None:
        self.script = script

    def act(self, obs: Observation, legal: ActionSpace) -> CountryOrders:
        return self.script.get(obs.round, CountryOrders())


HostFn = Callable[[int, GameState], HostInput]


class RoundRecord(ArenaModel):
    round: int
    orders: OrderBook
    events: list[AnyEvent]
    state_after: GameState


class GameLog(ArenaModel):
    log_schema_version: int = 1
    rules_version: str
    rules_snapshot: RuleSet = Field(description="Full rules after extends, for reproducibility")
    scenario_id: str
    seed: int
    initial_state: GameState
    rounds: list[RoundRecord] = Field(default_factory=list)

    @property
    def final_state(self) -> GameState:
        return self.rounds[-1].state_after if self.rounds else self.initial_state

    def standings(self) -> list[tuple[str, int]]:
        """Country id -> average life level, best first (section 4.4)."""
        s = self.final_state
        return sorted(((c.id, c.average_life_level) for c in s.countries), key=lambda x: -x[1])


def run_game(
    initial: GameState,
    rules: RuleSet,
    agents: Mapping[str, Agent],
    seed: int,
    *,
    scenario_id: str = "custom",
    rounds: int | None = None,
    host: HostFn | None = None,
    on_round: Callable[[RoundRecord], None] | None = None,
) -> GameLog:
    """Play ``rounds`` rounds (default: rules.params.rounds) and return the log."""
    unknown = set(agents) - {c.id for c in initial.countries}
    if unknown:
        raise ValueError(f"agents for unknown countries: {sorted(unknown)}")
    log = GameLog(
        rules_version=rules.version,
        rules_snapshot=rules,
        scenario_id=scenario_id,
        seed=seed,
        initial_state=initial,
    )
    state = initial
    last_events: list[Event] = []
    for _ in range(rounds if rounds is not None else rules.params.rounds):
        orders = collect_orders(state, rules, agents, last_events)
        if host is not None:
            orders = orders.model_copy(update={"host": host(state.round, state)})
        record = play_round(state, orders, rules, seed)
        log.rounds.append(record)
        if on_round is not None:
            on_round(record)
        state = record.state_after
        last_events = list(record.events)
    return log


def collect_orders(
    state: GameState,
    rules: RuleSet,
    agents: Mapping[str, Agent],
    last_events: list[Event] | None = None,
) -> OrderBook:
    """Ask every agent for orders; ``last_events`` becomes the news it sees."""
    orders: dict[str, CountryOrders] = {}
    for country in state.countries:
        agent = agents.get(country.id)
        if agent is None:
            continue
        obs = observe(state, country.id, last_events or [])
        legal = legal_actions(state, country.id, rules)
        orders[country.id] = agent.act(obs, legal)
    return OrderBook(orders=orders)


def play_round(state: GameState, orders: OrderBook, rules: RuleSet, seed: int) -> RoundRecord:
    new_state, events = resolve_round(state, orders, rules, seed)
    return RoundRecord(
        round=state.round,
        orders=orders,
        events=_as_any(events),
        state_after=new_state,
    )


class Divergence(ArenaModel):
    round: int
    path: str
    recorded: object
    replayed: object


def replay(log: GameLog, rules: RuleSet | None = None) -> list[Divergence]:
    """Re-run a log with the engine and list every difference from the recorded states."""
    rules = rules or log.rules_snapshot
    state = log.initial_state
    diffs: list[Divergence] = []
    for rec in log.rounds:
        new_state, _ = resolve_round(state, rec.orders, rules, log.seed)
        diffs.extend(
            Divergence(round=rec.round, path=p, recorded=a, replayed=b)
            for p, a, b in diff_states(rec.state_after, new_state)
        )
        state = rec.state_after  # continue from the recorded state, so one error != all
    return diffs


def diff_states(a: GameState, b: GameState) -> Iterable[tuple[str, object, object]]:
    """Yield (path, value_in_a, value_in_b) for every differing leaf."""
    yield from _diff(a.model_dump(), b.model_dump(), "")


def _diff(x: object, y: object, path: str) -> Iterable[tuple[str, object, object]]:
    if isinstance(x, dict) and isinstance(y, dict):
        for k in sorted(set(x) | set(y)):
            yield from _diff(x.get(k), y.get(k), f"{path}.{k}" if path else str(k))
    elif isinstance(x, list) and isinstance(y, list) and len(x) == len(y):
        for i, (xi, yi) in enumerate(zip(x, y, strict=True)):
            label = xi["id"] if isinstance(xi, dict) and "id" in xi else str(i)
            yield from _diff(xi, yi, f"{path}[{label}]")
    elif x != y:
        yield path, x, y


def _as_any(events: list[Event]) -> list[AnyEvent]:
    return events  # type: ignore[return-value]  # every Event subclass is a member of AnyEvent
