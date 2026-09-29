"""Replay of the Smolny game, years 1-3, against what the coordinator sheets record.

Only round 1 has a per-country money check ("потрачено денег" in the round-1 copy of
the coordinator sheet) and only the *end of round 4* has a full state - round 4's
orders were never written down. So this test checks what can be checked:
round-1 spending, and facts about the round-3 state that round 4 cannot have undone.
See docs/rules/smolny-replay-report.md for the full comparison.
"""

from pathlib import Path

import pytest

from arena.engine.events import BudgetSpent, NuclearStrike, OrderRejected
from arena.engine.play import load_script
from arena.engine.rules import load_rules
from arena.engine.runner import GameLog, ScriptedAgent, run_game
from arena.engine.scenario import load_scenario
from tests.conftest import REPO_ROOT

SCRIPT = Path(__file__).with_name("smolny_2026.yaml")

# Round-1 copy of the coordinator sheet: money spent per country in year 1.
SPENT_YEAR_1_COORDINATOR = {"iran": 650, "dprk": 600, "france": 1000, "usa": 650, "russia": 600}
FRANCE_OVERDRAFT = 15  # France had 985$ and was allowed to spend 1000$ (divergence 1)
# Final coordinator sheet, "потрачено денег": reliable for these two (see report)
SPENT_TOTAL_COORDINATOR = {"usa": 1550, "france": 1800}


def _play(forgive_overdraft: bool) -> GameLog:
    rules = load_rules("v1.0", REPO_ROOT / "rules")
    initial = load_scenario(REPO_ROOT / "scenarios" / "smolny.yaml").initial_state()
    if forgive_overdraft:
        initial.country("france").budget += FRANCE_OVERDRAFT
    scripts, _ = load_script(SCRIPT)
    agents = {c: ScriptedAgent(s) for c, s in scripts.items()}
    return run_game(initial, rules, agents, seed=2026, scenario_id="smolny", rounds=3)


@pytest.fixture(scope="module")
def strict() -> GameLog:
    return _play(forgive_overdraft=False)


@pytest.fixture(scope="module")
def as_played() -> GameLog:
    return _play(forgive_overdraft=True)


def _spent(log: GameLog, round_index: int) -> dict[str, int]:
    spent: dict[str, int] = {}
    for e in log.rounds[round_index].events:
        if isinstance(e, BudgetSpent) and e.actor:
            spent[e.actor] = spent.get(e.actor, 0) + e.amount
    return spent


@pytest.mark.replay
def test_year_1_spending_strict_engine(strict: GameLog) -> None:
    """Divergence 1: the engine refuses France's 15$ overdraft and drops the technology."""
    spent = _spent(strict, 0)
    assert spent == {**SPENT_YEAR_1_COORDINATOR, "france": 500}
    rejected = [
        (e.actor, e.action, e.reason)
        for e in strict.rounds[0].events
        if isinstance(e, OrderRejected)
    ]
    assert ("france", "nuclear_tech", "insufficient_budget") in rejected


@pytest.mark.replay
def test_year_1_spending_as_played(as_played: GameLog) -> None:
    """With the overdraft forgiven, every country spends exactly what the coordinator wrote."""
    assert _spent(as_played, 0) == SPENT_YEAR_1_COORDINATOR


@pytest.mark.replay
def test_total_spending_of_usa_and_france(as_played: GameLog) -> None:
    """Decision D1 (later submission replaces earlier) reproduces the coordinator's totals."""
    totals: dict[str, int] = {}
    for i in range(3):
        for c, v in _spent(as_played, i).items():
            totals[c] = totals.get(c, 0) + v
    assert {c: totals[c] for c in SPENT_TOTAL_COORDINATOR} == SPENT_TOTAL_COORDINATOR


@pytest.mark.replay
def test_usa_bomb_in_year_1_rejected_like_the_coordinator_did(as_played: GameLog) -> None:
    rejected = [
        e.action
        for e in as_played.rounds[0].events
        if isinstance(e, OrderRejected) and e.actor == "usa"
    ]
    assert rejected == ["bomb"]


@pytest.mark.replay
def test_tehran_destroyed_in_year_3_by_two_strikes(as_played: GameLog) -> None:
    strikes = [e for e in as_played.rounds[2].events if isinstance(e, NuclearStrike)]
    assert [(e.actor, e.outcome) for e in strikes] == [
        ("usa", "destroyed"),
        ("dprk", "already_destroyed"),
    ]
    iran = as_played.final_state.country("iran")
    assert iran.city("tehran").destroyed
    assert iran.city("shiraz").shield and iran.city("isfahan").shield and iran.city("yazd").shield


@pytest.mark.replay
def test_arsenals_at_end_of_year_3(as_played: GameLog) -> None:
    f = as_played.final_state
    assert {c.id: c.nuclear_tech for c in f.countries} == {
        "russia": True,
        "usa": True,
        "france": True,
        "iran": False,
        "dprk": True,
    }
    # bombs left for round 4: usa 3-1, france 2, russia 2, dprk 1-1+3
    assert {c.id: c.bombs for c in f.countries} == {
        "russia": 2,
        "usa": 2,
        "france": 2,
        "iran": 0,
        "dprk": 3,
    }
