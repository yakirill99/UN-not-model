"""Metrics of one game and a summary over many (DEV_PLAN sprint 3)."""

from __future__ import annotations

from collections import Counter
from statistics import mean

from pydantic import Field

from arena.engine.events import NuclearStrike, OrderRejected
from arena.engine.runner import GameLog
from arena.engine.state import ArenaModel

ECOLOGY_COLLAPSE = 30  # percent; "round of collapse" = first round ending below this


class GameMetrics(ArenaModel):
    seed: int
    scenario: str
    rules_version: str
    lineup: dict[str, str] = Field(description="country id -> bot name")
    rounds: int
    winner: str
    winner_bot: str
    final_life: dict[str, int] = Field(description="country -> average life level, 1/100 %")
    final_ecology: int
    ecology_collapse_round: int | None
    cities_destroyed: int
    strikes: int
    strikes_absorbed: int
    rejected_orders: int
    total_orders: int
    tech_countries: int

    @property
    def rejected_share(self) -> float:
        return self.rejected_orders / self.total_orders if self.total_orders else 0.0


def metrics_of(log: GameLog, lineup: dict[str, str]) -> GameMetrics:
    final = log.final_state
    standings = log.standings()
    winner = standings[0][0]
    collapse = next((r.round for r in log.rounds if r.state_after.ecology < ECOLOGY_COLLAPSE), None)
    events = [e for r in log.rounds for e in r.events]
    strikes = [e for e in events if isinstance(e, NuclearStrike)]
    total_orders = sum(
        _units(r.orders.for_country(c.id)) for r in log.rounds for c in final.countries
    )
    return GameMetrics(
        seed=log.seed,
        scenario=log.scenario_id,
        rules_version=log.rules_version,
        lineup=lineup,
        rounds=len(log.rounds),
        winner=winner,
        winner_bot=lineup.get(winner, "?"),
        final_life=dict(standings),
        final_ecology=final.ecology,
        ecology_collapse_round=collapse,
        cities_destroyed=sum(c.destroyed for co in final.countries for c in co.cities),
        strikes=len(strikes),
        strikes_absorbed=sum(e.outcome == "absorbed" for e in strikes),
        rejected_orders=sum(isinstance(e, OrderRejected) for e in events),
        total_orders=total_orders,
        tech_countries=sum(c.nuclear_tech for c in final.countries),
    )


def _units(o: object) -> int:
    from arena.engine.orders import CountryOrders

    assert isinstance(o, CountryOrders)
    return (
        len(o.invest)
        + o.eco_programs
        + int(o.nuclear_tech)
        + o.bombs
        + len(o.strikes)
        + len(o.shields)
        + len(o.sanctions)
        + len(o.aid)
    )


def summarize(metrics: list[GameMetrics]) -> dict[str, object]:
    """Aggregate numbers a human wants to see after a batch."""
    if not metrics:
        return {"games": 0}
    n = len(metrics)
    wins_by_bot = Counter(m.winner_bot for m in metrics)
    games_by_bot = Counter(bot for m in metrics for bot in set(m.lineup.values()))
    collapses = [m.ecology_collapse_round for m in metrics if m.ecology_collapse_round]
    return {
        "games": n,
        "win_rate_by_bot": {
            b: round(wins_by_bot[b] / games_by_bot[b], 3) for b in sorted(games_by_bot)
        },
        "win_rate_by_country": {
            c: round(v / n, 3) for c, v in sorted(Counter(m.winner for m in metrics).items())
        },
        "mean_final_ecology": round(mean(m.final_ecology for m in metrics), 1),
        "ecology_collapse_share": round(len(collapses) / n, 3),
        "mean_collapse_round": round(mean(collapses), 2) if collapses else None,
        "mean_cities_destroyed": round(mean(m.cities_destroyed for m in metrics), 2),
        "mean_strikes": round(mean(m.strikes for m in metrics), 2),
        "mean_tech_countries": round(mean(m.tech_countries for m in metrics), 2),
        "rejected_order_share": round(
            sum(m.rejected_orders for m in metrics) / max(1, sum(m.total_orders for m in metrics)),
            3,
        ),
        "mean_winner_life": round(mean(max(m.final_life.values()) for m in metrics) / 100, 2),
    }
