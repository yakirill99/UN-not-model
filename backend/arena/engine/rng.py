"""Deterministic randomness.

RngFactory(game_seed, round).for_system(system_id). Never use `random` directly.

Every system gets its own independent stream derived from (game seed, round, system
name). Adding a new random mechanic therefore never shifts the numbers an existing
system draws, so golden tests and replays stay valid (ROADMAP 3.4).
"""

from __future__ import annotations

import hashlib

from numpy.random import PCG64, Generator, SeedSequence


def stable_id(name: str) -> int:
    """A process-independent 64-bit integer for a system name (``hash()`` is salted)."""
    return int.from_bytes(hashlib.sha256(name.encode("utf-8")).digest()[:8], "big")


class RngFactory:
    def __init__(self, game_seed: int, round_no: int) -> None:
        if game_seed < 0 or round_no < 1:
            raise ValueError(f"seed must be >= 0 and round >= 1, got {game_seed}, {round_no}")
        self.game_seed = game_seed
        self.round_no = round_no

    def for_system(self, system_id: str) -> Generator:
        seq = SeedSequence([self.game_seed, self.round_no, stable_id(system_id)])
        return Generator(PCG64(seq))

    def __repr__(self) -> str:
        return f"RngFactory(game_seed={self.game_seed}, round_no={self.round_no})"
