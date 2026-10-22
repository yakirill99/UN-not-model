# World Arena API. Build from the repository root:
#   docker build -f backend/Dockerfile -t arena-api .
# The context is the root because the engine reads ../rules and ../scenarios.
FROM python:3.13-slim AS base

# uv installs from the lock file, so an image build can never drift from CI.
COPY --from=ghcr.io/astral-sh/uv:0.9.9 /uv /usr/local/bin/uv

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/backend/.venv \
    PATH="/app/backend/.venv/bin:$PATH"

WORKDIR /app/backend

# Dependencies first: this layer is cached until the lock file changes.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/ ./
# Rule sets and scenarios are data, not code: settings point at ../rules and ../scenarios.
COPY rules/ /app/rules/
COPY scenarios/ /app/scenarios/

RUN uv sync --frozen --no-dev

# Never run the API as root: the container only needs to read its own files.
RUN useradd --system --uid 10001 arena && chown -R arena:arena /app
USER arena

EXPOSE 8000
CMD ["uvicorn", "arena.main:app", "--host", "0.0.0.0", "--port", "8000"]
