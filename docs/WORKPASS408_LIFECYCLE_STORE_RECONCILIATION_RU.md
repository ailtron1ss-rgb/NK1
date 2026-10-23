# WorkPass408 — восстановление неопределённой активации по каноническому store

Дата: 23 октября 2026. Целевая ветка: `feature/learning`.

## Зачем нужен проход

WorkPass407 намеренно сохранял `activation-outcome-unknown`, если вызов versioned skill store завершился исключением и вызывающий код не мог доказать, успел ли произойти side effect. Это лучше ложного «failed», но само по себе оставляло попытку нерешённой после перезапуска.

WorkPass408 добавляет reconciliation-контур. Журнал жизненного цикла — не источник истины об активной версии: окончательный ответ берётся из проверенного versioned skill store.

## Механизм

`P23LearningEngine.reconcileLearningLifecycleOutcomes()` просматривает события `activation-outcome-unknown`, которые ещё не имеют reconciliation terminal event. Для каждого события:

1. Находит в store кандидата по точному `candidateId + skillId + version + payloadFingerprint`. Если кандидат отсутствует — оставляет попытку unresolved.
2. Если store содержит активную версию с точным `skillId + version + payloadFingerprint`, записывает `activation-reconciled-active` и фактическую версию.
3. Если тот же кандидат существует, но matching active record отсутствует и статус кандидата не `active`, записывает `activation-reconciled-not-currently-active`. Это описывает только текущий authoritative snapshot; не утверждает, что версия никогда не активировалась в прошлом.
4. Если состояние противоречиво или недостаточно — не угадывает результат, оставляет попытку pending.

Повторный запуск идемпотентен. Нельзя перевести попытку из unknown в reconciliation без последовательности `activation-intent → activation-outcome-unknown`, а после terminal reconciliation нельзя добавить другой исход. Точные fingerprints и `attemptId` копируются из исходного неизвестного события, не вычисляются по значениям от клиента.

## Интеграция

- Runtime конфигурирует sidecar lifecycle journal, затем при старте вызывает reconciliation по текущему versioned store.
- Добавлен явный `OrganismRuntime.reconcileLearningLifecycleOutcomes()` для повторной сверки без продвижения кандидата.
- Diagnostics оставляют unknown-попытку pending, пока canonical store не подтвердит активную или текущую неактивную версию.
- Regression `tests/workpass408-lifecycle-store-reconciliation.mjs` покрывает точное active совпадение, shadow candidate без active record, missing candidate lineage, unresolved pending state и idempotent повтор.
- Тест включён в `npm run test:p23:learning` и в P26 Learning Validation.

## Исследовательская основа

Этот ход не копирует конкретный upstream API. Он применяет общий принцип согласования журнала событий с авторитетным состоянием, сохраняя отделение генерации, оценки и продвижения из Hermes Self-Evolution. Исходники, напрямую изученные в прошлом проходе: [README](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/README.md), [PLAN](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/PLAN.md), [evolve_skill.py](https://github.com/NousResearch/hermes-agent-self-evolution/blob/main/evolution/skills/evolve_skill.py). Итоговый выбор реализации продиктован контрактами NK1's versioned skill store и текущей TypeScript runtime.

## Ограничения

- Сопоставление доказывает текущее authoritative состояние версии, а не всю историю её предыдущих активаций и откатов.
- Если кандидат/отпечатки исчезли или store противоречив, событие остаётся unresolved и требует операторского расследования.
- Нет автоматического продвижения, автоматического approval и автоматического rollback. Reconciliation только фиксирует доказуемое состояние.
- Exact-head Actions, test suite и TypeScript check ещё не подтверждены: workflow job returns `failure` with no available step logs. Не заявляется PASS или measured learning uplift.

## Следующий этап

1. Восстановить actionable CI и выполнить новые тесты на exact HEAD.
2. Связать подтверждённую активацию с последующими независимыми task outcomes, forgetting и regression evidence, чтобы считать не только «навык включён», но и «навык помог».
3. Добавить signed remote journal checkpoints и reconciliation на реальной persistence backend, затем провести restart/crash/rollback soak.


## WorkPass409 supplement — intent-only crash window

A failure-injection review found that a hard process exit can occur after `activation-intent` is fsynced but before `activation-outcome-unknown` is appended. WorkPass409 closes this window by reconciling all non-terminal intents against the canonical versioned store, even when no unknown event exists. The existing integration regression now contains that abrupt-exit case. Missing/contradictory store lineage remains unresolved; reconciliation never authorizes activation. CI execution remains unverified because job logs are unavailable.
