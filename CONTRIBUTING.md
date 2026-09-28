# Как вносить изменения

## Ветки

- `main` — всегда зелёный CI.
- Рабочие ветки: `feat/engine-pipeline`, `fix/strike-shield`, `rules/v2.0`, `infra/ci-golden`, `docs/adr-0004`.
- Слияние — через Pull Request, даже если работаешь один: так CI проверяет каждое изменение.

## Коммиты

[Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(engine): add strikes system with shield absorption
fix(engine): sanctions must skip destroyed cities
rules: v1.0.1 — strike ecology penalty -5
test(replay): digitize Smolny orders for years 1-3
docs(adr): 0004 rules and scenarios split
chore(ci): enable coverage report
```

## Изменение правил игры

1. Задача с шаблоном «Изменение правил».
2. Новая версия или patch в `rules/` — никогда не правка существующей версии «на месте».
3. Системы движка и тесты.
4. `just golden-update` только после того, как различия объяснены.
5. Запись в `docs/rules/CHANGELOG.md`.
6. Полный цикл версии — раздел 10 `docs/ROADMAP.md`.

## Архитектурные решения

Любое решение, которое трудно отменить, — отдельный ADR в `docs/adr/` по шаблону `0000-template.md`.

## Перед PR

```bash
just check    # lint, типы, тесты
just hooks    # все pre-commit хуки
```
