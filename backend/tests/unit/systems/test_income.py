"""income: worked example from the rules, destroyed city, computed from new indicators."""

from arena.engine.events import IncomeCredited
from arena.engine.orders import CountryOrders
from arena.engine.state import GameState
from tests.unit.systems.conftest import Run

P = ["income"]


def test_example_from_rules(run: Run, state: GameState) -> None:
    russia = state.country("russia")
    for city in russia.cities:
        city.destroyed = True
    russia.city("moscow").destroyed = False
    russia.city("moscow").development = 65
    s, ev = run(P)
    assert s.country("russia").budget == 1000 + 215
    credited = [e for e in ev if isinstance(e, IncomeCredited) and e.actor == "russia"]
    assert credited[0].amount == 215 and credited[0].budget_after == 1215


def test_equal_scenario_income(run: Run) -> None:
    s, _ = run(P)
    # 4 cities x (60 + 150) = 840 for everyone
    assert {c.budget for c in s.countries} == {1840}


def test_destroyed_city_earns_nothing(run: Run, state: GameState) -> None:
    state.find_city("moscow")[1].destroyed = True
    s, _ = run(P)
    assert s.country("russia").budget == 1000 + 3 * 210


def test_income_uses_new_indicators(run: Run) -> None:
    # invest 150 -> Moscow 75: income 4*150 + 75+60*3 = 855; budget 1000-150+855
    s, _ = run(
        ["budget", "develop", "clamp", "life_level", "income"],
        russia=CountryOrders(invest=["moscow"]),
    )
    assert s.country("russia").budget == 1000 - 150 + 855
