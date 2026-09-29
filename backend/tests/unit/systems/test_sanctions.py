"""sanctions: stacking, alive cities only, target sees the author, validation."""

from arena.engine.events import OrderRejected, SanctionApplied
from arena.engine.orders import CountryOrders
from arena.engine.state import GameState
from tests.unit.systems.conftest import Run

P = ["sanctions", "clamp"]


def test_sanction_hits_all_alive_cities(run: Run, state: GameState) -> None:
    state.find_city("paris")[1].destroyed = True
    state.find_city("paris")[1].development = 0
    s, ev = run(P, russia=CountryOrders(sanctions=["france"]))
    fr = s.country("france")
    assert [c.development for c in fr.cities] == [0, 55, 55, 55]
    assert fr.sanctioned_by == ["russia"]
    assert [(e.actor, e.target, e.delta) for e in ev if isinstance(e, SanctionApplied)] == [
        ("russia", "france", -5)
    ]


def test_sanctions_stack_and_clamp_at_zero(run: Run, state: GameState) -> None:
    for c in state.country("france").cities:
        c.development = 7
    s, _ = run(
        P, russia=CountryOrders(sanctions=["france"]), usa=CountryOrders(sanctions=["france"])
    )
    assert {c.development for c in s.country("france").cities} == {0}
    assert s.country("france").sanctioned_by == ["russia", "usa"]


def test_validation(run: Run) -> None:
    s, ev = run(P, russia=CountryOrders(sanctions=["russia", "mars", "usa", "usa"]))
    assert [(e.target, e.reason) for e in ev if isinstance(e, OrderRejected)] == [
        ("russia", "self_target"),
        ("mars", "unknown_country"),
        ("usa", "duplicate"),
    ]
    assert s.country("usa").sanctioned_by == ["russia"]
    assert {c.development for c in s.country("usa").cities} == {55}
