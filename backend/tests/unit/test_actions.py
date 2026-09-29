"""ActionSpace and structural validation."""

from arena.engine.actions import legal_actions, validate
from arena.engine.orders import CountryOrders
from arena.engine.rules import RuleSet, load_rules
from arena.engine.scenario import load_scenario
from arena.engine.state import GameState
from tests.conftest import REPO_ROOT


def _setup() -> tuple[GameState, RuleSet]:
    rules = load_rules("v1.0", REPO_ROOT / "rules")
    state = load_scenario(REPO_ROOT / "scenarios" / "equal.yaml").initial_state()
    return state, rules


def test_space_lists_every_action_from_rules() -> None:
    state, rules = _setup()
    space = legal_actions(state, "russia", rules)
    assert set(space.actions) == set(rules.actions)
    assert all(o.ui.title for o in space.actions.values())
    assert space.budget == 1000


def test_targets_and_availability_at_start() -> None:
    state, rules = _setup()
    a = legal_actions(state, "russia", rules).actions
    assert a["invest"].targets == ["moscow", "spb", "ekaterinburg", "rostov"]
    assert a["shield"].targets == a["invest"].targets
    assert a["strike"].available is False and a["strike"].reason == "no_bombs"
    assert "moscow" not in (a["strike"].targets or [])
    assert a["sanction"].targets == ["usa", "france", "iran", "dprk"]
    assert not a["bomb"].available and a["bomb"].reason == "requires_nuclear_tech"
    assert a["nuclear_tech"].available


def test_availability_follows_state() -> None:
    state, rules = _setup()
    r = state.country("russia")
    r.nuclear_tech, r.bombs, r.budget = True, 2, 100
    r.city("moscow").shield = True
    state.find_city("paris")[1].destroyed = True
    a = legal_actions(state, "russia", rules).actions
    assert a["nuclear_tech"].reason == "already_owned"
    assert a["strike"].available and a["strike"].max_count == 2
    assert "paris" not in (a["strike"].targets or [])
    assert a["shield"].targets == ["spb", "ekaterinburg", "rostov"]
    assert a["eco_program"].reason == "insufficient_budget"
    assert a["bomb"].reason == "insufficient_budget"


def test_validate_accepts_a_sane_order() -> None:
    state, rules = _setup()
    space = legal_actions(state, "russia", rules)
    assert (
        validate(CountryOrders(invest=["moscow", "spb"], eco_programs=1, aid={"usa": 100}), space)
        == []
    )


def test_validate_reports_every_problem() -> None:
    state, rules = _setup()
    state.country("russia").nuclear_tech = True
    state.country("russia").bombs = 1
    space = legal_actions(state, "russia", rules)
    o = CountryOrders(
        invest=["paris"],
        strikes=["paris", "paris"],
        shields=["moscow", "moscow"],
        sanctions=["russia"],
        aid={"usa": 0 + 1, "mars": 5},
        nuclear_tech=True,
        bombs=4,
        eco_programs=10,
    )
    reasons = {(e.action, e.target, e.reason) for e in validate(o, space)}
    assert ("invest", "paris", "invalid_target") in reasons
    assert ("strike", "paris", "limit_exceeded") in reasons
    assert ("shield", "moscow", "limit_exceeded") in reasons
    assert ("sanction", "russia", "invalid_target") in reasons
    assert ("aid", "mars", "invalid_target") in reasons
    assert ("nuclear_tech", None, "already_owned") in reasons
    assert ("bomb", None, "limit_exceeded") in reasons
    assert ("*", None, "over_budget") in reasons


def test_space_is_serialisable_for_frontend_and_llm() -> None:
    state, rules = _setup()
    space = legal_actions(state, "russia", rules)
    schema = space.model_json_schema()
    assert "ActionOption" in schema["$defs"]
    assert space.model_validate_json(space.model_dump_json()) == space
