# BIG PASS 317 — ORGANISM REALITY CLOSURE

Дата: 14.09.2026
Базовый release: Neuro-Kurisu 35.6.1 / B316
Цель: перейти от «много работающих механизмов» к быстрому, повторяемому доказательству единого жизненного цикла организма.

## 1. Что реально изменено

1. В `OrganismCore` исправлен accessor `cognitiveDomainClosureSnapshot()`: он теперь читает канонический runtime-субстрат `CognitiveDomainClosure`, а не потенциально устаревшую projection-копию.
2. Добавлен `cognitiveDomainClosureDiagnostics()`, чтобы snapshot и diagnostics имели явно разные контракты и не смешивались тестами.
3. Добавлен `tests/big-pass-317-organism-reality-closure.mjs`.
4. В `package.json` добавлены:
   - `test:big-pass-317:reality`
   - `audit:b317:reality`
5. B317 использует реальный `MemoryStateStore.load()` при restart-проверке, а не только `core.snapshot()`.

## 2. Что доказывает B317

### Live cognitive closure

В каждом живом проходе проверяется изменение и связь доменов:

- memory
- world
- self
- agency
- learning

Проверяется не наличие классов, а изменение runtime-state и междоменные причинные links.

### Learning

B317 требует:

- реальные neural learning updates;
- synaptic updates;
- causal/policy/personality path;
- divergence между matched positive и negative trajectories хотя бы по одному независимому внутреннему/поведенческому измерению.

### Persistence

Restart теперь начинается с содержимого `MemoryStateStore.load()`.
После восстановления система должна:

- сохранить closure history;
- сохранить learning updates;
- продолжить новые циклы;
- продолжить learning после restart.

### Resource stress

Отдельная ветка под сильным battery/thermal/RAM pressure проверяет, что организм не симулирует нормальное состояние:

- action distribution меняется;
- energy остаётся пониженной;
- cognitive closure допускает деградацию, но не падает полностью.

## 3. Фактический прогон

### B317

PASS.

Positive branch:

- 4 cycles;
- closure completion: 75%;
- persistence coverage: 100%;
- mean cycle ≈ 638.6 ms;
- p95 ≈ 848.0 ms;
- B296 learning updates: 4;
- synaptic updates: 624;
- critical-path score: 1.0.

Negative branch:

- 4 cycles;
- closure completion: 50%;
- persistence coverage: 100%;
- mean cycle ≈ 501.0 ms;
- p95 ≈ 728.2 ms;
- B296 learning updates: 4;
- synaptic updates: 624;
- critical-path score: 1.0.

Stress branch:

- 4 cycles;
- closure completion: 75%;
- persistence coverage: 100%;
- mean cycle ≈ 399.5 ms;
- p95 ≈ 663.8 ms;
- energy fell to ≈ 0.410;
- organism selected `rest` for all 4 stress cycles.

Matched-trajectory divergence:

- action-distribution L1 shift: 0 in this very short gate;
- neural plasticity gap: ≈ 0.00421;
- personality gap: ≈ 0.03199;
- personality gap crosses the B317 threshold, so the gate certifies internal developmental divergence without pretending that four cycles prove long-horizon behavioral differentiation.

Real store restart:

- closure cycles preserved: 4;
- learning updates preserved: 4;
- resumed cycles: 7;
- resumed learning updates: 7.

## 4. Regression gates

B316 contextual-action scar: PASS.

Observed:

- unrelated action scar remained 0;
- source action bias ≈ -0.2177;
- neighbor-context bias ≈ -0.2106;
- contextual action scar recovered from ≈ 0.7307 to ≈ 0.0813;
- restart retained the action-specific scar;
- live core produced 12 negative outcomes and 1872 synaptic updates.

B305 Termux benchmark: PASS on current host.

- platform: Linux x64;
- Node: v22.16.0;
- 48 cycles;
- 12 full / 36 micro;
- mean ≈ 44.7 ms;
- p95 ≈ 237.4 ms.

Важно: это host benchmark, а не физический Android ARM64 benchmark.

Typecheck: PASS via project runtime tsc mode.

## 5. Найденные проблемы в ходе B317

### 5.1 Snapshot ≠ diagnostics

Предыдущий тестовый код обращался к `cognitiveDomainClosureSnapshot()` как к diagnostics. Это было ошибкой тестового слоя. Теперь есть отдельный `cognitiveDomainClosureDiagnostics()`.

### 5.2 In-memory snapshot ≠ durable restart proof

Много старых тестов используют:

`const snap = core.snapshot()`

и затем создают новый `MemoryStateStore({initial:snap})`.

Это доказывает serialization/restore, но не обязательно доказывает, что state реально попал в store последним durable checkpoint.

B317 вводит более строгий образец:

`await store.load()` → новый runtime → restart verification.

Старые тесты пока не переписаны все сразу; это отдельный verification pass.

### 5.3 Большой aggregate audit слишком тяжёлый

Полный агрегированный `audit:b316:reality` остаётся тяжёлым и может превышать ограничения среды. Это нельзя трактовать ни как PASS, ни как FAIL функциональности. Следующий шаг — разнести release audit на быстрые mandatory gates и длинные research gates.

## 6. Что НЕ доказано B317

B317 не доказывает:

- сознание;
- human-level intelligence;
- fully autonomous life;
- multi-hour/multi-day autonomous survival;
- real Android ARM64 execution;
- novel holdout generalization;
- genuine structural neural network growth;
- human-equivalent personality.

Это намеренно. Gate измеряет закрытие инженерного жизненного цикла, а не делает философских заявлений.

## 7. Следующий большой проход

### B318 — REAL DURABILITY + BEHAVIORAL EFFECT

1. Перевести критические restart-тесты со `core.snapshot()` на реальный store.
2. Ввести durable-checkpoint identifier в каждую closure record.
3. Проверять `saved state -> kill process -> new process -> load -> continue`.
4. Сверять не только counters, но и behaviorally relevant state.
5. Закрыть mismatch между «сохранено в projection» и «сохранено в durable store».
6. Создать отдельный fast audit и отдельный deep audit.

### B319 — LONG-HORIZON BEHAVIOR

После durability:

`prediction → action → real outcome → update → future action`

на 50–100+ циклах с train/holdout separation.

### B320 — PERSONALITY CAUSALITY

Разделить:

- state change;
- personality change;
- behavior change;
- causal attribution.

Личность считать изменившейся только при устойчивом downstream effect на выбор действий в новых контекстах.

## 8. Правило проекта после B317

Функция, подсистема или capability не получает статус «готово» только потому, что:

- существует исходный код;
- экспортируется метод;
- snapshot меняется;
- unit test проходит.

Минимальный путь доверия:

`implemented → invoked → integrated → observed → verified → persisted → restarted → causally influential → regression-safe`

Для новых neural/cognitive capability добавляется:

`→ holdout-generalized`

Это становится основным ratchet проекта.
