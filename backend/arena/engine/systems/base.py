"""System protocol, RoundContext and the @register decorator.

A system is one game mechanic. It receives the *working copy* of the state, mutates
it in place and returns the events describing what it did. Systems never read
``random`` or the clock: everything they need is in ``RoundContext``.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import ClassVar, Protocol

from numpy.random import Generator

from arena.engine.events import Event
from arena.engine.orders import CountryOrders, OrderBook
from arena.engine.rng import RngFactory
from arena.engine.rules import RuleSet
from arena.engine.state import GameState


@dataclass(frozen=True, slots=True)
class RoundContext:
    rules: RuleSet
    rng: RngFactory
    round: int
    approved: dict[str, CountryOrders] = field(default_factory=dict)
    """Country id -> orders that passed budget/legality checks.

    ``resolve_round`` fills it with the raw orders of every country; the ``budget``
    system replaces each entry with what the country can actually afford. Systems
    that execute orders read ``ctx.approved``, never ``orders`` directly.
    """


class System(Protocol):
    name: ClassVar[str]

    def __init__(self, rules: RuleSet) -> None: ...

    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]: ...


class BaseSystem:
    """Convenience base: stores the rules and gives the system its own RNG stream."""

    name: ClassVar[str] = ""

    def __init__(self, rules: RuleSet) -> None:
        self.rules = rules

    def rng(self, ctx: RoundContext) -> Generator:
        return ctx.rng.for_system(self.name)

    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        raise NotImplementedError(f"system {self.name!r} does not implement apply()")


SYSTEMS: dict[str, type[System]] = {}


def round_half_away(num: int, den: int) -> int:
    """Round ``num / den`` half away from zero — the rules' own convention.

    GAME_RULES_2.md 18: «0,5 x (50 - 55) = -2,5 → -3», so +2,5 goes to 3 as well.
    Integer arithmetic only: no float drift in a deterministic engine.
    """
    q, r = divmod(abs(num), den)
    out = q + (1 if 2 * r >= den else 0)
    return -out if num < 0 else out


def register(name: str) -> Callable[[type[System]], type[System]]:
    """Add a system class to the registry under ``name`` (the id used in ``pipeline:``)."""

    def decorator(cls: type[System]) -> type[System]:
        if name in SYSTEMS and SYSTEMS[name] is not cls:
            raise ValueError(f"system {name!r} is already registered by {SYSTEMS[name].__name__}")
        cls.name = name
        SYSTEMS[name] = cls
        return cls

    return decorator
