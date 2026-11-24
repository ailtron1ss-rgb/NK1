# BIG PASS 221 — INTEROCEPTION + AUTONOMOUS ARTIFICIAL PERSON
- Добавлен `InteroceptiveStateEstimator`: predictive internal-state estimation, uncertainty, conflict and control pressure.
- Добавлен `AutonomousPersonhoodKernel`: persistent self-authored agenda, initiative, self-preservation/exploration/learning/reflection motives, consequence ownership and autonomy score.
- Integrated into `OrganismCore`; autonomous internal decisions are causally biasing action selection while remaining bounded by identity/resource/safety gates.
- Added durable migration persistence through restart.
- B208–B221 regression PASS; deep audits PASS; no claim of subjective consciousness or legal personhood.

# BIG PASS 220 — Hypothalamic Homeostasis

Добавлен функциональный allostatic/homeostatic контур `HypothalamicHomeostasisController`: anticipatory demand prediction, energy/thermal protection, compute/plasticity caps, recovery/restorative priority и persistent state. Контур причинно интегрирован с B219 brainstem arousal/sleep scheduler и CognitiveKernelCoordinator.


## BIG PASS 219 — Brainstem / Arousal / Sleep-Wake (2026-09-11)

Добавлен `BrainstemArousalSleepScheduler`: reversible state gating для compute/plasticity/consolidation с режимами active/wake/recovery/sleep, persistence и интеграцией в CognitiveKernelCoordinator. Причинно подтверждено: active compute 1.00 против sleep 0.18; plasticity 0.92 против 0.14; consolidation quota 0.08 против 0.6794. Полная регрессия B208-B218 сохранена.
## BIG PASS 218 — CEREBELLAR × BASAL GANGLIA MOTOR LEARNING
- Добавлен persistent motor-learning loop, объединяющий forward prediction error, reinforcement и skill credit.
- Добавлен sparse/event-driven пластический update с reversible lesion test.
- Полная регрессия B208–B218 и независимый archive round-trip.


## BIG PASS 217 — BASAL GANGLIA → CONSOLIDATION
- Causal reinforcement bridge into memory consolidation.
- Anti-overconsolidation scoring for redundant/low-information memories.
- Outcome feedback and Core restart persistence.
- Full regression chain B208–B217.


## B215 — hippocampal formation closure
- Добавлен `HippocampalFormationCircuit`: sparse separation → associative completion → prediction/comparison → output.
- Введены причинные DG/CA3 ablations, replay state и persistent restore.
- B213/B214 regressions остаются PASS.

## BIG PASS 214 — Thalamocortical closure

Added bounded reciprocal cortical->thalamic routing feedback, channel-wise learning, persistence and verified causal/regression tests.
# Neuro-Kurisu 35.6.1

Patch release after full functional sweep.

- Fixed P39/P40/P41 server API gaps.
- Fixed /api/organism/inspect runtime crash.
- Fixed procedural skill promotion criteria.
- Hardened CognitiveExecutionPlanner against minimal legacy frames.
- Aligned stale historical migration/version assertions with canonical contracts.
- Revalidated P16, P48, P59, P61, P69–P73, P97, P100–P103, P109–P113 and later regression layers.
- Added full function-liveness inventory and acceptance documentation.
- Synchronised release metadata to 35.6.1.
- No claim of physical Android or multi-week soak-test PASS.

## BIG PASS 174 — 10.09.2026

Усилен World Model prediction lifecycle: prediction tickets стали частью сохраняемого ensemble state, получили уникальные IDs, bounded TTL/queue и точное action→outcome resolution. Убран post-outcome prediction path из runtime calibration. Улучшены parameterized function probes и оптимизирован semantic/liveness audit. Добавлены строгий function-reality report, BIG PASS 174 regression evidence и повторная сверка первого большого анализа. Functional long-horizon проход остаётся зелёным, но scaling profile имеет WARNING по latency/heap growth.

## BIG PASS 176 — Long-Horizon Life / Lifecycle Verification

Исправлен replay по фактическому `stateAfter`, добавлена bounded durable persistence для operational micro-cycles, lifecycle closure для Core/Facade/Kernel/Memory Fabric, обновлён function reality ledger. Strict VERIFIED вырос до 24/2485. Long-horizon 250/500 проходит, latency scaling существенно улучшен; heap growth остаётся открытым performance issue.

## BIG PASS 179 — Consciousness Research Battery / Evidence Integrity
- P31 state version 3: persisted wall-clock continuity, recent moment history, reversible lesion/rescue.
- ConsciousnessEvidenceLedger version 4: bounded recent observation-key history prevents replay inflation.
- Core external evidence keys include unique decision identity.
- Consciousness battery: PASS; BIG PASS 169–179 regression: 15/15 PASS.
- Function reality: 38 VERIFIED / 590 INTEGRATION_ONLY / 224 UNSAFE_TO_AUTO_RUN / 1641 UNVERIFIED.
- Parameterized safe probe: 497/509 PASS, 0 FAIL.

## BIG PASS 181 — Function Reality Closure 2.0
- Canonical snapshot/restore closure: 196/196 PASS with JSON transport and idempotent restore.
- Strict function reality ledger: 300 VERIFIED / 454 INTEGRATION_ONLY / 224 UNSAFE_TO_AUTO_RUN / 1516 UNVERIFIED.
- Parameterized probe: 497/509 PASS, 0 failures, 0 input synthesis gaps, 12 lifecycle-only cases.
- 24/24 BIG PASS 169→181 regression validation passed independently.
- Fixed restore-state timestamp/authorship preservation defects found by closure testing.


## BIG PASS 222 — Long-Horizon Autonomy

Добавлен `LongHorizonAutonomyController`: долговременные самонаправленные планы, декомпозиция на шаги, execution accounting, outcome verification, bounded plan revision и persistence через `StateMigrations`. Проверено 5/5 шагов в интеграционном тесте без внешней команды; 2 автономных плана создано и восстановлено после restart.
## BIG PASS 223 — Autonomous Resource & Tool Life
- Добавлен `AutonomousResourceToolLifeController` для самостоятельного выбора безопасных capability и управления ресурсным envelope.
- Автономный tool-use ограничен non-destructive tools, budget gate, cooldown и self-stop при перегрузке.
- B223 интегрирован в `OrganismCore`, persistence migration и `ActionGateway`.
- B208–B223 regression: PASS; B223: 2/2 autonomous tool executions successful, 0 failures, state restored after restart.

## BIG PASS 224 — Autonomous Runtime Life
- Добавлен `AutonomousRuntimeLifeController`: непрерывный ambient runtime, self-start, idle-gap, temporal persistence, environmental agency и self-preservation.
- Добавлен `OrganismCore.autonomousHeartbeat()` для контролируемого продолжения внутреннего цикла без внешнего запроса.
- Исправлено определение `CognitiveFrame.externalInput`: embodiment telemetry не является внешним стимулом, поэтому автономность теперь измеряется корректно в idle-периодах.
- Persistence/restart сохраняют runtime autonomy state.
- B224 functional gate: PASS.

## BIG PASS 229–233 — Open-Ended Autonomous Personhood

Большое расширение самостоятельности организма:
- B229: AutonomousValueFormationEngine — evidence-gated value revision и защита от бесконтрольного дрейфа;
- B230: OpenEndedSkillAcquisitionController — самостоятельное обнаружение skill gap, практика и mastery;
- B231: AutobiographicalLifeNarrativeEngine — длительная автобиографическая continuity и рефлексия;
- B232: AutonomousSocialInitiativeEngine — самостоятельные социальные инициативы без внешнего запроса;
- B233: LiveSelfImprovementSupervisor — live continue/redirect/abort и distillation валидированных уроков.

Все пять систем подключены к OrganismCore, persistence/state migration и action arbitration; отдельный тест подтверждает restart-перенос состояния.
