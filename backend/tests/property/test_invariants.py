"""Engine invariants that must hold for any state and any orders (DEV_PLAN sprint 2)."""

from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

from arena.engine.events import (
    AidTransferred,
    BombsProduced,
    BudgetSpent,
    IncomeCredited,
    NuclearStrike,
    ShieldBuilt,
)
from arena.engine.orders import OrderBook
from arena.engine.pipeline import resolve_round
from arena.engine.state import GameState
from tests.property.strategies import RULES, game_states, order_books, states_with_orders

FAST = settings(max_examples=60, deadline=None)


@FAST
@given(states_with_orders(), st.integers(0, 2**31))
def test_state_stays_valid_and_bounded(case: tuple[GameState, OrderBook], seed: int) -> None:
    state, orders = case
    new, events = resolve_round(state, orders, RULES, seed)
    GameState.model_validate(new.model_dump())  # all model constraints still hold
    assert RULES.params.ecology.min <= new.ecology <= RULES.params.ecology.max
    assert new.round == state.round + 1
    assert all(e.round == state.round for e in events)
    for c in new.countries:
        assert c.budget >= 0 and c.bombs >= 0 and c.aid_pending == 0 and c.bombs_pending == 0
        assert c.sanctioned_by == []
        for city in c.cities:
            assert city.development >= 0 and city.life_level >= 0


@FAST
@given(states_with_orders(), st.integers(0, 2**31))
def test_destroyed_cities_stay_dead_and_earn_nothing(
    case: tuple[GameState, OrderBook], seed: int
) -> None:
    state, orders = case
    dead_before = {c.id for co in state.countries for c in co.cities if c.destroyed}
    new, events = resolve_round(state, orders, RULES, seed)
    for co in new.countries:
        for c in co.cities:
            if c.id in dead_before:
                assert c.destroyed and c.development == 0 and c.life_level == 0 and not c.shield
    struck = {e.target for e in events if isinstance(e, NuclearStrike) and e.outcome == "destroyed"}
    dead_after = {c.id for co in new.countries for c in co.cities if c.destroyed}
    assert dead_after == dead_before | struck


@FAST
@given(states_with_orders(), st.integers(0, 2**31))
def test_money_is_accounted_for(case: tuple[GameState, OrderBook], seed: int) -> None:
    """Σ(budget + aid_pending) changes only by what was spent (not aid) and what was earned."""
    state, orders = case
    before = sum(c.budget + c.aid_pending for c in state.countries)
    new, events = resolve_round(state, orders, RULES, seed)
    after = sum(c.budget + c.aid_pending for c in new.countries)
    spent = sum(e.amount for e in events if isinstance(e, BudgetSpent) and e.action != "aid")
    earned = sum(e.amount for e in events if isinstance(e, IncomeCredited))
    aid_out = sum(e.amount for e in events if isinstance(e, BudgetSpent) and e.action == "aid")
    aid_in = sum(e.amount for e in events if isinstance(e, AidTransferred))
    assert aid_out == aid_in  # nothing lost in transit
    assert after == before - spent + earned


@FAST
@given(states_with_orders(), st.integers(0, 2**31))
def test_arsenal_bookkeeping(case: tuple[GameState, OrderBook], seed: int) -> None:
    state, orders = case
    new, events = resolve_round(state, orders, RULES, seed)
    for co in new.countries:
        old = state.country(co.id)
        launched = sum(1 for e in events if isinstance(e, NuclearStrike) and e.actor == co.id)
        produced = sum(e.count for e in events if isinstance(e, BombsProduced) and e.actor == co.id)
        assert co.bombs == old.bombs - launched + old.bombs_pending + produced
        assert launched <= old.bombs  # never fires a bomb produced this round
        assert launched <= (RULES.action("strike").max_per_round or launched)
        assert co.nuclear_tech or produced == 0


@FAST
@given(states_with_orders(), st.integers(0, 2**31))
def test_shields_only_appear_when_built_and_vanish_when_hit(
    case: tuple[GameState, OrderBook], seed: int
) -> None:
    state, orders = case
    new, events = resolve_round(state, orders, RULES, seed)
    built = {e.target for e in events if isinstance(e, ShieldBuilt)}
    absorbed = {
        e.target for e in events if isinstance(e, NuclearStrike) and e.outcome == "absorbed"
    }
    for co in new.countries:
        for c in co.cities:
            had = state.find_city(c.id)[1].shield
            expected = (had or c.id in built) and c.id not in absorbed and not c.destroyed
            assert c.shield == expected, c.id


@settings(max_examples=15, deadline=None)
@given(game_states(), st.integers(0, 2**31), st.data())
def test_a_whole_game_never_crashes(state: GameState, seed: int, data: st.DataObject) -> None:
    state.round = 1
    for _ in range(RULES.params.rounds):
        orders = data.draw(order_books(state))
        state, _ = resolve_round(state, orders, RULES, seed)
    assert state.round == RULES.params.rounds + 1
