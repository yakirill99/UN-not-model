"""Scenario loading: scenarios/*.yaml -> initial GameState.

Starting conditions are kept separate from rules.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import Field, model_validator

from arena.engine.state import ArenaModel, Country, GameState


class ScenarioError(ValueError):
    """Scenario file cannot be loaded or is inconsistent."""


class Scenario(ArenaModel):
    id: str
    title: str = ""
    ecology: int = Field(description="Starting world ecology in percent")
    countries: list[Country] = Field(min_length=1)

    @model_validator(mode="after")
    def _unique_ids(self) -> Scenario:
        # GameState enforces the same invariants; validating here gives the error
        # the scenario's file name instead of a state dump.
        GameState(round=1, ecology=self.ecology, countries=self.countries)
        return self

    def initial_state(self) -> GameState:
        return GameState(round=1, ecology=self.ecology, countries=self.countries)


def load_scenario(path: Path) -> Scenario:
    if not path.is_file():
        raise ScenarioError(f"scenario file not found: {path}")
    with path.open(encoding="utf-8") as f:
        data = f.read()
    try:
        return Scenario.model_validate(_parse_yaml(data, path))
    except ValueError as exc:
        raise ScenarioError(f"{path}: {exc}") from exc


def _parse_yaml(text: str, path: Path) -> dict[str, object]:
    import yaml

    data = yaml.safe_load(text)
    if not isinstance(data, dict):
        raise ScenarioError(f"{path}: top level must be a mapping")
    return data
