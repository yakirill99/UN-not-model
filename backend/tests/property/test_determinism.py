"""Same inputs -> same outputs, and each system has an independent RNG stream."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from arena.engine.events import EcologyChanged, Event
from arena.engine.orders import OrderBook
from arena.engine.pipeline import resolve_round
from arena.engine.rng import RngFactory, stable_id
from arena.engine.rules import load_rules
from arena.engine.scenario import load_scenario
from arena.engine.state import GameState
from arena.engine.systems import SYSTEMS, BaseSystem, RoundContext, register

ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture(autouse=True)
def _noise_system() -> Iterator[None]:
    saved = dict(SYSTEMS)

    @register("noise")
    class Noise(BaseSystem):
        def apply(self, state: GameState, orders: OrderBook, ctx: RoundContext) -> list[Event]:
            delta = int(self.rng(ctx).integers(-20, 0))
            state.ecology += delta
            return [
                EcologyChanged(
                    round=ctx.round, cause="noise", delta=delta, ecology_after=state.ecology
                )
            ]

    yield
    SYSTEMS.clear()
    SYSTEMS.update(saved)


def _draw(seed: int, round_no: int, system: str) -> list[int]:
    return [int(x) for x in RngFactory(seed, round_no).for_system(system).integers(0, 1_000_000, 5)]


def test_rng_streams_are_reproducible_and_independent() -> None:
    assert _draw(42, 1, "strikes") == _draw(42, 1, "strikes")
    assert _draw(42, 1, "strikes") != _draw(42, 1, "events")
    assert _draw(42, 1, "strikes") != _draw(42, 2, "strikes")
    assert _draw(42, 1, "strikes") != _draw(43, 1, "strikes")


def test_stable_id_is_pure_and_collision_free_for_neighbours() -> None:
    assert stable_id("strikes") == stable_id("strikes")
    assert stable_id("strikes") != stable_id("strike")
    assert 0 <= stable_id("x") < 2**64


def test_rng_factory_rejects_bad_input() -> None:
    with pytest.raises(ValueError):
        RngFactory(-1, 1)
    with pytest.raises(ValueError):
        RngFactory(1, 0)


@settings(max_examples=50, deadline=None)
@given(seed=st.integers(min_value=0, max_value=2**32 - 1))
def test_resolve_round_is_deterministic(seed: int) -> None:
    rules = load_rules("v1.0", ROOT / "rules").model_copy(update={"pipeline": ["noise"]})
    state = load_scenario(ROOT / "scenarios" / "equal.yaml").initial_state()
    s1, e1 = resolve_round(state, OrderBook(), rules, seed)
    s2, e2 = resolve_round(state, OrderBook(), rules, seed)
    assert s1 == s2 and e1 == e2
    assert state.ecology == 100  # input untouched
