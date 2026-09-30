"""Dump the OpenAPI document of the API to a file (source of the frontend's types).

    uv run python -m arena.openapi --out ../frontend/src/api/openapi.json

The frontend generates ``src/api/schema.d.ts`` from this file (``just openapi``), and
``tests/api/test_openapi_snapshot.py`` fails when the API changes but the committed
snapshot does not, so client and server cannot silently drift apart.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from arena.main import create_app
from arena.settings import Settings

DEFAULT_OUT = Path(__file__).resolve().parents[2] / "frontend" / "src" / "api" / "openapi.json"


def openapi_document() -> dict[str, Any]:
    """The document as served at /openapi.json, independent of environment and DB."""
    app = create_app(Settings(env="test", database_url="sqlite+aiosqlite://", jwt_secret="x" * 32))
    return app.openapi()


def render(doc: dict[str, Any]) -> str:
    return json.dumps(doc, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="arena.openapi", description=__doc__.split("\n\n")[0])
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument("--check", action="store_true", help="exit 1 if --out is not up to date")
    args = p.parse_args(argv)
    text = render(openapi_document())
    if args.check:
        current = args.out.read_text(encoding="utf-8") if args.out.exists() else ""
        if current != text:
            print(f"{args.out} is out of date: run `just openapi`", file=sys.stderr)
            return 1
        print(f"{args.out} is up to date")
        return 0
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(text, encoding="utf-8")
    print(f"wrote {args.out} ({len(text)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
