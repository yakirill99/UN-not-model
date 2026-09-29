"""Bots: always legal orders, deterministic, and the behaviour each is named for."""

import pytest
from hypothesis import given, settings

from arena.agents.bots import BOTS, AggressorBot, AvengerBot, EcologistBot, RandomBot, make_bot
from arena.engine.actions import legal_actions, validate
from arena.engine.events import Event, NuclearStrike, SanctionApplied
from arena.engine.observe import observe
from arena.engine.orders import CountryOrders
from arena.engine.runner import Agent, run_game
from arena.engine.scenario import load_scenario
from arena.engine.state import GameState
from tests.conftest import REPO_ROOT
from tests.property.strategies import RULES, game_states


@settings(max_examples=40, deadline=None)
@given(game_states())
def test_every_bot_submits_a_valid_order_anywhere(state: GameState) -> None:
    for name in BOTS:
        for country in state.countries:
            bot = make_bot(name, seed=1)
            space = legal_actions(state, country.id, RULES)
            orders = bot.act(observe(state, country.id), space)
            assert validate(orders, space) == [], (name, country.id, orders)


def test_random_bot_is_deterministic_per_seed() -> None:
    state = load_scenario(REPO_ROOT / "scenarios" / "equal.yaml").initial_state()
    space = legal_actions(state, "russia", RULES)
    obs = observe(state, "russia")
    a = [RandomBot(5).act(obs, space) for _ in range(3)]
    b = [RandomBot(5).act(obs, space) for _ in range(3)]
    assert a == b
    assert any(o != CountryOrders() for o in a)


def test_ecologist_reacts_to_ecology() -> None:
    state = load_scenario(REPO_ROOT / "scenarios" / "equal.yaml").initial_state()
    assert (
        EcologistBot().act(observe(state, "usa"), legal_actions(state, "usa", RULES)).eco_programs
        == 0
    )
    state.ecology = 40
    assert (
        EcologistBot().act(observe(state, "usa"), legal_actions(state, "usa", RULES)).eco_programs
        == 2
    )


def test_aggressor_escalates_and_strikes_the_leader() -> None:
    state = load_scenario(REPO_ROOT / "scenarios" / "smolny.yaml").initial_state()
    for c in state.countries:  # life levels are computed by the engine; seed them
        for city in c.cities:
            city.life_level = city.development * 33 + 3300
    bot = AggressorBot()
    o1 = bot.act(observe(state, "iran"), legal_actions(state, "iran", RULES))
    assert o1.nuclear_tech and o1.sanctions == ["russia"] and not o1.strikes
    iran = state.country("iran")
    iran.nuclear_tech, iran.bombs = True, 2
    o2 = bot.act(observe(state, "iran"), legal_actions(state, "iran", RULES))
    assert set(o2.strikes) == {"ekaterinburg", "moscow"}  # Russia's two best cities
    assert o2.bombs >= 1


def test_avenger_holds_a_grudge() -> None:
    state = load_scenario(REPO_ROOT / "scenarios" / "equal.yaml").initial_state()
    bot = AvengerBot()
    calm = bot.act(observe(state, "france"), legal_actions(state, "france", RULES))
    assert calm.sanctions == [] and not calm.nuclear_tech
    news: list[Event] = [SanctionApplied(round=1, actor="usa", target="france", delta=-5)]
    hit = bot.act(observe(state, "france", news), legal_actions(state, "france", RULES))
    assert hit.sanctions == ["usa"] and not hit.nuclear_tech
    news = [NuclearStrike(round=2, actor=None, target="paris", outcome="destroyed")]
    state.find_city("paris")[1].destroyed = True
    war = bot.act(observe(state, "france", news), legal_actions(state, "france", RULES))
    assert war.nuclear_tech and war.sanctions == ["usa"]


def test_mixed_lineup_plays_a_whole_game_and_bots_see_news() -> None:
    state = load_scenario(REPO_ROOT / "scenarios" / "smolny.yaml").initial_state()
    lineup = ["aggressor", "avenger", "economist", "ecologist", "random"]
    agents: dict[str, Agent] = {
        c.id: make_bot(name, seed=i)
        for i, (c, name) in enumerate(zip(state.countries, lineup, strict=True))
    }
    log = run_game(state, RULES, agents, seed=11, scenario_id="smolny")
    assert log.final_state.round == 7
    assert any(e.type == "nuclear_strike" for r in log.rounds for e in r.events)
    # the economist (France) shields once violence is in the news; it cannot see arsenals
    assert any(r.orders.for_country("france").shields for r in log.rounds)


def test_unknown_bot_name() -> None:
    with pytest.raises(ValueError, match="unknown bot"):
        make_bot("hal9000")
