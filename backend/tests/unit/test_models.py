"""State, orders and events: shape, invariants and JSON round-trip."""

from typing import Any

import pytest
from pydantic import ValidationError

from arena.engine.events import (
    EVENT_SCHEMA_VERSION,
    CityInvested,
    Event,
    LifeLevelComputed,
    NuclearStrike,
    OrderRejected,
    SanctionApplied,
    dump_events,
    load_events,
)
from arena.engine.orders import CountryOrders, OrderBook
from arena.engine.state import City, Country, GameState


def _state() -> GameState:
    return GameState(
        round=1,
        ecology=100,
        countries=[
            Country(
                id="a",
                name="A",
                budget=1000,
                cities=[
                    City(id="a1", name="A1", development=65),
                    City(id="a2", name="A2", development=10),
                ],
            ),
            Country(
                id="b", name="B", budget=500, cities=[City(id="b1", name="B1", development=50)]
            ),
        ],
    )


# --- state --------------------------------------------------------------------


def test_state_round_trip() -> None:
    s = _state()
    assert GameState.model_validate_json(s.model_dump_json()) == s
    assert s.state_schema_version == 1


def test_state_rejects_unknown_field() -> None:
    with pytest.raises(ValidationError):
        City(id="x", name="X", development=1, colour="red")  # type: ignore[call-arg]


def test_state_rejects_negative_numbers() -> None:
    with pytest.raises(ValidationError):
        City(id="x", name="X", development=-1)
    with pytest.raises(ValidationError):
        Country(id="c", name="C", budget=-5, cities=[City(id="x", name="X", development=1)])


def test_country_ids_unique() -> None:
    s = _state()
    with pytest.raises(ValidationError, match="duplicate country ids"):
        GameState(round=1, ecology=100, countries=[s.countries[0], s.countries[0]])


def test_city_ids_unique_across_countries() -> None:
    dup = Country(id="c", name="C", budget=1, cities=[City(id="a1", name="Dup", development=1)])
    with pytest.raises(ValidationError, match="unique across"):
        GameState(round=1, ecology=100, countries=[*_state().countries, dup])


def test_city_ids_unique_within_country() -> None:
    with pytest.raises(ValidationError, match="duplicate city ids"):
        Country(
            id="c",
            name="C",
            budget=1,
            cities=[City(id="x", name="X", development=1), City(id="x", name="Y", development=1)],
        )


def test_lookups() -> None:
    s = _state()
    assert s.country("b").name == "B"
    owner, city = s.find_city("a2")
    assert owner.id == "a" and city.development == 10
    assert s.city_owner("b1").id == "b"
    with pytest.raises(KeyError):
        s.country("zzz")
    with pytest.raises(KeyError):
        s.find_city("zzz")


def test_alive_and_total_development() -> None:
    c = _state().countries[0]
    assert c.total_development == 75
    c.cities[1].destroyed = True
    assert [x.id for x in c.alive_cities] == ["a1"]
    assert c.total_development == 65


# --- orders -------------------------------------------------------------------


def test_orders_defaults_are_empty() -> None:
    o = CountryOrders()
    assert o.is_empty
    assert OrderBook().for_country("nobody") == o


def test_orders_round_trip() -> None:
    book = OrderBook(
        orders={"a": CountryOrders(invest=["a1", "a1"], eco_programs=2, aid={"b": 100})},
        host={"laugh_winner": "b"},
    )
    assert OrderBook.model_validate_json(book.model_dump_json()) == book
    assert not book.for_country("a").is_empty


def test_orders_reject_bad_input() -> None:
    with pytest.raises(ValidationError):
        CountryOrders(aid={"b": 0})
    with pytest.raises(ValidationError):
        CountryOrders(bombs=-1)
    with pytest.raises(ValidationError):
        CountryOrders(unknown=1)  # type: ignore[call-arg]


# --- events -------------------------------------------------------------------


def test_events_round_trip_through_discriminated_union() -> None:
    events: list[Event] = [
        OrderRejected(round=1, actor="a", action="invest", reason="insufficient_budget"),
        CityInvested(round=1, actor="a", target="a1", development_before=65, development_after=80),
        LifeLevelComputed(round=1, target="a1", life_level=5445),
        NuclearStrike(round=2, actor="b", target="a1", outcome="absorbed"),
        SanctionApplied(round=2, actor="b", target="a", delta=-5),
    ]
    raw = dump_events(events)
    assert [r["type"] for r in raw] == [
        "order_rejected",
        "city_invested",
        "life_level_computed",
        "nuclear_strike",
        "sanction_applied",
    ]
    assert all(r["schema_version"] == EVENT_SCHEMA_VERSION for r in raw)
    loaded = load_events(raw)
    assert loaded == events
    assert isinstance(loaded[1], CityInvested)


def test_events_unknown_type_is_error() -> None:
    bad: list[dict[str, Any]] = [{"type": "teleport", "round": 1}]
    with pytest.raises(ValidationError):
        load_events(bad)


def test_events_newer_schema_is_error() -> None:
    raw = dump_events([LifeLevelComputed(round=1, target="a1", life_level=1)])
    raw[0]["schema_version"] = EVENT_SCHEMA_VERSION + 1
    with pytest.raises(ValueError, match="newer than supported"):
        load_events(raw)
