# Neuro-Kurisu 35.6.0 — Functional Verification Matrix

## Правило релиза
Функция не считается подтверждённо работающей только по наличию исходника. Доказательство строится одним из трёх способов:
1. прямой вызов безопасной функции;
2. semantic contract с осмысленными входами/ожидаемым поведением;
3. integration/runtime/restart contract для stateful, parameterized или externally-effectful API.

## Inventory
- source files under src: 258
- function-like declarations: 2333
- declarations with body: 2304
- exported declarations: 102
- static zero-reference candidates: 385
- one-or-less-reference candidates: 746
- safe Core zero-argument surface: 179 discovered / 177 executed / 2 intentionally skipped (destructive rollback/policy mutation)

## Real runtime evidence
- P16 world learning: PASS; memories=29, semanticHits=77, links=178, policyUpdates=18, worldTransitions=35.
- P35 world/body integration: PASS; entities=3, scene=lab.
- P35 semantic world/body: PASS; entities=8, relations=2, coverage=0.150, rest=0.600.
- P35 performance: PASS; 10,000 cycles in 602.43 ms, entities=12.
- P36 integration/migration/performance/self-development: PASS.
- P36 performance: 10,000 cycles in 138 ms, experiments=128.
- P69–P73 giant runtime+persistence: PASS after fixing snapshotLight budget.
- P80–P82 runtime E2E: PASS; 160 ticks propagated through all three layers.
- BIG PASS 126 Core/server: PASS.
- BIG PASS 155 Core/server/restart: PASS.
- BIG PASS 157 Core/server/restart: PASS; real HTTP and restored state confirmed.

## Release/architecture evidence
- TYPECHECK: PASS
- CLEAN_ARCHITECTURE: PASS, cycles=0
- CORE_OWNERSHIP: PASS
- SOURCE_HYGIENE: PASS, errors=0, warnings=0
- FORENSICS: PASS
- RELEASE_CONTRACT: PASS
- RELEASE_SOURCE: PASS
- SOURCE_TRUTH: PASS
- API_ROUTES: PASS, duplicates=0
- ANALYSIS_ALIGNMENT: PASS, 52/52
- ARCHIVE_MANIFEST: PASS

## Explicit limits
Static zero-reference does not equal dead code. Stateful/destructive methods are not called with random arguments; they require scenario-level tests. Physical Android device-gate and multi-day/month-long soak are not represented as container PASS.
