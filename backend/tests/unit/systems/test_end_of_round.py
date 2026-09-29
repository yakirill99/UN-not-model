"""end_of_round: pending -> available, sanctions lifted, shields kept, round advanced."""

from arena.engine.events import RoundEnded
from arena.engine.orders import CountryOrders, OrderBook
from arena.engine.pipeline import resolve_round
from arena.engine.rules import RuleSet
from arena.engine.state import GameState
from tests.unit.systems.conftest import Run

P = ["end_of_round"]


def test_releases_pending_and_lifts_sanctions(run: Run, state: GameState) -> None:
    r = state.country("russia")
    r.bombs_pending, r.aid_pending, r.sanctioned_by = 2, 300, ["usa", "iran"]
    r.city("moscow").shield = True
    s, ev = run(P)
    r2 = s.country("russia")
    assert (r2.bombs, r2.bombs_pending) == (2, 0)
    assert (r2.budget, r2.aid_pending) == (1300, 0)
    assert r2.sanctioned_by == []
    assert r2.city("moscow").shield  # shields persist until used
    assert s.round == state.round + 1
    e = next(e for e in ev if isinstance(e, RoundEnded) and e.actor == "russia")
    assert (e.bombs_released, e.aid_credited, e.sanctions_lifted, e.budget_after) == (
        2,
        300,
        2,
        1300,
    )


def test_bombs_and_aid_usable_only_next_round(state: GameState, rules: RuleSet) -> None:
    """Two rounds through the full v1.0 pipeline: a bomb produced in round 1 fires in round 2."""
    state.country("russia").nuclear_tech = True
    orders = OrderBook(
        orders={
            "russia": CountryOrders(bombs=1, strikes=["paris"]),
            "usa": CountryOrders(aid={"iran": 200}),
        }
    )
    s1, _ = resolve_round(state, orders, rules, seed=1)
    assert s1.round == 2
    assert s1.country("russia").bombs == 1 and not s1.find_city("paris")[1].destroyed
    assert s1.country("iran").aid_pending == 0
    assert s1.country("iran").budget == 1000 + 200 + 4 * (
        60 + 150 * 95 // 100
    )  # aid + income at eco 95
    s2, _ = resolve_round(
        s1, OrderBook(orders={"russia": CountryOrders(strikes=["paris"])}), rules, 1
    )
    assert s2.find_city("paris")[1].destroyed and s2.country("russia").bombs == 0
