"""strikes: nuclear strikes with shields (section 10, section 12 step 7).

Validation (per attacker, in the order strikes are listed): a bomb must be on stock
(``bombs``, not ``bombs_pending``), at most ``max_per_round`` strikes, at most
``max_per_target_city_per_round`` per city, never an own city, never a city that
was already destroyed before this round. Each valid strike consumes one bomb and
costs ``effect.ecology`` (decision 3).

Resolution is simultaneous: all valid strikes are collected first, then applied
city by city. A shield absorbs exactly one strike and disappears; a second strike
on the same city in the same round destroys it (section 10). A strike on a city
destroyed earlier in the same round still spends the bomb (``outcome="already_destroyed"``).

Events carry the attacker for the journal; ``observe`` hides it (``anonymous: true``).
"""

from __future__ import annotations

from arena.engine.events import CityDestroyed, EcologyChanged, Event, NuclearStrike, OrderRejected
from arena.engine.orders import OrderBook
from arena.engine.state import City, GameState
from arena.engine.systems.base import BaseSystem, RoundContext, register


@register("strikes")
class StrikesSystem(BaseSystem):
    def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
        events: list[Event] = []
        eco = self.rules.effect("strike", "ecology")
        hits: list[tuple[str, str]] = []  # (attacker, city) in submission order

        for attacker in state.countries:
            own = {c.id for c in attacker.cities}
            per_city: dict[str, int] = {}
            launched = 0
            for city_id in ctx.approved[attacker.id].strikes:
                reason = self._check(state, attacker.id, own, city_id, launched, per_city)
                if reason is None and attacker.bombs <= 0:
                    reason = "no_bombs"
                if reason is not None:
                    events.append(
                        OrderRejected(
                            round=ctx.round,
                            actor=attacker.id,
                            target=city_id,
                            action="strike",
                            reason=reason,
                        )
                    )
                    continue
                attacker.bombs -= 1
                launched += 1
                hits.append((attacker.id, city_id))

        for attacker_id, city_id in hits:
            owner, city = state.find_city(city_id)
            outcome = self._hit(city)
            events.append(
                NuclearStrike(round=ctx.round, actor=attacker_id, target=city_id, outcome=outcome)
            )
            if outcome == "destroyed":
                events.append(
                    CityDestroyed(round=ctx.round, actor=owner.id, target=city_id, cause="nuclear")
                )
            if eco:
                state.ecology += eco
                events.append(
                    EcologyChanged(
                        round=ctx.round,
                        actor=attacker_id,
                        cause="strike",
                        delta=eco,
                        ecology_after=state.ecology,
                    )
                )
        return events

    def _check(
        self,
        state: GameState,
        attacker_id: str,
        own: set[str],
        city_id: str,
        launched: int,
        per_city: dict[str, int],
    ) -> str | None:
        """Rejection reason for one strike, or None. Mutates per_city bookkeeping."""
        spec = self.rules.action("strike")
        if city_id in own:
            return "own_city"
        try:
            _, city = state.find_city(city_id)
        except KeyError:
            return "unknown_city"
        if city.destroyed:  # cities are not mutated until all strikes are validated
            return "city_destroyed"
        if spec.max_per_round is not None and launched >= spec.max_per_round:
            return "limit_exceeded"
        per_city[city_id] = per_city.get(city_id, 0) + 1
        cap = spec.max_per_target_city_per_round
        if cap is not None and per_city[city_id] > cap:
            return "limit_exceeded"
        return None

    @staticmethod
    def _hit(city: City) -> str:
        if city.destroyed:
            return "already_destroyed"
        if city.shield:
            city.shield = False
            return "absorbed"
        city.destroyed = True
        city.development = 0
        city.shield = False
        return "destroyed"
