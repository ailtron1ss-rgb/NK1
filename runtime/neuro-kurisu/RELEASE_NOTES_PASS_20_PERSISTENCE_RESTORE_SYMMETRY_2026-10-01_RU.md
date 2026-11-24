# Neuro-Kurisu PASS20 — Persistence Restore Symmetry

Дата: 2026-10-01
База: 35.40.0 / R26 / PASS19

## Цель

Проверить не только наличие durable snapshot, но и симметрию `projection -> persistence -> restore` для критических continuity-состояний.

## Реальные изменения

1. `src/organism/core/PersistenceProjectionCoordinator.ts`
   - удалён дублирующий второй snapshot `p84AutobiographicalContinuity` внутри одного projection branch;
   - первый и единственный snapshot проходит через существующий `snapshotOnce` cache.

2. `tests/pass20-persistence-restore-continuity.mjs`
   - добавлен отдельный restart/restore regression;
   - проверяются 23 критических persistence-состояния: P48, P49, P51, P52, P53, P54, P55, P56, P58, P61, P63, P64, P67, P68, P71, P74, P76, P77, P78, P80, P81, P82, P84;
   - проверяются ключевые counters/continuity markers и bounded projection limits;
   - после restore выполняется ещё один cognitive cycle, подтверждающий продолжение жизненного цикла.

3. `scripts/release-r26-core.mjs`
   - restore-symmetry regression добавлен как обязательный шаг R26 functional core gate.

## Verification

- TYPECHECK: PASS
- PASS20_PERSISTENCE_RESTORE: PASS (`tick=2 -> 3`)
- R26 release core: PASS, 9/9 steps
- P2895 R19 long horizon: PASS (`cycles=256`, `restartedTick=257`, `memoryCount=105`)
- mobile256 organism smoke: PASS
- architecture: PASS
- forensics: PASS, `duplicateContent=0`, `duplicateNames=0`
- source hygiene: PASS, `errors=0`, `warnings=0`
- integrity: PASS
- source truth: PASS
- release source: PASS

## Important non-results

- `test:p61-63` aggregate exceeded the external execution timeout and is not marked PASS here.
- Historical `p64:p65` / `big-pass-44` behavioural failures remain baseline issues reproduced before PASS18 and are not attributed to PASS20.

## Outcome

PASS20 adds a durable architectural guard against a class of silent restore/continuity regressions and removes one real duplicate persistence snapshot. No live cognitive history limits were changed.
