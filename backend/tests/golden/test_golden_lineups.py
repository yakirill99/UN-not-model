"""Golden games with bot lineups: the engine + bots must reproduce frozen final states.

Each entry of lineups.yaml is played and compared, field by field, with its snapshot.
A diff means the rules, the engine or a bot changed behaviour - intended or not.
"""

import json
import os
from pathlib import Path
from typing import TypedDict

import pytest
import yaml

from arena.engine.runner import diff_states
from arena.engine.state import GameState
from arena.sim import metrics_of, run_one, specs_for

HERE = Path(__file__).parent


class GoldenGame(TypedDict):
    rules: str
    scenario: str
    seed: int
    lineup: str


LINEUPS: dict[str, GoldenGame] = yaml.safe_load((HERE / "lineups.yaml").read_text(encoding="utf-8"))


def _play(name: str) -> tuple[GameState, dict[str, object]]:
    cfg = LINEUPS[name]
    spec = specs_for(cfg["rules"], cfg["scenario"], [cfg["seed"]], cfg["lineup"])[0]
    log = run_one(spec)
    m = metrics_of(log, spec.lineup_dict)
    digest = {
        "lineup": spec.lineup_dict,
        "winner": m.winner,
        "final_life": m.final_life,
        "final_ecology": m.final_ecology,
        "cities_destroyed": m.cities_destroyed,
        "strikes": m.strikes,
    }
    return log.final_state, digest


@pytest.mark.golden
@pytest.mark.parametrize("name", sorted(LINEUPS))
def test_golden_lineup(name: str) -> None:
    snapshot = HERE / f"{name}.json"
    final, digest = _play(name)
    if os.environ.get("UPDATE_GOLDEN"):
        payload = {"digest": digest, "final_state": final.model_dump(mode="json")}
        snapshot.write_text(
            json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        pytest.skip(f"golden snapshot {snapshot.name} regenerated")
    assert snapshot.exists(), f"missing {snapshot.name}: run with UPDATE_GOLDEN=1"
    saved = json.loads(snapshot.read_text(encoding="utf-8"))
    assert digest == saved["digest"], f"{name}: digest changed"
    expected = GameState.model_validate(saved["final_state"])
    diffs = list(diff_states(expected, final))
    assert diffs == [], f"{name}: engine result differs from snapshot:\n" + "\n".join(
        f"  {p}: snapshot {a!r} -> now {b!r}" for p, a, b in diffs
    )
