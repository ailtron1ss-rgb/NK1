# WorkPass72 — Core restore integrity and self-improvement boundary (2026-11-03)

**Branch:** `workpass72-core-integrity` (off canonical `workpass70-source`).
**Base SHA:** `57103c645336a22c0a38401c790f6290be2fda94`.
**Scope:** defensive snapshot-restore integrity across the cognitive core, plus a
fail-closed protected-artifact guard on the self-improvement contour.

## Failure modes fixed

Five canonical owners accepted untrusted persisted snapshots through a bare
`{...defaults, ...raw}` merge or `structuredClone(raw)`. A corrupt, hostile or
partially written snapshot could therefore inject `NaN`, out-of-range values,
unknown enum members, inherited properties or throwing accessors straight into
live cognitive state — and in two cases crash the restore path outright.

| Owner | Defect | Fix |
|---|---|---|
| `core/TemporalResolutionGovernor.ts` | `restore()` merged the raw snapshot verbatim. `idleCyclesSincePulse:NaN`, `lastLevel:'bogus'`, `fullEvery:-5`, `savedPulseFraction01:42`, `lastAt:-99` all entered state and broke idle cadence. A hostile throwing getter crashed restore. `decide()` with a non-finite `baseFullEvery` produced `fullEvery:NaN`. | Strict per-field validation against the level/reason enums, non-negative safe-integer counters, unit-interval fractions, own-data-property copying with descriptor inspection, prototype traps fail closed, unknown versions reset. `decide()` now ignores non-finite `baseFullEvery`. |
| `cognition/SelfModelV2.ts` (`SelfModelEngine`) | `restore()` merged raw state, then indexed `selfConsistentAction11` — a hostile getter or `null` map threw `GETTER` / `Cannot read properties of null`. Invalid actions, unbounded error arrays and `Infinity` gate timestamps were copied through. | Full descriptor-safe rebuild of every field, drop-and-clamp of malformed values, unknown actions rejected, list/counter bounds, hostile snapshots reset to defaults. |
| `world/WorldModel.ts` | `restore()` `structuredClone`d belief and transitions verbatim. `observeContext(undefined)` threw `Cannot read properties of undefined (reading 'facts')`; `observeTransition` cloned hostile input unchecked. | Descriptor-safe sanitizer for contexts and transitions, malformed entries dropped, non-finite units coerced to finite values so `beliefSignature()` never emits `NaN`/`Infinity`, malformed observations rejected without wiping the last good belief. |
| `memory/MultiTimescaleMemory.ts` | `restore(rows)` called `add(row)` on each row; a malformed row (`kind` unknown, non-array `evidence`, `NaN` salience, hostile accessor) crashed or corrupted the store. | Per-row `sanitizeMemoryRecord` validation; structurally invalid rows are dropped, valid rows still restore, non-array input resets to empty. |
| `system/CanonicalSelfAgencyAuthority.ts` | `admitSelfModification` gated only on measured gain/risk/identity — it never checked *which artifacts* the change touched, so a self-edit could target its own verifiers or holdout data. | New `verification/ProtectedArtifactRegistry.ts` classifies repository paths and blocks any change set touching verifiers, holdout data, evaluation harnesses, evidence ledgers, the registry itself or verification CI. Wired into the gate; a perfect evidence score cannot override a protected-path violation. |

## New module

`runtime/neuro-kurisu/src/organism/verification/ProtectedArtifactRegistry.ts`

- `canonicalizeRepoPath()` — normalizes separators, resolves `.`/`..`, rejects
  root escapes, control characters, non-strings and oversized input (`null`).
- `classifyProtectedArtifact()` — returns the matched class or `not-protected`;
  unparseable paths fail closed as protected; `includes` matching is
  case-insensitive.
- `guardSelfModification()` — gates a whole change set; any protected path
  blocks it; malformed/oversized/non-array input fails closed.
- Self-referential by design: the registry file, the whole `src/organism/
  verification/` subsystem, every `.github/workflows/` file and the
  `tests/workpass72-*` suite are protected, so a self-edit cannot weaken its own
  checker.

### Rules audited against the live tree

The first draft referenced names that do not exist in the repository. A sweep of
all 2,159 files under `src/`, `tests/` and `.github/workflows/` drove a rewrite:

- `IndependentEvaluator` matched nothing → replaced with the real owners
  (`OutcomeVerificationService`, `SkillRevisionGate`, `LearningTrustBoundary`,
  `ConstitutionalArbiter`, `CriticalFunctionPassport`,
  `CanonicalSelfAgencyAuthority`, `Independent*` evaluators).
- `includes: 'holdout'` missed the capitalized
  `B303HoldoutGeneralizationLedger.ts` → matching is now case-insensitive.
- The guard's own regression suite was not protected → added.
- 123 files now classify as protected; the sample of `src/` matches was manually
  reviewed and contains only genuine verifiers, holdout owners and evidence
  ledgers (no false positives on ordinary modules such as `MemoryOS2`).

### Integration boundary (honest status)

`OrganismCore` calls `admitSelfModification` at the live self-rewrite decision
point (`OrganismCore.ts:4667`). The runtime has **no source-patching pipeline** —
`SandboxedSelfRewriteEngine.propose` is a purely numeric gate with no file
targets — so today the guard enforces the invariant when a change set is
declared and fails closed on malformed declarations. Wiring a real change-set
producer would mean inventing a patch pipeline, which the project rules forbid;
the guard therefore sits at the correct maximal boundary rather than in a
placeholder module.

## Batch series — restore-integrity sweep (WorkPass72)

The five-owner fix above was extended into a batch sweep that closes the same
failure mode across every remaining owner whose `restore()` merged a persisted
snapshot with a bare spread or `structuredClone`. Each batch is a standalone
commit with a fail-before/pass-after regression wired into
`test:workpass72:core-integrity` and the CI trigger paths.

| Batch | Commit | Owners | Test |
|---|---|---|---|
| 5 | `63f8667` | 10 owners (developmental + social + system) | `workpass72-developmental-social-restore-integrity` |
| 6 | `e7713b5` | 8 owners (cognition core + prediction caches) | `workpass72-cognition-core-restore-integrity` |
| 7 | `f9669ef` | 10 owners (body/immune/developmental/world) | `workpass72-body-immune-world-restore-integrity` |
| 8 | `2a3200ad` | `MultimodalPerception`, `B2506NeuralBottleneckEscalator`, `B2507ConsolidationScheduler`, `B2508AdaptiveNeuralComputeGovernor`, `B265IndependentPolicyEvaluator`, `B266HiddenTaskGeneralization`, `BoundedRecurrentStateSubstrate`, `P74IntegratedOrganismKernel`, `ValuePlasticity` | `workpass72-perception-neural-value-restore-integrity` |
| 9 | `467b2dd` | `LifelongDevelopmentSystem`, `AutobiographicalNarrativeEngine`, `ValueEvolutionEngine`, `BehavioralInfluenceLedger` | `workpass72-lifelong-narrative-value-restore-integrity` |
| 10 | `870ba62` | `ExternalEvidenceTrustEngine`, `LongHorizonPredictionBenchmark`, `P77RealityExperimentOS`, `P82RealityProgressController` | `workpass72-evidence-horizon-progress-restore-integrity` |
| 11 | `7733e92` | `P62MemoryFabric`, `P68GoalEcology`, `P54LongHorizonEvidence`, `P59MemoryOperatingSystem` | `workpass72-fabric-goal-evidence-memos-restore-integrity` |
| 12 | `3583d3f` | `P65EpistemicLedger`, `P67AutonomousGoalGenesis`, `MicroDreamEngine`, `AutonomousLearningMemoryGovernor` | `workpass72-epistemic-goalgen-dream-learningmem-restore-integrity` |
| 13 | (this commit) | `P56IntegratedDevelopmentalMind`, `P63DevelopmentalOperatingSystem`, `IntegratedLifeTrajectoryEngine`, `VerifiedAutonomousLifeEngine` | `workpass72-developmental-control-lifetrajectory-autolife-restore-integrity` |
| 14 | (this commit) | `DeviceEvidenceLedger`, `PerceptualEvidenceCompiler`, `P37EmbodiedSensoriumEngine` | `workpass72-device-perceptual-embodied-restore-integrity` |
| 15 | (this commit) | `P69ConstitutionalArbiter`, `P61IntegratedMindKernel`, `P58CognitiveKernel`, `PerceptualEpistemicGraph`, `NeuroSymbolicConceptCompiler`, `B2518PersistentSelfWorldModel`, `NeuromodulationSystem` | `workpass72-cognition-kernels-epistemic-concept-selfworld-neuromod-restore-integrity` |
| 16 | (this commit) | `B2513FutureSelfProjectionField`, `B2514MemoryNeedPrioritizer`, `B2517SelfAuthoredRuleCompiler`, `B2519LongHorizonCounterfactualPlanner`, `B2520SensorimotorImagination`, `B2521LearnedGenerativeOrganismLoop` | `workpass72-selfworld-projection-memoryneed-rules-planner-imagination-generative-restore-integrity` |
| 17 | (this commit) | `B2524NonparametricWorldExperienceMemory`, `B2526MultiscaleCausalRegimeGraph`, `B2527FactorialAblationHarness`, `B2529PolicyInformationGainController`, `B2530AutonomousExperimentScheduler`, `B268CausalSelfExperimentLab` | `workpass72-experiencemem-causalregime-ablation-policyinfo-experimentsched-b268-restore-integrity` |
| 18 | (this commit) | `DeviceAwareNeuralScheduler`, `CrossLayerAdaptiveArbiter`, `ClosedLoopEvidenceLedger`, `P2703GlobalWorkspaceConvergence`, `ActiveInformationGainController`, `HippocampalFormationCircuit` | `workpass72-devicesched-arbiter-evidence-workspace-aigc-hippocampal-restore-integrity` |
| 19 | (this commit) | `B2503ActionablePredictiveField`, `B275NeuralCompositionalPolicy`, `B276LatentActionProgramSynthesizer`, `B281PredictiveInterAreaMessaging`, `B282PredictiveGlobalWorkspace`, `B283CompetingPredictiveHypotheses` | `workpass72-predictivefield-compositionalprogram-interarea-workspace-competinghyp-restore-integrity` |
| 20 | (this commit) | `ActivePerceptionExecutor`, `AdaptiveComputeGovernor`, `HypothalamicHomeostasisController`, `InteroceptiveStateEstimator`, `AdvancedResilienceEngine`, `CausalDevelopmentLoop` | `workpass72-activeperception-computegovernor-hypothalamic-interoceptive-resilience-causaldeve-restore-integrity` |
| 21 | (this commit) | `BrainstemArousalSleepScheduler`, `DualTimescaleMemoryBridge`, `DreamCounterfactualLaboratory`, `LongHorizonAutonomyController`, `P49TemporalLifeEngine`, `P55DevelopmentalForkUniverse` | `workpass72-brainstem-dualtimescale-dream-longhorizon-p49-p55-restore-integrity` |
| 22 | (this commit) | `B286SelfConflictContinuityCore`, `CentralSubjectDynamics`, `GoalIdentitySkillModulator`, `TaskAgnosticTransferRouter`, `AutonomousPersonhoodKernel`, `AutonomousValueFormationEngine` | `workpass72-b286-centralsubject-gism-tatr-personhood-valueformation-restore-integrity` |
| 23 | (this commit) | `P50CausalSelfWorldEngine`, `P51GroundedCausalWorkspace`, `P44EmbodiedPredictiveSelfWorld`, `P52CounterfactualDevelopmentMind`, `P83PersistentRealityModel`, `GroundedWorldState` | `workpass72-p50-p51-p44-p52-p83-groundedworld-restore-integrity` |
| 24 | (this commit) | `ParametricPolicyLearner`, `PersonalCurriculumEngine`, `DevelopmentalPortfolioEngine`, `MetaDevelopmentalStrategyEngine`, `LongitudinalSubjectTransferBattery`, `CognitiveOrganismContinuityEngine` | `workpass72-parametricpolicy-curriculum-portfolio-metadev-longitudinal-cogcontinuity-restore-integrity` |
| 25 | (this commit) | `B267AdaptiveRegimeController`, `P2734SelfOptimizingContinualController`, `SelfOptimizingAutobiographicalMemory`, `NeuralTemporalSubstrate`, `B278NeuralPrimitiveGenesis`, `P2774ModelTimeReplayConsolidator` | `workpass72-b267-p2734-sam-nts-b278-p2774-restore-integrity` |
| 26 | (this commit) | `B2511ActiveEpistemicExperimentController`, `B2512EpistemicSemanticAutobiographicalConsolidator`, `B2509EmbodiedHomeostaticActionField`, `P2853SlowMemoryConsolidationController`, `HippocampalMemorySubstrate`, `ExperienceContinuumFabric` | `workpass72-b2511-b2512-hms-p2853-ecf-b2509-restore-integrity` |
| 27 | (this commit) | `B292CognitiveStateBus`, `P60IdentityGuardian`, `OrganismResourceAllocator`, `AdaptiveReplayGovernor`, `ActionOwnershipGraph`, `SelfDirectedLifeOrchestrator` | `workpass72-b292-p60-ora-arg-aog-sdl-restore-integrity` |
| 28 | (this commit) | `LifeCourseNavigator`, `PersonalWorldlineEngine`, `DevelopmentalExecutiveEngine`, `P39ContinuousArtificialLifeEngine`, `P38AutonomousCausalResearchEngine`, `ResearchGradeOrganismEngine` | `workpass72-lcn-pwl-dee-p39-p38-rg-restore-integrity` |
| 29 | (this commit) | `B280MultiAreaNeuralCircuit`, `ExternalGroundingAdaptiveController`, `RiskAwareRecoveryController`, `B273AutonomousGoalLifecycle`, `B277NeuralOperatorGenesis`, `B279NeuralAttractorAssemblies` | `workpass72-b280-egac-rarc-b273-b277-b279-restore-integrity` |
| 30 | (this commit) | `B288SocialPredictiveSelfOtherBrain`, `B287RelationshipValueDevelopmentCore`, `B284NeuralAutobiographicalIdentityCore`, `SocialPredictiveNeuralSubstrate`, `PredictiveSelfAgencySubstrate`, `P2852OfflineConsolidationController` | `workpass72-b288-b287-b284-sps-psa-p2852-restore-integrity` |
| 31 | (this commit) | `B269SpikingPlasticNeuralSubstrate`, `CentralBrainSubstrate`, `B270NeuralGerminalOrganism`, `B261UnifiedWorldModel`, `B262MultiTimescaleWorldModel`, `B264CausalPolicyLearning` | `workpass72-b269-centralbrain-b270-b261-b262-b264-restore-integrity` |
| 32 | (this commit) | `P42UnifiedEmbodiedExperienceEngine`, `P43EmbodiedImageryWorkspace`, `P48FunctionalAwarenessCore`, `P41NativePerceptionEngine`, `P66InteroceptiveHomeostasis`, `P64IntegratedOrganismDynamics`, `P2750UnifiedCausalWorldLoop` | `workpass72-p42-p43-p48-p41-p66-p64-p2750-restore-integrity` |
| 33 | (this commit) | `P71SelfConsistencyModel`, `NeuroDigitalFusionKernel`, `OpenEndedSkillAcquisitionController`, `UnifiedDevelopmentalCompiler`, `AutonomousResourceToolLifeController`, `SelfModelValidationEngine`, `NeuralMorphogeneticConstraintSolver`, `NeuralMorphogenesisEngine`, `NeuralDigitalCoevolutionController`, `NeuralEcologyRouter`, `CounterfactualWorldCompiler`, `P73CapabilityEvolutionLedger`, `FailureRecoveryCertification`, `LiveSelfImprovementSupervisor`, `P57RealityFirstObservatory`, `NeuralPhaseTransitionDetector`, `P72LifeCycleOrchestrator`, `SelfGeneratedCurriculumEngine` (18) | `workpass72-p71-ndf-oes-udc-artl-smv-nmcs-nme-ndcc-ner-cwc-p73-frc-lsis-p57-nptd-p72-sgce-restore-integrity` |

Every batch uses the same idiom — a descriptor-safe `read(k)` accessor plus
`finN`/`cnt`/`clamp` helpers and per-owner `sanitize*` builders — so a corrupt
snapshot drops malformed records, floors counters, clamps unit-interval ratios
and whitelists enums instead of injecting `NaN`, out-of-range values or unknown
members into live state. `test:workpass72:core-integrity` runs all thirty-one
workpass72 suites in one step (exit 0, 21× `=PASS`).

## Evidence

- Batch series (5–13) re-verified after batch 13: `npm run
  test:workpass72:core-integrity` → exit 0, 41 suites `=PASS`; `npm run
  typecheck` → `TYPECHECK=PASS mode=tsc compiler=runtime-lock`.
- Consumer regressions for the batch 10/11 owners re-run green:
  `big-pass-37-spine`, `big-pass-38-autonomous-spine`,
  `big-pass-380-evidence-and-retired-receipts`, `big-pass-40-cognitive-spine`,
  `big-pass-49-subsystem-extraction`, `evidence-hash-unification-workpass39`,
  `big-pass-180-lifecycle-function-closure`, `big-pass-52-memory-fabric`,
  `p54-long-horizon-evidence`, `p58-p60-integrated-kernel`,
  `p66-p68-integration`, `memory-*-workpass*` retrieval suites.
- Every new batch test was confirmed fail-before / pass-after by stashing the
  edited source files and re-running the same test.
- `npm run typecheck` → `TYPECHECK=PASS mode=node-strip-syntax-only files=658`.
- New regressions (fail before the fix, pass after — verified by stashing
  `runtime/neuro-kurisu/src`):
  - `tests/workpass72-temporal-resolution-restore-integrity.mjs`
  - `tests/workpass72-self-model-restore-integrity.mjs`
  - `tests/workpass72-world-memory-restore-integrity.mjs`
  - `tests/workpass72-protected-artifact-guard.mjs`
- Owning regressions re-run green: `big-pass-75-temporal-resolution`,
  `canonical-self-agency-authority`, `p32-causal-self-model`, `p10-world-model`,
  `self-model-evidence-write-gate-workpass315`.
- Broad sweep of the 56 tests that reference the changed modules: 43 pass; the
  13 failures are **pre-existing** on the pristine base SHA (verified by stashing
  all source changes and re-running — identical failures, caused by unrelated
  `AdaptivePolicyEngine`/`MemoryStateStore`/worker-fixture issues).
- CI: `.github/workflows/nk1-core-restore-integrity.yml`.

## Status labels

- **IMPLEMENTED + CONNECTED:** all five fixes are wired into the live restore
  path and the `admitSelfModification` gate.
- **TESTED:** unit-level behavioural regressions (above).
- **NOT independently validated:** no external holdout, device E2E or soak run.
  The protected-artifact registry is a policy guard, not a sandbox; it constrains
  declared change sets, not arbitrary filesystem writes.

## Blockers / next

- 13 pre-existing test failures outside this pass's scope (`AdaptivePolicyEngine`
  temporal credit, `MemoryStateStore` construction, worker-thread fixtures) —
  should be triaged as their own pass.
- The registry's rule list is a starting canonical set; holdout/verifier paths
  beyond the named prefixes still need an explicit inventory before promotion.
- Release ZIP and license review gate remain unchanged and blocking.
