#!/usr/bin/env bash
# Creates labels and sprint milestones in the current GitHub repository.
# Requirements: GitHub CLI (gh), authenticated (gh auth login), run from the repo root.
# Safe to re-run: labels are updated with --force, existing milestones are skipped.
set -euo pipefail

label() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null && echo "label: $1"; }

# Type
label "type:task"     "0E8A16" "Задача из плана разработки"
label "type:bug"      "D73A4A" "Ошибка"
label "type:rules"    "5319E7" "Изменение правил игры или баланса"
label "type:infra"    "1D76DB" "Инфраструктура, CI/CD, деплой"
label "type:docs"     "0075CA" "Документация"
label "type:research" "FBCA04" "Исследование: симуляции, аналитика, ML, LLM"

# Area
label "area:engine"   "C5DEF5" "Движок правил"
label "area:api"      "C5DEF5" "Бэкенд и API"
label "area:frontend" "C5DEF5" "Фронтенд"
label "area:sim"      "C5DEF5" "Симулятор и боты"
label "area:deploy"   "C5DEF5" "Docker, Kubernetes"
label "area:llm"      "C5DEF5" "LLM-лаборатория"

# Rules versions
label "rules:v1" "E4E669" "Правила v1.x"
label "rules:v2" "E4E669" "Правила v2.x"
label "rules:v3" "E4E669" "Правила v3.x"

# Milestones (sprints from docs/DEV_PLAN.md)
existing=$(gh api "repos/{owner}/{repo}/milestones?state=all&per_page=100" --jq '.[].title')
milestone() {
  if grep -Fxq "$1" <<<"$existing"; then echo "milestone exists: $1"; return; fi
  gh api "repos/{owner}/{repo}/milestones" -f title="$1" -f description="$2" >/dev/null && echo "milestone: $1"
}
milestone "Спринт 0 — Фундамент"          "Репозиторий, инструменты, CI"
milestone "Спринт 1 — Ядро движка"        "Модели, RuleSet, конвейер, RNG, события"
milestone "Спринт 2 — Полный движок v1.0" "Все системы, наблюдения, runner, реплей Смольного"
milestone "Спринт 3 — Симулятор и боты"   "Боты, симуляции, golden-тесты"
milestone "Спринт 4 — Бэкенд"             "FastAPI, PostgreSQL, сервисы, API"
milestone "Спринт 5 — Фронтенд"           "React, форма приказов по ActionSpace"
milestone "Спринт 6 — Контейнеры"         "Dockerfile, compose, just up"
milestone "Спринт 7 — Реалтайм и сдача"   "WebSocket, Playtest, живая игра, v1.0"

echo "Done."
