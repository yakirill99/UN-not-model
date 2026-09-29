"""compare: pairing by seed+lineup, zero diff against itself, report shape."""

from arena.engine.rules import load_rules
from arena.sim.compare import compare, main
from tests.conftest import REPO_ROOT


def test_experiment_rules_load_and_only_change_what_they_say() -> None:
    base = load_rules("v1.0", REPO_ROOT / "rules")
    cheap = load_rules("experiments/v1.0-cheap-eco", REPO_ROOT / "rules")
    assert cheap.cost("eco_program") == 100 and base.cost("eco_program") == 200
    assert cheap.model_dump(exclude={"version", "actions"}) == base.model_dump(
        exclude={"version", "actions"}
    )


def test_compare_rules_with_itself_is_a_no_op() -> None:
    c = compare("v1.0", "v1.0", range(6), scenario="equal", workers=1)
    assert c.games == 6 and c.winner_changed_share == 0
    assert all(v == 0 for v in c.paired_diffs.values())
    assert c.summary_a == c.summary_b


def test_compare_detects_a_real_change(capsys) -> None:  # type: ignore[no-untyped-def]
    c = compare("v1.0", "experiments/v1.0-cheap-eco", range(12), scenario="smolny", workers=1)
    report = c.report()
    assert "12 paired games" in report and "win rate by bot" in report
    assert (
        main(["--a", "v1.0", "--b", "experiments/v1.0-cheap-eco", "--games", "4", "--workers", "1"])
        == 0
    )
    assert "paired games" in capsys.readouterr().out
