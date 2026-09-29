"""Contract between rules/*.yaml and the engine.

Every rules file must load, every system in its pipeline must exist, every action
must have a UI description, and every action id used in code must exist in the rules.
"""

from pathlib import Path

import pytest

from arena.engine.orders import OrderBook
from arena.engine.pipeline import build_pipeline, resolve_round
from arena.engine.rules import load_rules
from arena.engine.scenario import load_scenario
from arena.engine.systems import SYSTEMS

REPO_ROOT = Path(__file__).resolve().parents[2]
RULE_FILES = sorted((REPO_ROOT / "rules").glob("*.yaml"))
SCENARIO_FILES = sorted((REPO_ROOT / "scenarios").glob("*.yaml"))

# Action ids the systems refer to by name (grep "rules.action(" / "rules.effect(").
ACTIONS_USED_IN_CODE = {
    "invest",
    "eco_program",
    "nuclear_tech",
    "bomb",
    "strike",
    "shield",
    "sanction",
    "aid",
}


@pytest.mark.parametrize("path", RULE_FILES, ids=lambda p: p.stem)
def test_every_system_in_pipeline_is_registered(path: Path) -> None:
    rules = load_rules(path)
    missing = [s for s in rules.pipeline if s not in SYSTEMS]
    assert not missing, f"{path.name}: unregistered systems {missing}"
    assert [s.name for s in build_pipeline(rules)] == rules.pipeline


@pytest.mark.parametrize("path", RULE_FILES, ids=lambda p: p.stem)
def test_actions_have_ui_and_code_actions_exist(path: Path) -> None:
    rules = load_rules(path)
    for action_id, spec in rules.actions.items():
        assert spec.ui.title, f"{path.name}: action {action_id} has no ui.title"
    assert set(rules.actions) >= ACTIONS_USED_IN_CODE, path.name


def test_registered_systems_are_used_by_some_rules() -> None:
    used = {s for p in RULE_FILES for s in load_rules(p).pipeline}
    unused = set(SYSTEMS) - used
    assert not unused, f"systems registered but in no pipeline: {sorted(unused)}"


@pytest.mark.parametrize("scenario", SCENARIO_FILES, ids=lambda p: p.stem)
def test_full_pipeline_runs_on_every_scenario(scenario: Path) -> None:
    rules = load_rules("v1.0", REPO_ROOT / "rules")
    state = load_scenario(scenario).initial_state()
    for _ in range(rules.params.rounds):
        state, _ = resolve_round(state, OrderBook(), rules, seed=7)
    assert state.round == rules.params.rounds + 1
    assert all(c.budget > 0 for c in state.countries)
