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
# One JSON per rules version: the rules page picks the file the party started
# with (?v=2.0) — «чтобы динамически версия подтягивалась в зависимости от
# версии старта».
VERSIONS = ("v1.0", "v2.0")
RULES_DIR = REPO / "rules"
OUT_DIR = REPO / "frontend" / "src" / "rules"

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


def build(version: str) -> dict:
    # Load through the engine: extends + defaults are merged there, so the
    # JSON is complete even for a YAML that inherits (v2.0 extends v1.0).
    from arena.engine.rules import load_rules

    rules = load_rules(version, RULES_DIR)
    dump = rules.model_dump()
    # The system order is written per file in the YAML; the engine model keeps
    # only the module ids, so read the raw key (both files define their own).
    import yaml

    raw_pipeline = yaml.safe_load((RULES_DIR / f"{version}.yaml").read_text(encoding="utf-8"))["pipeline"]
    params = dump["params"]
    actions = {}
    for action_id, spec in dump["actions"].items():
        entry = {
            "id": action_id,
            "title": spec.get("ui", {}).get("title", action_id),
            "emoji": spec.get("ui", {}).get("emoji", ""),
        }
        for field in ACTION_FIELDS:
            if field in spec and spec[field] is not None:
                entry[field] = spec[field]
        actions[action_id] = entry
    doc = {
        "version": rules.version,
        "rounds": params["rounds"],
        "ecology": params["ecology"],
        "life_weights": params["life_weights"],
        "income": params["income"],
        "laugh_bonus": params["laugh_bonus"],
        "budget_priority": params["budget_priority"],
        "last_round": params.get("last_round", {"unlimited_bombs": False}),
        "pipeline": raw_pipeline,
        "tech_from_round": params.get("tech_from_round", 1),
        "actions": actions,
    }
    # Second edition: the page shows these sections only for ?v=2.0.
    for key in ("stability", "rating", "private_pool", "climate", "traits"):
        if key in params and params[key]:
            doc[key] = params[key]
    if params.get("invest_returns"):
        doc["invest_returns"] = params["invest_returns"]
    if "charisma_bonus" in params:
        doc["charisma_bonus"] = params["charisma_bonus"]
    return doc


def main() -> None:
    out_dir = OUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    for version in VERSIONS:
        doc = build(version)
        out = out_dir / f"rules-{version}.json"
        out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {out.relative_to(REPO)} ({out.stat().st_size} bytes)")
    if sys.argv[-1] == "--check":
        return


if __name__ == "__main__":
    main()
