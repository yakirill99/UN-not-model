"""Rules v2.0: stability, rating, private capital, climate, charisma, power change.

The worked example in GAME_RULES_2.md 18 is the specification: «Устойчивость
60 - 3 + 2 - 3 + 10 = 66», «Оценка = 48 → рейтинг C, вес 3», «Доля X = 800 x 3 /
13 ≈ 185$». The engine must reproduce it exactly — these tests are that promise.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from arena.engine.actions import legal_actions
from arena.engine.orders import CountryOrders, HostInput, OrderBook
from arena.engine.pipeline import resolve_round
from arena.engine.rng import RngFactory
from arena.engine.rules import RuleSet, load_rules
from arena.engine.runner import IdleAgent, replay, run_game
from arena.engine.scenario import load_scenario
from arena.engine.state import City, Country, GameState, score_of
from arena.engine.systems.base import RoundContext
from arena.engine.systems.capital import CapitalSystem
from arena.engine.systems.charisma import CharismaSystem
from arena.engine.systems.climate import ClimateSystem
from arena.engine.systems.develop import DevelopSystem
from arena.engine.systems.income import IncomeSystem
from arena.engine.systems.rating import RatingSystem
from arena.engine.systems.stability import StabilitySystem

RULES_DIR = Path(__file__).resolve().parents[3] / "rules"


@pytest.fixture(scope="module")
def v2() -> RuleSet:
    return load_rules("v2.0", RULES_DIR)


def ctx_of(
    rules: RuleSet,
    state: GameState,
    approved: dict[str, CountryOrders] | None = None,
    round_no: int = 1,
) -> RoundContext:
    """A RoundContext like resolve_round builds: every country has an entry."""
    extra = approved or {}
    return RoundContext(
        rules=rules,
        rng=RngFactory(0, round_no),
        round=round_no,
        approved={c.id: extra.get(c.id, CountryOrders()) for c in state.countries},
    )


def mini_state(**country_kwargs) -> GameState:
    """One country ('x') with one city; keyword args go to the Country."""
    fields = {"id": "x", "name": "X", "budget": 1000}
    fields |= country_kwargs
    fields.setdefault("cities", [City(id="x1", name="X1", development=50)])
    return GameState(round=1, ecology=100, countries=[Country(**fields)])


def book(approved: dict[str, CountryOrders]) -> OrderBook:
    return OrderBook(orders=approved)


# --- stability: the doc example ------------------------------------------------


def test_doc_example_stability(v2: RuleSet) -> None:
    """GAME_RULES_2.md 18: динамика -3, уровень +2, санкция -3, соцпрограмма +10.

    Итого 60 + (-3 + 2 - 3 + 10) = 66 — «⚪ Норма».
    """
    # Average life fell from 55 % to 50 %; one sanction; social program ordered.
    state = mini_state(
        stability=60,
        average_life_prev=5500,
        sanctioned_by=["usa"],
        cities=[City(id="x1", name="X1", development=50, life_level=5000)],
    )
    approved = {"x": CountryOrders(social_program=True)}
    events = StabilitySystem(v2).apply(state, book(approved), ctx_of(v2, state, approved))
    x = state.country("x")
    assert (x.stability, x.average_life_prev) == (66, 5000)
    changed = next(e for e in events if e.type == "stability_changed")
    assert (changed.dynamics, changed.level_effect, changed.shocks, changed.actions) == (
        -3,
        2,
        -3,
        10,
    )


def test_stability_level_bands(v2: RuleSet) -> None:
    """≥ 50 %: +2; 30-49 %: 0; < 30 %: -3 (no other terms, no previous round)."""
    for life, expected in ((5000, 2), (4999, 0), (3000, 0), (2999, -3)):
        state = mini_state(
            stability=50, cities=[City(id="x1", name="X1", development=1, life_level=life)]
        )
        StabilitySystem(v2).apply(state, book({}), ctx_of(v2, state))
        assert state.country("x").stability == 50 + expected, life


def test_stability_city_losses(v2: RuleSet) -> None:
    """First city ever lost: -5 («сплочение вокруг флага»); the next ones: -15 each.

    The dead city's life is 0 (as life_level leaves it), so the surviving city's
    life is set to keep the average inside the neutral band (level effect 0).
    """
    state = mini_state(
        stability=60,
        cities=[
            City(id="x1", name="X1", development=1, life_level=0, destroyed=True),
            City(id="x2", name="X2", development=1, life_level=8000),
        ],
        cities_lost=1,
        cities_lost_this_round=1,
    )
    StabilitySystem(v2).apply(state, book({}), ctx_of(v2, state))
    assert state.country("x").stability == 60 - 5  # first loss

    state = mini_state(
        stability=60,
        cities=[City(id="x1", name="X1", development=1, life_level=4000)],
        # cities_lost counts the whole game INCLUDING this round: one lost before,
        # one lost now -> the new loss is the second ever.
        cities_lost=2,
        cities_lost_this_round=1,
    )
    StabilitySystem(v2).apply(state, book({}), ctx_of(v2, state))
    assert state.country("x").stability == 60 - 15  # second loss ever
    assert state.country("x").cities_lost_this_round == 0  # consumed


def test_power_change(v2: RuleSet) -> None:
    """Stability 0: budget halves, government is not recognised, stability resets to 40."""
    state = mini_state(
        stability=3,
        budget=1000,
        cities=[City(id="x1", name="X1", development=20, life_level=2000)],
    )
    events = StabilitySystem(v2).apply(state, book({}), ctx_of(v2, state))
    x = state.country("x")
    assert (x.stability, x.in_transition, x.powers_lost, x.budget) == (40, True, 1, 500)
    assert any(e.type == "power_changed" for e in events)
    # The final score carries the penalty: УЖ 20 % + 0.2 x 40 - 10 = 18.
    assert score_of(x, 2) == 2000 + 20 * 40 - 1000


def test_crisis_refuses_strikes(v2: RuleSet) -> None:
    """Stability 1-19: «армия отказывается выполнять приказы на ядерные удары»."""
    state = mini_state(
        stability=15,
        nuclear_tech=True,
        bombs=2,
        cities=[City(id="x1", name="X1", development=50)],
    )
    state.countries.append(
        Country(id="y", name="Y", budget=0, cities=[City(id="y1", name="Y1", development=10)])
    )
    space = legal_actions(state, "x", v2)
    assert space.actions["strike"].available is False
    assert space.actions["strike"].reason == "army_refuses"

    state.country("x").stability = 75
    space = legal_actions(state, "x", v2)
    assert space.actions["strike"].available is True


def test_transition_round_refuses_strikes(v2: RuleSet) -> None:
    state = mini_state(
        stability=60,
        nuclear_tech=True,
        bombs=1,
        in_transition=True,
        cities=[City(id="x1", name="X1", development=50)],
    )
    state.countries.append(
        Country(id="y", name="Y", budget=0, cities=[City(id="y1", name="Y1", development=10)])
    )
    space = legal_actions(state, "x", v2)
    assert space.actions["strike"].available is False
    assert space.actions["strike"].reason == "no_government"


# --- rating: the doc example ---------------------------------------------------


def test_doc_example_rating(v2: RuleSet) -> None:
    """GAME_RULES_2.md 18: 0.5 x 66 + 0.5 x 50 - 10 (санкция) = 48 → рейтинг C, вес 3."""
    state = mini_state(
        stability=66,
        sanctioned_by=["usa"],
        cities=[City(id="x1", name="X1", development=50, life_level=5000)],
    )
    RatingSystem(v2).apply(state, book({}), ctx_of(v2, state))
    x = state.country("x")
    assert (x.rating_score, x.rating, x.rating_weight) == (48, "C", 3)


def test_rating_bands_and_nuclear(v2: RuleSet) -> None:
    """Nuclear tech -10; bombs produced this round -5 each; eco program +5."""
    state = mini_state(
        stability=80,
        nuclear_tech=True,
        cities=[City(id="x1", name="X1", development=50, life_level=5000)],
    )
    # 0.5 x 80 + 0.5 x 50 = 65, - 10 (технология) - 5 (бомба) = 50 → C.
    approved = {"x": CountryOrders(bombs=1)}
    RatingSystem(v2).apply(state, book(approved), ctx_of(v2, state, approved))
    assert (state.country("x").rating_score, state.country("x").rating) == (50, "C")

    # Same country with an eco program instead: 65 + 5 = 70 → B.
    state2 = mini_state(
        stability=80, cities=[City(id="x1", name="X1", development=50, life_level=5000)]
    )
    approved = {"x": CountryOrders(eco_programs=1)}
    RatingSystem(v2).apply(state2, book(approved), ctx_of(v2, state2, approved))
    assert (state2.country("x").rating_score, state2.country("x").rating) == (70, "B")


# --- capital: the doc example --------------------------------------------------


def test_doc_example_capital(v2: RuleSet) -> None:
    """GAME_RULES_2.md 18: пул 800$, веса 3+4+3+2+1, доля X = 800 x 3 / 13 ≈ 185$."""
    rules = v2.model_copy(deep=True)
    rules.params.private_pool.jitter_percent = 0  # the doc quotes the share without noise
    state = GameState(
        round=1,
        ecology=80,
        countries=[
            Country(
                id="x",
                name="X",
                budget=0,
                rating_weight=3,
                cities=[City(id="x1", name="X1", development=1)],
            ),
            Country(
                id="a",
                name="A",
                budget=0,
                rating_weight=4,
                cities=[City(id="a1", name="A1", development=1)],
            ),
            Country(
                id="b",
                name="B",
                budget=0,
                rating_weight=3,
                cities=[City(id="b1", name="B1", development=1)],
            ),
            Country(
                id="c",
                name="C",
                budget=0,
                rating_weight=2,
                cities=[City(id="c1", name="C1", development=1)],
            ),
            Country(
                id="d",
                name="D",
                budget=0,
                rating_weight=1,
                cities=[City(id="d1", name="D1", development=1)],
            ),
        ],
    )
    events = CapitalSystem(rules).apply(state, book({}), ctx_of(rules, state))
    shares = {e.actor: e.amount for e in events}
    assert events[0].pool == 800
    assert shares["x"] == 185  # 800 x 3 / 13 = 184.6 -> 185
    # Rounding may leave a small residue on either side of the pool.
    assert abs(sum(shares.values()) - 800) <= 3


def test_capital_jitter_bounds(v2: RuleSet) -> None:
    """One country, full share of the pool: 1000$ ± 10 % of market noise."""
    for round_no in range(1, 21):
        state = mini_state(budget=0, cities=[City(id="x1", name="X1", development=1)])
        events = CapitalSystem(v2).apply(state, book({}), ctx_of(v2, state, round_no=round_no))
        assert 900 <= events[0].amount <= 1100


def test_collapse_dries_the_pool(v2: RuleSet) -> None:
    state = mini_state(budget=0, cities=[City(id="x1", name="X1", development=1)])
    state.ecology = 0
    assert CapitalSystem(v2).apply(state, book({}), ctx_of(v2, state)) == []


# --- climate -------------------------------------------------------------------


def test_climate_unstable_hits_one_city(v2: RuleSet) -> None:
    state = GameState(
        round=1,
        ecology=45,
        countries=[
            Country(id="x", name="X", budget=0, cities=[City(id="x1", name="X1", development=60)]),
            Country(id="y", name="Y", budget=0, cities=[City(id="y1", name="Y1", development=60)]),
        ],
    )
    events = ClimateSystem(v2).apply(state, book({}), ctx_of(v2, state))
    assert [e.level for e in events] == ["unstable", "unstable"]
    assert state.country("x").city("x1").development == 55
    assert state.country("y").city("y1").development == 55


def test_climate_catastrophe_and_collapse(v2: RuleSet) -> None:
    state = mini_state(stability=50, cities=[City(id="x1", name="X1", development=60)])
    state.ecology = 20
    events = ClimateSystem(v2).apply(state, book({}), ctx_of(v2, state))
    assert events[0].level == "catastrophe"
    assert state.country("x").stability == 40  # 50 - 10

    state.ecology = 0
    events = ClimateSystem(v2).apply(state, book({}), ctx_of(v2, state))
    assert events[0].level == "collapse"


def test_climate_fine_band_is_silent(v2: RuleSet) -> None:
    for eco in (60, 100):
        state = mini_state(cities=[City(id="x1", name="X1", development=60)])
        state.ecology = eco
        assert ClimateSystem(v2).apply(state, book({}), ctx_of(v2, state)) == []


# --- income modifiers ----------------------------------------------------------


def test_income_stability_and_climate(v2: RuleSet) -> None:
    income = IncomeSystem(v2)
    x = Country(
        id="x", name="X", budget=0, stability=75, cities=[City(id="x1", name="X1", development=65)]
    )
    assert income.income_percent(x, 100) == 10  # 70+: +10 %
    assert income.city_income(x.city("x1"), 100) == 215  # the v1 example: 65 + 150
    assert income.income_percent(x, 20) == -10  # climate -20 on top of stability +10


def test_income_is_pure_v1_without_the_module() -> None:
    v1 = load_rules("v1.0", RULES_DIR)
    income = IncomeSystem(v1)
    x = Country(
        id="x", name="X", budget=0, stability=5, cities=[City(id="x1", name="X1", development=65)]
    )
    assert income.income_percent(x, 20) == 0  # no v2_core module -> no modifiers


def test_income_forecast_matches_modifiers(v2: RuleSet) -> None:
    from arena.engine.observe import observe

    state = mini_state(stability=75, cities=[City(id="x1", name="X1", development=65)])
    obs = observe(state, "x", rules=v2)
    assert obs.income_forecast == 236  # 215 x 110 // 100
    assert obs.me.stability == 75 and obs.me.rating is not None


def test_v1_observation_hides_v2_fields() -> None:
    from arena.engine.observe import observe

    v1 = load_rules("v1.0", RULES_DIR)
    state = mini_state(cities=[City(id="x1", name="X1", development=65)])
    obs = observe(state, "x", rules=v1)
    assert obs.me.stability is None and obs.me.rating is None


# --- diminishing returns -------------------------------------------------------


def test_invest_tiers(v2: RuleSet) -> None:
    develop = DevelopSystem(v2)
    assert [develop._gain(d) for d in (0, 99, 100, 149, 150, 300)] == [15, 15, 10, 10, 5, 5]


def test_invest_tiers_via_pipeline(v2: RuleSet) -> None:
    state = GameState(
        round=1,
        ecology=100,
        countries=[
            Country(
                id="x",
                name="X",
                budget=1000,
                cities=[
                    City(id="low", name="Low", development=90),
                    City(id="high", name="High", development=150),
                ],
            )
        ],
    )
    orders = book({"x": CountryOrders(invest=["low", "high"])})
    new, _ = resolve_round(state, orders, v2, 0)
    assert new.country("x").city("low").development == 105  # 90 + 15
    assert new.country("x").city("high").development == 155  # 150 + 5


def test_v1_invest_is_flat() -> None:
    v1 = load_rules("v1.0", RULES_DIR)
    state = GameState(
        round=1,
        ecology=100,
        countries=[
            Country(
                id="x", name="X", budget=1000, cities=[City(id="x1", name="X1", development=170)]
            )
        ],
    )
    new, _ = resolve_round(state, book({"x": CountryOrders(invest=["x1"])}), v1, 0)
    assert new.country("x").city("x1").development == 185  # +15 at any level


# --- charisma and social program -----------------------------------------------


def test_charisma_gives_stability_not_life(v2: RuleSet) -> None:
    state = mini_state(stability=50, cities=[City(id="x1", name="X1", development=50)])
    orders = OrderBook(orders={}, host=HostInput(laugh_winner="x"))
    events = CharismaSystem(v2).apply(state, orders, ctx_of(v2, state))
    x = state.country("x")
    assert (x.stability, x.laugh) == (55, 0)
    assert events[0].type == "charisma_awarded" and events[0].bonus == 5


def test_social_program_costs_and_boosts(v2: RuleSet) -> None:
    state = mini_state(stability=50, cities=[City(id="x1", name="X1", development=50)])
    orders = book({"x": CountryOrders(social_program=True)})
    new, events = resolve_round(state, orders, v2, 0)
    x = new.country("x")
    assert x.stability == 62  # 50 + 10 (программа) + 2 (УЖ 55 %)
    spent = [e for e in events if e.type == "budget_spent" and e.action == "social_program"]
    assert [e.amount for e in spent] == [150]


def test_social_program_unknown_in_v1() -> None:
    """A crafted social-program order against v1 rules is rejected, never paid."""
    v1 = load_rules("v1.0", RULES_DIR)
    state = mini_state(cities=[City(id="x1", name="X1", development=50)])
    new, events = resolve_round(state, book({"x": CountryOrders(social_program=True)}), v1, 0)
    assert any(e.type == "order_rejected" and e.action == "social_program" for e in events)
    # v1 income of this city (50 + 150 = 200) arrives, but the 150$ program is not paid.
    assert new.country("x").budget == 1000 + 200


def test_v1_stability_defaults_inert() -> None:
    """A v1 strike at default stability 60 is fine: the v2 checks must stay silent."""
    v1 = load_rules("v1.0", RULES_DIR)
    state = GameState(
        round=1,
        ecology=100,
        countries=[
            Country(
                id="x",
                name="X",
                budget=0,
                nuclear_tech=True,
                bombs=1,
                cities=[City(id="x1", name="X1", development=50)],
            ),
            Country(id="y", name="Y", budget=0, cities=[City(id="y1", name="Y1", development=50)]),
        ],
    )
    space = legal_actions(state, "x", v1)
    assert space.actions["strike"].available is True
    new, _ = resolve_round(state, book({"x": CountryOrders(strikes=["y1"])}), v1, 0)
    assert new.country("y").city("y1").destroyed is True


# --- the whole game ------------------------------------------------------------


def test_v2_full_game_replays(v2: RuleSet) -> None:
    scenario = load_scenario(RULES_DIR.parent / "scenarios" / "equal.yaml")
    log = run_game(
        scenario.initial_state(),
        v2,
        {c.id: IdleAgent() for c in scenario.countries},
        seed=7,
        scenario_id=scenario.id,
    )
    assert replay(log) == []  # deterministic: same inputs, same world
    standings = log.standings()
    assert len(standings) == 5
    # v2 standings use the итоговый счёт, not bare average life.
    top_id, top_score = standings[0]
    assert top_score == score_of(log.final_state.country(top_id), 2)


def test_charisma_via_pipeline_news(v2: RuleSet) -> None:
    scenario = load_scenario(RULES_DIR.parent / "scenarios" / "equal.yaml")
    orders = OrderBook(orders={}, host=HostInput(laugh_winner="russia"))
    _, events = resolve_round(scenario.initial_state(), orders, v2, 0)
    assert any(e.type == "charisma_awarded" for e in events)
