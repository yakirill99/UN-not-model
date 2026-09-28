"""RuleSet: loading v1.0, strictness, extends + overrides, JSON Schema."""

from pathlib import Path

import pytest

from arena.engine.rules import RulesError, RuleSet, deep_merge, load_rules, rules_json_schema

V1 = "v1.0"


def test_v1_loads(rules_dir: Path) -> None:
    rules = load_rules(V1, rules_dir)
    assert rules.version == "1.0.0" and rules.major == 1
    assert rules.pipeline[0] == "budget" and rules.pipeline[-1] == "end_of_round"
    assert rules.cost("invest") == 150
    assert rules.effect("invest", "development") == 15
    assert rules.effect("invest", "laugh") == 0
    assert rules.action("bomb").requires == "nuclear_tech"
    assert rules.action("invest").max_per_city_per_round is None
    assert rules.params.budget_priority[0] == "shield"


def test_all_actions_have_ui(rules_dir: Path) -> None:
    rules = load_rules(V1, rules_dir)
    assert all(a.ui.title for a in rules.actions.values())


def test_load_by_path_without_rules_dir(rules_dir: Path) -> None:
    assert load_rules(rules_dir / "v1.0.yaml").version == "1.0.0"


def test_unknown_action_raises(rules_dir: Path) -> None:
    with pytest.raises(RulesError, match="no action 'teleport'"):
        load_rules(V1, rules_dir).action("teleport")


def _write(tmp: Path, name: str, text: str) -> Path:
    p = tmp / f"{name}.yaml"
    p.write_text(text, encoding="utf-8")
    return p


def test_unknown_field_is_error(rules_dir: Path, tmp_path: Path) -> None:
    _write(tmp_path, "v1.0", (rules_dir / "v1.0.yaml").read_text(encoding="utf-8"))
    _write(tmp_path, "bad", 'version: "1.0.1"\nextends: v1.0\nparams: {rounds: 6, roundz: 7}\n')
    with pytest.raises(RulesError, match="roundz"):
        load_rules("bad", tmp_path)


def test_extends_overrides_only_what_it_names(rules_dir: Path, tmp_path: Path) -> None:
    _write(tmp_path, "v1.0", (rules_dir / "v1.0.yaml").read_text(encoding="utf-8"))
    _write(
        tmp_path,
        "cheap",
        'version: "1.1.0"\nextends: v1.0\n'
        "params: {rounds: 8}\n"
        "actions:\n  invest: {cost: 100}\n  eco_program: {effect: {ecology: 40}}\n",
    )
    base = load_rules("v1.0", tmp_path)
    child = load_rules("cheap", tmp_path)
    assert child.version == "1.1.0" and child.extends is None
    assert child.params.rounds == 8
    assert child.params.laugh_bonus == base.params.laugh_bonus
    assert child.cost("invest") == 100
    assert child.effect("invest", "development") == 15  # untouched
    assert child.action("invest").ui == base.action("invest").ui
    assert child.effect("eco_program", "ecology") == 40
    assert child.cost("eco_program") == 200


def test_extends_null_removes_key(rules_dir: Path, tmp_path: Path) -> None:
    _write(tmp_path, "v1.0", (rules_dir / "v1.0.yaml").read_text(encoding="utf-8"))
    _write(
        tmp_path,
        "no-limit",
        'version: "1.0.1"\nextends: v1.0\nactions:\n  bomb: {max_per_round: null}\n',
    )
    assert load_rules("no-limit", tmp_path).action("bomb").max_per_round is None


def test_circular_extends(tmp_path: Path) -> None:
    _write(tmp_path, "a", 'version: "1.0.0"\nextends: b\n')
    _write(tmp_path, "b", 'version: "1.0.0"\nextends: a\n')
    with pytest.raises(RulesError, match="circular extends"):
        load_rules("a", tmp_path)


def test_missing_file(tmp_path: Path) -> None:
    with pytest.raises(RulesError, match="not found"):
        load_rules("nope", tmp_path)


def test_consistency_checks(rules_dir: Path) -> None:
    raw = load_rules(V1, rules_dir).model_dump()
    raw["pipeline"].append("budget")
    with pytest.raises(ValueError, match="more than once"):
        RuleSet.model_validate(raw)
    raw = load_rules(V1, rules_dir).model_dump()
    raw["params"]["budget_priority"].append("teleport")
    with pytest.raises(ValueError, match="unknown actions"):
        RuleSet.model_validate(raw)


def test_deep_merge() -> None:
    base = {"a": {"x": 1, "y": 2}, "b": [1, 2], "c": 3}
    out = deep_merge(base, {"a": {"y": 20, "z": 30}, "b": [9], "c": None})
    assert out == {"a": {"x": 1, "y": 20, "z": 30}, "b": [9]}
    assert base == {"a": {"x": 1, "y": 2}, "b": [1, 2], "c": 3}  # not mutated


def test_json_schema_export() -> None:
    schema = rules_json_schema()
    assert schema["title"] == "RuleSet"
    assert set(schema["required"]) >= {"version", "pipeline", "params", "actions"}
    assert "ActionSpec" in schema["$defs"]
