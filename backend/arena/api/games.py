from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from arena.api.deps import GamePrincipal, HostPrincipal, PlayerPrincipal, SessionDep, SettingsDep
from arena.engine.actions import ActionSpace
from arena.engine.events import AnyEvent
from arena.engine.observe import Observation, visible_events
from arena.engine.orders import CountryOrders
from arena.engine.state import GameState
from arena.services import games, rounds
from arena.services.games import CreateGame, GameInfo

router = APIRouter(prefix="/games", tags=["games"])


@router.post("", status_code=201, summary="Create a game (returns host and team codes)")
async def create(req: CreateGame, session: SessionDep, settings: SettingsDep) -> GameInfo:
    return await games.create_game(session, req, settings)


@router.get("/{game_id}", summary="Game overview; codes only for the host")
async def info(game_id: uuid.UUID, principal: GamePrincipal, session: SessionDep) -> GameInfo:
    return await games.game_info(session, game_id, for_host=principal.is_host)


# --- player -------------------------------------------------------------------


@router.get("/{game_id}/observation", summary="What my country sees")
async def observation(
    game_id: uuid.UUID, principal: PlayerPrincipal, session: SessionDep
) -> Observation:
    return await rounds.get_observation(session, game_id, principal.require_country())


@router.get("/{game_id}/action-space", summary="What my country may do this round")
async def action_space(
    game_id: uuid.UUID, principal: PlayerPrincipal, session: SessionDep
) -> ActionSpace:
    return await rounds.get_action_space(session, game_id, principal.require_country())


@router.put("/{game_id}/orders", status_code=204, summary="Submit (or replace) my orders")
async def submit(
    game_id: uuid.UUID, orders: CountryOrders, principal: PlayerPrincipal, session: SessionDep
) -> None:
    await rounds.submit_orders(session, game_id, principal.require_country(), orders)


# --- shared -------------------------------------------------------------------


@router.get("/{game_id}/round", summary="Round status")
async def round_status(
    game_id: uuid.UUID, principal: GamePrincipal, session: SessionDep
) -> rounds.RoundStatus:
    status = await rounds.get_round_status(session, game_id)
    if not principal.is_host:  # players learn only about themselves
        me = principal.require_country()
        status.submitted = {me: status.submitted.get(me, False)}
        status.laugh_winner = None
    return status


@router.get("/{game_id}/events", summary="Events of a round, filtered by what I may see")
async def events(
    game_id: uuid.UUID,
    principal: GamePrincipal,
    session: SessionDep,
    round: int = Query(ge=1),
) -> list[AnyEvent]:
    evs = await rounds.load_round_events(session, game_id, round)
    if principal.is_host:
        return evs  # type: ignore[return-value]
    return visible_events(evs, principal.require_country())


# --- host ---------------------------------------------------------------------


@router.get("/{game_id}/state", summary="Full game state (host)")
async def state(game_id: uuid.UUID, _: HostPrincipal, session: SessionDep) -> GameState:
    return await games.load_state(session, game_id)


@router.post(
    "/{game_id}/rounds/{number}/laugh", status_code=204, summary="Pick the funniest team (host)"
)
async def laugh(
    game_id: uuid.UUID,
    number: int,
    _: HostPrincipal,
    session: SessionDep,
    country_id: str | None = None,
) -> None:
    await rounds.set_laugh_winner(session, game_id, country_id)


@router.post("/{game_id}/rounds/{number}/resolve", summary="Resolve round `number` (host)")
async def resolve(
    game_id: uuid.UUID, number: int, _: HostPrincipal, session: SessionDep
) -> rounds.RoundResult:
    return await rounds.resolve_round(session, game_id, expected_round=number)
