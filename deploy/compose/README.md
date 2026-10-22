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
