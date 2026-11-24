# Neuro-Kurisu 35.6.1 — сверхглубокий аудит B297+
Дата: 2026-09-13

## 1. Итог

Проект имеет сильный инженерный каркас и большое количество реально исполняемых когнитивных/нейронных компонентов. Однако архитектурная ширина всё ещё значительно опережает строго доказанную глубину обучения и реального self-directed поведения.

Ключевой диагноз: проблема уже не в отсутствии модулей. Главная проблема — контур обычной жизни организма не гарантирует, что ключевые нейронные подсистемы обучаются на каждом обычном опыте, а исполнительная система B297 не является единственным финальным владельцем выбора действия.

## 2. Что подтверждено непосредственно

- Typecheck: PASS.
- Architecture: PASS; 1124 source files, 382 canonical files, no cycles/legacy leakage.
- Integrity: PASS; 2288 checked files, release 35.6.1, schema 127.
- Hygiene: PASS.
- Release contract: PASS.
- Zero-dependency lock: PASS.
- Semantic coverage текущего дерева: 3663 function-like units; VERIFIED 38 (1.04%), INTEGRATION_ONLY 837, UNSAFE_TO_AUTO_RUN 259, UNVERIFIED 2529; evidenceCoverage01 0.0675.
- Function liveness: 3783 declarations, 3754 with body, 214 zero-reference, 685 with <=1 reference.
- Parameterized-safe audit: 912 attempted, 878 passed, 0 failed, 22 input-synthesis-needed, 12 lifecycle-needed.
- B259, B260, B263, B264, B268, B289, B291, B293, B294, B296 standalone, B297 standalone/core — tests were executed; the targeted B297/B296/B294 chain mostly passes.

## 3. Critical discovery A — B296 core integration does not actually learn in the tested ordinary path

B296 standalone produces learningUpdates=48 after 384 cycles.

B296 inside OrganismCore in the current integration test produced:
- cycles=40
- learningUpdates=0
- agency≈0.50
- personalityCoherence≈0.76

This is caused by the integration gate:
`learningEnabled: b295Plan.budget01 > .18`

Thus the neural personality-agency nucleus can be executable while receiving zero plastic updates during the tested core trajectory. This is a direct architecture-to-runtime mismatch: "component learns" is not the same as "organism learns through that component in ordinary life".

Required correction: add an integration benchmark where the organism experiences a controlled sequence containing both high- and low-budget phases and prove:
1) B296 receives learning permission when appropriate;
2) at least one real weight/readout changes;
3) the change survives restart;
4) the changed B296 state alters later action bias;
5) lesion removes the effect.

## 4. Critical discovery B — B297 is integrated, but not the sole action owner

B297 enters OrganismCore and modifies candidate scores. However after B297 the pipeline continues through B291, p69 constitutional arbitration, selectIntent, p31 workspace preview, adaptive-development diversity recommendation, cognitive-kernel finalization, consistency/quorum safety, repair overrides, and additional downstream decision logic.

Therefore B297 is an arbitration seam, not the final action-owner. This is consistent with the B297 map document, but it means the phrase "unified executive" must be interpreted narrowly.

Required next step: create an `ActionOwnershipGraph` with one explicit final-owner node and a provenance edge for every score mutation. The release gate should fail if an action score is changed after the declared final owner without an explicit post-owner governance reason.

## 5. Critical discovery C — MicroDreamEngine still contains the exact hardcoded decoration B296 roadmap says was removed

`src/organism/developmental/MicroDreamEngine.ts` still creates dreams with:
`confidence: .32`

The planned B296/B297 chain explicitly describes this as a decoration to be removed in favor of computed confidence and world-model rollout.

Therefore the current archive contains a stale/unfinished implementation despite the documentation claiming this debt as a target for closure.

Required correction:
- replace fixed confidence with evidence-derived confidence;
- use B262/B283-derived similarity/prediction evidence;
- prove confidence differs under different inputs;
- prove the result changes replay/consolidation or later behaviour;
- run lesion/disable test to show the dream mechanism is causally relevant.

## 6. Critical discovery D — p15.5 autonomous runtime test is not currently a clean PASS signal

The test `tests/p15.5-device-hardening.mjs` did not terminate within 90 seconds when run directly in the audited archive.

A separately profiled autoRun path shows that autoRun does execute: in a fresh runtime it advanced from tick 0 to tick 1 during the 90ms wait window, then stopped cleanly.

So this is not the original B266 "zero ticks" defect. Instead, the current problem is that the release test itself is not a reliable bounded proof of runtime health in this environment. The likely issue is test/lifecycle timing or a long-running resource in the complete scenario, and it must be isolated before autonomy is declared closed.

Required correction:
- instrument p15.5 into bounded phases;
- assert init duration, manual-step duration, flush duration, restored-init duration, autoRun first-tick latency, stop latency;
- fail with the phase name on timeout;
- add a hard overall timeout per phase;
- add a separate minimal `test:autoRun-first-tick`.

## 7. Critical discovery E — audit failure introduced by integrated Claude documents was forensic, not product code

The integrated archive initially failed `audit-forensics` because the external Claude folder introduced a second `README_RU.md` basename:
`README_RU.md` and `docs/external/claude_2026-09-13/README_RU.md`.

Renaming the external index to `CLAUDE_DOCUMENTS_INDEX_RU.md` immediately restored:
`FORENSICS=PASS activeFiles=2266 empty=0 duplicateContent=0 duplicateNames=0 pathMarkers=0 staleMarkers=0`.

Therefore this was packaging/document-integration debt, not a neural/runtime defect. The corrected name should be kept in the next archive.

## 8. Neural reality assessment

The neural branch is not merely text labels. Components such as B269, B280, B293, B294 and B296 contain:
- recurrent state;
- membrane variables;
- spike thresholds;
- refractory dynamics;
- traces/eligibility;
- synaptic weights;
- plasticity updates;
- neuromodulatory factors;
- lesions/ablations.

This is real computational neural modelling at a small engineered scale.

However, it is not yet evidence of a large learned neural organism comparable to biological neural development or a modern end-to-end trained foundation model. Much of the network topology, dimensions and update coefficients are hand-specified, the dimensionality is small, and many outputs are subsequently converted to bounded scalar biases.

The correct statement is: "a real executable neural-inspired substrate with spiking/plastic mechanisms exists and participates in the organism", not "the system has a biologically equivalent artificial brain".

## 9. Causal-learning bottleneck remains

B263 and B264 tests are positive, but their latest reported gains are still small in B263, while B264 can show strong synthetic holdout gains. This difference is important.

B263:
causalGain≈0.00224
behavioralGain≈0.00118

B264:
holdoutGain≈0.477
unseenTaskGain≈0.477

This means the policy learner is capable of strong improvement on its benchmark, while the lower-level causal identification signal remains much weaker. Therefore the benchmark pipeline may be measuring a policy advantage that does not yet imply a correspondingly strong learned causal world model.

Required next benchmark: same-task policy improvement with randomized causal interventions, shuffled action/outcome assignments, environment parameter shifts, and a held-out action family. The policy must lose the advantage when causal inputs are lesioned or permuted.

## 10. Current most important architectural chain

Canonical priority should be:

perception/interoception
→ canonical recurrent state
→ self/world prediction
→ motivation and homeostatic pressure
→ candidate generation
→ single action-ownership arbitration
→ execution in an embodied environment
→ external consequence
→ independent evaluation
→ causal credit
→ plasticity
→ memory/replay
→ self-model and identity update
→ changed future policy

Everything that does not close this loop should be secondary to evidence closure.

## 11. Strict scorecard

Engineering architecture 96/100
Persistence/migration 95/100
Source ownership/architecture hygiene 96/100
Verification methodology 91/100
Neural substrate 70/100
Neural integration 61/100
World-model depth 68/100
Causal identification 55/100
Policy learning 64/100
Executive integration 67/100
Action ownership clarity 45/100
Self-model learning 48/100
Agency learning 50/100
Motivation/development 46/100
Personality learning 52/100
Autobiographical continuity 68/100
Memory/replay 63/100
Structural plasticity 24/100
Closed-loop embodiment 38/100
Long-horizon autonomy 28/100
Physical Android evidence 25/100
Consciousness evidence 2/100
Overall artificial-organism functional maturity 44/100

## 12. Progress scale V2

P0 Existence — code exists.
P1 Execution — code runs.
P2 Integration — canonical runtime invokes it.
P3 Persistence — state survives restart.
P4 Causal intervention — lesion/ablation changes behaviour.
P5 Transfer — effect survives unseen context.
P6 Longitudinal learning — repeated experience changes future behaviour.
P7 Independent replication — another evaluator reproduces the effect.

A component is not considered scientifically "complete" below P5. A personality subsystem is not considered developmentally real below P6.

## 13. Recommended next giant pass

Do NOT add another anatomical subsystem immediately.

Next giant pass should be a `CLOSED_LOOP_LEARNING_PASS` that:
1) fixes B296 core learning permission;
2) removes MicroDream .32 decoration;
3) maps every post-B297 action-score mutation;
4) declares one final action owner;
5) creates an end-to-end experience→learning→future-action benchmark;
6) runs low/high-budget, lesion, restart and unseen-context variants;
7) updates Function Reality and semantic coverage only after behavioural proof exists.

This pass is more valuable than adding B298-B305 without closing the existing learning loop.
