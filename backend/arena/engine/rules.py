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

from itertools import pairwise
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import Field, model_validator

from arena.engine.state import ArenaModel, Country

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


class LastRound(ArenaModel):
    """Overrides for the final round. The playtest's ask #10: «на последнем
    раунде можно было сколько угодно кинуть, чтобы всё могло поменяться в
    последний момент». Off by default — the host decides per rules version."""

    unlimited_bombs: bool = Field(
        default=False,
        description="Lift the per-round bomb cap in the final round",
    )


class InvestReturn(ArenaModel):
    """One tier of diminishing returns on city investment (GAME_RULES_2.md 13).

    ``gain`` applies while the city's development is strictly below ``up_to``
    (``None`` = the last, open-ended tier). The first matching tier wins.
    """

    up_to: int | None = Field(default=None, ge=0)
    gain: int


class ClimateParams(ArenaModel):
    """Climate thresholds (GAME_RULES_2.md 7): ecology 60-100 fine, below — trouble."""

    unstable_below: int = Field(default=60, ge=0, description="Ecology below this is unstable")
    catastrophe_below: int = Field(
        default=30, ge=0, description="Ecology below this is a catastrophe"
    )
    unstable_city_loss: int = Field(default=5, description="Development lost by one random city")
    catastrophe_stability: int = Field(default=-10, description="Stability delta for everyone")
    catastrophe_income: int = Field(default=-20, ge=-100, description="Income penalty in percent")


class RatingLevel(ArenaModel):
    """A rating band: score >= min gives ``level`` with pool ``weight``."""

    min: int
    level: str
    weight: int = Field(ge=1)


class RatingParams(ArenaModel):
    """Investment rating (GAME_RULES_2.md 5): score = 0.5 x stability + 0.5 x life + modifiers."""

    sanction: int = -10
    nuclear_tech: int = -10
    bomb: int = -5
    eco_program: int = 5
    levels: list[RatingLevel] = Field(
        default_factory=lambda: [
            RatingLevel(min=75, level="A", weight=5),
            RatingLevel(min=60, level="B", weight=4),
            RatingLevel(min=45, level="C", weight=3),
            RatingLevel(min=30, level="D", weight=2),
            RatingLevel(min=0, level="E", weight=1),
        ]
    )


class PrivatePoolParams(ArenaModel):
    """The world pool of private capital (GAME_RULES_2.md 5): base x ecology/100."""

    base: int = Field(default=1000, ge=0)
    jitter_percent: int = Field(
        default=10, ge=0, le=100, description="Market noise, +/- this percent"
    )


class StabilityLevel(ArenaModel):
    """Income modifier for a stability band: stability >= min -> ``income_percent``."""

    min: int
    income_percent: int


class TraitsParams(ArenaModel):
    """The numbers of the country traits (GAME_RULES_2.md 9). The trait IDS live
    in state.py (TRAIT_IDS) and ride on the scenario's countries; a trait only
    has an effect in games whose rules carry the ``v2_core`` module."""

    resource_income: int = Field(default=100, description="resource_power: flat income bonus")
    electoral_dynamics_percent: int = Field(
        default=75, description="electoral_cycle: dynamics factor, percent of the life change"
    )
    eco_agenda_penalty: int = Field(
        default=-5, description="eco_agenda: stability lost per round in the unstable band"
    )
    sanction_resist_percent: int = Field(
        default=50, description="sanctions_experience: percent of the sanction effect left"
    )
    mobilization_bomb_cost: int = Field(
        default=100, description="mobilization_economy: the price of one bomb"
    )
    capital_cap: str = Field(default="B", description="capital_limits: the best rating available")
    floor_level: str = Field(default="E", description="isolation: the only rating available")


class StabilityParams(ArenaModel):
    """Political stability (GAME_RULES_2.md 4): the numbers of the round formula."""

    dynamics_percent: int = Field(
        default=50, description="Percent of the life-level change the people react to"
    )
    good_life: int = Field(
        default=50, description="Average life (percent) from which stability grows"
    )
    good_bonus: int = 2
    poor_life: int = Field(
        default=30, description="Average life (percent) below which stability sinks"
    )
    poor_penalty: int = -3
    sanction_penalty: int = -3
    first_city_loss: int = -5
    city_loss: int = -15
    crisis_below: int = Field(default=20, description="Stability below this: strikes are refused")
    transition_stability: int = Field(
        default=40, description="Stability after a power change (the reset value)"
    )
    income_levels: list[StabilityLevel] = Field(
        default_factory=lambda: [
            StabilityLevel(min=70, income_percent=10),
            StabilityLevel(min=40, income_percent=0),
            StabilityLevel(min=20, income_percent=-15),
            StabilityLevel(min=1, income_percent=-30),
        ]
    )


class Params(ArenaModel):
    rounds: int = Field(ge=1)
    ecology: Range
    life_weights: LifeWeights
    income: IncomeCoefficients
    laugh_bonus: int = Field(ge=0, description="Percentage points added to the laugh winner")
    budget_priority: list[str] = Field(
        min_length=1, description="Action ids in the order the budget is spent"
    )
    last_round: LastRound = Field(default_factory=LastRound)
    # --- v2 (GAME_RULES_2.md): used only by the systems the v2 pipeline names ---
    invest_returns: list[InvestReturn] | None = Field(
        default=None, description="Diminishing returns tiers; None = flat effect of the action"
    )
    climate: ClimateParams = Field(default_factory=ClimateParams)
    rating: RatingParams = Field(default_factory=RatingParams)
    private_pool: PrivatePoolParams = Field(default_factory=PrivatePoolParams)
    stability: StabilityParams = Field(default_factory=StabilityParams)
    traits: TraitsParams = Field(default_factory=TraitsParams)
    charisma_bonus: int = Field(
        default=5, ge=0, description="Stability points of the charisma winner"
    )

    @model_validator(mode="after")
    def _invest_returns_ordered(self) -> Params:
        tiers = self.invest_returns
        if tiers is None:
            return self
        for prev, cur in pairwise(tiers):
            if prev.up_to is None:
                raise ValueError("invest_returns: the open tier (up_to: null) must be last")
            if cur.up_to is not None and prev.up_to >= cur.up_to:
                raise ValueError("invest_returns: tiers must be sorted by up_to")
        if tiers and tiers[-1].up_to is not None:
            raise ValueError("invest_returns: the last tier must be open (up_to: null)")
        return self


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

    def is_v2(self) -> bool:
        """Whether the second-edition mechanics are switched on for these rules."""
        return "v2_core" in self.modules

    def action(self, action_id: str) -> ActionSpec:
        try:
            return self.actions[action_id]
        except KeyError:
            raise RulesError(f"rules {self.version} have no action {action_id!r}") from None

    def cost(self, action_id: str, payer: Country | None = None) -> int:
        """The price one unit costs; traits may discount it (GAME_RULES_2.md 9)."""
        if payer is not None and self.is_v2() and payer.has("mobilization_economy"):
            return self.params.traits.mobilization_bomb_cost
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
