# World Arena — project commands. Run `just` to see the list.
set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-load

default:
    @just --list

# --- Setup ---------------------------------------------------------------

# Install pinned tools (python, uv, node, pnpm, just) and git hooks
tools:
    mise install
    uv tool install pre-commit
    pre-commit install

# Install backend dependencies
sync:
    cd backend && uv sync

# --- Quality -------------------------------------------------------------

# Run backend tests (fast suite)
test *args:
    cd backend && uv run pytest {{args}}

# Lint and check formatting
lint:
    cd backend && uv run ruff check . && uv run ruff format --check .

# Auto-format and fix lint issues
fmt:
    cd backend && uv run ruff format . && uv run ruff check --fix .

# Static type checking
typecheck:
    cd backend && uv run mypy arena

# Everything CI runs
check: lint typecheck test

# Run all pre-commit hooks on all files
hooks:
    pre-commit run --all-files

# --- Engine, simulation, rules (sprints 2-3) ------------------------------
# Uncomment as the corresponding modules appear.

# play scenario="smolny":
#     cd backend && uv run python -m arena.engine.play --scenario {{scenario}}

# sim rules="v1.0" scenario="smolny" n="1000":
#     cd backend && uv run python -m arena.sim --rules {{rules}} --scenario {{scenario}} --games {{n}}

# replay game rules:
#     cd backend && uv run python -m arena.runner.replay --game {{game}} --rules {{rules}}

# rules-diff a b n="500":
#     cd backend && uv run python -m arena.sim.compare --a {{a}} --b {{b}} --games {{n}}

# rules-docs:
#     cd backend && uv run python -m arena.engine.rules --export-docs ../docs/rules/generated

# golden-update:
#     cd backend && uv run pytest tests/golden --update-golden

# --- Stack (sprint 6) -----------------------------------------------------

# up:
#     docker compose up -d --build
# down:
#     docker compose down
# seed:
#     docker compose exec arena python -m arena.scripts.seed_demo
# logs:
#     docker compose logs -f arena

# --- simulations (sprint 3) --------------------------------------------------
# just sim [n] [scenario] [rules] [lineup]   e.g. just sim 200 equal v1.0 aggressor
sim n="1000" scenario="smolny" rules="v1.0" lineup="mixed":
    cd backend && uv run python -m arena.sim --rules {{rules}} --scenario {{scenario}} --games {{n}} --lineup {{lineup}}

# just rules-diff [a] [b] [n]   e.g. just rules-diff v1.0 experiments/v1.0-cheap-eco 500
rules-diff a="v1.0" b="experiments/v1.0-cheap-eco" n="500" scenario="smolny":
    cd backend && uv run python -m arena.sim.compare --a {{a}} --b {{b}} --games {{n}} --scenario {{scenario}}
