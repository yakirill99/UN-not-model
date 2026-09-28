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

STATE_SCHEMA_VERSION = 1


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
