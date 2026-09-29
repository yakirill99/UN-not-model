"""Hypothesis strategies: plausible mid-game states and (mostly legal) orders.

States start from the ``equal`` scenario and are perturbed: budgets, development,
ecology, arsenals, shields, destroyed cities, sanctions. Orders are drawn from the
country's ActionSpace so most are legal, with a sprinkle of illegal targets so the
rejection paths are exercised too.
"""

from __future__ import annotations

from hypothesis import strategies as st

from arena.engine.actions import legal_actions
from arena.engine.orders import CountryOrders, HostInput, OrderBook
from arena.engine.rules import RuleSet, load_rules
from arena.engine.scenario import load_scenario
from arena.engine.state import GameState
from tests.conftest import REPO_ROOT

RULES: RuleSet = load_rules("v1.0", REPO_ROOT / "rules")
BASE: GameState = load_scenario(REPO_ROOT / "scenarios" / "equal.yaml").initial_state()
COUNTRY_IDS = [c.id for c in BASE.countries]
CITY_IDS = [c.id for co in BASE.countries for c in co.cities]


@st.composite
def game_states(draw: st.DrawFn) -> GameState:
    s = BASE.model_copy(deep=True)
    s.round = draw(st.integers(1, RULES.params.rounds))
    s.ecology = draw(st.integers(RULES.params.ecology.min, RULES.params.ecology.max))
    for c in s.countries:
        c.budget = draw(st.integers(0, 3000))
        c.nuclear_tech = draw(st.booleans())
        c.bombs = draw(st.integers(0, 4)) if c.nuclear_tech else 0
        c.bombs_pending = draw(st.integers(0, 3)) if c.nuclear_tech else 0
        c.laugh = draw(st.sampled_from([0, 20, 40]))
        c.aid_pending = draw(st.integers(0, 500))
        for city in c.cities:
            city.destroyed = draw(st.booleans()) if draw(st.integers(0, 9)) == 0 else False
            city.development = 0 if city.destroyed else draw(st.integers(0, 250))
            city.shield = False if city.destroyed else draw(st.booleans())
    return s


@st.composite
def order_books(draw: st.DrawFn, state: GameState) -> OrderBook:
    orders: dict[str, CountryOrders] = {}
    for c in state.countries:
        if draw(st.integers(0, 4)) == 0:
            continue  # this country submits nothing
        space = legal_actions(state, c.id, RULES).actions
        own = space["invest"].targets or []
        foreign = space["strike"].targets or []
        others = space["sanction"].targets or []
        noise = st.sampled_from([*CITY_IDS, "nowhere"])  # illegal targets sneak in
        orders[c.id] = CountryOrders(
            invest=draw(st.lists(st.one_of(st.sampled_from(own or ["x"]), noise), max_size=6)),
            eco_programs=draw(st.integers(0, 3)),
            nuclear_tech=draw(st.booleans()),
            bombs=draw(st.integers(0, 4)),
            strikes=draw(st.lists(st.one_of(st.sampled_from(foreign or ["x"]), noise), max_size=4)),
            shields=draw(st.lists(st.sampled_from(own or ["x"]), max_size=3)),
            sanctions=draw(st.lists(st.sampled_from([*others, c.id]), max_size=3)),
            aid=draw(
                st.dictionaries(
                    st.sampled_from([*others, "nowhere"]), st.integers(1, 400), max_size=2
                )
            ),
        )
    host = HostInput(laugh_winner=draw(st.sampled_from([None, *COUNTRY_IDS])))
    return OrderBook(orders=orders, host=host)


@st.composite
def states_with_orders(draw: st.DrawFn) -> tuple[GameState, OrderBook]:
    state = draw(game_states())
    return state, draw(order_books(state))
