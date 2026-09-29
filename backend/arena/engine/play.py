"""CLI: play a headless game or replay a saved log.

    python -m arena.engine.play --scenario smolny --seed 1
    python -m arena.engine.play --scenario equal --orders orders.yaml --out game.json
    python -m arena.engine.play --replay game.json

``--orders`` is a YAML script: round -> country -> CountryOrders fields, with an
optional ``host: {laugh_winner: ...}`` per round. Countries without a script idle.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import yaml

from arena.engine.orders import CountryOrders, HostInput
from arena.engine.rules import load_rules
from arena.engine.runner import (
    Agent,
    GameLog,
    IdleAgent,
    RoundRecord,
    ScriptedAgent,
    replay,
    run_game,
)
from arena.engine.scenario import load_scenario
from arena.engine.state import GameState

REPO_ROOT = Path(__file__).resolve().parents[3]


def load_script(path: Path) -> tuple[dict[str, dict[int, CountryOrders]], dict[int, HostInput]]:
    raw: dict[int, dict[str, Any]] = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    scripts: dict[str, dict[int, CountryOrders]] = {}
    hosts: dict[int, HostInput] = {}
    for round_no, by_country in raw.items():
        for country_id, fields in (by_country or {}).items():
            if country_id == "host":
                hosts[int(round_no)] = HostInput.model_validate(fields or {})
            else:
                scripts.setdefault(country_id, {})[int(round_no)] = CountryOrders.model_validate(
                    fields or {}
                )
    return scripts, hosts


def summary(state: GameState) -> str:
    rows = [f"round {state.round - 1} done | ecology {state.ecology}%"]
    for c in sorted(state.countries, key=lambda c: -c.average_life_level):
        cities = " ".join(("✗" if x.destroyed else "🛡" if x.shield else "·") for x in c.cities)
        rows.append(
            f"  {c.id:<8} life {c.average_life_level / 100:6.2f}%  budget {c.budget:>5}$  "
            f"dev {c.total_development:>4}  bombs {c.bombs}/{c.bombs_pending}  "
            f"laugh {c.laugh:>2}  {cities}"
        )
    return "\n".join(rows)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="arena.engine.play", description=__doc__)
    p.add_argument("--scenario", default="equal")
    p.add_argument("--rules", default="v1.0")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--rounds", type=int, default=None)
    p.add_argument("--orders", type=Path, help="YAML script of orders per round")
    p.add_argument("--out", type=Path, help="write the GameLog as JSON")
    p.add_argument("--replay", type=Path, help="replay a saved GameLog and report divergences")
    p.add_argument("--quiet", action="store_true")
    args = p.parse_args(argv)

    if args.replay:
        log = GameLog.model_validate_json(args.replay.read_text(encoding="utf-8"))
        diffs = replay(log)
        for d in diffs:
            print(f"round {d.round}: {d.path}: recorded {d.recorded!r}, engine {d.replayed!r}")
        print(f"{len(diffs)} divergence(s) over {len(log.rounds)} round(s)")
        return 1 if diffs else 0

    rules = load_rules(args.rules, REPO_ROOT / "rules")
    scenario = load_scenario(REPO_ROOT / "scenarios" / f"{args.scenario}.yaml")
    scripts, hosts = load_script(args.orders) if args.orders else ({}, {})
    agents: dict[str, Agent] = {
        c.id: ScriptedAgent(scripts[c.id]) if c.id in scripts else IdleAgent()
        for c in scenario.countries
    }

    def on_round(rec: RoundRecord) -> None:
        if not args.quiet:
            print(summary(rec.state_after))

    log = run_game(
        scenario.initial_state(),
        rules,
        agents,
        args.seed,
        scenario_id=scenario.id,
        rounds=args.rounds,
        host=lambda r, _s: hosts.get(r, HostInput()),
        on_round=on_round,
    )
    print("final standings:", ", ".join(f"{c} {ll / 100:.2f}%" for c, ll in log.standings()))
    if args.out:
        args.out.write_text(log.model_dump_json(indent=1), encoding="utf-8")
        print(f"log written to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
