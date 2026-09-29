"""run_batch: many games in parallel, each fully determined by its GameSpec."""

from __future__ import annotations

import os
from collections.abc import Iterable, Sequence
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from numpy.random import PCG64, Generator

from arena.agents.bots import BOTS, make_bot
from arena.engine.rules import load_rules
from arena.engine.runner import Agent, GameLog, run_game
from arena.engine.scenario import load_scenario
from arena.sim.metrics import GameMetrics, metrics_of

Lineup = dict[str, str]  # country id -> bot name

REPO_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True, slots=True)
class GameSpec:
    rules: str
    scenario: str
    seed: int
    lineup: tuple[tuple[str, str], ...]  # sorted (country, bot) pairs - hashable

    @property
    def lineup_dict(self) -> Lineup:
        return dict(self.lineup)


def specs_for(
    rules: str,
    scenario: str,
    seeds: Iterable[int],
    lineup: str = "mixed",
    rules_dir: Path | None = None,
) -> list[GameSpec]:
    """Build one spec per seed.

    ``lineup`` is either a comma-separated list of bot names in country order
    ("aggressor,avenger,economist,ecologist,random"), a single bot name for everyone,
    or "mixed" - a per-seed random assignment of the five named bots.
    """
    root = rules_dir or REPO_ROOT
    countries = [c.id for c in load_scenario(root / "scenarios" / f"{scenario}.yaml").countries]
    specs: list[GameSpec] = []
    for seed in seeds:
        bots = _lineup_for(lineup, countries, seed)
        specs.append(
            GameSpec(rules=rules, scenario=scenario, seed=seed, lineup=tuple(sorted(bots.items())))
        )
    return specs


def _lineup_for(lineup: str, countries: Sequence[str], seed: int) -> Lineup:
    if lineup == "mixed":
        pool = ["aggressor", "avenger", "economist", "ecologist", "random"]
        rng = Generator(PCG64(seed))
        order = [pool[i] for i in rng.permutation(len(pool))]
        return dict(zip(countries, (order * 3)[: len(countries)], strict=False))
    names = [n.strip() for n in lineup.split(",")]
    if len(names) == 1:
        names = names * len(countries)
    if len(names) != len(countries):
        raise ValueError(f"lineup has {len(names)} bots for {len(countries)} countries")
    unknown = sorted(set(names) - set(BOTS))
    if unknown:
        raise ValueError(f"unknown bots {unknown}; known: {sorted(BOTS)}")
    return dict(zip(countries, names, strict=True))


def run_one(spec: GameSpec, rules_dir: Path | None = None) -> GameLog:
    root = rules_dir or REPO_ROOT
    rules = load_rules(spec.rules, root / "rules")
    initial = load_scenario(root / "scenarios" / f"{spec.scenario}.yaml").initial_state()
    agents: dict[str, Agent] = {
        country: make_bot(bot, seed=spec.seed * 100 + i)
        for i, (country, bot) in enumerate(spec.lineup)
    }
    return run_game(initial, rules, agents, spec.seed, scenario_id=spec.scenario)


def _metrics_for(spec: GameSpec) -> GameMetrics:
    return metrics_of(run_one(spec), spec.lineup_dict)


def run_batch(
    specs: Sequence[GameSpec], workers: int | None = None, keep_logs: bool = False
) -> tuple[list[GameMetrics], list[GameLog]]:
    """Play every spec, in parallel processes when there are enough of them.

    Returns metrics in spec order and, if ``keep_logs``, the full GameLogs too
    (logs are big - only keep them for small batches).
    """
    if keep_logs:
        logs = [run_one(s) for s in specs]
        return [metrics_of(g, s.lineup_dict) for g, s in zip(logs, specs, strict=True)], logs
    workers = workers or min(len(specs), os.cpu_count() or 1)
    if workers <= 1 or len(specs) < 4:
        return [_metrics_for(s) for s in specs], []
    with ProcessPoolExecutor(max_workers=workers) as pool:
        return list(
            pool.map(_metrics_for, specs, chunksize=max(1, len(specs) // (workers * 4)))
        ), []
