from __future__ import annotations

from fastapi import APIRouter, Response
from pydantic import BaseModel

from arena.api.deps import COOKIE, PrincipalDep, SessionDep, SettingsDep
from arena.services import games
from arena.services.auth import Principal, issue_token

router = APIRouter(prefix="/auth", tags=["auth"])


class JoinRequest(BaseModel):
    code: str


class JoinResponse(BaseModel):
    principal: Principal
    token: str


@router.post("/join", summary="Exchange an access code for a session")
async def join(
    req: JoinRequest, session: SessionDep, settings: SettingsDep, response: Response
) -> JoinResponse:
    principal = await games.join(session, req.code)
    token = issue_token(principal, settings)
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=settings.env == "prod",
        max_age=settings.jwt_ttl_hours * 3600,
    )
    return JoinResponse(principal=principal, token=token)


@router.get("/me", summary="Who am I")
async def me(principal: PrincipalDep) -> Principal:
    return principal


@router.post("/logout", status_code=204)
async def logout(response: Response) -> None:
    response.delete_cookie(COOKIE)
