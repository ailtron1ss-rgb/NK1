# PASS 2855 — R7.2 Hot-Path Allocation / Durable Byte Accounting Reduction — 2026-09-24

## Цель
R7.2 продолжает R7/R7.1 с узким приоритетом: убрать доказанные повторные snapshot/deep-clone операции из одного cognitive cycle и снизить вторичную allocation pressure на durable persistence, не удаляя causal, policy, memory, world-model, self/agency или continuity pathways.

## Реализовано

### 1. Post-step snapshot reuse в canonical neural path
`src/organism/core/OrganismCore.ts`

После реального `step()` состояния B269/B270/B271 теперь получают один detached post-step snapshot и повторно используются там, где до следующей мутации сохраняется read-only семантика.

Для одного instrumented `observe()` цикла R7.1 → R7.2:
- B269 snapshots: `8 → 2`;
- B270 snapshots: `13 → 2`;
- B270 autonomous snapshots: `15 → 2`;
- B271 snapshots: `3 → 1`;
- cognitive-kernel snapshots: `8 → 1`.

Дополнительно в том же observe-сегменте:
- developmentalPortfolio: `10 → 3`;
- personalWorldline: `15 → 4`;
- futureSelf: `8 → 4`.

Эти числа являются instrumentation counts на одинаковом одном-cycle workload, а не процентом общего runtime acceleration.

### 2. Feedback / projection de-duplication
Сохраняется R7.1 invariant:
- один P80 snapshot для read-only feedback path;
- recovery watchdog snapshot не дублируется;
- terminal cognitive-kernel projection использует единственный detached snapshot;
- checkpoint не делает отдельный canonical-neural snapshot вне `PersistenceProjectionCoordinator`.

### 3. Durable byte accounting без второй полной byte-buffer allocation
`src/organism/persistence/FileStateStore.ts`

Вместо `TextEncoder().encode(payload).byteLength` добавлен bounded UTF-8 code-unit counter. JSON payload по-прежнему сериализуется один раз и записывается тем же `writeFile`; изменён только способ измерения размера уже созданной строки.

Unicode regression проверяет Latin, Cyrillic, astral symbols и escaped-surrogate content. `metrics.lastPayloadBytes`, cumulative `bytesWritten` и реальный размер файла совпадают.

Изолированный synthetic save benchmark на ~7.26 MB JSON payload:
- baseline mean: `66.20 ms`;
- R7.2 mean: `61.94 ms`;
- baseline p50: `62.63 ms`;
- R7.2 p50: `55.21 ms`.

Это локальный allocation/serialization benchmark, а не mobile/device benchmark и не заявление об общем ускорении организма.

### 4. Runtime regression guards
`tests/r7-performance-guards.mjs` расширен проверками exact hot-path snapshot counts и сохранением ранее действующих B301/world/ensemble/NeuralExperienceBranch guards.

Добавлен также `tests/r7-2-file-byte-accounting.mjs`.

## Runtime evidence
Текущий 16-cycle mobile diagnostic probe:
- mean cycle latency: `144.96 ms`;
- p50: `126.98 ms`;
- p95: `228.08 ms`;
- heap used at end: `~142.8 MB`;
- RSS at end: `~307.6 MB`.

Этот benchmark предназначен для наблюдения, не для pass/fail performance budget. End-to-end file-backed checkpoints имеют заметную run-to-run variance; R7.2 поэтому не объявляет общий mobile speedup на основании нескольких шумных запусков.

## Проверки
- `TYPECHECK=PASS mode=tsc`
- `test:r7:guards` = PASS
- `test:r7-2:file-byte-accounting` = PASS
- `test:canonical-policy` = PASS
- `test:canonical-live` = PASS
- `test:policy-authority` = PASS
- canonical self-agency live = PASS, `invariantIntegrity01=1`, `policyDuplicates=0`, `selfAgencyAblationDelta01=0.0765`
- R3 unified latent world unit/ablation/restart = PASS
- R4 temporal credit authority/ablation/restart/integration = PASS
- R5 memory lifecycle authority/ablation = PASS
- P2855 contextual policy = PASS, holdout accuracy `1.0`
- P2855 integration = PASS, `84/84` policy updates/selections, persisted
- P2855 ablation = isolated PASS, policy `0.2667` vs `0.1667` absolute gain `+0.10`; a later aggregate multi-test run timed out while executing this CPU-heavy test, so that timeout is not treated as a module regression
- `CLEAN_ARCHITECTURE=PASS sourceFiles=1673 canonicalFiles=533 missing=0 cycles=0 legacyLeakage=0`
- `RELEASE_CONTRACT=PASS`
- `SOURCE_HYGIENE files=3691 errors=0 warnings=0`
- `CLEAN_INTEGRITY=PASS files=3697`
- `SYNTAX_JSON=PASS js=1163 sh=6 json=240 parser=typescript`
- `RELEASE_SOURCE=PASS`

## Honest limits
R7.2 does not establish consciousness, human-level intelligence, biological equivalence, or readiness for indefinite autonomous mobile operation. The 80-cycle endurance target remains open; no 80/120/240-cycle result is being relabeled as PASS.

The full file-backed checkpoint loop still has high variance because serialization, fsync, recovery/watchdog work, and device/filesystem behavior remain material. R7.2 removes unnecessary allocation around that loop but does not pretend those costs disappeared.

## Next technical targets
1. Measure and reduce durable payload duplication at the projection boundary without removing causally required state.
2. Add explicit allocation budgets for `NeuralExperienceBranch` replay/eligibility/causal evidence.
3. Build reproducible 80/120/240-cycle endurance harnesses with file-backed persistence and independent holdout checks.
4. Split hot runtime projections from durable snapshots only where persistence ownership and restart semantics can be proven equivalent.
5. Preserve R3/R4/R5/R6 ablations, restart evidence and self-agency hard-invariant checks through every subsequent performance pass.
