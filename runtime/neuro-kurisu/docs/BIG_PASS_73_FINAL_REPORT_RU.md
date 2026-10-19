# Neuro-Kurisu 34.44.0 — BIG PASS 73
## Mobile Long-Horizon / Projection Efficiency / Legacy Continuity

Дата: 2026-09-06

## 1. Что было сделано

### A. Long-horizon performance

Найден и подтверждён основной bottleneck прошлого прохода: полная persistence projection выполнялась слишком часто, а её стоимость росла до примерно 100–125 ms за отдельный checkpoint.

Вместо отключения cognitive mechanisms введён отдельный `performanceProfile`:

- `quality` — короткое окно deep persistence;
- `balanced` — прежний базовый режим;
- `mobile` — deep persistence interval расширен до 12 dirty cycles при сохранении forced/full flush.

Дополнительно operational mode теперь не считает один лишь body telemetry причиной для deep projection. Значимые text/vision/audio/world/outcome signals и периодический bounded refresh по-прежнему переводят projection в глубокий режим.

### B. Snapshot de-duplication

В hot path сокращены повторные структурные копирования:

- P41 semantic perception snapshot теперь кэшируется внутри цикла;
- P41 temporal snapshot переиспользуется;
- social trust читается один раз;
- P42 experience snapshot переиспользуется;
- outcome cognition snapshot читается один раз для P84 derivation;
- cognitive network больше не клонирует 64-entry broadcast history на каждом hot broadcast.

### C. World model

Сохранена оптимизация предыдущего прохода:

`WorldEnvironment.project()` больше не клонирует весь bounded transition history при обычном projection.

### D. P-system fusion

Добавлена карта доменной группировки P30–P82. Цель — перестать считать каждый P-уровень отдельным «мозгом» и перейти к capability ownership:

Memory / Reality / Perception-Body / Identity-Self / Agency / Development / Governance / Consciousness Research.

Это documentation/architecture alignment, а не ложное заявление о полном fusion runtime.

### E. Legacy continuity

Старый архив не был массово возвращён в runtime.

Реинтегрированный полезный слой остаётся canonical:

- Live2D model;
- moc3;
- texture;
- physics;
- cdi;
- expressions;
- motions;
- исторические reference documents.

Старые duplicate cognitive cores и старый frontend dependency graph не возвращены.

## 2. Измерения

### Mobile 1000-cycle operational qualification

Результат отдельного чистого прогона:

- `MOBILE_HORIZON_1000=PASS`
- ratio: `1.339`
- first median: `28.94 ms`
- last median: `38.74 ms`
- p95: `51.64 ms`
- heap first checkpoint: `39.1 MB`
- heap last checkpoint: `134.8 MB`
- canonical memory count: `143`
- wall time: `~32.0 s` на validation host

Это программная qualification текущего Node runtime. Она не заменяет физический прогон именно на Poco M7 Pro 5G / Termux.

### Focused regression

PASS:

- release-source verification;
- legacy reintegration audit;
- clean organism smoke;
- server smoke;
- persistence projection tiering;
- persistence projection governor;
- P40 integration;
- P41 semantic perception;
- P52 counterfactual development;
- mobile performance profile;
- mobile 1000-cycle horizon.

## 3. Почему это улучшение качественное

Cognition не отключена для ускорения. Изменён только момент дорогого materialization.

Живые cognitive engines продолжают обновляться каждый цикл; persisted compatibility projections становятся событием persistence policy.

Это разделяет два ранее смешанных процесса:

`live organism computation` ≠ `deep persistence materialization`.

Для мобильной платформы это принципиально более здоровая архитектура.

## 4. Что пока НЕ доказано

- physical Android/Termux long-run stability;
- native Android foreground service lifecycle;
- полноценное semantic vision;
- полноценный unified sensorium;
- человеческий уровень general intelligence;
- феноменальное consciousness;
- эквивалентность какой-либо P-метрики субъективному опыту.

## 5. Состояние после прохода

| Область | Оценка |
|---|---:|
| Archive continuity | 100% |
| Legacy reintegration | 100% |
| Live2D embodiment | 100% |
| Operational API | 100% |
| WorldModel hot-path | 100% |
| Mobile persistence profile | 100% |
| Snapshot de-duplication | 100% |
| Mobile 1000-cycle proof | 100% |
| P30–P82 fusion map | 100% |
| Unified sensorium | 40% |
| Developmental self | 60% |
| Social mind | 55% |
| Self-generated motives | 35% |
| Consciousness experiment harness | 30% |
| Native Android organism | 25% |
| Physical device qualification | 25% |

## 6. Следующий большой шаг

BIG PASS 74 следует направить не на добавление нового P-номера, а на:

1. hot/warm/cold state separation;
2. event-delta persistence/journal;
3. semantic memory compression;
4. experience graph;
5. identity gravity / stability model;
6. cognitive immune system;
7. resource-scarcity-aware scheduler;
8. repeatable 2k/5k-cycle qualification.

После этого — Unified Sensorium и developmental self.
