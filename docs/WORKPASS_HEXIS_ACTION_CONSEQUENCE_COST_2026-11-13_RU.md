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
- `AutonomousResourceToolLifeState` сохраняет счётчик отклонённых consequential-кандидатов и последний профиль; controller outcome record сохраняет повторно вычисленные `consequenceCost01`/`consequenceClass`; каноническая схема receipt внутри `ActionGateway` не меняется. Старые snapshots совместимы: новые поля имеют безопасные defaults, старые receipt rows остаются читаемыми.
- Внутренняя мотивация, память и автономное планирование не заменяются донорским runtime; не создаётся второе состояние и не добавляются зависимости.

## Польза

1. Снижается риск «молчаливого» социального действия или мутации в фоне из-за того, что кандидат ошибочно помечен как неразрушающий.
2. Неизвестные инструменты получают безопасное поведение по умолчанию.
3. Вычислительный ресурс и последствия действий измеряются раздельно — без фиктивной общей шкалы.
4. Существующий ActionGateway остаётся последним неизменённым барьером исполнения.

## Проверки

- TDD red до создания модуля: ожидаемый missing-module import failure.
- Policy regression проверяет пять consequence-классов, precedence, approval flag, read-only selection, social-only block, раздельные resource/consequence cost, snapshot round-trip и fail-closed для reconciliation.
- Финальный exact-head Actions run [#43391123521](https://github.com/ailtron1ss-rgb/NK1/actions/runs/43391123521), SHA `6d17f888ece72b643c84ebae5ba1fbc123f7eae8`: **SUCCESS**.
- Внутри run успешно: Node 24, `npm ci --ignore-scripts`, полный `npm run typecheck`, `hexis-action-consequence-cost-policy.mjs`, `big-pass-223-autonomous-resource-tool-life.mjs`, `action-cost-unification-workpass36.mjs`, `workpass53-action-approval-boundary.mjs`.
- Отдельная idempotency suite: 12/13 subtests PASS, один failure по temporal reafference. Тот же failure воспроизведён на чистом baseline `workpass70-source@1a0315595302f3154df0ae53e5d9188875311467`; заведен самостоятельный [issue #865](https://github.com/ailtron1ss-rgb/NK1/issues/865). Он не относится к изменённому policy/controller path и не замаскирован под PASS.

### Выборочная сверка registry

- `organism.project.device` / `project.device.read` и `organism.project.world` / `project.world.read` распознаются как read-only.
- `android.listen` / `android.stt` остаётся `unknown` и не допускается фоновым policy — это консервативно для микрофона.
- `organism.device.speak` распознаётся как social и блокируется в ambient lane.
- Это выборочные регистрации из `OrganismRuntime`, а не полный инвентарный аудит всех tools; следующий проход должен пройти каждый зарегистрированный `id/capability`.
- Отдельная idempotency suite: 12/13 subtests PASS, один failure по temporal reafference. Тот же failure воспроизведён на чистом baseline `workpass70-source@1a0315595302f3154df0ae53e5d9188875311467`; заведён самостоятельный [issue #865](https://github.com/ailtron1ss-rgb/NK1/issues/865). Он не относится к изменённому policy/controller path и не замаскирован под PASS.

## Риски и следующий проход

- Строковая классификация по зарегистрированным `id/capability` намеренно консервативна; reconciliation отнесён к mutation, поскольку может менять durable state. Полный registry audit ещё не завершён.
- Пока не разрешены локальные draft/create инструменты; потребуется различить безопасные shadow drafts, реальные filesystem mutations и self-modification по registry/rollback/idempotency.
- Последующие Hexis ideas: контекстные множители first-use/high-error/repeated-action и outcome-backed cost calibration; hard floors должны быть неизменяемы для модели и опираться только на verified receipts.
- Перед merge: актуальный compare с базой, точный review, relevant CI; потом отдельный release ZIP reconciliation.
- Не изменены `main`, теги, релизный ZIP или сторонние зависимости. PR остаётся Draft; SUCCESS этого workflow означает проверку данного slice, а не production readiness проекта или сознание.



