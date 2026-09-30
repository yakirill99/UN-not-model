"""Create a demo game and print the codes.

uv run python -m arena.seed_demo            # smolny, dprk/iran/france are bots
uv run python -m arena.seed_demo --scenario equal --bots usa:random
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from arena.db import Database
from arena.services.games import BotSlot, CreateGame, create_game
from arena.settings import Settings, get_settings

DEFAULT_BOTS = ["dprk:aggressor", "iran:economist", "france:ecologist"]


def parse_bots(items: list[str]) -> list[BotSlot]:
    out = []
    for item in items:
        country, _, bot = item.partition(":")
        if not bot:
            raise SystemExit(f"--bots expects country:bot, got {item!r}")
        out.append(BotSlot(country_id=country, bot=bot))
    return out


async def seed(settings: Settings, req: CreateGame, db: Database | None = None) -> str:
    own = db is None
    db = db or Database(settings)
    try:
        async with db.sessions() as session:
            info = await create_game(session, req, settings)
    finally:
        if own:
            await db.dispose()
    lines = [
        f"game {info.id}: {info.title}",
        f"  scenario {info.scenario_id}, rules {info.rules_version}, seed {info.seed}",
    ]
    lines.append(f"  host code:  {info.host_code}")
    for p in info.players:
        tag = f"bot ({p.kind})" if p.kind != "human" else "human"
        lines.append(f"  {p.country_id:<8} {p.name:<16} {tag:<14} code {p.join_code}")
    lines.append("open http://localhost:8000/docs and POST /api/auth/join with a code")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="arena.seed_demo", description=__doc__)
    p.add_argument("--scenario", default="smolny")
    p.add_argument("--rules", default="v1.0")
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--title", default="Демо-партия")
    p.add_argument("--bots", nargs="*", default=DEFAULT_BOTS, help="country:bot ...")
    args = p.parse_args(argv)
    req = CreateGame(
        rules=args.rules,
        scenario=args.scenario,
        seed=args.seed,
        title=args.title,
        mode="playtest",
        bots=parse_bots(args.bots),
    )
    print(asyncio.run(seed(get_settings(), req)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
