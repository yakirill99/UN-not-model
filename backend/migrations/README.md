# Migrations (Alembic)

- `just migrate` — apply to the database from `ARENA_DATABASE_URL` (`alembic upgrade head`).
- `just migration "add foo"` — autogenerate a revision from `arena.db` models; **read it before committing**.
- `just db-up` — local Postgres from `compose.yaml`.

In Kubernetes migrations run as a Job before the app rolls out (deploy/helm), never at pod start.
