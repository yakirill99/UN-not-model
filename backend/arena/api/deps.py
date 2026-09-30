"""FastAPI dependencies: settings, database session, current principal, role guards."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from arena.db import Database
from arena.services.auth import Principal, decode_token
from arena.services.errors import Forbidden
from arena.settings import Settings

COOKIE = "arena_token"


def get_settings_dep(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    db: Database = request.app.state.db
    async for session in db.session():
        yield session


SettingsDep = Annotated[Settings, Depends(get_settings_dep)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


def current_principal(request: Request, settings: SettingsDep) -> Principal:
    """Token from the httpOnly cookie, or from ``Authorization: Bearer`` (Swagger, scripts)."""
    token = request.cookies.get(COOKIE)
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    if not token:
        raise Forbidden("not authenticated: join a game with your code first")
    return decode_token(token, settings)


PrincipalDep = Annotated[Principal, Depends(current_principal)]


def in_game(game_id: uuid.UUID, principal: PrincipalDep) -> Principal:
    if principal.game_id != game_id:
        raise Forbidden("token is for another game")
    return principal


def host_only(principal: Annotated[Principal, Depends(in_game)]) -> Principal:
    if not principal.is_host:
        raise Forbidden("host only")
    return principal


def player_only(principal: Annotated[Principal, Depends(in_game)]) -> Principal:
    principal.require_country()
    return principal


GamePrincipal = Annotated[Principal, Depends(in_game)]
HostPrincipal = Annotated[Principal, Depends(host_only)]
PlayerPrincipal = Annotated[Principal, Depends(player_only)]
