"""ServiceError -> HTTP response; OrdersRejected carries the per-field problems."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from arena.services.errors import ServiceError
from arena.services.rounds import OrdersRejected


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ServiceError)
    async def _service_error(request: Request, exc: ServiceError) -> JSONResponse:
        body: dict[str, object] = {"detail": str(exc)}
        if isinstance(exc, OrdersRejected):
            body["errors"] = [e.model_dump() for e in exc.errors]
        return JSONResponse(body, status_code=exc.status_code)
