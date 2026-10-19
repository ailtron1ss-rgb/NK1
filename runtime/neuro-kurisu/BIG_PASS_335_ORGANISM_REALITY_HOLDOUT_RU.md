# BIG PASS 335 — Organism Reality / Autonomous Project Holdout
Дата: 2026-09-14

## 1. Почему изменён масштаб работы
Перепроверка B326–B334 показала, что проект слишком долго углублял один recovery/causal evidence-контур. Master-аудит прямо указывает: главная единица прогресса — persistent causal change in future behaviour, а не новый module/gate.

B335 поэтому не создаёт новую goal/project subsystem. Он измеряет, сохраняет ли уже существующий SelfDirectedLifeOrchestrator собственную деятельность при смене контекста.

## 2. Что добавлено
`B335AutonomousProjectHoldoutGate`.

Фазы:
`baseline -> training -> holdout -> closed`

Накопление:
- baseline action distribution;
- training verified outcomes;
- holdout action distribution;
- persistent project identity;
- project continuity;
- behavioural divergence between baseline and holdout;
- restart persistence.

Promotion/eligibility не разрешается только по факту существования проекта: нужны training evidence, holdout evidence, сохранённый projectId и measurable action-distribution shift.

## 3. Unit gate
PASS:
- 5 baseline observations;
- 4 training verified outcomes;
- 4 holdout verified outcomes;
- same project identity;
- positive holdout divergence ≈ 0.80;
- bad-control divergence = 0 -> blocked;
- snapshot/restore exact match.

## 4. Live OrganismCore gate — status recheck
`OPEN / NOT VERIFIED in current execution budget`.

The archived 24-cycle Core harness was re-run. It did not complete within the local execution budget, so the earlier report must NOT retain a fresh LIVE PASS claim. The shorter 12-cycle variant was also not independently reproduced within the same limit.

Therefore the current evidence status is:
- B335 unit gate: **PASS**;
- B335 Core live gate: **REPRODUCTION OPEN**;
- 24-cycle scalability benchmark: **OPEN**;
- restart/persistence wiring: structurally present but not counted as a fresh live PASS in this recheck.

The previous observed 24-cycle values (`holdout action divergence = 0.125`, `strategyRetention01 = 1.0`) remain historical evidence from the original run, not a newly reproduced PASS.

Observed Core action distributions:
- baseline: wait=1, explore=7;
- holdout: explore=7, rest=1.

This is real runtime evidence of behavioural change while retaining the autonomous project identity.

## 5. Critical limitation
B335 is **transfer/holdout evidence, not causal proof**.

The action distribution can change because the context changed, not necessarily because the self-generated project caused the change. Therefore B335 does NOT claim:
- causal project ownership;
- independent motivation;
- consciousness;
- external-world consequence ownership.

A later causal matched-control/lesion design is still required.

## 6. Persistence defect found and fixed
The first live restart check showed B335 state was not restored by `OrganismCore.snapshot()`/migration.

Fixed:
- explicit snapshot projection;
- `StateMigrations` schema wiring;
- restore path.

After correction: exact B335 diagnostic equality across restore.

## 7. Core reality check
Measured `src/organism/core/OrganismCore.ts`:
- 7,531 lines;
- 304 import declarations;
- 208 private readonly state owners/fields;
- ~578 method-like public/internal surfaces.

This confirms that further feature accumulation inside Core is counterproductive. The next major architecture step must extract boundaries while preserving behaviour.

## 8. Verification — corrected after independent recheck
PASS:
- `npm run typecheck`;
- B334 canonical test directly;
- B335 unit;
- integrity audit;
- release contract.

NOT counted as fresh PASS:
- B335 live Core — execution budget exceeded;
- B335 restart persistence as an organism-level live reproduction;
- full `audit:syntax` — current run exceeded the local execution budget.

The combined mega-command exceeded the local execution budget once; timeout was NOT treated as PASS. Individual required gates above were then executed separately.

## 9. Interpretation
B333/B334 proved a limited autonomous goal/project lifecycle.
B335 unit infrastructure demonstrates the intended holdout criterion, but the organism-level live reproduction remains open after recheck. The correct next move is therefore not another holdout gate, but a scalability/architecture pass that makes the Core cycle independently runnable and observable within bounded tiers.

The project is therefore moving from:
`goal exists`
to
`goal persists`
to
`goal changes future behaviour under transfer`.

## 10. Next large pass
Do NOT create another isolated evidence module.

Next large pass should combine:
1. OrganismCore boundary extraction phase 1;
2. a bounded cycle-trace harness that finishes on the host before any 40–80 cycle benchmark;
3. whole-organism action/self-model/project metrics in one trace;
4. autonomous project causal control (project-present vs matched project-absent);
5. only then long-run/restart/holdout;
6. update the runtime so the organism cycle itself becomes cheaper to execute and easier to observe.

Success condition:
`internal goal -> persistent project -> changed future behaviour -> matched causal control -> self/personality update -> persistence`.
