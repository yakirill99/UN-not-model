"""Engine systems, one module per mechanic. Importing this package registers all systems.

Add an import line here for every new system module (ROADMAP 3.10, step 2).
"""

from arena.engine.systems import (  # noqa: F401  (registration)
    aid,
    budget,
    build,
    capital,
    charisma,
    clamp,
    climate,
    develop,
    end_of_round,
    income,
    laugh,
    life_level,
    rating,
    sanctions,
    stability,
    strikes,
)
from arena.engine.systems.base import SYSTEMS, BaseSystem, RoundContext, System, register

__all__ = ["SYSTEMS", "BaseSystem", "RoundContext", "System", "register"]
