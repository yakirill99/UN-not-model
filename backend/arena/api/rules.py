from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter

from arena.api.deps import SettingsDep
from arena.engine.rules import RulesError, RuleSet, load_rules, rules_json_schema
from arena.services.errors import NotFound

router = APIRouter(prefix="/rules", tags=["rules"])


def _dir(settings: SettingsDep) -> Path:
    return (Path(__file__).resolve().parents[2] / settings.rules_dir).resolve()


@router.get("", summary="Available rules versions")
async def list_rules(settings: SettingsDep) -> list[str]:
    d = _dir(settings)
    return sorted(p.stem for p in d.glob("*.yaml")) + sorted(
        f"experiments/{p.stem}" for p in (d / "experiments").glob("*.yaml")
    )


@router.get("/schema", summary="JSON Schema of a rules file")
async def schema() -> dict[str, Any]:
    return rules_json_schema()


@router.get("/{version:path}", summary="Rules after extends, as the engine sees them")
async def get_rules(version: str, settings: SettingsDep) -> RuleSet:
    try:
        return load_rules(version, _dir(settings))
    except RulesError as exc:
        raise NotFound(str(exc)) from exc
