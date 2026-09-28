# 🌍 Мировая Арена

Пошаговая многопользовательская стратегия на тему ООН. Пять делегаций управляют странами шесть игровых лет: развивают города, берегут общую экологию, вводят санкции, строят ядерный арсенал и договариваются — или не договариваются. Веб-версия игры «Немодель ООН в Смольном»: сервер заменяет координаторов, а движок правил позволяет развивать игру версиями после каждой реальной партии.

> **Статус:** Спринт 0 — фундамент репозитория. План — в [`docs/DEV_PLAN.md`](docs/DEV_PLAN.md).

## Стек

Python 3.13 · FastAPI · PostgreSQL · SQLAlchemy 2.0 · React + TypeScript · Docker · Kubernetes (k3d/k3s) · uv · just · mise

## Быстрый старт

Требуется: Docker и git. На Windows — всё внутри **WSL2**, репозиторий в файловой системе WSL2 (`~/projects`).

```bash
git clone <url> world-arena && cd world-arena
curl https://mise.run | sh          # если mise ещё не установлен
mise install                        # python, uv, node, pnpm, just
just tools                          # + pre-commit хуки
just sync                           # зависимости бэкенда
just check                          # lint + типы + тесты
```

## Структура

| Путь | Назначение |
|---|---|
| `backend/arena/engine/` | Движок правил: конвейер систем, чистые функции |
| `backend/arena/runner/`, `agents/`, `sim/` | Headless-партии, боты, LLM-агенты, симуляции |
| `backend/arena/api/`, `ws/`, `db/`, `services/` | Веб-сервер (со спринта 4) |
| `rules/` | Версии правил в YAML — все числа игры |
| `scenarios/` | Стартовые условия партий |
| `frontend/` | React-клиент (со спринта 5) |
| `deploy/` | Compose, Helm, Kubernetes, Ansible |
| `docs/` | План, роадмап, правила, ADR, runbook'и |

## Документация

- [План разработки](docs/DEV_PLAN.md) — спринты до v1.0 и журнал прогресса
- [Роадмап](docs/ROADMAP.md) — стек, архитектура, тестирование, этапы 0–14
- Правила: [v1](docs/rules/GAME_RULES.md) · [v2 (проект)](docs/rules/GAME_RULES_2.md) · [v3 (проект)](docs/rules/GAME_RULES_3.md) · [оптимизация игрового процесса](docs/rules/GAMEPLAY_OPTIMIZATION.md) · [changelog](docs/rules/CHANGELOG.md)
- [Архитектурные решения (ADR)](docs/adr/)
- [Как вносить изменения](CONTRIBUTING.md)

## Лицензия

MIT
