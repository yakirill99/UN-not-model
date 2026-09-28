"""develop + clamp: +15 per investment, repeats, ecology capped by params."""

from arena.engine.events import CityInvested, EcologyChanged
from arena.engine.orders import CountryOrders, OrderBook
from arena.engine.pipeline import resolve_round
from arena.engine.rules import RuleSet
from arena.engine.state import GameState
from tests.unit.systems.conftest import Run

P = ["budget", "develop", "clamp"]


def test_investment_adds_effect_from_yaml(run: Run, rules: RuleSet) -> None:
    s, ev = run(P, russia=CountryOrders(invest=["moscow"]))
    gain = rules.effect("invest", "development")
    assert s.find_city("moscow")[1].development == 60 + gain
    inv = [e for e in ev if isinstance(e, CityInvested)]
    assert len(inv) == 1 and (inv[0].development_before, inv[0].development_after) == (60, 75)


def test_repeated_investment_in_one_city(run: Run) -> None:
    s, _ = run(P, russia=CountryOrders(invest=["moscow", "moscow", "spb"]))
    assert s.find_city("moscow")[1].development == 90
    assert s.find_city("spb")[1].development == 75


def test_ecology_program_capped_at_max(run: Run, rules: RuleSet) -> None:
    s, ev = run(P, russia=CountryOrders(eco_programs=1), usa=CountryOrders(eco_programs=1))
    assert s.ecology == rules.params.ecology.max
    causes = [e.cause for e in ev if isinstance(e, EcologyChanged)]
    assert causes == ["eco_program", "eco_program", "clamp"]


def test_unpaid_orders_have_no_effect(run: Run) -> None:
    # 8 investments cost 1200 > 1000: only 6 land
    s, _ = run(P, russia=CountryOrders(invest=["moscow"] * 8))
    assert s.find_city("moscow")[1].development == 60 + 6 * 15


def test_changing_price_in_rules_changes_result(rules: RuleSet, state: GameState) -> None:
    cheap = rules.model_dump()
    cheap["actions"]["invest"]["cost"] = 100
    cheap["pipeline"] = P
    s, _ = resolve_round(
        state,
        OrderBook(orders={"russia": CountryOrders(invest=["moscow"] * 8)}),
        RuleSet.model_validate(cheap),
        0,
    )
    assert s.find_city("moscow")[1].development == 60 + 8 * 15
    assert s.country("russia").budget == 200
