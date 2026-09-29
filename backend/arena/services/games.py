"""Game lifecycle: create a game, join it, list its state.

``create_game`` freezes the rules (after extends + overrides) and the initial state
into the database, so a game keeps playing by the rules it started with even if
rules/*.yaml changes later.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from arena.agents.bots import BOTS
from arena.db.models import Game, Player, Round, StateSnapshot
from arena.engine.rules import RulesError, RuleSet, deep_merge, load_rules
from arena.engine.scenario import ScenarioError, load_scenario
from arena.engine.state import STATE_SCHEMA_VERSION, GameState
from arena.services.auth import Principal, new_code
from arena.services.errors import Conflict, InvalidInput, NotFound
from arena.settings import Settings


class BotSlot(BaseModel):
    country_id: str
    bot: str


class CreateGame(BaseModel):
    rules: str = "v1.0"
    scenario: str = "smolny"
    seed: int = Field(default=0, ge=0)
    title: str = ""
    mode: str = Field(default="live", pattern="^(live|playtest)$")
    overrides: dict[str, Any] = Field(
        default_factory=dict, description="Deep-merged over the rules"
    )
    bots: list[BotSlot] = Field(default_factory=list)


class PlayerInfo(BaseModel):
    country_id: str
    name: str
    kind: str
    joined: bool
    join_code: str | None = None  # only shown to the host


class GameInfo(BaseModel):
    id: uuid.UUID
    title: str
    mode: str
    status: str
    rules_version: str
    scenario_id: str
    seed: int
    current_round: int
    rounds_total: int
    phase: str
    players: list[PlayerInfo]
    host_code: str | None = None  # only on creation / for the host


def _rules_dir(settings: Settings) -> Path:
    return (Path(__file__).resolve().parents[2] / settings.rules_dir).resolve()


def _scenarios_dir(settings: Settings) -> Path:
    return (Path(__file__).resolve().parents[2] / settings.scenarios_dir).resolve()


async def create_game(session: AsyncSession, req: CreateGame, settings: Settings) -> GameInfo:
    try:
        rules = load_rules(req.rules, _rules_dir(settings))
        if req.overrides:
            rules = RuleSet.model_validate(deep_merge(rules.model_dump(), req.overrides))
        scenario = load_scenario(_scenarios_dir(settings) / f"{req.scenario}.yaml")
    except (RulesError, ScenarioError, ValueError) as exc:
        raise InvalidInput(str(exc)) from exc
    bots = {b.country_id: b.bot for b in req.bots}
    known = {c.id for c in scenario.countries}
    if unknown := set(bots) - known:
        raise InvalidInput(f"bots for unknown countries: {sorted(unknown)}")
    if bad := sorted(set(bots.values()) - set(BOTS)):
        raise InvalidInput(f"unknown bots {bad}; known: {sorted(BOTS)}")

    initial = scenario.initial_state()
    game = Game(
        title=req.title or scenario.title,
        mode=req.mode,
        rules_version=rules.version,
        rules_snapshot=rules.model_dump(mode="json"),
        scenario_id=scenario.id,
        seed=req.seed,
        host_code=new_code("HOST"),
    )
    game.players = [
        Player(
            country_id=c.id,
            display_name=c.name,
            kind="bot" if c.id in bots else "human",
            agent_config={"bot": bots[c.id]} if c.id in bots else {},
            join_code=new_code(c.id[:3].upper()),
            joined_at=datetime.now(UTC) if c.id in bots else None,
        )
        for c in scenario.countries
    ]
    game.rounds = [Round(number=1)]
    session.add(game)
    await session.flush()
    session.add(
        StateSnapshot(
            game_id=game.id,
            round_number=0,
            state_schema_version=STATE_SCHEMA_VERSION,
            state=initial.model_dump(mode="json"),
        )
    )
    await session.commit()
    return await game_info(session, game.id, for_host=True)


async def get_game(session: AsyncSession, game_id: uuid.UUID) -> Game:
    game = await session.get(Game, game_id, options=[selectinload(Game.players)])
    if game is None:
        raise NotFound(f"game {game_id} not found")
    return game


async def game_info(session: AsyncSession, game_id: uuid.UUID, for_host: bool = False) -> GameInfo:
    game = await get_game(session, game_id)
    rules = RuleSet.model_validate(game.rules_snapshot)
    return GameInfo(
        id=game.id,
        title=game.title,
        mode=game.mode,
        status=game.status,
        rules_version=game.rules_version,
        scenario_id=game.scenario_id,
        seed=game.seed,
        current_round=game.current_round,
        rounds_total=rules.params.rounds,
        phase=game.phase,
        players=[
            PlayerInfo(
                country_id=p.country_id,
                name=p.display_name,
                kind=p.kind,
                joined=p.joined_at is not None,
                join_code=p.join_code if for_host else None,
            )
            for p in sorted(game.players, key=lambda p: p.country_id)
        ],
        host_code=game.host_code if for_host else None,
    )


async def join(session: AsyncSession, code: str) -> Principal:
    """Exchange an access code for a principal (the API turns it into a JWT)."""
    code = code.strip().upper()
    game = (await session.execute(select(Game).where(Game.host_code == code))).scalar_one_or_none()
    if game is not None:
        return Principal(game_id=game.id, role="host")
    player = (
        await session.execute(select(Player).where(Player.join_code == code))
    ).scalar_one_or_none()
    if player is None:
        raise NotFound("unknown code")
    if player.kind != "human":
        raise Conflict(f"{player.country_id} is controlled by a bot")
    if player.joined_at is None:
        player.joined_at = datetime.now(UTC)
        await session.commit()
    return Principal(game_id=player.game_id, role="player", country_id=player.country_id)


async def load_state(
    session: AsyncSession, game_id: uuid.UUID, round_number: int | None = None
) -> GameState:
    """Latest snapshot (or the one after ``round_number``) as an engine state."""
    q = select(StateSnapshot).where(StateSnapshot.game_id == game_id)
    q = (
        q.where(StateSnapshot.round_number == round_number)
        if round_number is not None
        else q.order_by(StateSnapshot.round_number.desc()).limit(1)
    )
    snap = (await session.execute(q)).scalar_one_or_none()
    if snap is None:
        raise NotFound(f"no state for game {game_id}")
    return GameState.model_validate(snap.state)


def rules_of(game: Game) -> RuleSet:
    return RuleSet.model_validate(game.rules_snapshot)
