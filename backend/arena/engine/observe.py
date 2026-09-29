"""observe(state, country_id) -> Observation. The single place where secrecy rules live.

GAME_RULES.md section 11. A delegation sees everything about itself and the public
picture of the world: life levels of all cities, averages, ecology, destroyed cities,
laugh coefficients, who sanctioned *it*. It never sees foreign budgets, arsenals,
technologies, shields, pending aid or who launched a strike.

The view models deliberately do not have fields for secret data, so a leak is a
type error rather than a forgotten filter. Frontend, bots and LLM agents all get
the same ``Observation``.
"""

from __future__ import annotations

from pydantic import Field

from arena.engine.events import (
    AnyEvent,
    CityDestroyed,
    EcologyChanged,
    Event,
    LaughAwarded,
    NuclearStrike,
    SanctionApplied,
)
from arena.engine.state import ArenaModel, City, Country, GameState


class OwnCityView(ArenaModel):
    id: str
    name: str
    development: int
    shield: bool
    destroyed: bool
    life_level: int


class ForeignCityView(ArenaModel):
    id: str
    name: str
    destroyed: bool
    life_level: int


class OwnCountryView(ArenaModel):
    id: str
    name: str
    budget: int
    cities: list[OwnCityView]
    nuclear_tech: bool
    bombs: int
    bombs_pending: int
    laugh: int
    aid_pending: int
    sanctioned_by: list[str]
    average_life_level: int


class ForeignCountryView(ArenaModel):
    id: str
    name: str
    cities: list[ForeignCityView]
    laugh: int
    average_life_level: int


class Observation(ArenaModel):
    round: int
    ecology: int
    me: OwnCountryView
    others: list[ForeignCountryView]
    news: list[AnyEvent] = Field(default_factory=list, description="Events visible to this country")


def observe(state: GameState, country_id: str, events: list[Event] | None = None) -> Observation:
    me = state.country(country_id)
    return Observation(
        round=state.round,
        ecology=state.ecology,
        me=_own(me),
        others=[_foreign(c) for c in state.countries if c.id != country_id],
        news=visible_events(events or [], country_id),
    )


def visible_events(events: list[Event], country_id: str) -> list[AnyEvent]:
    """Filter and redact a round's events for one country (section 11)."""
    out: list[Event] = []
    for e in events:
        if e.actor == country_id:
            out.append(e)  # everything I did, including rejections and income
        elif isinstance(e, NuclearStrike):
            out.append(e.model_copy(update={"actor": None}))  # strike is public, author is not
        elif isinstance(e, SanctionApplied) and e.target == country_id:
            out.append(e)  # the victim learns who sanctioned it
        elif isinstance(e, CityDestroyed | EcologyChanged | LaughAwarded):
            out.append(e.model_copy(update={"actor": None}) if e.actor else e)
    return out  # type: ignore[return-value]  # every Event subclass is a member of AnyEvent


def _own(c: Country) -> OwnCountryView:
    return OwnCountryView(
        id=c.id,
        name=c.name,
        budget=c.budget,
        cities=[_own_city(x) for x in c.cities],
        nuclear_tech=c.nuclear_tech,
        bombs=c.bombs,
        bombs_pending=c.bombs_pending,
        laugh=c.laugh,
        aid_pending=c.aid_pending,
        sanctioned_by=list(c.sanctioned_by),
        average_life_level=c.average_life_level,
    )


def _own_city(x: City) -> OwnCityView:
    return OwnCityView(
        id=x.id,
        name=x.name,
        development=x.development,
        shield=x.shield,
        destroyed=x.destroyed,
        life_level=x.life_level,
    )


def _foreign(c: Country) -> ForeignCountryView:
    return ForeignCountryView(
        id=c.id,
        name=c.name,
        cities=[
            ForeignCityView(id=x.id, name=x.name, destroyed=x.destroyed, life_level=x.life_level)
            for x in c.cities
        ],
        laugh=c.laugh,
        average_life_level=c.average_life_level,
    )
