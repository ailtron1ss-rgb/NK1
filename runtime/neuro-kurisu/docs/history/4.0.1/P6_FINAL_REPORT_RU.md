# Neuro-Kurisu Evolution Current Release — P6 Final Report

## Статус

P6 завершён как архитектурно-исследовательская фаза. Главная цель была не добавить ещё один набор когнитивных модулей, а превратить накопленные P0–P5 системы в более строгий организм с единым доменным состоянием, provenance, integrity, replay и более дешёвым persistence path.

## Что изменено

### 1. Единый state contract

Версия приложения: `Current Release`.

Organism Core: `см. VERSION.json`.

State schema: `8`.

Фазовые поля `p1/p2/p3/p4/p5` заменены в canonical state на доменные facets:

- `memory`
- `embodiment`
- `learning`
- `consciousness`
- `evolution`

Исторические названия остались только в migration/history слоях.

### 2. State provenance

Каждый checkpoint теперь содержит:

- release contract;
- capabilities snapshot;
- invariant result;
- stable state hash;
- replay signature;
- evolutionary stage.

Hash вычисляется по стабильному состоянию организма, а volatile operational timestamps не влияют на его воспроизводимость.

### 3. Integrity Sentinel

Перед сохранением проверяются:

- schema/version;
- диапазоны внутренних потребностей;
- уникальность goal IDs;
- уникальность self-project IDs;
- retention limits;
- protected value floors;
- состояние system contract.

Ошибки блокируют checkpoint, а не превращаются в молчаливую порчу состояния.

### 4. Replay

Decision traces получают deterministic replay signature. Это позволяет обнаруживать непреднамеренное изменение последовательности решений между тестами и рестартами.

### 5. Capability Registry

Доступные возможности теперь являются данными, а не предположением. Состояние может явно показать наличие/отсутствие:

- persistence;
- replay;
- Termux:API;
- Gemini;
- KoboldCpp;
- simulation;
- network assertion.

### 6. Action Gateway

Перед действием организм получает audited authorization record. По умолчанию gateway находится в `dry-run`, а live execution требует явного configuration gate.

### 7. Transactional persistence

Один cognitive cycle теперь выполняется внутри batch transaction. Внутренние `observe`, counterfactual, feedback и embodiment updates не вызывают несколько fsync подряд. В конце цикла выполняется единый atomic checkpoint.

Это важное изменение для Android/Termux и для исследовательских benchmark.

### 8. Исследовательский контур

Исследования больше не являются частью обязательного release gate. Production audit и тяжёлые causal labs разделены.

## Проверки

- `npm ci --offline` — PASS
- lockfile — zero-dependency tree
- TypeScript strict audit — PASS
- organism smoke — PASS
- autonomy — PASS
- restart persistence — PASS
- P6 migration — PASS
- P6 organism — PASS
- server smoke — PASS
- architecture audit — 0 missing imports / 0 runtime cycles / 0 legacy leakage
- integrity audit — PASS
- source hygiene — 0 errors / 0 warnings
- operational hardening — PASS
- P6 causal lab — PASS

## P6 causal lab

Baseline: 42 cycles, 5 self-projects, 42 agency records, 13 value revisions, 126 identity trajectory samples.

Lesions:

- self-projects disabled → 0 projects;
- agency disabled → 0 agency records;
- value evolution disabled → 0 revisions;
- identity trajectory disabled → 0 trajectory samples.

Это подтверждает функциональную причинность архитектурных каналов, но не является доказательством субъективного опыта.

## Что намеренно не объявлено завершённым

1. Физический Android Device Gate.
2. Длительный 24–168h soak.
3. Реальный multi-agent/social world.
4. Полноценное lifelong learning на реальных данных.
5. Доказательство субъективного сознания — на текущем уровне науки и инструментов такого теста нет.
