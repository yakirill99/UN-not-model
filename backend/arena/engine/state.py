"""Game state models: GameState, Country, City.

Also the per-module state container for v2/v3 modules (DEV_PLAN, sprint 1).

Conventions (ROADMAP, principle 11): integers everywhere.
* ``development`` and ``ecology`` are percents: ``65`` means 65 %.
* ``life_level`` is in hundredths of a percent: ``5445`` means 54.45 %.
* ``budget`` is in whole dollars.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

STATE_SCHEMA_VERSION = 2  # 2: added the v2 country fields (stability, rating, ...); 1: MVP state

# Traits (GAME_RULES_2.md 9): every country carries one bonus and one limit. The
# ids are fixed here so a scenario typo is a load error, not a silent no-op.
# raw_dependency and diplomatic_tradition ride along already: their engines (the
# event deck, the resolutions) arrive with the next v2 steps.
TRAIT_IDS = {
    "resource_power",  # RU bonus: +income every round (params.traits.resource_income)
    "raw_dependency",  # RU limit: crisis/shock events hit double (event deck, reserved)
    "financial_center",  # US bonus: +1 share weight in the private pool
    "electoral_cycle",  # US limit: stability dynamics react faster (0.75, not 0.5)
    "diplomatic_tradition",  # FR bonus: two resolutions per round (resolutions, reserved)
    "eco_agenda",  # FR limit: stability drains while ecology is below the unstable line
    "sanctions_experience",  # IR bonus: sanctions bite half as hard
    "capital_limits",  # IR limit: rating capped at B
    "mobilization_economy",  # KP bonus: cheap bombs; sanctions never touch stability; starts at 70
    "isolation",  # KP limit: rating is always E
}


class ArenaModel(BaseModel):
    """Base for all engine models: unknown fields are an error, not silently dropped."""

    model_config = ConfigDict(extra="forbid")


class City(ArenaModel):
    id: str
    name: str
    development: int = Field(ge=0, description="Development in percent")
    shield: bool = False
    destroyed: bool = False
    life_level: int = Field(default=0, ge=0, description="Life level in 1/100 of a percent")


class Country(ArenaModel):
    id: str
    name: str
    budget: int = Field(ge=0)
    cities: list[City] = Field(min_length=1)
    nuclear_tech: bool = False
    bombs: int = Field(default=0, ge=0, description="Bombs ready to use this round")
    bombs_pending: int = Field(default=0, ge=0, description="Produced this round, usable next")
    laugh: int = Field(default=0, ge=0, description="Laugh coefficient, percentage points")
    aid_pending: int = Field(default=0, ge=0, description="Aid received, credited next round")
    sanctioned_by: list[str] = Field(default_factory=list)
    # --- v2 (GAME_RULES_2.md): carried by every game, used only by the v2 pipeline ---
    stability: int = Field(default=60, ge=0, le=100, description="Political stability, 0-100")
    average_life_prev: int | None = Field(
        default=None, description="Average life of the previous round, for the dynamics term"
    )
    rating_score: int = Field(default=0, description="Investment rating score (points)")
    rating: str = Field(default="C", description="Investment rating level, A-E")
    rating_weight: int = Field(default=3, ge=1, description="Share weight in the private pool")
    cities_lost: int = Field(default=0, ge=0, description="Cities lost in the whole game")
    cities_lost_this_round: int = Field(
        default=0, ge=0, description="Cities lost this round, consumed by the stability system"
    )
    powers_lost: int = Field(default=0, ge=0, description="Power changes over the game")
    in_transition: bool = Field(
        default=False, description="New government: strikes (and votes) are refused this round"
    )
    traits: list[str] = Field(
        default_factory=list, description="v2 trait ids (GAME_RULES_2.md 9); see TRAIT_IDS"
    )

    def has(self, trait: str) -> bool:
        """Whether the country carries a trait. The scenario loader rejects
        unknown ids, so a typo fails at load time, not as a silent no-op."""
        return trait in self.traits

    @model_validator(mode="after")
    def _unique_city_ids(self) -> Country:
        ids = [c.id for c in self.cities]
        if len(ids) != len(set(ids)):
            raise ValueError(f"country {self.id!r}: duplicate city ids {ids}")
        return self

    def city(self, city_id: str) -> City:
        for c in self.cities:
            if c.id == city_id:
                return c
        raise KeyError(f"country {self.id!r} has no city {city_id!r}")

    @property
    def alive_cities(self) -> list[City]:
        return [c for c in self.cities if not c.destroyed]

    @property
    def total_development(self) -> int:
        return sum(c.development for c in self.alive_cities)

    @property
    def average_life_level(self) -> int:
        """Country's main score, in 1/100 of a percent; destroyed cities count as 0."""
        return sum(c.life_level for c in self.cities) // len(self.cities)


def score_of(country: Country, major: int) -> int:
    """Standings score in 1/100 of a point (GAME_RULES_2.md 16 for v2).

    v1 ranks by average life alone; v2 adds stability and power-change penalties:
    итоговый счёт = средний УЖ + 0.2 x устойчивость - 10 x смены власти.
    """
    if major < 2:
        return country.average_life_level
    return country.average_life_level + 20 * country.stability - 1000 * country.powers_lost


class GameState(ArenaModel):
    round: int = Field(ge=1)
    ecology: int = Field(description="World ecology in percent")
    countries: list[Country] = Field(min_length=1)
    modules: dict[str, dict[str, Any]] = Field(
        default_factory=dict, description="State of v2/v3 modules keyed by module id"
    )
    state_schema_version: int = STATE_SCHEMA_VERSION

    @model_validator(mode="after")
    def _unique_ids(self) -> GameState:
        country_ids = [c.id for c in self.countries]
        if len(country_ids) != len(set(country_ids)):
            raise ValueError(f"duplicate country ids {country_ids}")
        city_ids = [city.id for c in self.countries for city in c.cities]
        if len(city_ids) != len(set(city_ids)):
            raise ValueError("city ids must be unique across all countries")
        return self

    # --- lookups -----------------------------------------------------------

    def country(self, country_id: str) -> Country:
        for c in self.countries:
            if c.id == country_id:
                return c
        raise KeyError(f"no country {country_id!r}")

    def find_city(self, city_id: str) -> tuple[Country, City]:
        for country in self.countries:
            for city in country.cities:
                if city.id == city_id:
                    return country, city
        raise KeyError(f"no city {city_id!r}")

    def city_owner(self, city_id: str) -> Country:
        return self.find_city(city_id)[0]
