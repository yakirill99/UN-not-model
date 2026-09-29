"""Batch simulations: thousands of bot games to test rules before people play them.

python -m arena.sim --rules v1.0 --scenario smolny --games 1000
"""

from arena.sim.batch import GameSpec, Lineup, run_batch, run_one, specs_for
from arena.sim.metrics import GameMetrics, metrics_of, summarize

__all__ = [
    "GameMetrics",
    "GameSpec",
    "Lineup",
    "metrics_of",
    "run_batch",
    "run_one",
    "specs_for",
    "summarize",
]
