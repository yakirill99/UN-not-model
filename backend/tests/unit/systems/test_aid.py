"""aid: money moves to aid_pending, total money is preserved, unpaid aid is dropped."""

from arena.engine.events import AidTransferred
from arena.engine.orders import CountryOrders
from arena.engine.state import GameState
from tests.unit.systems.conftest import Run

P = ["budget", "aid"]


def _money(s: GameState) -> int:
    return sum(c.budget + c.aid_pending for c in s.countries)


def test_aid_lands_in_pending(run: Run) -> None:
    s, ev = run(P, russia=CountryOrders(aid={"usa": 300, "iran": 50}))
    assert s.country("russia").budget == 650
    assert s.country("usa").aid_pending == 300 and s.country("usa").budget == 1000
    assert s.country("iran").aid_pending == 50
    assert [(e.actor, e.target, e.amount) for e in ev if isinstance(e, AidTransferred)] == [
        ("russia", "usa", 300),
        ("russia", "iran", 50),
    ]


def test_total_money_preserved(run: Run, state: GameState) -> None:
    before = _money(state)
    s, _ = run(P, russia=CountryOrders(aid={"usa": 999}), usa=CountryOrders(aid={"russia": 1000}))
    assert _money(s) == before


def test_aid_beyond_budget_is_rejected_not_partial(run: Run) -> None:
    s, _ = run(P, russia=CountryOrders(eco_programs=4, aid={"usa": 300}))  # 800 + 300 > 1000
    assert s.country("russia").budget == 200
    assert s.country("usa").aid_pending == 0
