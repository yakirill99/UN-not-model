"""FastAPI application: lifespan, health probes, routers.

uv run uvicorn arena.main:app --reload
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from arena import __version__
from arena.db import Database
from arena.settings import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.settings = settings
        app.state.db = Database(settings)
        try:
            yield
        finally:
            await app.state.db.dispose()

    app = FastAPI(
        title="World Arena API",
        version=__version__,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url=None,
    )

    @app.get("/healthz", tags=["ops"], summary="Process is alive")
    async def healthz() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    @app.get("/readyz", tags=["ops"], summary="Database reachable")
    async def readyz(session: Annotated[AsyncSession, Depends(get_session)]) -> JSONResponse:
        try:
            await session.execute(text("SELECT 1"))
        except Exception as exc:
            return JSONResponse({"status": "unavailable", "detail": type(exc).__name__}, 503)
        return JSONResponse({"status": "ready"})

    return app


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: one AsyncSession per request."""
    db: Database = request.app.state.db
    async for session in db.session():
        yield session


app = create_app()
