"""RuleSet: loading versioned rules/*.yaml.

Handles `extends` + overrides, validation and JSON Schema export.

A rules file is the *only* place where game numbers live (ADR 0003). Loading is
strict: an unknown key anywhere in the file is an error, so a typo in a parameter
name cannot silently fall back to a default.

``extends`` names another rules file in the same directory (``"v1.0"`` or
``"v1.0.yaml"``). The child is deep-merged over the parent: nested mappings merge
key by key, everything else (scalars, lists) is replaced, and an explicit ``null``
removes the parent's key.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import Field, model_validator

from arena.engine.state import ArenaModel

TargetKind = Literal["own_city", "foreign_city", "own_country", "foreign_country"]
Timing = Literal["same_round", "next_round"]


class RulesError(ValueError):
    """Rules file cannot be loaded or is inconsistent."""


class Range(ArenaModel):
    min: int
    max: int

    @model_validator(mode="after")
    def _ordered(self) -> Range:
        if self.min > self.max:
            raise ValueError(f"min {self.min} > max {self.max}")
        return self


class LifeWeights(ArenaModel):
    """life_level x100 = development x w_d + ecology x w_e + laugh x w_l (all in percent)."""

    development: int = Field(ge=0)
    ecology: int = Field(ge=0)
    laugh: int = Field(ge=0)


class IncomeCoefficients(ArenaModel):
    """income = (k_development x development + k_ecology x ecology) / 100."""

    k_development: int = Field(ge=0)
    k_ecology: int = Field(ge=0)


class Params(ArenaModel):
    rounds: int = Field(ge=1)
    ecology: Range
    life_weights: LifeWeights
    income: IncomeCoefficients
    laugh_bonus: int = Field(ge=0, description="Percentage points added to the laugh winner")
    budget_priority: list[str] = Field(
        min_length=1, description="Action ids in the order the budget is spent"
    )


class UiSpec(ArenaModel):
    title: str
    emoji: str = ""
    description: str = ""


class ActionSpec(ArenaModel):
    """One player action. Fields that do not apply to an action stay at their default."""

    cost: int = Field(default=0, ge=0)
    effect: dict[str, int] = Field(default_factory=dict)
    target: TargetKind | None = None
    requires: str | None = Field(default=None, description="Prerequisite: action id or resource")
    once_per_game: bool = False
    max_per_round: int | None = Field(default=None, ge=1)
    max_per_city_per_round: int | None = Field(default=None, ge=1)
    max_per_target_city_per_round: int | None = Field(default=None, ge=1)
    usable: Timing | None = None
    active: Timing | None = None
    available: Timing | None = None
    anonymous: bool = False
    duration_rounds: int | None = Field(default=None, ge=1)
    visible_to_target: bool = False
    min_amount: int | None = Field(default=None, ge=1)
    ui: UiSpec


class RuleSet(ArenaModel):
    version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    extends: str | None = None
    modules: list[str] = Field(min_length=1)
    pipeline: list[str] = Field(min_length=1)
    params: Params
    actions: dict[str, ActionSpec]

    @model_validator(mode="after")
    def _consistent(self) -> RuleSet:
        dupes = {s for s in self.pipeline if self.pipeline.count(s) > 1}
        if dupes:
            raise ValueError(f"pipeline lists systems more than once: {sorted(dupes)}")
        unknown = [a for a in self.params.budget_priority if a not in self.actions]
        if unknown:
            raise ValueError(f"budget_priority names unknown actions: {unknown}")
        for action_id, spec in self.actions.items():
            if spec.requires is not None and spec.requires not in self.actions:
                raise ValueError(f"action {action_id!r} requires unknown action {spec.requires!r}")
        return self

    @property
    def major(self) -> int:
        return int(self.version.split(".")[0])

    def action(self, action_id: str) -> ActionSpec:
        try:
            return self.actions[action_id]
        except KeyError:
            raise RulesError(f"rules {self.version} have no action {action_id!r}") from None

    def cost(self, action_id: str) -> int:
        return self.action(action_id).cost

    def effect(self, action_id: str, key: str) -> int:
        return self.action(action_id).effect.get(key, 0)


# --- loading ------------------------------------------------------------------


def rules_path(name_or_path: str | Path, rules_dir: Path) -> Path:
    name = str(name_or_path)
    if not name.endswith(".yaml"):
        name += ".yaml"  # not Path.with_suffix: "v1.0" would lose its ".0"
    path = Path(name)
    return path if path.is_absolute() else rules_dir / path


def load_rules(name_or_path: str | Path, rules_dir: Path | None = None) -> RuleSet:
    """Load a rules file, resolving its ``extends`` chain, and validate it."""
    path = Path(name_or_path)
    base_dir = rules_dir if rules_dir is not None else path.parent
    merged = _load_raw(rules_path(path, base_dir), base_dir, seen=())
    merged.pop("extends", None)
    try:
        return RuleSet.model_validate(merged)
    except ValueError as exc:
        raise RulesError(f"{path}: {exc}") from exc


def _load_raw(path: Path, rules_dir: Path, seen: tuple[Path, ...]) -> dict[str, Any]:
    if path in seen:
        chain = " -> ".join(p.name for p in (*seen, path))
        raise RulesError(f"circular extends: {chain}")
    if not path.is_file():
        raise RulesError(f"rules file not found: {path}")
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise RulesError(f"{path}: top level must be a mapping")
    parent_name = data.get("extends")
    if parent_name is None:
        return data
    parent = _load_raw(rules_path(parent_name, rules_dir), rules_dir, (*seen, path))
    return deep_merge(parent, data)


def deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    """Return ``base`` updated by ``override``: mappings merge recursively, ``None`` deletes."""
    result = dict(base)
    for key, value in override.items():
        if value is None:
            result.pop(key, None)
        elif isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def rules_json_schema() -> dict[str, Any]:
    """JSON Schema of a rules file (for editor validation and the docs)."""
    return RuleSet.model_json_schema()
