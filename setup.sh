#!/usr/bin/env bash
# ============================================================================
# setup.sh — деплой: Docker-образы, прод-compose, nginx, рецепты just
#
# Запуск из КОРНЯ репозитория, на новой ветке от rules/v1:
#   cd ~/world-arena
#   git switch rules/v1 && git pull
#   git switch -c feat/v1-deploy
#   bash setup.sh
#
# Что создаёт:
#   backend/Dockerfile        uv sync --frozen из uv.lock, запуск не от root
#   frontend/Dockerfile       pnpm build -> nginx со статикой
#   deploy/compose/nginx.conf один origin: SPA и /api за одним хостом
#   compose.prod.yaml         db + api + web; наружу только web
#   .env.prod.example         шаблон секретов (сам .env.prod не коммитится)
#   .dockerignore             чтобы node_modules и .env не попали в образ
#   deploy/compose/README.md  краткая инструкция
#   justfile                  рецепты prod-up / prod-down / prod-logs / prod-seed
# ============================================================================
set -euo pipefail

fail() { printf 'ОШИБКА: %s\n' "$*" >&2; exit 1; }

[ -f justfile ] && [ -d frontend ] && [ -d backend ] || fail "запускайте из корня репозитория (~/world-arena)"
[ -f backend/uv.lock ] || fail "нет backend/uv.lock — образ собирается только из lock-файла"
[ -f frontend/pnpm-lock.yaml ] || fail "нет frontend/pnpm-lock.yaml"

BRANCH="$(git branch --show-current 2>/dev/null || echo '?')"
case "$BRANCH" in
  main|dev|rules/v1) fail "вы на '$BRANCH'. Создайте ветку: git switch -c feat/v1-deploy" ;;
esac
echo "Ветка: $BRANCH"

BACKUP=".setup-backup-$(date +%Y%m%d-%H%M%S)"
CREATED=()
backup() { if [ -f "$1" ]; then mkdir -p "$BACKUP/$(dirname "$1")"; cp "$1" "$BACKUP/$1"; fi; }

mkdir -p deploy/compose
echo "=== Creating backend/Dockerfile ==="
backup backend/Dockerfile
cat << 'DEOF' > backend/Dockerfile
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
DEOF
CREATED+=("backend/Dockerfile")
echo "=== Creating frontend/Dockerfile ==="
backup frontend/Dockerfile
cat << 'DEOF' > frontend/Dockerfile
# World Arena web. Build from the repository root:
#   docker build -f frontend/Dockerfile -t arena-web .
# Stage 1 compiles the SPA, stage 2 serves it and proxies /api to the API container.
FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app/frontend

# Dependencies first: cached until the lock file changes.
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
# No ARENA_API_URL here: nginx serves the SPA and /api from one origin, so the
# relative paths in api/client.ts resolve by themselves and the cookie stays first-party.
RUN pnpm build


FROM nginx:1.29-alpine AS runtime

COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY deploy/compose/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
DEOF
CREATED+=("frontend/Dockerfile")
echo "=== Creating deploy/compose/nginx.conf ==="
backup deploy/compose/nginx.conf
cat << 'DEOF' > deploy/compose/nginx.conf
# One origin for the player: the SPA and the API live behind the same host, so the
# httpOnly session cookie set by /api/auth/join is first-party and needs no CORS.
server {
    listen 80;
    server_name _;

    # Tuna (and any TLS-terminating proxy) talks plain HTTP to us but the browser is
    # on HTTPS. Forward the original scheme so the API marks cookies correctly.
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;

    client_max_body_size 2m;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Hashed assets are immutable; index.html must never be cached or players get
    # yesterday's bundle after a redeploy.
    location /assets/ {
        root /usr/share/nginx/html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /index.html {
        root /usr/share/nginx/html;
        add_header Cache-Control "no-store";
    }

    location ~ ^/(api|healthz|readyz|docs|openapi\.json) {
        proxy_pass http://api:8000;
        proxy_http_version 1.1;
        proxy_read_timeout 60s;
    }

    # Client-side routes (/host/<id>, /play/<id>) are not files: hand them the SPA.
    location / {
        root /usr/share/nginx/html;
        try_files $uri /index.html;
    }
}
DEOF
CREATED+=("deploy/compose/nginx.conf")
echo "=== Creating compose.prod.yaml ==="
backup compose.prod.yaml
cat << 'DEOF' > compose.prod.yaml
# World Arena in production (a laptop behind a Tuna tunnel counts as production).
#
#   cp .env.prod.example .env.prod   # then put a real secret in it
#   docker compose -f compose.prod.yaml --env-file .env.prod up -d --build
#   docker compose -f compose.prod.yaml --env-file .env.prod exec api alembic upgrade head
#
# Only nginx publishes a port. The API and the database are reachable only inside the
# compose network, so the tunnel cannot expose them by accident.
name: world-arena

services:
  db:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-arena}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env.prod}
      POSTGRES_DB: ${POSTGRES_DB:-arena}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-arena} -d ${POSTGRES_DB:-arena}"]
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    build:
      context: .
      dockerfile: backend/Dockerfile
    restart: unless-stopped
    environment:
      # prod marks the session cookie Secure (HTTPS only) — right behind Tuna.
      # Set ARENA_ENV=dev in .env.prod only to test over plain http://.
      ARENA_ENV: ${ARENA_ENV:-prod}
      ARENA_DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-arena}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-arena}
      # Sessions are signed with this; changing it logs everyone out.
      ARENA_JWT_SECRET: ${ARENA_JWT_SECRET:?set ARENA_JWT_SECRET in .env.prod}
      ARENA_JWT_TTL_HOURS: ${ARENA_JWT_TTL_HOURS:-12}
      ARENA_RULES_DIR: /app/rules
      ARENA_SCENARIOS_DIR: /app/scenarios
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/readyz')\""]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s

  web:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    restart: unless-stopped
    ports:
      - "${ARENA_HTTP_PORT:-8080}:80"
    depends_on:
      api:
        condition: service_healthy

volumes:
  pgdata:
DEOF
CREATED+=("compose.prod.yaml")
echo "=== Creating .env.prod.example ==="
backup .env.prod.example
cat << 'DEOF' > .env.prod.example
# Copy to .env.prod and fill in the two secrets. Never commit .env.prod.
#   cp .env.prod.example .env.prod
#   openssl rand -hex 32   # -> ARENA_JWT_SECRET (min 32 characters)
#   openssl rand -hex 16   # -> POSTGRES_PASSWORD

# prod = session cookie is Secure (HTTPS only), which is what Tuna gives you.
# Switch to dev only if you open the app over plain http://.
ARENA_ENV=prod

POSTGRES_USER=arena
POSTGRES_PASSWORD=
POSTGRES_DB=arena

# Signs the session cookie. At least 32 characters, or the API refuses to start.
ARENA_JWT_SECRET=
# How long a team stays logged in. One evening of play fits in 12 hours.
ARENA_JWT_TTL_HOURS=12

# Host port nginx listens on; the tunnel points here.
ARENA_HTTP_PORT=8080
DEOF
CREATED+=(".env.prod.example")
echo "=== Creating .dockerignore ==="
backup .dockerignore
cat << 'DEOF' > .dockerignore
# Keep build contexts small and secrets out of images.
.git
.github
**/node_modules
**/.venv
**/dist
**/coverage
**/__pycache__
**/.pytest_cache
**/.mypy_cache
**/.ruff_cache
.env
.env.*
!.env.example
!.env.prod.example
analytics
ml
e2e
docs
*.md
DEOF
CREATED+=(".dockerignore")
echo "=== Creating deploy/compose/README.md ==="
backup deploy/compose/README.md
cat << 'DEOF' > deploy/compose/README.md
# Развёртывание World Arena

Три контейнера: `db` (Postgres), `api` (FastAPI) и `web` (nginx со собранным SPA).
Наружу смотрит только `web`; база и API доступны лишь внутри сети compose.

```
браузер  ->  Tuna (HTTPS)  ->  web:80 (nginx)  ->  api:8000  ->  db:5432
                                  |
                                  +-- статика SPA
```

## Первый запуск

```bash
cp .env.prod.example .env.prod
openssl rand -hex 32   # вставить в ARENA_JWT_SECRET
openssl rand -hex 16   # вставить в POSTGRES_PASSWORD

docker compose -f compose.prod.yaml --env-file .env.prod up -d --build
docker compose -f compose.prod.yaml --env-file .env.prod exec api alembic upgrade head
```

Проверка: `curl -s localhost:8080/readyz` должен ответить `{"status":"ready"}`.

## Туннель

```bash
tuna http 8080 --subdomain world-arena
```

Ссылку вида `https://world-arena.ru.tuna.am` раздайте командам.

## Полезное

```bash
# демо-игра с кодами
docker compose -f compose.prod.yaml --env-file .env.prod exec api python -m arena.seed_demo

# коды уже созданной игры
docker compose -f compose.prod.yaml --env-file .env.prod exec db \
  psql -U arena -d arena -c "select title, host_code from games order by created_at desc limit 5;"

# логи и остановка
docker compose -f compose.prod.yaml --env-file .env.prod logs -f api
docker compose -f compose.prod.yaml --env-file .env.prod down
```

`down` сохраняет данные в томе `pgdata`. Удалить партии полностью: `down -v`.
DEOF
CREATED+=("deploy/compose/README.md")

# --- .gitignore: .env.* спрятан целиком, шаблон прода нужно разрешить ----------
if ! grep -qx '!.env.prod.example' .gitignore; then
  backup .gitignore
  printf '!.env.prod.example\n' >> .gitignore
  echo "=== .gitignore: разрешён .env.prod.example ==="
  CREATED+=(".gitignore")
fi

# --- justfile: рецепты прода --------------------------------------------------
if ! grep -q '^prod-up' justfile; then
  backup justfile
  cat << 'DEOF' >> justfile

# --- production (docker compose + туннель) -----------------------------------
PROD := "-f compose.prod.yaml --env-file .env.prod"

# Собрать и поднять db+api+web; nginx слушает ARENA_HTTP_PORT (8080)
prod-up:
    docker compose {{PROD}} up -d --build
    docker compose {{PROD}} exec api alembic upgrade head
    @echo "готово: http://localhost:8080/readyz"

# Остановить (данные остаются в томе pgdata)
prod-down:
    docker compose {{PROD}} down

# Логи API
prod-logs:
    docker compose {{PROD}} logs -f api

# Демо-партия с кодами на проде
prod-seed *args:
    docker compose {{PROD}} exec api python -m arena.seed_demo {{args}}

# Коды всех созданных партий
prod-codes:
    docker compose {{PROD}} exec db psql -U arena -d arena -c "select title, host_code, current_round, phase from games order by created_at desc limit 10;"
DEOF
  echo "=== justfile: добавлены рецепты prod-* ==="
  CREATED+=("justfile")
fi

echo
echo "============================================================"
echo "Созданные/обновлённые файлы (${#CREATED[@]}):"
echo "============================================================"
for f in "${CREATED[@]}"; do printf '  %-40s %4s строк\n' "$f" "$(wc -l < "$f")"; done
[ -d "$BACKUP" ] && echo && echo "Бэкапы: $BACKUP/"
cat <<'TXT'

Дальше:
  cp .env.prod.example .env.prod
  openssl rand -hex 32    # -> ARENA_JWT_SECRET
  openssl rand -hex 16    # -> POSTGRES_PASSWORD
  nano .env.prod

  just prod-up
  curl -s localhost:8080/readyz
TXT
