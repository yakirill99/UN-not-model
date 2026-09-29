"""Simulator: specs, metrics, determinism, parallel batch, Parquet."""

from pathlib import Path

import pytest

from arena.sim import GameSpec, metrics_of, run_batch, run_one, specs_for, summarize
from arena.sim.__main__ import main, write_parquet
from arena.sim.batch import _lineup_for


def test_specs_and_lineups() -> None:
    specs = specs_for("v1.0", "equal", range(3), "mixed")
    assert [s.seed for s in specs] == [0, 1, 2]
    assert all(len(s.lineup) == 5 for s in specs)
    assert specs_for("v1.0", "equal", [1], "mixed") == specs_for("v1.0", "equal", [1], "mixed")
    assert _lineup_for("economist", ["a", "b"], 0) == {"a": "economist", "b": "economist"}
    assert _lineup_for("aggressor,random", ["a", "b"], 0) == {"a": "aggressor", "b": "random"}
    with pytest.raises(ValueError, match="unknown bots"):
        _lineup_for("hal", ["a"], 0)
    with pytest.raises(ValueError, match="bots for"):
        _lineup_for("random,random", ["a"], 0)


def test_game_is_reproducible_from_its_spec() -> None:
    spec = specs_for("v1.0", "smolny", [3], "mixed")[0]
    a, b = run_one(spec), run_one(spec)
    assert a.final_state == b.final_state
    assert metrics_of(a, spec.lineup_dict) == metrics_of(b, spec.lineup_dict)


def test_metrics_shape() -> None:
    spec = GameSpec(
        "v1.0",
        "equal",
        5,
        (
            ("dprk", "aggressor"),
            ("france", "economist"),
            ("iran", "ecologist"),
            ("russia", "avenger"),
            ("usa", "random"),
        ),
    )
    m = metrics_of(run_one(spec), spec.lineup_dict)
    assert m.rounds == 6 and m.winner in m.final_life and m.winner_bot == spec.lineup_dict[m.winner]
    assert m.final_life[m.winner] == max(m.final_life.values())
    assert 0 <= m.final_ecology <= 100
    assert m.strikes >= m.strikes_absorbed
    assert 0 <= m.rejected_share <= 1


def test_batch_parallel_matches_serial() -> None:
    specs = specs_for("v1.0", "equal", range(8), "mixed")
    serial, _ = run_batch(specs, workers=1)
    parallel, _ = run_batch(specs, workers=2)
    assert serial == parallel
    s = summarize(serial)
    assert s["games"] == 8
    by_country = s["win_rate_by_country"]
    assert isinstance(by_country, dict) and abs(sum(by_country.values()) - 1) < 1e-6


def test_keep_logs_returns_full_games() -> None:
    specs = specs_for("v1.0", "equal", [0, 1], "idle")
    metrics, logs = run_batch(specs, keep_logs=True)
    assert len(logs) == 2 and logs[0].rounds[-1].round == 6
    assert all(m.strikes == 0 for m in metrics)


def test_cli_and_parquet(tmp_path: Path) -> None:
    out = tmp_path / "m.parquet"
    assert (
        main(["--scenario", "equal", "--games", "4", "--lineup", "random", "--out", str(out)]) == 0
    )
    import polars as pl

    df = pl.read_parquet(out)
    assert df.height == 4 and {"seed", "winner", "final_ecology", "lineup"} <= set(df.columns)
    write_parquet([], tmp_path / "empty.parquet")
