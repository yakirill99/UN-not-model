"""life_level: worked example from the rules, destroyed city, laugh, country average."""

from arena.engine.events import LifeLevelComputed
from arena.engine.orders import CountryOrders
from arena.engine.rules import RuleSet
from arena.engine.state import GameState
from tests.unit.systems.conftest import Run

P = ["life_level"]


def test_example_from_rules(run: Run, state: GameState) -> None:
    state.find_city("moscow")[1].development = 65
    s, ev = run(P)
    assert s.find_city("moscow")[1].life_level == 5445  # 0.33*65 + 0.33*100 = 54.45 %
    moscow = next(e for e in ev if isinstance(e, LifeLevelComputed) and e.target == "moscow")
    assert moscow.life_level == 5445


def test_equal_scenario_start(run: Run) -> None:
    s, _ = run(P)
    # 0.33*60 + 0.33*100 = 52.80 %
    assert {c.life_level for co in s.countries for c in co.cities} == {5280}


def test_destroyed_city_is_zero_and_counts_in_average(run: Run, state: GameState) -> None:
    state.find_city("moscow")[1].destroyed = True
    s, _ = run(P)
    russia = s.country("russia")
    assert russia.city("moscow").life_level == 0
    assert russia.average_life_level == 3 * 5280 // 4
    assert s.country("usa").average_life_level == 5280


def test_laugh_adds_weighted_points(run: Run, state: GameState, rules: RuleSet) -> None:
    state.country("russia").laugh = 20
    s, _ = run(P)
    assert s.find_city("moscow")[1].life_level == 5280 + rules.params.life_weights.laugh * 20


def test_uses_state_after_develop(run: Run) -> None:
    s, _ = run(
        ["budget", "develop", "clamp", "life_level"], russia=CountryOrders(invest=["moscow"])
    )
    assert s.find_city("moscow")[1].life_level == 33 * 75 + 33 * 100
