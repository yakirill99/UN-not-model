"""Secrecy: what a delegation sees, and what it must not."""

from arena.engine.events import NuclearStrike
from arena.engine.observe import Observation, observe, visible_events
from arena.engine.orders import CountryOrders, HostInput, OrderBook
from arena.engine.pipeline import resolve_round
from arena.engine.rules import RuleSet, load_rules
from arena.engine.scenario import load_scenario
from arena.engine.state import GameState
from tests.conftest import REPO_ROOT

SECRET_FIELDS = {
    "budget",
    "bombs",
    "bombs_pending",
    "nuclear_tech",
    "shield",
    "aid_pending",
    "development",
}


def _play_round() -> tuple[GameState, list, RuleSet]:  # type: ignore[type-arg]
    rules = load_rules("v1.0", REPO_ROOT / "rules")
    state = load_scenario(REPO_ROOT / "scenarios" / "equal.yaml").initial_state()
    state.country("russia").nuclear_tech = True
    state.country("russia").bombs = 1
    orders = OrderBook(
        orders={
            "russia": CountryOrders(strikes=["paris"], sanctions=["usa"], invest=["moscow"]),
            "usa": CountryOrders(shields=["chicago"], aid={"iran": 100}),
        },
        host=HostInput(laugh_winner="dprk"),
    )
    s, ev = resolve_round(state, orders, rules, seed=3)
    return s, ev, rules


def test_own_country_is_fully_visible() -> None:
    s, ev, _ = _play_round()
    obs = observe(s, "usa", ev)
    assert obs.me.budget == s.country("usa").budget
    assert obs.me.cities[3].shield is True
    assert obs.me.sanctioned_by == []  # lifted by end_of_round; the news tells who did it
    assert any(e.type == "sanction_applied" and e.actor == "russia" for e in obs.news)


def test_foreign_secrets_have_no_field_to_leak_through() -> None:
    s, ev, _ = _play_round()
    obs = observe(s, "france", ev)
    dumped = obs.model_dump()
    for other in dumped["others"]:
        assert SECRET_FIELDS.isdisjoint(other)
        for city in other["cities"]:
            assert SECRET_FIELDS.isdisjoint(city)
    assert {o["id"] for o in dumped["others"]} == {"russia", "usa", "iran", "dprk"}


def test_public_picture_is_visible_to_everyone() -> None:
    s, ev, _ = _play_round()
    for cid in ("france", "iran"):
        obs = observe(s, cid, ev)
        assert obs.ecology == s.ecology
        russia = next(o for o in obs.others if o.id == "russia")
        assert russia.average_life_level == s.country("russia").average_life_level
        assert next(o for o in obs.others if o.id == "dprk").laugh == 20
        paris = (
            next(c for o in obs.others for c in o.cities if c.id == "paris")
            if cid != "france"
            else obs.me.cities[0]
        )
        assert paris.destroyed


def test_strike_author_is_hidden_but_strike_is_news() -> None:
    _, ev, _ = _play_round()
    for cid in ("france", "usa", "iran"):
        strikes = [e for e in visible_events(ev, cid) if isinstance(e, NuclearStrike)]
        assert len(strikes) == 1 and strikes[0].target == "paris" and strikes[0].actor is None
    # the attacker sees its own strike with itself as actor
    mine = [e for e in visible_events(ev, "russia") if isinstance(e, NuclearStrike)]
    assert mine[0].actor == "russia"


def test_sanction_author_visible_only_to_victim() -> None:
    _, ev, _ = _play_round()
    assert any(e.type == "sanction_applied" for e in visible_events(ev, "usa"))
    assert not any(e.type == "sanction_applied" for e in visible_events(ev, "france"))


def test_foreign_private_events_are_not_visible() -> None:
    _, ev, _ = _play_round()
    news = visible_events(ev, "france")
    private = {"budget_spent", "aid_transferred", "income_credited", "round_ended", "shield_built"}
    assert all(e.actor == "france" for e in news if e.type in private)  # only my own
    assert any(e.type == "income_credited" for e in news)  # ... and I do see mine
    types = {e.type for e in news}
    assert "city_destroyed" in types and "laugh_awarded" in types


def test_observation_round_trips() -> None:
    s, ev, _ = _play_round()
    obs = observe(s, "iran", ev)
    assert Observation.model_validate_json(obs.model_dump_json()) == obs
