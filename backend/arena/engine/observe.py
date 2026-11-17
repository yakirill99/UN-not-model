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
    CharismaAwarded,
    CityDestroyed,
    ClimateThreshold,
    EcologyChanged,
    Event,
    LaughAwarded,
    NuclearStrike,
    PowerChanged,
    RatingUpdated,
    SanctionApplied,
    StabilityChanged,
)
from arena.engine.rules import RuleSet
from arena.engine.state import ArenaModel, City, Country, GameState
from arena.engine.systems.income import IncomeSystem


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
    # v2 only (GAME_RULES_2.md 4-5): None in v1 games, so the UI can hide them
    # instead of showing numbers the current rules never use.
    stability: int | None = None
    rating: str | None = None
    rating_score: int | None = None


class ForeignCountryView(ArenaModel):
    id: str
    name: str
    cities: list[ForeignCityView]
    laugh: int
    average_life_level: int
    stability: int | None = None
    rating: str | None = None
    rating_score: int | None = None


class Observation(ArenaModel):
    round: int
    ecology: int
    me: OwnCountryView
    others: list[ForeignCountryView]
    news: list[AnyEvent] = Field(default_factory=list, description="Events visible to this country")
    income_forecast: int = Field(
        default=0,
        description=(
            "Income the current indicators will earn at the end of this round, "
            "before anyone acts; foreign strikes and sanctions will move it"
        ),
    )


def observe(
    state: GameState,
    country_id: str,
    events: list[Event] | None = None,
    rules: RuleSet | None = None,
) -> Observation:
    me = state.country(country_id)
    v2 = rules is not None and "v2_core" in rules.modules
    # The forecast (#11 of the playtest feedback) rides along with the view:
    # the income formula lives in one place (IncomeSystem), the secrecy rules
    # in another (here) — the forecast is public arithmetic on own numbers.
    income = IncomeSystem(rules) if rules is not None else None
    forecast = 0
    if income is not None:
        gross = sum(income.city_income(c, state.ecology) for c in me.alive_cities)
        forecast = max(0, (gross * (100 + income.income_percent(me, state.ecology))) // 100)
    return Observation(
        round=state.round,
        ecology=state.ecology,
        me=_own(me, v2),
        others=[_foreign(c, v2) for c in state.countries if c.id != country_id],
        news=visible_events(events or [], country_id),
        income_forecast=forecast,
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
        elif isinstance(
            e,
            # Public by design (GAME_RULES_2.md): stability and its breakdown, the
            # rating letters, climate thresholds, power changes, charisma, and the
            # v1 originals. All of them carry no actor, so nothing to redact.
            CityDestroyed
            | EcologyChanged
            | LaughAwarded
            | CharismaAwarded
            | StabilityChanged
            | PowerChanged
            | RatingUpdated
            | ClimateThreshold,
        ):
            out.append(e.model_copy(update={"actor": None}) if e.actor else e)
    return out  # type: ignore[return-value]  # every Event subclass is a member of AnyEvent


def _own(c: Country, v2: bool) -> OwnCountryView:
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
        stability=c.stability if v2 else None,
        rating=c.rating if v2 else None,
        rating_score=c.rating_score if v2 else None,
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


def _foreign(c: Country, v2: bool) -> ForeignCountryView:
    return ForeignCountryView(
        id=c.id,
        name=c.name,
        cities=[
            ForeignCityView(id=x.id, name=x.name, destroyed=x.destroyed, life_level=x.life_level)
            for x in c.cities
        ],
        laugh=c.laugh,
        average_life_level=c.average_life_level,
        # Stability and the rating letter are public in v2: the news announce them
        # («Агентство понизило рейтинг Франции до C»), protests are visible.
        stability=c.stability if v2 else None,
        rating=c.rating if v2 else None,
        rating_score=c.rating_score if v2 else None,
    )
