"""laugh: host input, accumulation, unknown winner."""

from arena.engine.events import LaughAwarded, OrderRejected
from arena.engine.orders import HostInput, OrderBook
from arena.engine.pipeline import resolve_round
from arena.engine.rules import RuleSet
from arena.engine.state import GameState


def _run(state: GameState, rules: RuleSet, winner: str | None) -> tuple[GameState, list[object]]:
    r = rules.model_copy(update={"pipeline": ["laugh"]})
    s, ev = resolve_round(state, OrderBook(host=HostInput(laugh_winner=winner)), r, 0)
    return s, list(ev)


def test_bonus_from_yaml_and_accumulation(state: GameState, rules: RuleSet) -> None:
    s1, ev = _run(state, rules, "iran")
    assert s1.country("iran").laugh == rules.params.laugh_bonus
    assert isinstance(ev[0], LaughAwarded) and ev[0].target == "iran"
    s2, _ = _run(s1, rules, "iran")
    assert s2.country("iran").laugh == 2 * rules.params.laugh_bonus


def test_no_winner_no_event(state: GameState, rules: RuleSet) -> None:
    s, ev = _run(state, rules, None)
    assert ev == [] and all(c.laugh == 0 for c in s.countries)


def test_unknown_winner_is_rejected(state: GameState, rules: RuleSet) -> None:
    _, ev = _run(state, rules, "atlantis")
    assert isinstance(ev[0], OrderRejected) and ev[0].reason == "unknown_country"
