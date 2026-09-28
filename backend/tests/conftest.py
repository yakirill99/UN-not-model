"""Shared fixtures."""

from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return REPO_ROOT


@pytest.fixture(scope="session")
def rules_dir() -> Path:
    return REPO_ROOT / "rules"


@pytest.fixture(scope="session")
def scenarios_dir() -> Path:
    return REPO_ROOT / "scenarios"
