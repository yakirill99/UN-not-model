"""Scripted bots for simulations and as opponents (DEV_PLAN sprint 3).

Every bot sees only ``Observation`` and ``ActionSpace`` - exactly what a human or an
LLM agent gets - and returns ``CountryOrders`` that pass ``validate``. Randomness
comes from the bot's own seeded generator, so a game with bots is reproducible from
(game seed, bot seeds).
"""

from __future__ import annotations

from collections.abc import Callable

from numpy.random import PCG64, Generator

from arena.engine.actions import ActionSpace
from arena.engine.observe import ForeignCountryView, Observation
from arena.engine.orders import CountryOrders
from arena.engine.runner import Agent


class Planner:
    """Builds an order while tracking the money left, so bots never overspend."""

    def __init__(self, space: ActionSpace) -> None:
        self.space = space
        self.left = space.budget
        self.orders = CountryOrders()

    def can(self, action: str, amount: int | None = None) -> bool:
        o = self.space.actions.get(action)
        if o is None or not o.available:
            return False
        cost = amount if amount is not None else o.cost
        return cost <= self.left

    def invest(self, city_id: str) -> bool:
        return self._buy("invest", city_id, self.orders.invest)

    def shield(self, city_id: str) -> bool:
        return self._buy("shield", city_id, self.orders.shields)

    def eco_program(self) -> bool:
        if not self.can("eco_program"):
            return False
        self.left -= self.space.option("eco_program").cost
        self.orders.eco_programs += 1
        return True

    def nuclear_tech(self) -> bool:
        if self.orders.nuclear_tech or not self.can("nuclear_tech"):
            return False
        self.left -= self.space.option("nuclear_tech").cost
        self.orders.nuclear_tech = True
        return True

    def bomb(self) -> bool:
        o = self.space.actions["bomb"]
        if not self.can("bomb") or (o.max_count is not None and self.orders.bombs >= o.max_count):
            return False
        self.left -= o.cost
        self.orders.bombs += 1
        return True

    def strike(self, city_id: str) -> bool:
        o = self.space.actions["strike"]
        if not o.available or city_id not in (o.targets or []) or city_id in self.orders.strikes:
            return False
        if o.max_count is not None and len(self.orders.strikes) >= o.max_count:
            return False
        self.orders.strikes.append(city_id)
        return True

    def sanction(self, country_id: str) -> bool:
        o = self.space.actions["sanction"]
        if not o.available or country_id not in (o.targets or []):
            return False
        if country_id in self.orders.sanctions:
            return False
        self.orders.sanctions.append(country_id)
        return True

    def aid(self, country_id: str, amount: int) -> bool:
        o = self.space.actions["aid"]
        if not o.available or country_id not in (o.targets or []) or amount < (o.min_amount or 1):
            return False
        if amount > self.left or country_id in self.orders.aid:
            return False
        self.left -= amount
        self.orders.aid[country_id] = amount
        return True

    def _buy(self, action: str, target: str, into: list[str]) -> bool:
        o = self.space.actions[action]
        if not self.can(action) or target not in (o.targets or []):
            return False
        if o.max_per_target is not None and into.count(target) >= o.max_per_target:
            return False
        self.left -= o.cost
        into.append(target)
        return True


# --- helpers ------------------------------------------------------------------


def _shuffled[T](items: list[T], rng: Generator) -> list[T]:
    """A random order, so that a stable sort afterwards breaks ties at random.

    Without this every bot would prefer whatever comes first in the scenario file,
    which on a symmetric start turns list order into a hidden advantage.
    """
    return [items[i] for i in rng.permutation(len(items))] if items else []


def _leader(obs: Observation, rng: Generator) -> ForeignCountryView | None:
    alive = [o for o in obs.others if any(not c.destroyed for c in o.cities)]
    ranked = sorted(_shuffled(alive, rng), key=lambda o: -o.average_life_level)
    return ranked[0] if ranked else None


def _best_cities(country: ForeignCountryView, n: int, rng: Generator) -> list[str]:
    alive = [c for c in country.cities if not c.destroyed]
    return [c.id for c in sorted(_shuffled(alive, rng), key=lambda c: -c.life_level)[:n]]


def _weakest_own_cities(obs: Observation, rng: Generator) -> list[str]:
    alive = [c for c in obs.me.cities if not c.destroyed]
    return [c.id for c in sorted(_shuffled(alive, rng), key=lambda c: c.development)]


def _unshielded_own(obs: Observation, rng: Generator) -> list[str]:
    return _shuffled([c.id for c in obs.me.cities if not c.destroyed and not c.shield], rng)


def _world_is_violent(obs: Observation) -> bool:
    return any(e.type in ("nuclear_strike", "city_destroyed") for e in obs.news)


def _invest_spread(p: Planner, obs: Observation, rng: Generator) -> None:
    """Round-robin investments from the weakest city up, until the money runs out."""
    cities = _weakest_own_cities(obs, rng)
    while cities and p.can("invest"):
        if not any(p.invest(city) for city in cities):
            break


def _arm(p: Planner, obs: Observation) -> None:
    """Technology first, then as many bombs as allowed and affordable."""
    if not obs.me.nuclear_tech:
        p.nuclear_tech()
    else:
        while p.bomb():
            pass


# --- bots ---------------------------------------------------------------------


class SeededBot:
    """Base: every bot owns a generator, used at least to break ties fairly."""

    def __init__(self, seed: int = 0) -> None:
        self.rng = Generator(PCG64(seed))


class RandomBot(SeededBot):
    """Random legal actions within the budget. The null model for balance tests."""

    def act(self, obs: Observation, legal: ActionSpace) -> CountryOrders:
        p = Planner(legal)
        rng = self.rng
        own = [c.id for c in obs.me.cities if not c.destroyed]
        foreign = legal.actions["strike"].targets or []
        others = legal.actions["sanction"].targets or []
        for _ in range(int(rng.integers(0, 8))):
            choice = rng.choice(
                ["invest", "eco", "tech", "bomb", "shield", "strike", "sanction", "aid"]
            )
            if choice == "invest" and own:
                p.invest(str(rng.choice(own)))
            elif choice == "eco":
                p.eco_program()
            elif choice == "tech":
                p.nuclear_tech()
            elif choice == "bomb":
                p.bomb()
            elif choice == "shield" and own:
                p.shield(str(rng.choice(own)))
            elif choice == "strike" and foreign and rng.random() < 0.5:
                p.strike(str(rng.choice(foreign)))
            elif choice == "sanction" and others and rng.random() < 0.2:
                p.sanction(str(rng.choice(others)))
            elif choice == "aid" and others and rng.random() < 0.1:
                p.aid(str(rng.choice(others)), int(rng.integers(50, 201)))
        return p.orders


class EconomistBot(SeededBot):
    """Invests everything in development; shields cities once the world turns violent."""

    def act(self, obs: Observation, legal: ActionSpace) -> CountryOrders:
        p = Planner(legal)
        if _world_is_violent(obs):
            for city in _unshielded_own(obs, self.rng)[:2]:
                p.shield(city)
        _invest_spread(p, obs, self.rng)
        return p.orders


class EcologistBot(SeededBot):
    """Ecology programs while ecology < threshold, the rest into development."""

    def __init__(self, seed: int = 0, threshold: int = 70, max_programs: int = 2) -> None:
        super().__init__(seed)
        self.threshold = threshold
        self.max_programs = max_programs

    def act(self, obs: Observation, legal: ActionSpace) -> CountryOrders:
        p = Planner(legal)
        if obs.ecology < self.threshold:
            for _ in range(self.max_programs):
                p.eco_program()
        _invest_spread(p, obs, self.rng)
        return p.orders


class AggressorBot(SeededBot):
    """Technology -> bombs -> strikes on the life-level leader; sanctions it meanwhile."""

    def act(self, obs: Observation, legal: ActionSpace) -> CountryOrders:
        p = Planner(legal)
        leader = _leader(obs, self.rng)
        if leader is not None:
            p.sanction(leader.id)
            for city in _best_cities(leader, obs.me.bombs, self.rng):
                p.strike(city)
        _arm(p, obs)
        for city in _unshielded_own(obs, self.rng)[:1]:
            p.shield(city)
        _invest_spread(p, obs, self.rng)
        return p.orders


class AvengerBot(SeededBot):
    """Peaceful economist until sanctioned or struck; then answers in kind, and worse.

    The bot remembers who sanctioned it (public to the victim). A strike is anonymous,
    so it blames the most recent sanctioner, or the leader if nobody has shown hostility.
    """

    def __init__(self, seed: int = 0) -> None:
        super().__init__(seed)
        self.grudges: list[str] = []
        self.struck = False

    def act(self, obs: Observation, legal: ActionSpace) -> CountryOrders:
        my_cities = {c.id for c in obs.me.cities}
        for e in obs.news:
            if e.type == "sanction_applied" and e.actor and e.actor not in self.grudges:
                self.grudges.append(e.actor)
            if e.type == "nuclear_strike" and e.target in my_cities:
                self.struck = True
        p = Planner(legal)
        for enemy in self.grudges:
            p.sanction(enemy)
        if self.struck:
            others = {o.id: o for o in obs.others}
            suspect = next((others[g] for g in reversed(self.grudges) if g in others), None)
            target = suspect or _leader(obs, self.rng)
            if target is not None:
                for city in _best_cities(target, obs.me.bombs, self.rng):
                    p.strike(city)
            _arm(p, obs)
            for city in _unshielded_own(obs, self.rng)[:2]:
                p.shield(city)
        elif _world_is_violent(obs):
            for city in _unshielded_own(obs, self.rng)[:1]:
                p.shield(city)
        _invest_spread(p, obs, self.rng)
        return p.orders


class IdleBot:
    def act(self, obs: Observation, legal: ActionSpace) -> CountryOrders:
        return CountryOrders()


BOTS: dict[str, Callable[[int], Agent]] = {
    "random": RandomBot,
    "economist": EconomistBot,
    "ecologist": EcologistBot,
    "aggressor": AggressorBot,
    "avenger": AvengerBot,
    "idle": lambda _seed: IdleBot(),
}


def make_bot(name: str, seed: int = 0) -> Agent:
    try:
        return BOTS[name](seed)
    except KeyError:
        raise ValueError(f"unknown bot {name!r}; known: {sorted(BOTS)}") from None
