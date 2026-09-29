"""compare(rules_a, rules_b, seeds): the same games under two rule sets, and what changed.

Pairing by seed *and* lineup means the only difference between the two runs is the
rules, so even small effects show up without thousands of games.

    python -m arena.sim.compare --a v1.0 --b experiments/v1.0-cheap-eco --games 500
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Iterable
from dataclasses import dataclass, replace
from statistics import mean

from arena.sim.batch import GameSpec, run_batch, specs_for
from arena.sim.metrics import GameMetrics, summarize

NUMERIC = [
    "mean_final_ecology",
    "ecology_collapse_share",
    "mean_cities_destroyed",
    "mean_strikes",
    "mean_tech_countries",
    "mean_winner_life",
]


@dataclass(frozen=True, slots=True)
class Comparison:
    rules_a: str
    rules_b: str
    games: int
    summary_a: dict[str, object]
    summary_b: dict[str, object]
    winner_changed_share: float
    paired_diffs: dict[str, float]  # metric -> mean(b - a) over paired games

    def report(self) -> str:
        lines = [f"{self.games} paired games: A = {self.rules_a}, B = {self.rules_b}", ""]
        lines.append(f"{'metric':<28}{'A':>10}{'B':>10}{'B-A':>10}")
        for k in NUMERIC:
            a, b = self.summary_a[k], self.summary_b[k]
            if isinstance(a, int | float) and isinstance(b, int | float):
                lines.append(f"{k:<28}{a:>10.3f}{b:>10.3f}{b - a:>+10.3f}")
        lines.append("")
        lines.append("win rate by bot        A      B")
        wa, wb = self.summary_a["win_rate_by_bot"], self.summary_b["win_rate_by_bot"]
        assert isinstance(wa, dict) and isinstance(wb, dict)
        for bot in sorted(set(wa) | set(wb)):
            lines.append(f"  {bot:<18}{wa.get(bot, 0):>7.3f}{wb.get(bot, 0):>7.3f}")
        lines.append("")
        lines.append(f"games where the winner changed: {self.winner_changed_share:.1%}")
        lines.append(
            "paired mean differences (B-A): "
            + ", ".join(f"{k} {v:+.2f}" for k, v in self.paired_diffs.items())
        )
        return "\n".join(lines)


def compare(
    rules_a: str,
    rules_b: str,
    seeds: Iterable[int],
    scenario: str = "smolny",
    lineup: str = "mixed",
    workers: int | None = None,
) -> Comparison:
    specs_a = specs_for(rules_a, scenario, seeds, lineup)
    specs_b = [replace(s, rules=rules_b) for s in specs_a]  # same seed, same lineup
    ma, _ = run_batch(specs_a, workers=workers)
    mb, _ = run_batch(specs_b, workers=workers)
    return _compare_metrics(rules_a, rules_b, ma, mb)


def _compare_metrics(
    rules_a: str, rules_b: str, ma: list[GameMetrics], mb: list[GameMetrics]
) -> Comparison:
    pairs = list(zip(ma, mb, strict=True))
    return Comparison(
        rules_a=rules_a,
        rules_b=rules_b,
        games=len(pairs),
        summary_a=summarize(ma),
        summary_b=summarize(mb),
        winner_changed_share=mean(a.winner != b.winner for a, b in pairs) if pairs else 0.0,
        paired_diffs={
            "final_ecology": mean(b.final_ecology - a.final_ecology for a, b in pairs),
            "cities_destroyed": mean(b.cities_destroyed - a.cities_destroyed for a, b in pairs),
            "strikes": mean(b.strikes - a.strikes for a, b in pairs),
            "winner_life": mean(
                (max(b.final_life.values()) - max(a.final_life.values())) / 100 for a, b in pairs
            ),
        }
        if pairs
        else {},
    )


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="arena.sim.compare", description=__doc__)
    p.add_argument("--a", required=True, help="rules name, e.g. v1.0")
    p.add_argument("--b", required=True, help="rules name, e.g. experiments/v1.0-cheap-eco")
    p.add_argument("--games", type=int, default=500)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--scenario", default="smolny")
    p.add_argument("--lineup", default="mixed")
    p.add_argument("--workers", type=int, default=None)
    args = p.parse_args(argv)
    result = compare(
        args.a,
        args.b,
        range(args.seed, args.seed + args.games),
        scenario=args.scenario,
        lineup=args.lineup,
        workers=args.workers,
    )
    print(result.report())
    return 0


__all__ = ["Comparison", "GameSpec", "compare", "main"]

if __name__ == "__main__":
    sys.exit(main())
