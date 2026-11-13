# Hexis → NK1: адаптация цены последствий действия (2026-11-13)

**Ветка:** `aspect/hexis-consequence-cost-policy-20261113`  
**База:** `workpass70-source` @ `189643ede8f3904dd670f0109a28b7536e894c00`  
**Донор:** Hexis, MIT; `docs/reference/energy-model.md`, `docs/concepts/heartbeat-system.md`  
**Статус:** `IMPLEMENTED` локально; `TESTED` локальным regression; `INTEGRATED` ожидает review/merge; `RELEASED` нет.

## Что именно ассимилировано

Hexis разделяет вычислительную стоимость и цену последствий действия: необратимость, социальную экспозицию, обязательство, внимание пользователя и влияние на идентичность. NK1 уже имел бюджет вычислительных/аппаратных ресурсов, внутренние action-cost коэффициенты и финальный ActionGateway, но эти измерения не были отдельным предфильтром автономного выбора инструмента.

Добавлен `ActionConsequenceCostPolicy` с детерминированными профилями:

| Класс | Пример | Оценка | Фоновое действие |
|---|---|---:|---|
| read-only | inspect/status/evidence/research/context | 0.0142 | Разрешено при отсутствии отдельного approval gate |
| mutation | write/update/install/execute | 0.2564 | Запрещено |
| social | send/message/contact/publish | 0.7024 | Запрещено |
| unknown | нераспознанная capability | 0.5090 | Запрещено (fail closed) |
| destructive | delete/remove/shutdown | 0.7116 | Запрещено |

Весовые коэффициенты: необратимость 0.28, социальная экспозиция 0.24, обязательство 0.18, внимание пользователя 0.14, влияние на идентичность 0.16. Это эвристические начальные профили для policy gate, а не эмпирически измеренная человеческая цена. Их нужно калибровать на NK1 action logs и независимой human review.

## Связи с существующими системами

- `AutonomousResourceToolLifeController.plan()` использует новый классификатор для сужения множества кандидатов и ранжирования только разрешённых read-only действий.
- Существующий `cost01` остаётся стоимостью вычислительного/ресурсного конверта. Новое `consequenceCost01` возвращается отдельно, поэтому две величины не подменяют друг друга.
- `ActionGateway` остаётся единственным исполнителем и авторитетом разрешений, одобрений, idempotency receipts и outcome verification. Новый фильтр не вызывает инструменты и не выдаёт разрешения.
- `AutonomousResourceToolLifeState` сохраняет счётчик отклонённых consequential-кандидатов и последний профиль; каждый tool receipt содержит повторно вычисленные `consequenceCost01`/`consequenceClass`. Старые snapshots совместимы: новые поля имеют безопасные defaults, старые receipt rows остаются читаемыми.
- Внутренняя мотивация, память и автономное планирование не заменяются донорским runtime; не создаётся второе состояние и не добавляются зависимости.

## Польза

1. Снижается риск «молчаливого» социального действия или мутации в фоне из-за того, что кандидат ошибочно помечен как неразрушающий.
2. Неизвестные инструменты получают безопасное поведение по умолчанию.
3. Вычислительный ресурс и последствия действий измеряются раздельно — без фиктивной общей шкалы.
4. Существующий ActionGateway остаётся последним неизменённым барьером исполнения.

## Проверки

- TDD red до создания модуля: ожидаемый missing-module import failure.
- Новый policy regression — PASS на локальном прогоне и exact-head Actions.
- Exact-head Actions run [#43390755183](https://github.com/ailtron1ss-rgb/NK1/actions/runs/43390755183), SHA `72ab4bc76d6fc45fe3888fe74223ecdf127e12a9`: **SUCCESS**.
- Внутри run успешно: Node 24, `npm ci --ignore-scripts`, полный `npm run typecheck`, `hexis-action-consequence-cost-policy.mjs`, `big-pass-223-autonomous-resource-tool-life.mjs`, `action-cost-unification-workpass36.mjs`, `workpass53-action-approval-boundary.mjs`.
- Отдельная idempotency suite: 12/13 subtests PASS, один failure по temporal reafference. Тот же failure воспроизведён на чистом baseline `workpass70-source@1a0315595302f3154df0ae53e5d9188875311467`; заведён самостоятельный [issue #865](https://github.com/ailtron1ss-rgb/NK1/issues/865). Он не относится к изменённому policy/controller path и не замаскирован под PASS.

## Риски и следующий проход

- Строковая классификация по зарегистрированным `id/capability` намеренно консервативна; перед расширением read-only allowlist следует сверить фактический registry tool-by-tool.
- Пока не разрешены локальные draft/create инструменты; потребуется различить безопасные shadow drafts, реальные filesystem mutations и self-modification по registry/rollback/idempotency.
- Последующие Hexis ideas: контекстные множители first-use/high-error/repeated-action и outcome-backed cost calibration; hard floors должны быть неизменяемы для модели и опираться только на verified receipts.
- Перед merge: актуальный compare с базой, точный review, relevant CI; потом отдельный release ZIP reconciliation.
- Не изменены `main`, теги, релизный ZIP или сторонние зависимости. PR остаётся Draft; SUCCESS этого workflow означает проверку данного slice, а не production readiness проекта или сознание.
