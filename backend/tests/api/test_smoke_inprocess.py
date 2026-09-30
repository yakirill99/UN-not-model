"""The smoke scenario itself must pass against the in-process app (so CI guards it)."""

import threading

import pytest
import uvicorn

from arena.db.migrate import create_all
from arena.main import create_app
from arena.settings import Settings
from arena.smoke import run
from tests.conftest import TEST_JWT_SECRET


@pytest.fixture
def live_server():  # type: ignore[no-untyped-def]
    app = create_app(
        Settings(
            env="test",
            database_url="sqlite+aiosqlite:///./smoke-test.db",
            jwt_secret=TEST_JWT_SECRET,
        )
    )
    config = uvicorn.Config(app, host="127.0.0.1", port=8765, log_level="warning")
    server = uvicorn.Server(config)
    t = threading.Thread(target=server.run, daemon=True)
    t.start()
    import time

    for _ in range(50):
        if server.started:
            break
        time.sleep(0.1)
    import asyncio

    asyncio.run(create_all(app.state.db.engine))
    yield "http://127.0.0.1:8765"
    server.should_exit = True
    t.join(timeout=5)
    import pathlib

    pathlib.Path("smoke-test.db").unlink(missing_ok=True)


def test_smoke_scenario_passes(live_server: str) -> None:
    report = run(live_server, seed=7, scenario="equal")
    assert report.failed == [], report.failed
