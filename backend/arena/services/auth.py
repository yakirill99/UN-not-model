"""Access codes and JWT tokens. No passwords: the host creates a game and hands out codes."""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

import jwt
from pydantic import BaseModel

from arena.services.errors import Forbidden
from arena.settings import Settings

Role = Literal["host", "player"]
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O, 1/I


def new_code(prefix: str, length: int = 6) -> str:
    body = "".join(secrets.choice(ALPHABET) for _ in range(length))
    return f"{prefix}-{body}"


class Principal(BaseModel):
    """Who is calling: decoded from the JWT."""

    game_id: uuid.UUID
    role: Role
    country_id: str | None = None

    @property
    def is_host(self) -> bool:
        return self.role == "host"

    def require_country(self) -> str:
        if self.country_id is None:
            raise Forbidden("this action needs a player token")
        return self.country_id


def issue_token(principal: Principal, settings: Settings, now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    claims = {
        "sub": str(principal.game_id),
        "role": principal.role,
        "country": principal.country_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.jwt_ttl_hours)).timestamp()),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str, settings: Settings) -> Principal:
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise Forbidden(f"invalid token: {exc}") from exc
    return Principal(
        game_id=uuid.UUID(claims["sub"]), role=claims["role"], country_id=claims.get("country")
    )
