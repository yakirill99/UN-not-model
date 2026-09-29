"""budget: priority order, rejection reasons, budget never negative."""

from arena.engine.events import BudgetSpent, Event, OrderRejected
from arena.engine.orders import CountryOrders
from arena.engine.rules import RuleSet
from arena.engine.state import GameState
from tests.unit.systems.conftest import Run

P = ["budget"]


def _rejections(events: list[Event]) -> list[tuple[str, str | None, str]]:
    return [(e.action, e.target, e.reason) for e in events if isinstance(e, OrderRejected)]


def test_everything_affordable_is_paid(run: Run, rules: RuleSet) -> None:
    s, ev = run(P, russia=CountryOrders(invest=["moscow", "spb"], eco_programs=1))
    assert s.country("russia").budget == 1000 - 2 * 150 - 200
    assert _rejections(ev) == []
    assert [e.action for e in ev if isinstance(e, BudgetSpent)] == [
        "invest",
        "invest",
        "eco_program",
    ]


def test_priority_order_when_short_of_money(run: Run) -> None:
    # 1000$: shield 300 -> invest 150 -> eco 200 -> nuclear 500 (rejected) -> aid 100
    o = CountryOrders(
        shields=["moscow"], invest=["spb"], eco_programs=1, nuclear_tech=True, aid={"usa": 100}
    )
    s, ev = run(P, russia=o)
    assert s.country("russia").budget == 1000 - 300 - 150 - 200 - 100
    assert _rejections(ev) == [("nuclear_tech", None, "insufficient_budget")]
    assert s.country("usa").budget == 1000  # aid itself is applied by the aid system


def test_partial_execution_of_repeated_units(run: Run) -> None:
    s, ev = run(P, russia=CountryOrders(invest=["moscow"] * 8))  # 8 x 150 = 1200 > 1000
    assert s.country("russia").budget == 1000 - 6 * 150
    assert len([e for e in ev if isinstance(e, BudgetSpent)]) == 6
    assert _rejections(ev) == [("invest", "moscow", "insufficient_budget")] * 2


def test_budget_never_negative(run: Run) -> None:
    s, _ = run(P, russia=CountryOrders(nuclear_tech=True, eco_programs=3))
    assert s.country("russia").budget >= 0


def test_foreign_and_destroyed_city_rejected(run: Run, state: GameState) -> None:
    state.country("russia").city("spb").destroyed = True
    s, ev = run(P, russia=CountryOrders(invest=["paris", "spb", "moscow"], shields=["paris"]))
    assert s.country("russia").budget == 1000 - 150
    assert set(_rejections(ev)) == {
        ("invest", "paris", "not_own_city"),
        ("invest", "spb", "city_destroyed"),
        ("shield", "paris", "not_own_city"),
    }


def test_nuclear_prerequisites_and_limits(run: Run) -> None:
    _, ev = run(P, russia=CountryOrders(bombs=2))
    assert _rejections(ev) == [("bomb", None, "requires_nuclear_tech")]
    # tech ordered in the same round unlocks production; limit 3 per round
    s, ev = run(P, russia=CountryOrders(nuclear_tech=True, bombs=5))
    assert s.country("russia").budget == 1000 - 500 - 3 * 150
    assert _rejections(ev) == [("bomb", None, "limit_exceeded")]


def test_bombs_rejected_when_tech_ordered_but_unpaid(run: Run, state: GameState) -> None:
    """Found by hypothesis: tech (500) rejected for money, bomb (150) must not slip through."""
    state.country("iran").budget = 150
    s, ev = run(P, iran=CountryOrders(nuclear_tech=True, bombs=1))
    assert s.country("iran").budget == 150
    assert _rejections(ev) == [
        ("nuclear_tech", None, "insufficient_budget"),
        ("bomb", None, "requires_nuclear_tech"),
    ]


def test_aid_validation(run: Run) -> None:
    s, ev = run(P, russia=CountryOrders(aid={"russia": 10, "mars": 10, "usa": 300}))
    assert s.country("russia").budget == 700
    assert set(_rejections(ev)) == {
        ("aid", "russia", "self_target"),
        ("aid", "mars", "unknown_country"),
    }


def test_double_shield_rejected(run: Run) -> None:
    s, ev = run(P, russia=CountryOrders(shields=["moscow", "moscow"]))
    assert s.country("russia").budget == 700
    assert _rejections(ev) == [("shield", "moscow", "already_shielded")]


def test_country_without_orders_is_untouched(run: Run) -> None:
    s, ev = run(P)
    assert all(c.budget == 1000 for c in s.countries)
    assert ev == []
