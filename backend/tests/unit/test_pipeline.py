"""Pipeline: registry, order of systems, unregistered system error, purity."""

from collections.abc import Iterator
from pathlib import Path

import pytest

from arena.engine.events import EcologyChanged, Event
from arena.engine.orders import OrderBook
from arena.engine.pipeline import PipelineError, build_pipeline, resolve_round
from arena.engine.rng import RngFactory
from arena.engine.rules import RuleSet, load_rules
from arena.engine.scenario import load_scenario
from arena.engine.state import GameState
from arena.engine.systems import SYSTEMS, BaseSystem, RoundContext, System, register

Registry = dict[str, type[System]]


@pytest.fixture
def registry() -> Iterator[Registry]:
    """Isolate the global registry: tests register throwaway systems."""
    saved = dict(SYSTEMS)
    yield SYSTEMS
    SYSTEMS.clear()
    SYSTEMS.update(saved)


@pytest.fixture
def rules(rules_dir: Path) -> RuleSet:
    return load_rules("v1.0", rules_dir).model_copy(update={"pipeline": ["alpha", "beta"]})


@pytest.fixture
def state(scenarios_dir: Path) -> GameState:
    return load_scenario(scenarios_dir / "equal.yaml").initial_state()


def _two_systems() -> list[str]:
    calls: list[str] = []

    def _eco(name: str, delta: int) -> None:
        class Sys(BaseSystem):
            def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
                calls.append(name)
                state.ecology += delta
                return [
                    EcologyChanged(
                        round=ctx.round, cause=name, delta=delta, ecology_after=state.ecology
                    )
                ]

        register(name)(Sys)

    _eco("alpha", -10)
    _eco("beta", -1)
    return calls


def test_register_sets_name_and_registry(registry: Registry) -> None:
    _two_systems()
    assert registry["alpha"].name == "alpha"
    with pytest.raises(ValueError, match="already registered"):

        @register("alpha")
        class Other(BaseSystem):
            pass


def test_build_pipeline_follows_rules_order(registry: Registry, rules: RuleSet) -> None:
    _two_systems()
    assert [s.name for s in build_pipeline(rules)] == ["alpha", "beta"]
    reversed_rules = rules.model_copy(update={"pipeline": ["beta", "alpha"]})
    assert [s.name for s in build_pipeline(reversed_rules)] == ["beta", "alpha"]


def test_unregistered_system_is_a_clear_error(registry: Registry, rules: RuleSet) -> None:
    _two_systems()
    bad = rules.model_copy(update={"pipeline": ["alpha", "teleport"]})
    with pytest.raises(PipelineError, match=r"unregistered systems \['teleport'\]"):
        build_pipeline(bad)


def test_resolve_round_runs_systems_in_order_and_collects_events(
    registry: Registry, rules: RuleSet, state: GameState
) -> None:
    calls = _two_systems()
    new_state, events = resolve_round(state, OrderBook(), rules, seed=1)
    assert calls == ["alpha", "beta"]
    assert new_state.ecology == 89
    assert [e.type for e in events] == ["ecology_changed", "ecology_changed"]
    assert all(e.round == 1 for e in events)


def test_resolve_round_is_pure(registry: Registry, rules: RuleSet, state: GameState) -> None:
    _two_systems()
    before = state.model_dump()
    new_state, _ = resolve_round(state, OrderBook(), rules, seed=1)
    assert state.model_dump() == before
    assert new_state is not state
    assert new_state.countries[0] is not state.countries[0]


def test_base_system_requires_apply(rules: RuleSet, state: GameState) -> None:
    class Stub(BaseSystem):
        name = "stub"

    ctx = RoundContext(rules=rules, rng=RngFactory(0, 1), round=1)
    with pytest.raises(NotImplementedError, match="stub"):
        Stub(rules).apply(state, OrderBook(), ctx)
