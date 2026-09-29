"""CLI: python -m arena.sim --rules v1.0 --scenario smolny --games 1000 [--lineup mixed]"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from arena.sim.batch import REPO_ROOT, run_batch, specs_for
from arena.sim.metrics import GameMetrics, summarize


def write_parquet(metrics: list[GameMetrics], path: Path) -> None:
    import polars as pl

    rows = [
        {
            **m.model_dump(exclude={"lineup", "final_life"}),
            "lineup": json.dumps(m.lineup, ensure_ascii=False),
            "final_life": json.dumps(m.final_life),
        }
        for m in metrics
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    pl.DataFrame(rows).write_parquet(path)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="arena.sim", description=__doc__)
    p.add_argument("--rules", default="v1.0")
    p.add_argument("--scenario", default="smolny")
    p.add_argument("--games", type=int, default=100)
    p.add_argument("--seed", type=int, default=0, help="first seed; games use seed..seed+games-1")
    p.add_argument("--lineup", default="mixed", help='"mixed", one bot name, or 5 comma-separated')
    p.add_argument("--workers", type=int, default=None)
    p.add_argument(
        "--out", type=Path, default=None, help="Parquet path (default data/sim/<auto>.parquet)"
    )
    p.add_argument("--no-save", action="store_true")
    args = p.parse_args(argv)

    specs = specs_for(
        args.rules, args.scenario, range(args.seed, args.seed + args.games), args.lineup
    )
    t0 = time.perf_counter()
    metrics, _ = run_batch(specs, workers=args.workers)
    dt = time.perf_counter() - t0

    summary = summarize(metrics)
    print(
        f"{len(metrics)} games, rules {args.rules}, scenario {args.scenario}, "
        f"lineup {args.lineup}: {dt:.1f}s"
    )
    for k, v in summary.items():
        print(f"  {k:<26} {v}")
    if not args.no_save:
        out = (
            args.out
            or REPO_ROOT
            / "data"
            / "sim"
            / f"{args.rules}_{args.scenario}_{args.lineup}_{args.games}.parquet"
        )
        write_parquet(metrics, out)
        print(f"saved {out.relative_to(REPO_ROOT) if out.is_relative_to(REPO_ROOT) else out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
