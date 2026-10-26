# Установка и проверка всего стека (WSL2 / Ubuntu)

Пошаговая инструкция для нового компьютера: от пустого WSL до работающей «Мировой Арены»
и PR'а в репозиторий. Проверена на реальной установке (октябрь 2026, Ubuntu 24.04 в WSL2).

Два режима работы:

| Режим | Что это | Когда использовать |
|---|---|---|
| **Прод-стенд** (`compose.prod.yaml`) | 3 контейнера: db + api + web(nginx). Всё собирается из исходников | Показать игру, тестовая партия, «как на хостинге» |
| **Дев-режим** (`mise` + `just`) | Postgres в контейнере, API и Vite на хосте с хот-релоадом | Писать код: правки подхватываются на лету |

---

## 1. Предварительные требования

### Windows

1. **WSL2** — `wsl --install` в PowerShell от администратора, перезагрузка.
2. **Docker Desktop** — установить с официального сайта, при первом запуске:
   - Settings → **Resources → WSL Integration** → включить тумблер для вашей Ubuntu;
   - **Docker Desktop должен быть запущен**, пока работаете из WSL.

> Репозиторий держите в файловой системе WSL (`~/UN-not-model`), а не в `/mnt/c/...` —
> иначе медленный I/O и сломанный file-watching у Vite.

### Проверка, что Docker виден из WSL

```bash
docker --version && docker compose version
```

Если `Command 'docker' not found` (типичная ситуация сразу после установки):

```powershell
# в PowerShell на Windows:
wsl --shutdown
# затем снова открыть терминал WSL — интеграция подхватится
```

Если не помогло: Docker Desktop не запущен или тумблер WSL Integration для вашего
дистрибутива выключен.

---

## 2. Код и конфиг

```bash
git clone https://github.com/yakirill99/UN-not-model.git ~/UN-not-model
cd ~/UN-not-model
git fetch origin
git checkout dev          # или рабочая ветка: git checkout <branch>
git pull origin <branch>
```

### Секреты `.env.prod` (один раз)

```bash
cp .env.prod.example .env.prod
openssl rand -hex 32      # вывод → в ARENA_JWT_SECRET
openssl rand -hex 16      # вывод → в POSTGRES_PASSWORD
mcedit .env.prod          # или nano/vim — вставить оба значения
```

Итоговый файл должен содержать непустые:

```ini
ARENA_ENV=prod
POSTGRES_PASSWORD=<openssl rand -hex 16>
ARENA_JWT_SECRET=<openssl rand -hex 32>
ARENA_JWT_TTL_HOURS=12
ARENA_HTTP_PORT=8080
```

`.env.prod` **никогда не коммитится** (в `.gitignore` уже есть).

---

## 3. Запуск прод-стенда

```bash
docker compose -f compose.prod.yaml --env-file .env.prod up -d --build
# первый запуск 5–10 минут: pnpm install + сборка SPA + uv-образы API

docker compose -f compose.prod.yaml --env-file .env.prod exec api alembic upgrade head
```

### Чек-лист проверки

```bash
# 1. Все три контейнера живы, db и api — Healthy
docker compose -f compose.prod.yaml --env-file .env.prod ps

# 2. API отвечает
curl -s localhost:8080/readyz          # → {"status":"ready"}

# 3. Миграции применены
docker compose -f compose.prod.yaml --env-file .env.prod exec api \
  alembic current                      # → 0001 (или старше)

# 4. Фронтенд открылся
# браузер Windows: http://localhost:8080  → экран входа по коду

# 5. Демо-партия с кодами команд
docker compose -f compose.prod.yaml --env-file .env.prod exec api python -m arena.seed_demo

# 6. Анимационное демо (стек визуала)
docker compose -f compose.prod.yaml --env-file .env.prod \
  cp docs/demos/bomb-lock-offline.html web:/usr/share/nginx/html/
# браузер: http://localhost:8080/bomb-lock-offline.html
# все три панели должны дойти до «Готова к запуску»
```

> **Куда делись коды партий?** `docker compose -f compose.prod.yaml --env-file .env.prod exec db psql -U arena -d arena -c "select title, host_code from games order by created_at desc limit 5;"`

### Ежедневные команды

```bash
UP="docker compose -f compose.prod.yaml --env-file .env.prod"

$UP up -d            # старт (образы уже собраны — секунды)
$UP down             # остановить (данные партий остаются в томе pgdata)
$UP logs -f api      # хвост логов API
$UP logs -f web      # логи nginx
$UP down -v          # ⚠ снести вместе с данными партий
```

### Правка одного файла без пересборки

`docker cp` живёт до пересоздания контейнера. Для постоянного файла — через Vite:

```bash
cp docs/demos/bomb-lock-offline.html frontend/public/
docker compose -f compose.prod.yaml --env-file .env.prod up -d --build web
```

---

## 4. Дев-режим (правки с хот-релоадом)

```bash
curl https://mise.run | sh           # менеджер тулчейнов
mise install                         # python, uv, node, pnpm, just по версии репо
just tools                           # pre-commit-хуки
just sync                            # зависимости бэкенда (uv)
just web-sync                        # зависимости фронтенда (pnpm)
just check                           # lint + типы + тесты + веб — перед коммитом

# Postgres для дев-режима (пароль arena/arena, порт 5432)
just db-up

# API с автоперезагрузкой
just dev

# Фронтенд с хот-релоадом (второй терминал)
just web                             # Vite отдаст свой порт, /api проксируется
```

---

## 5. Git: ветки и PR через `gh`

Conventional Commits, PR обязателен (см. `CONTRIBUTING.md`).

### Авторизация (один раз)

```bash
sudo apt update && sudo apt install gh -y
gh auth login
# GitHub.com → HTTPS → Yes → Login with a web browser
```

> Браузер из WSL сам не откроется — скопируйте одноразовый код и вручную откройте
> `https://github.com/login/device` в браузере Windows, введите код.

### Рабочий цикл

```bash
git fetch origin && git switch dev && git pull          # свежий dev
git switch -c feat/quick-wins                            # новая ветка от dev

# ... правки ...
just check                                               # тесты локально
git add -A
git commit -m "feat(orders): счётчик бомб и блокировка сверх лимита"
git push -u origin feat/quick-wins

gh pr create --base dev --title "feat: ..." --body "что и зачем"
gh pr merge --merge                                      # или merge в веб-интерфейсе
```

Имена веток: `feat/...`, `docs/...`, `fix/...`, `chore/...`.

---

## 6. Tuna — публичная ссылка (опционально)

Локальный стенд доступен на `localhost:8080`; туннель нужен, чтобы дать ссылку командам.

```bash
sh -c "$(curl -sSLf https://releases.tuna.am/tuna/get.sh)"   # установка CLI
tuna login                                                   # токен из личного кабинета tuna.am
tuna http 8080                                               # туннель на прод-стенд
```

Нюансы:

- На бесплатном тарифе работает **только ваш постоянный поддомен** (вида
  `world-arena.a.2na.am`); флаг `--subdomain` для произвольных имён — на платных.
- `Tunnel already active` — старый туннель с тем же поддоменом ещё жив: убить его
  в панели tuna (tunnels) и запустить заново.
- Диагностика сети: `tuna diagnose`.

---

## 7. Типовые проблемы

| Симптом | Причина | Лечение |
|---|---|---|
| `docker: command not found` в WSL | Docker Desktop не запущен / интеграция выключена | Запустить Docker Desktop; Settings → WSL Integration → ON; `wsl --shutdown` |
| `couldn't find env file: .env.prod` | Секреты не создавались на этом компе | Раздел 2: `cp .env.prod.example .env.prod` + openssl |
| `POSTGRES_PASSWORD in .env.prod` ошибка при `up` | Пустые поля в env-файле | Заполнить `POSTGRES_PASSWORD` и `ARENA_JWT_SECRET` |
| API не стартует: «JWT secret too short» | `ARENA_JWT_SECRET` < 32 символов | Сгенерировать заново: `openssl rand -hex 32` |
| Порт 8080 занят | Старый контейнер/процесс | `docker ps` → найти и остановить, либо сменить `ARENA_HTTP_PORT` |
| `Failed opening a web browser` при `gh auth login` | В WSL нет браузера | Открыть `https://github.com/login/device` вручную в Windows |
| Смена `ARENA_JWT_SECRET` выкинула всех из сессий | Так и задумано: секрет подписывает cookie | Нормальное поведение |
| Партии пропали после `down` | Скорее всего делали `down -v` | Тома `pgdata` удаляется только `-v`; восстанавливать нечего |
