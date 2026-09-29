"""Golden game: a fixed scripted game whose final state is frozen in a snapshot.

If the engine's numbers change on purpose, regenerate with
    UPDATE_GOLDEN=1 uv run pytest tests/golden
and review the diff of the snapshot in the PR.
"""

import json
import os
from pathlib import Path

import pytest

from arena.engine.orders import CountryOrders, HostInput
from arena.engine.rules import load_rules
from arena.engine.runner import ScriptedAgent, diff_states, run_game
from arena.engine.scenario import load_scenario
from arena.engine.state import GameState
from tests.conftest import REPO_ROOT

SNAPSHOT = Path(__file__).with_name("equal_v1.0_seed7.json")

SCRIPT = {
    "russia": {
        1: CountryOrders(nuclear_tech=True, bombs=3),
        2: CountryOrders(strikes=["paris", "washington", "tehran"]),
        4: CountryOrders(invest=["moscow"] * 3),
    },
    "usa": {
        1: CountryOrders(invest=["washington"] * 2),
        2: CountryOrders(shields=["washington"]),
        3: CountryOrders(sanctions=["russia"], eco_programs=1),
    },
    "france": {
        1: CountryOrders(shields=["paris"], eco_programs=1),
        3: CountryOrders(nuclear_tech=True),
        4: CountryOrders(bombs=2),
        5: CountryOrders(strikes=["moscow"]),
    },
    "iran": {
        1: CountryOrders(aid={"dprk": 200}),
        2: CountryOrders(invest=["tehran"]),
        5: CountryOrders(eco_programs=2),
    },
    "dprk": {
        2: CountryOrders(invest=["pyongyang"] * 4),
        3: CountryOrders(sanctions=["usa", "france"]),
    },
}
LAUGH = {1: "dprk", 3: "iran", 5: "dprk"}


def _play() -> GameState:
    rules = load_rules("v1.0", REPO_ROOT / "rules")
    initial = load_scenario(REPO_ROOT / "scenarios" / "equal.yaml").initial_state()
    agents = {c: ScriptedAgent(s) for c, s in SCRIPT.items()}
    log = run_game(
        initial,
        rules,
        agents,
        seed=7,
        scenario_id="equal",
        host=lambda r, _s: HostInput(laugh_winner=LAUGH.get(r)),
    )
    return log.final_state


@pytest.mark.golden
def test_golden_equal_seed7() -> None:
    final = _play()
    if os.environ.get("UPDATE_GOLDEN"):
        SNAPSHOT.write_text(
            json.dumps(final.model_dump(mode="json"), indent=1, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        pytest.skip("golden snapshot regenerated")
    assert SNAPSHOT.exists(), "run with UPDATE_GOLDEN=1 to create the snapshot"
    expected = GameState.model_validate_json(SNAPSHOT.read_text(encoding="utf-8"))
    diffs = list(diff_states(expected, final))
    assert diffs == [], "engine result differs from the golden snapshot:\n" + "\n".join(
        f"  {p}: snapshot {a!r} -> now {b!r}" for p, a, b in diffs
    )
