# PASS 17 — Durable File Codec / Termux Persistence

Дата: 2026-10-01
Версия проекта: 35.40.0
Release core: 100.32.0-r26-hierarchical-lowrank-causal

## Цель

Снизить стоимость длительной persistence-нагрузки в hot path и реальном phone/Termux runtime, не меняя семантику восстановления, причинную непрерывность или публичные snapshot-контракты.

## Реализовано

### 1. V8 binary codec для FileStateStore

`FileStateStore` получил `encoding: 'v8'` с автоматическим чтением старого JSON и последующей миграцией при сохранении.

- JSON остаётся режимом по умолчанию для research/debug.
- Phone/Termux server bootstrap использует V8.
- Crash-safe temporary file + fsync + backup + atomic rename сохранены.
- SHA-256 считается по фактическому binary payload.

Node V8 serialization поддерживает structured-clone-подобное состояние и допускает хранение сериализованных данных на диске; формат привязан к поддерживаемому Node runtime проекта.

### 2. Shared canonical persistence state

`NeuralExperienceBranch` и B269 получили внутренний `clone:false` режим.

`PersistenceProjectionCoordinator` теперь переиспользует один canonical neural substrate snapshot внутри projection.

`NeuralSubstrateBackend.fullSnapshot()` может принимать уже созданный canonical snapshot, что исключает повторный deep clone.

### 3. Persistence regression coverage

Добавлены:

- `tests/pass17-file-state-codec.mjs`
- `tests/pass17-v8-file-long-horizon.mjs`

Проверяется:

- JSON baseline
- V8 rich JS state (`Map`, `Set`, `undefined`)
- JSON → V8 migration
- 256-cycle long horizon
- restart tick 257
- semantic evidence после reload
- crash recovery

## Результаты

### FileStateStore A/B, 64 cycles

| Режим | Payload | Flush | Save |
|---|---:|---:|---:|
| JSON | ~4.86 MiB | ~212 ms | ~93 ms |
| V8 | ~3.70 MiB | ~98 ms | ~17 ms |

Это соответствует примерно -24% размера payload, -54% flush времени и -82% времени непосредственного save в данном A/B прогоне.

### V8 long horizon

- cycles: 256
- restartedTick: 257
- payload: ~5.44 MiB
- peak RSS: ~474 MB
- direct FileStateStore restart: PASS

### Mobile heap smoke

`--max-old-space-size=256`:

`CLEAN_ORGANISM_SMOKE=PASS`

## Verification

PASS:

- typecheck
- R26 core release gate (8/8)
- P34 causal personhood
- R26 neural substrate
- R26 observation planning
- canonical hash equivalence
- clean restart persistence
- P15.5 device hardening
- server smoke
- server security smoke
- P2869 durable checkpoint dedup
- core ownership
- architecture
- hygiene
- forensics
- syntax
- integrity
- source truth
- release source
- archive manifest

Отдельный `test:smoke` агрегатор в этой среде не завершился за выделенный лимит; специализированный `test:organism-smoke` и mobile256 smoke проходят. Большой `test:big-pass-364:long-horizon` также не используется как PASS из-за внешнего timeout orchestration.

## Ограничения

V8 serialization сохраняет сильную runtime-совместимость в пределах поддерживаемого Node major/version, но не должна рассматриваться как универсальный cross-runtime архивный формат между произвольными версиями Node.
