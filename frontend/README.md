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

## Маршруты

| Путь            | Кто               | Что                                                    |
| --------------- | ----------------- | ------------------------------------------------------ |
| `/`             | все               | вход по коду → `POST /api/auth/join` → переход по роли |
| `/new`          | ведущий без кодов | создать игру, получить коды, войти как ведущий         |
| `/host/:gameId` | ведущий           | панель ведущего (пока: раунд, коды, кто вошёл)         |
| `/play/:gameId` | игрок             | экран страны (пока: бюджет и уровень жизни)            |

Сессия — `src/session.tsx` (`useSession()`: `principal`, `join`, `logout`), загружается из
`GET /api/auth/me` по cookie. `RequireRole` перенаправляет чужую роль или чужую игру на её
собственный экран, а без сессии — на `/`.

## WSL2 на Windows: если `localhost:5173` не открывается

Симптом: в WSL `curl localhost:5173` отвечает, а из Windows `localhost` и `127.0.0.1` — нет,
хотя `http://<ip из вывода Vite>:5173` работает. Так ведут себя агенты безопасности с
loopback-фильтром (Dr.Web и подобные): они ломают `localhostForwarding`, WSL при этом жива.

- Быстро: открывать адрес из строки `Network: … eth0`, которую печатает `just web`.
- Привычный `localhost`: один раз после каждого `wsl --shutdown`, в PowerShell от администратора
  из корня репозитория — `.\scripts\wsl-portproxy.ps1` (пробрасывает 5173 и 8000).
- Режим сети WSL: `networkingMode=NAT` в `%USERPROFILE%\.wslconfig`; mirrored под VPN не зеркалит порты.
