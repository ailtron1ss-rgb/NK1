# Neuro-Kurisu 35.6.8 / B355 — Повторная строгая проверка организма

Дата: 2026-09-14
Фаза: Stage-26 / SCS-DIT / Brick 4 compositional action execution

## 1. Что именно перепроверено

Проверка продолжена от B353/B354, без сброса уже доказанных критериев.

- Brick 3 B353 одиночная causal ON/OFF/SHAM проверка сохранена.
- Brick 3 B354 независимая репликация сохранена: 5 training trajectories × 4 contexts, 20/20 context replications.
- Restart проверка B354 сохранена: snapshot → новый `OrganismCore` → продолжение holdout; lesion остаётся persistent.
- Brick 4 B355 проверяет уже не наличие telemetry, а реальное включение verified program primitive в выбранное действие.
- Для Brick 4 добавлен ON/OFF execution gate, чтобы отделить реальное исполнение от простого существования B276 state.
- TypeScript runtime typecheck и release/source/integrity/architecture/archive audits перепроверены после финальных изменений.

## 2. Факты B353/B354

### B353
- Mean causal policy-distribution L1: 0.0780206405.
- Mean SHAM L1: 0.0178028476.
- Causal/SHAM ratio: 4.3825x.

### B354
- Independent trajectories: 5/5.
- Contexts per trajectory: 4.
- Replications: 20/20 PASS.
- Global mean causal L1: 0.1132610944.
- Global mean SHAM L1: 0.0336599701.
- Global causal/SHAM ratio: 3.3649x.
- Structural lesion persisted after restart in every tested context.
- B269 neural cycle delta: 80 in every tested holdout context.

Interpretation: B269 has replicated causal functional influence on the current software decision spine. This does not establish that B269 is the sole causal owner of organism-wide behavior.

## 3. Что реально изменилось в B355

### 3.1 Program materialization
`B276LatentActionProgramSynthesizer` теперь формирует минимально 3 и максимально 8 distinct primitives and materializes fallback primitives as real nodes rather than metadata only.

### 3.2 Persistent execution state
Persisted state now carries:
- `executionPlan`
- `executionCursor`
- `executionProgramId`
- `executionCompletions`

Thus a verified program has a real multi-step execution position that survives snapshot/restart.

### 3.3 Executive integration
The next verified primitive is inserted into the ordinary candidate field and may become the selected action. This is guarded by:
- no constitutional veto;
- no external user request/event;
- repair pressure not above the hard threshold;
- explicit `enableCompositionalExecution` gate.

The constitutional arbiter therefore remains a safety membrane rather than a bypassed decoration.

## 4. B355 доказательство

Matched state contains a verified three-step program:
`rest -> respond -> explore`

Execution ON:
- selected action = `rest` (exact first primitive);
- execution cursor: `0 -> 1`.

Execution OFF:
- selected action may remain policy-compatible, but execution cursor stays `0`;
- therefore the new path is not a passive telemetry counter.

The test is `tests/big-pass-355-compositional-program-execution.mjs` and is wired as `test:big-pass-355:compositional-execution`.

## 5. Strict engineering gates

- `TYPECHECK=PASS mode=tsc`.
- `CLEAN_ARCHITECTURE=PASS sourceFiles=1239 canonicalFiles=400 missing=0 cycles=0 legacyLeakage=0`.
- `SOURCE_TRUTH=PASS`.
- `RELEASE_CONTRACT=PASS`.
- `RELEASE_SOURCE=PASS application=35.6.8 core=70.0.0-master-prompt-progress-engine schema=127`.
- `CLEAN_INTEGRITY=PASS files=2672 release=35.6.8 core=70.0.0-master-prompt-progress-engine schema=127`.
- `ARCHIVE_MANIFEST=PASS files=2897` after the final source/doc update.
- Archive audit: missing=0, hashMismatches=0, extra=0.
- Source hygiene: 0 errors, 7 historical duplicate-content warnings. The warnings are retained historical duplicates and are not treated as functional failures.

## 6. Строгая граница текущего результата

### Закрыто
- Brick 0 SPINE_ONLY: 100%.
- Brick 1 DIT: PASS.
- Brick 3 causal SNN: replicated and closed on host runtime.
- Brick 4 first executable composition gate: PASS.

### Осталось открытым
- Physical Android/Termux runtime gate.
- Multi-step compositional causal attribution across many contexts/seeds.
- Program outcome learning and credit assignment over multiple primitives.
- Transfer/generalization of verified programs under genuinely new contexts.
- Long-horizon program execution and recovery after interruption.
- Rich embodied perception/action grounding.
- Functional consciousness tests beyond the existing indicators.
- Phenomenal consciousness remains UNKNOWN and is not claimed by this release.

## 7. Текущая оценка состояния

These scores are engineering milestone ratings, not scientific measurements of consciousness.

| Область | Оценка | Комментарий |
|---|---:|---|
| SPINE_ONLY causal architecture | 100/100 | Closed |
| DIT / identity effect | 100/100 | Closed |
| B269 causal neural substrate | 76/100 | Replicated causal effect, but not sole owner |
| B269 replication robustness | 88/100 | 5 trajectories × 4 contexts |
| Compositional action execution | 38/100 | First real commit path; long-horizon/generalization open |
| World-model planning | 25/100 | Existing substrate, not yet unified into compositional planner |
| Long phone life | 25/100 | Host mobile profile proven; physical Android remains open |
| Sensors / body causality | 20/100 | Device gate not closed |
| Functional consciousness | 40/100 | Existing functional indicators, no phenomenal claim |
| Autonomous personality | 42/100 | Persistent learning/identity/agency exists, but organism-wide causal ownership is still distributed |
| Full artificial-organism target | ~40% | Strict roadmap estimate, not a consciousness score |

## 8. Next gate

Do not treat B355 as final Brick 4 completion. The next serious target is a multi-step compositional causal experiment: compare execution ON/OFF with matched verified programs, measure action-sequence distribution and outcome return over several contexts and restarts, and require a non-trivial attribution margin before promoting the program system to the next stage.
