#!/usr/bin/env python3
"""Generate `frontend/src/rules/rules.json` from `rules/v1.0.yaml` (#19).

The rules page inside the platform must show the same numbers the engine
enforces — one source of truth. The page imports the generated JSON; rerun
this script after any change to the rules YAML:

    cd backend && uv run python ../scripts/gen_rules_json.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
RULES = REPO / "rules" / "v1.0.yaml"
OUT = REPO / "frontend" / "src" / "rules" / "rules.json"

# Action fields worth showing to a player, in display order.
ACTION_FIELDS = [
    "cost",
    "effect",
    "target",
    "max_per_round",
    "max_per_city_per_round",
    "max_per_target_city_per_round",
    "min_amount",
    "requires",
    "once_per_game",
    "duration_rounds",
    "usable",
    "active",
    "available",
]


def main() -> None:
    raw = yaml.safe_load(RULES.read_text(encoding="utf-8"))
    params = raw["params"]
    actions = {}
    for action_id, spec in raw["actions"].items():
        entry = {
            "id": action_id,
            "title": spec.get("ui", {}).get("title", action_id),
            "emoji": spec.get("ui", {}).get("emoji", ""),
        }
        for field in ACTION_FIELDS:
            if field in spec:
                entry[field] = spec[field]
        actions[action_id] = entry
    doc = {
        "version": raw["version"],
        "rounds": params["rounds"],
        "ecology": params["ecology"],
        "life_weights": params["life_weights"],
        "income": params["income"],
        "laugh_bonus": params["laugh_bonus"],
        "budget_priority": params["budget_priority"],
        "last_round": params.get("last_round", {"unlimited_bombs": False}),
        "pipeline": raw["pipeline"],
        "actions": actions,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(REPO)} ({OUT.stat().st_size} bytes)")
    if sys.argv[-1] == "--check":
        return


if __name__ == "__main__":
    main()
