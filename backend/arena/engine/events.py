"""Events: discriminated union of event classes with schema_version; upcasters for old formats.

Every change the engine makes is an event (ROADMAP, principle 5). Events are the source
for debugging, replays, analytics and LLM experiments, so the schema is versioned and
old logs must always be readable.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import Field, TypeAdapter

from arena.engine.state import ArenaModel

EVENT_SCHEMA_VERSION = 1


class Event(ArenaModel):
    """Common envelope. Subclasses override ``type`` with a Literal and add payload fields."""

    type: str
    schema_version: int = EVENT_SCHEMA_VERSION
    round: int = Field(ge=1)
    actor: str | None = Field(default=None, description="Country id that caused the event")
    target: str | None = Field(default=None, description="Country or city id affected")


class OrderRejected(Event):
    type: Literal["order_rejected"] = "order_rejected"
    action: str
    reason: str
    detail: dict[str, Any] = Field(default_factory=dict)


class BudgetSpent(Event):
    type: Literal["budget_spent"] = "budget_spent"
    action: str
    amount: int = Field(ge=0)
    budget_after: int


class CityInvested(Event):
    type: Literal["city_invested"] = "city_invested"
    development_before: int
    development_after: int


class EcologyChanged(Event):
    type: Literal["ecology_changed"] = "ecology_changed"
    cause: str
    delta: int
    ecology_after: int


class LifeLevelComputed(Event):
    type: Literal["life_level_computed"] = "life_level_computed"
    life_level: int = Field(ge=0, description="1/100 of a percent")


class IncomeCredited(Event):
    type: Literal["income_credited"] = "income_credited"
    amount: int = Field(ge=0)
    budget_after: int


AnyEvent = Annotated[
    OrderRejected
    | BudgetSpent
    | CityInvested
    | EcologyChanged
    | LifeLevelComputed
    | IncomeCredited,
    Field(discriminator="type"),
]

EventList = TypeAdapter(list[AnyEvent])


def dump_events(events: list[Event]) -> list[dict[str, Any]]:
    return [e.model_dump(mode="json") for e in events]


def load_events(raw: list[dict[str, Any]]) -> list[AnyEvent]:
    """Parse a stored log, upcasting old schema versions first."""
    return EventList.validate_python([_upcast(item) for item in raw])


def _upcast(item: dict[str, Any]) -> dict[str, Any]:
    version = item.get("schema_version", 1)
    if version > EVENT_SCHEMA_VERSION:
        raise ValueError(f"event schema {version} is newer than supported {EVENT_SCHEMA_VERSION}")
    # Upcasters go here as the schema evolves: while version < CURRENT: item = _v1_to_v2(item)
    return item
