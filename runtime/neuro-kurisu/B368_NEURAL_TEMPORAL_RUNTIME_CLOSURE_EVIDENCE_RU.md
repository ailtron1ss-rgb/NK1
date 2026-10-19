# B368 — NEURAL TEMPORAL + FULL RUNTIME CLOSURE

## Статус
CURRENT / EVIDENCE-BACKED

## Цель
Замкнуть causal spine так, чтобы каноническое 96-нейронное ядро B365 влияло не только на исторический spine-only путь, но и на обычный full OrganismRuntime, а delayed outcomes могли изменять нейронный readout через temporal credit assignment.

## Архитектурное изменение
1. B365 получил temporal trace window из 12 тиков.
2. Delayed reward распространяется назад с gamma=0.90 и lambda=0.78.
3. Temporal credit изменяет action readout и отдельный temporal credit ledger.
4. B365 получил обучаемое context→action neuromodulatory field на 7 входах.
5. Context field сочетает небольшую семантическую инициализацию с обучаемым outcome-driven update.
6. B365 подключён к ordinary full decision path.
7. Full-path outcome вызывает B365 learning даже при simulator worldTransition.
8. OrganismRuntime получил explicit autonomousStep()/runAutonomousCycles().

## Causal tests
### B365 core
PASS.
Минимальный lesion L1: 0.003517.

### B366 action commitment
PASS, 6/6 seeds.
Context ON/OFF separation L1: 1.119–1.124.
Max action probability: 0.606–0.678.

### B367 predictive closure
PASS, 6/6 seeds.
Minimum external L1: 0.653654.
Minimum learned-transfer L1: 0.158974.
Minimum forecast lesion L1: 0.008088.
Restart L1: 0 на всех seed.

### B368 temporal closure
PASS.
Temporal updates: 90.
Temporal credit magnitude: 0.999919.
Temporal ON/OFF policy L1: 1.120000.

### B368 full runtime closure
PASS.
First-step full-path candidate L1: 0.064380.
Enabled B365 learning after first autonomous step: 1.
Enabled temporal updates after first autonomous step: 1.
Disabled B365 cycles: 0.
Disabled B365 learning: 0.
After additional 3 autonomous cycles: enabled learning=4, temporal=4; disabled remains 0.
External commands: 0.

## Persistence
CLEAN_RESTART_PERSISTENCE=PASS.
MEMORY_DEDUP=PASS.

## Static verification
TYPECHECK=PASS.
CORE_OWNERSHIP=PASS.
SOURCE_HYGIENE errors=0 warnings=0.
CLEAN_ARCHITECTURE cycles=0 legacyLeakage=0.
CLEAN_INTEGRITY=PASS.
RELEASE_CONTRACT=PASS.
SYNTAX_JSON=PASS.

## Performance evidence
Host mobile-profile benchmark: 8 autonomous cycles.
p50 = 546.824 ms/cycle.
p95 = 656.311 ms/cycle.
Peak observed Node heap = 143.81 MiB.

Это host evidence, не physical Android evidence.

## Ограничения
Phenomenal consciousness: UNKNOWN.
Physical Termux sensor evidence: not verified in current environment. device:preflight reports Termux API commands absent.
WorldEnvironment is simulator/environment evidence, not physical Android proof.

## Source-of-truth decision
B365 remains the canonical neural causal core. B368 deliberately does not create a parallel B369/B370 neural substrate.
