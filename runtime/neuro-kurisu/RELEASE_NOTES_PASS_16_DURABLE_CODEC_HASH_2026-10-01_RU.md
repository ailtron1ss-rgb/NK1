# Neuro-Kurisu — PASS 16 — Durable Codec + Canonical Hash

Дата: 2026-10-01

## Цель

Уменьшить residency и стоимость durable checkpoint без изменения публичной семантики snapshot/restart и без декоративных интеграций.

## Изменения

### 1. MemoryStateStore → V8 binary snapshot

`MemoryStateStore` больше не хранит вторую полную объектную копию состояния через `structuredClone()`.

Теперь:

- `save()` сериализует detached state через `node:v8` `serialize()`;
- store удерживает компактный `Uint8Array` payload;
- `load()` создаёт независимый объект через `deserialize()`;
- добавлены store metrics: сохранения, размер payload и время save;
- `FileStateStore` не изменён.

На состоянии после 256 циклов локальный codec benchmark показал около 29 ms на `v8.serialize` против около 105 ms на `structuredClone` для сохранения; бинарное представление было около 6.0 MiB против около 7.6 MiB JSON-размера объектного графа.

### 2. Canonical Integrity hash

`IntegritySentinel.hash()` теперь сначала строит тот же canonical JSON-порядок, затем делает один SHA-256 update.

Семантика сохранена:

- сортировка object keys;
- arrays сохраняют порядок и holes;
- root-level `system` исключается;
- `undefined` продолжает нормализоваться в `null` в hash material.

Добавлен equivalence test против прежнего streaming hash алгоритма; digest совпадает.

### 3. B365 projection deduplication

`unifiedNeuroCausalCoreB365.snapshot()` теперь создаётся один раз в `OrganismCore.projectionContext()` и передаётся в hot neural persistence bundle вместо повторного deep snapshot.

## Проверки

- typecheck: PASS
- memory state codec/isolation: PASS
- canonical hash equivalence: PASS
- checkpoint hotpath: PASS
- clean restart persistence: PASS
- P2887/P2888/P2889/P2890/P2891: PASS
- P2842 calibration: PASS
- P2855 contextual policy: PASS
- P2892/P2893/P2894/P2895: PASS
- persistence projection/governor: PASS
- core ownership: PASS
- architecture: PASS
- hygiene: PASS
- forensics: PASS
- syntax: PASS
- integrity: PASS
- release-source: PASS

## R19 long horizon

256 циклов + restart boundary: PASS.

Текущий прямой замер после PASS16:

- firstMs: ~93 ms
- lastMs: ~127 ms
- ratio: ~1.37
- restartedTick: 257
- memoryCount: 105
- max RSS одного прогона: ~499 MiB

Peak RSS остаётся чувствительным к состоянию Node/V8/allocator, поэтому одиночный RSS-run не трактуется как абсолютная device-гарантия.

## Ограничения

MemoryStateStore — in-process store и не является межпроцессным форматом. V8 binary payload намеренно используется только для этого store; файловая persistence остаётся JSON-based.
