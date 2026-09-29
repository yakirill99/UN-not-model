"""strikes: limits, shields, simultaneous hits, anonymity is a journal matter."""

from arena.engine.events import CityDestroyed, Event, NuclearStrike, OrderRejected
from arena.engine.orders import CountryOrders
from arena.engine.state import GameState
from tests.unit.systems.conftest import Run

P = ["budget", "build", "strikes"]


def _arm(state: GameState, country: str, bombs: int) -> None:
    c = state.country(country)
    c.nuclear_tech = True
    c.bombs = bombs


def _outcomes(ev: list[Event]) -> list[tuple[str | None, str | None, str]]:
    return [(e.actor, e.target, e.outcome) for e in ev if isinstance(e, NuclearStrike)]


def _rejections(ev: list[Event]) -> list[tuple[str | None, str]]:
    return [(e.target, e.reason) for e in ev if isinstance(e, OrderRejected)]


def test_strike_destroys_unshielded_city(run: Run, state: GameState) -> None:
    _arm(state, "russia", 1)
    s, ev = run(P, russia=CountryOrders(strikes=["paris"]))
    paris = s.find_city("paris")[1]
    assert paris.destroyed and paris.development == 0
    assert s.country("russia").bombs == 0
    assert s.ecology == 95
    assert _outcomes(ev) == [("russia", "paris", "destroyed")]
    assert [e.target for e in ev if isinstance(e, CityDestroyed)] == ["paris"]


def test_shield_absorbs_one_strike(run: Run, state: GameState) -> None:
    _arm(state, "russia", 1)
    state.find_city("paris")[1].shield = True
    s, ev = run(P, russia=CountryOrders(strikes=["paris"]))
    paris = s.find_city("paris")[1]
    assert not paris.destroyed and not paris.shield
    assert _outcomes(ev) == [("russia", "paris", "absorbed")]


def test_shield_built_this_round_protects_this_round(run: Run, state: GameState) -> None:
    _arm(state, "russia", 1)
    s, ev = run(P, russia=CountryOrders(strikes=["paris"]), france=CountryOrders(shields=["paris"]))
    assert not s.find_city("paris")[1].destroyed
    assert _outcomes(ev) == [("russia", "paris", "absorbed")]


def test_two_strikes_on_shielded_city_destroy_it(run: Run, state: GameState) -> None:
    _arm(state, "russia", 1)
    _arm(state, "usa", 1)
    state.find_city("paris")[1].shield = True
    s, ev = run(P, russia=CountryOrders(strikes=["paris"]), usa=CountryOrders(strikes=["paris"]))
    assert s.find_city("paris")[1].destroyed
    assert _outcomes(ev) == [("russia", "paris", "absorbed"), ("usa", "paris", "destroyed")]


def test_second_strike_on_destroyed_city_still_spends_bomb(run: Run, state: GameState) -> None:
    _arm(state, "russia", 1)
    _arm(state, "usa", 1)
    s, ev = run(P, russia=CountryOrders(strikes=["paris"]), usa=CountryOrders(strikes=["paris"]))
    assert s.country("usa").bombs == 0
    assert _outcomes(ev) == [
        ("russia", "paris", "destroyed"),
        ("usa", "paris", "already_destroyed"),
    ]
    assert s.ecology == 90


def test_limits_and_prerequisites(run: Run, state: GameState) -> None:
    _arm(state, "russia", 5)
    state.find_city("chicago")[1].destroyed = True
    o = CountryOrders(
        strikes=["moscow", "mars", "chicago", "paris", "paris", "nice", "tehran", "yazd"]
    )
    s, ev = run(P, russia=o)
    assert _rejections(ev) == [
        ("moscow", "own_city"),
        ("mars", "unknown_city"),
        ("chicago", "city_destroyed"),
        ("paris", "limit_exceeded"),  # 2nd strike on the same city
        ("yazd", "limit_exceeded"),  # 4th strike this round
    ]
    assert _outcomes(ev) == [
        ("russia", "paris", "destroyed"),
        ("russia", "nice", "destroyed"),
        ("russia", "tehran", "destroyed"),
    ]
    assert s.country("russia").bombs == 2


def test_no_bombs_no_strike(run: Run, state: GameState) -> None:
    state.country("russia").nuclear_tech = True
    s, ev = run(
        P, russia=CountryOrders(bombs=1, strikes=["paris"])
    )  # produced this round -> pending
    assert not s.find_city("paris")[1].destroyed
    assert _rejections(ev) == [("paris", "no_bombs")]
    assert s.country("russia").bombs_pending == 1
