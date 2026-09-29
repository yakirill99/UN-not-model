"""build: technology once, shields same round, bombs pending, ecology costs from YAML."""

from arena.engine.events import (
    BombsProduced,
    EcologyChanged,
    OrderRejected,
    ShieldBuilt,
    TechDeveloped,
)
from arena.engine.orders import CountryOrders
from arena.engine.rules import RuleSet
from arena.engine.state import GameState
from tests.unit.systems.conftest import Run

P = ["budget", "build"]


def test_nuclear_tech_costs_ecology_and_is_once(run: Run, rules: RuleSet, state: GameState) -> None:
    s, ev = run(P, russia=CountryOrders(nuclear_tech=True))
    assert s.country("russia").nuclear_tech
    assert s.ecology == 100 + rules.effect("nuclear_tech", "ecology")
    assert any(isinstance(e, TechDeveloped) for e in ev)
    # second time: rejected by budget, no effect
    state.country("russia").nuclear_tech = True
    s2, ev2 = run(P, russia=CountryOrders(nuclear_tech=True))
    assert s2.ecology == 100 and s2.country("russia").budget == 1000
    assert [e.reason for e in ev2 if isinstance(e, OrderRejected)] == ["already_owned"]


def test_shield_is_active_same_round(run: Run) -> None:
    s, ev = run(P, russia=CountryOrders(shields=["moscow"]))
    assert s.find_city("moscow")[1].shield
    assert [e.target for e in ev if isinstance(e, ShieldBuilt)] == ["moscow"]


def test_bombs_go_to_pending(run: Run, rules: RuleSet, state: GameState) -> None:
    state.country("russia").nuclear_tech = True
    s, ev = run(P, russia=CountryOrders(bombs=2))
    r = s.country("russia")
    assert (r.bombs, r.bombs_pending) == (0, 2)
    assert s.ecology == 100 + 2 * rules.effect("bomb", "ecology")
    assert next(e for e in ev if isinstance(e, BombsProduced)).count == 2
    assert [e.cause for e in ev if isinstance(e, EcologyChanged)] == ["bomb_production"]


def test_tech_and_bombs_in_one_round_gives_only_tech(run: Run) -> None:
    s, _ = run(P, russia=CountryOrders(nuclear_tech=True, bombs=3))
    r = s.country("russia")
    assert r.nuclear_tech and r.bombs_pending == 0
    assert r.budget == 1000 - 500
    assert s.ecology == 100 - 5
