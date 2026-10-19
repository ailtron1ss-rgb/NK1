# BIG PASS 325 — Recovery → Autobiography → Self-Model

Дата: 2026-09-14
Версия: Neuro-Kurisu 35.6.1

## Цель

Связать восстановление после разрыва процесса не только с инфраструктурным watchdog, но и с внутренней непрерывностью организма:

**process gap → recovery event → autobiographical narrative → self-model shock → post-recovery integration → continued life**

## Что внедрено

### 1. Recovery event

В `EventSourcing` добавлен тип события `recovery`.

Событие содержит:
- recoveryCount;
- previousBootId;
- currentBootId;
- preRecoveryTick;
- postRecoveryTick;
- previous/current learning count;
- recovery reason;
- gap duration.

Это позволяет отличать факт восстановления от обычного `session`/`temporal-gap`.

### 2. Исправлен boot identity defect

В B324 `RecoveryWatchdog.restore()` восстанавливал старый `bootId` из durable state. Это скрывало границу поколений процесса.

В B325:
- новый runtime получает новый `bootId`;
- старый `bootId` сохраняется в `previousBootId`;
- recovery event содержит обе границы;
- continuity теперь различает предыдущее и текущее поколение runtime.

Это реальный defect fix, а не декоративное расширение.

### 3. SelfModelV2

Добавлены поля:
- `recoveryCount`;
- `lastRecoveryAt`;
- `continuityShock01`;
- `postRecoveryIntegration01`.

Добавлен `registerRecovery()`.

После recovery организм получает измеримый continuity shock и сниженное, но не обнулённое agency/identity состояние.

После последующих когнитивных шагов:
- `continuityShock01` уменьшается;
- `postRecoveryIntegration01` увеличивается.

Это создаёт реальный recover → integrate feedback loop.

### 4. Autobiographical Life Narrative

После восстановления создаётся narrative episode:

`recovery-after-process-gap`

Он содержит:
- agency;
- outcome;
- novelty;
- identity continuity;
- project continuity;
- lesson.

Таким образом recovery становится частью истории субъекта, а не только runtime telemetry.

### 5. Diagnostic surface

Добавлен:

`recoveryAutobiographicalSnapshot()`

Он одновременно возвращает:
- watchdog;
- self-model;
- recovery events;
- autobiographical compatibility records;
- autobiographical life narrative.

## Проверка

### B325 PASS

Реальный runtime сценарий:

1. Первый runtime стартует.
2. Сохраняется durable state.
3. Второй runtime восстанавливается.
4. Recovery count становится `1`.
5. `previousBootId != currentBootId`.
6. Появляется `recovery` event.
7. SelfModel фиксирует `continuityShock01=0.58`.
8. Autobiographical narrative получает новый recovery episode.
9. После следующего cognitive step shock снижается до `0.5452`.
10. Integration повышается с `0.45` до `0.475`.
11. Runtime возвращается в `healthy`.

### Regression

- B324 watchdog: PASS
- B324 core watchdog: PASS
- B323 process kill/resume: PASS
- changed TypeScript files syntax-check: PASS

### TypeScript compiler

Полный `npm run typecheck` и targeted `tsc` в текущей среде не завершились в установленном execution budget.
Это НЕ маркируется как PASS.

Для изменённых `.ts` файлов проведён Node TypeScript strip-syntax check — PASS.

## Что доказано

B325 доказывает не сознание и не полноценную человеческую autobiographical self-awareness.

Он доказывает инженерно:

**runtime interruption → recovery detection → new runtime identity → durable causal trace → self-model reaction → autobiographical recording → post-recovery integration**.

## Следующий фронт

B326 должен проверить causal influence:

**должна ли recovery history реально менять последующее поведение**.

То есть не достаточно записывать `recovery-after-process-gap`; нужно доказать, что прошлый разрыв влияет на action selection, uncertainty, exploration/consolidation и стратегию будущего организма.
