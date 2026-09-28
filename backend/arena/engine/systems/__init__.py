"""Engine systems, one module per mechanic. Importing this package registers all systems.

Add an import line here for every new system module (ROADMAP 3.10, step 2).
"""

from arena.engine.systems import (  # noqa: F401  (registration)
    budget,
    clamp,
    develop,
    income,
    life_level,
)
from arena.engine.systems.base import SYSTEMS, BaseSystem, RoundContext, System, register

__all__ = ["SYSTEMS", "BaseSystem", "RoundContext", "System", "register"]
