"""Scenarios: loading, invariants, initial state."""

from pathlib import Path

import pytest

from arena.engine.scenario import ScenarioError, load_scenario

SCENARIOS = ["smolny", "equal"]


@pytest.mark.parametrize("name", SCENARIOS)
def test_scenario_loads_five_countries_four_cities(scenarios_dir: Path, name: str) -> None:
    sc = load_scenario(scenarios_dir / f"{name}.yaml")
    assert sc.id == name
    assert len(sc.countries) == 5
    assert all(len(c.cities) == 4 for c in sc.countries)
    assert all(c.budget > 0 for c in sc.countries)


@pytest.mark.parametrize("name", SCENARIOS)
def test_initial_state(scenarios_dir: Path, name: str) -> None:
    state = load_scenario(scenarios_dir / f"{name}.yaml").initial_state()
    assert state.round == 1
    assert state.ecology == 100
    for c in state.countries:
        assert c.bombs == 0 and not c.sanctioned_by
        assert c.nuclear_tech == (name == "smolny" and c.id == "dprk")
        assert all(not city.destroyed and not city.shield for city in c.cities)


def test_equal_is_balanced(scenarios_dir: Path) -> None:
    sc = load_scenario(scenarios_dir / "equal.yaml")
    assert {c.total_development for c in sc.countries} == {240}
    assert {c.budget for c in sc.countries} == {1000}


def test_smolny_matches_source_table(scenarios_dir: Path) -> None:
    state = load_scenario(scenarios_dir / "smolny.yaml").initial_state()
    assert state.country("russia").budget == 1445
    assert state.find_city("moscow")[1].development == 125


def test_duplicate_city_id_is_error(scenarios_dir: Path, tmp_path: Path) -> None:
    text = (scenarios_dir / "equal.yaml").read_text(encoding="utf-8").replace("spb", "moscow")
    bad = tmp_path / "bad.yaml"
    bad.write_text(text, encoding="utf-8")
    with pytest.raises(ScenarioError, match="duplicate city ids"):
        load_scenario(bad)


def test_unknown_field_is_error(tmp_path: Path) -> None:
    bad = tmp_path / "bad.yaml"
    bad.write_text(
        "id: x\necology: 100\nclimate: warm\ncountries:\n"
        "  - {id: a, name: A, budget: 1, cities: [{id: a1, name: A1, development: 1}]}\n",
        encoding="utf-8",
    )
    with pytest.raises(ScenarioError, match="climate"):
        load_scenario(bad)


def test_missing_file(tmp_path: Path) -> None:
    with pytest.raises(ScenarioError, match="not found"):
        load_scenario(tmp_path / "nope.yaml")
