"""Skeleton checks: the repository data files are well-formed.

These tests keep CI meaningful before the engine exists. The real RuleSet and
scenario validation replaces them in sprint 1 (tests/unit/test_rules_loading.py,
tests/unit/test_scenario.py).
"""

from pathlib import Path
from typing import Any

import pytest
import yaml

import arena


def _load(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    assert isinstance(data, dict), f"{path.name}: top level must be a mapping"
    return data


def test_package_version() -> None:
    assert arena.__version__


def test_rules_v1_loads(rules_dir: Path) -> None:
    rules = _load(rules_dir / "v1.0.yaml")
    assert rules["version"].startswith("1.0")
    assert rules["pipeline"], "pipeline must not be empty"
    for name, action in rules["actions"].items():
        assert "ui" in action, f"action {name} has no ui description"


@pytest.mark.parametrize("scenario", ["smolny.yaml", "equal.yaml"])
def test_scenario_shape(scenarios_dir: Path, scenario: str) -> None:
    data = _load(scenarios_dir / scenario)
    countries = data["countries"]
    assert len(countries) == 5
    city_ids: list[str] = []
    for country in countries:
        assert len(country["cities"]) == 4, country["id"]
        assert country["budget"] > 0
        city_ids += [c["id"] for c in country["cities"]]
    assert len(city_ids) == len(set(city_ids)), "city ids must be unique"


def test_equal_scenario_is_balanced(scenarios_dir: Path) -> None:
    data = _load(scenarios_dir / "equal.yaml")
    for country in data["countries"]:
        assert sum(c["development"] for c in country["cities"]) == 240
