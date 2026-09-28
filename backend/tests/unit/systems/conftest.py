"""Fixtures for system tests: real v1.0 rules, equal scenario, pipeline overrides."""

from collections.abc import Callable
from pathlib import Path

import pytest

from arena.engine.events import Event
from arena.engine.orders import CountryOrders, OrderBook
from arena.engine.pipeline import resolve_round
from arena.engine.rules import RuleSet, load_rules
from arena.engine.scenario import load_scenario
from arena.engine.state import GameState

Run = Callable[..., tuple[GameState, list[Event]]]


@pytest.fixture
def rules(rules_dir: Path) -> RuleSet:
    return load_rules("v1.0", rules_dir)


@pytest.fixture
def state(scenarios_dir: Path) -> GameState:
    return load_scenario(scenarios_dir / "equal.yaml").initial_state()


@pytest.fixture
def run(rules: RuleSet, state: GameState) -> Run:
    """run(pipeline, **orders_by_country) -> (state, events) on the equal scenario."""

    def _run(pipeline: list[str], **orders: CountryOrders) -> tuple[GameState, list[Event]]:
        r = rules.model_copy(update={"pipeline": pipeline})
        return resolve_round(state, OrderBook(orders=orders), r, seed=0)

    return _run
