"""The committed OpenAPI snapshot (frontend/src/api/openapi.json) matches the app."""

from pathlib import Path

from arena.openapi import DEFAULT_OUT, openapi_document, render


def test_openapi_snapshot_is_current(repo_root: Path) -> None:
    snapshot = repo_root / "frontend" / "src" / "api" / "openapi.json"
    assert snapshot == DEFAULT_OUT
    assert snapshot.exists(), "run `just openapi` to create the snapshot"
    msg = "API changed but frontend/src/api/openapi.json was not regenerated: run `just openapi`"
    assert snapshot.read_text(encoding="utf-8") == render(openapi_document()), msg
