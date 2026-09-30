# Frontend — Мировая Арена

React 19 + TypeScript + Vite, пакеты через pnpm (node 22, версии в `mise.toml`).

```bash
just web-sync     # pnpm install
just openapi      # backend → src/api/openapi.json → src/api/schema.d.ts (после любого изменения API)
just web          # vite dev на http://localhost:5173, /api проксируется на :8000 (just dev)
just web-lint     # oxlint + prettier --check
just web-build    # tsc -b + vite build → dist/
```

- Клиент API — `src/api/client.ts` (`openapi-fetch`, типы из сгенерированной схемы).
  Сессия — httpOnly-cookie от `POST /api/auth/join`; в dev прокси Vite делает всё same-origin.
- `src/api/openapi.json` и `schema.d.ts` закоммичены; тест `tests/api/test_openapi_snapshot.py`
  в бэкенде падает, если API изменился, а снимок не обновлён (`just openapi`).
- Телефоны игроков: `--host` уже включён в `just web`, открывайте `http://<ip-компьютера>:5173`.
