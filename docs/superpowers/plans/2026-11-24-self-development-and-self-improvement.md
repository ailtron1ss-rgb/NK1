# Саморазвитие и самоулучшение — Implementation Plan

> **For agentic workers:** Execute task-by-task in the existing aspect branch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Собрать безопасный, измеримый и восстанавливаемый контур саморазвития NeuroCore от внутренней диагностики до independently verified improvement и rollback.

**Architecture:** Сохранить существующих владельцев P67/P68, P23/P26, SelfAuthorship, P32CausalSelfModel, SelfModelV2, TheInventionLoop, CanonicalSelfAgencyAuthority и ActionGateway. Связать их versioned decision/evidence/receipt contracts; не вводить параллельную систему целей, памяти, identity или execution receipts.

**Tech Stack:** TypeScript, Node.js `--experimental-strip-types`, npm scripts, GitHub Actions, текущие runtime test harnesses, signed host receipts и immutable holdout evidence.

**Spec:** `docs/engineering/NK1_SELF_DEVELOPMENT_MAP_RU_2026-11-24.md`

## Global Constraints

- Canonical integration base for this plan: `workpass70-source @ 87c9ed9034e09ca9fb83fd676ac52bb46434c4fe`.
- Продолжать существующие aspect branches/PRs; не создавать version-stacked копии.
- Scope ограничен саморазвитием и связующими контрактами; unrelated memory/voice/avatar/UI work не затрагивать.
- SelfAuthorship не начисляет credit за selection/intent; только за точный matched, internally originated, verified outcome.
- Host receipt/postcondition — источник истины для внешнего исполнения; ambiguous receipts не исполнять повторно.
- Holdout недоступен candidate generator/optimizer; approval keys/evaluators/identity anchors protected.
- Любое изменение должно иметь сначала regression test, доказанно падающий на pre-fix checkpoint, затем focused pass и runtime integration checks.
- Не менять опубликованный Release ZIP до exact-head verification и отдельного решения о выпуске.

## Review Focus

- Дубликат или неверный `decisionId`: не должен получить credit.
- Внешняя цель/запрос пользователя: не должна стать intrinsic commitment.
- Неоднозначный receipt, crash или повторная доставка: не должна повторить side effect/credit.
- Holdout leakage или self-edit evaluator/trust root: admission должен отказать.
- Отрицательный downstream gain при положительном proxy score: кандидат должен быть rejected.

---

### Task 1: Verified SelfAuthorship settlement

**Files:**
- Modify: `runtime/neuro-kurisu/src/organism/cognition/SelfAuthorship.ts`
- Modify: `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts`
- Modify: `runtime/neuro-kurisu/src/organism/system/CognitiveEventFabric.ts`
- Test: `runtime/neuro-kurisu/tests/self-authorship-verified-execution-workpass70.mjs`
- Test: `runtime/neuro-kurisu/tests/self-authorship-spineonly-runtime-workpass71.mjs`
- Test: `runtime/neuro-kurisu/tests/action-receipt-selfauthorship-recovery-workpass72.mjs`
- Test: `runtime/neuro-kurisu/tests/cef-decision-reference-workpass72.mjs`

**Interfaces:**
- `SelfAuthorshipEngine.observeDecision({decisionId, action, autonomous, externalRequest, goalTitle, reason})` records bounded pending intent only.
- `SelfAuthorshipEngine.observeOutcome({decisionId, executed, success, surprise, selectedGoal})` consumes only the exact pending decision, once.
- Core finalizer settles only a real selected trace after host-attested external postcondition; persisted facet shares the action receipt snapshot boundary.
- CEF stores sanitized decision correlation even when no matching CEF parent event exists; `decisionLinked=false` means no parent edge.

- [ ] Add regression tests for selection-without-credit, unrelated/duplicate decision IDs, external goals, restore, ambiguous receipt, process restart and idempotent replay.
- [ ] Verify each regression fails on its explicit test-only pre-fix checkpoint.
- [ ] Implement pending ledger with a finite limit and expiry; preserve backwards restore from legacy snapshots without pendingDecisions.
- [ ] Wire full, spine-only and tool-execution paths; ensure feedback is attributed to the prior decision, not the next newly selected trace.
- [ ] Run focused tests, ActionGateway archive/restart/crash tests, outcome-verification tests and runtime typecheck.
- [ ] Require exact-head GitHub Actions success before merge.

### Task 2: Structural self-analysis and self-modification boundary

**Files:**
- Integrate selectively from existing PR #698: `runtime/neuro-kurisu/src/organism/analysis/SourceGraph.ts`, `SelfModificationGuard.ts`, `DangerModel.ts`, `SelfImprovementCandidatePool.ts`.
- Modify: current `runtime/neuro-kurisu/src/organism/system/CanonicalSelfAgencyAuthority.ts` and actual rewrite proposal path only after mapping caller chain.
- Test: `runtime/neuro-kurisu/tests/self-analysis-substrate.mjs`, `self-modification-adversarial.mjs`.

**Interfaces:**
- SourceGraph exposes deterministic source nodes/import edges with extracted vs inferred provenance and reverse-impact query.
- SelfModificationGuard rejects protected trust roots, evaluator/gate/holdout/approval/identity/workflow owners.
- Candidate admission consumes exact base SHA, changed file/line manifest, host-pinned signing key and immutable patch bytes; it cannot trust candidate-supplied keys or base SHA.

- [ ] Add a live-caller regression proving the guard actually blocks a protected-path proposal (not just a unit test of the guard).
- [ ] Rebase the existing PR #698 selectively against current source; drop unrelated stale files and duplicate proxy guard implementation.
- [ ] Connect the guard to the real candidate admission/rewrite proposal entry point, fail-closed when source graph/protected-path analysis is unavailable.
- [ ] Pair the existing 5+ independent proxy/downstream evidence with the host-owned signed patch receipt admission path.
- [ ] Verify benign permitted patch remains admissible, protected-file patch is refused, missing key/old SHA/malformed receipt are refused, rollback remains possible.

### Task 3: One promotion contract across P23/P26 and TheInventionLoop

**Files:**
- Existing: `P23ReflectiveCandidatePopulationSearch.ts`, `P23CandidateParetoArchive.ts`, `ValidationOnlySkillCandidateEvaluator.ts`, `P23LearningEngine.ts`, `TheInventionLoop.ts`, `CanonicalSelfAgencyAuthority.ts`.
- Tests: existing `p23-*`, `p26-*`, `invention-loop-*`, self-agency paired evidence tests.

**Interfaces:**
- Candidate record: immutable candidate fingerprint, source base SHA, experiment protocol ID, bounded generation budget.
- Validation evaluator: validation-only reports; never receives holdout outcomes.
- Independent verifier: distinct verifier identity/environment/test fingerprint; signed outcome artifacts.
- Promotion authority: consumes validated paired downstream observations, safety report, rollback-ready evidence and host-owned patch receipt; emits one admission decision.

- [ ] Trace every live path from generated candidate to validation, holdout, promotion, apply, postcondition and rollback.
- [ ] Remove any direct path that bypasses CanonicalSelfAgencyAuthority or evaluator.
- [ ] Test candidate generator cannot read holdout labels or alter verifier/approval files.
- [ ] Test duplicate candidate, repeated seed, evaluator timeout, negative downstream effect, and proxy inversion.
- [ ] Require same contract for skill updates, behavioral policy changes and source patches, with separate capability levels.

### Task 4: Separate plasticity from architecture morphogenesis

**Files:**
- Existing: `P53DevelopmentalSelfModificationLab.ts`, `AdaptiveSynapticMatrix.ts`, `NeuralMorphogenesisEngine.ts`, `DevelopmentalGenomeExperimentBridge.ts`.
- Existing branch to inspect selectively: `aspect/developmental-genome-20261117` / PR #902 and related morphogenesis PRs.

**Interfaces:**
- Behavioural parameter experiment: bounded parameter set, immutable baseline, deterministic shadow eval, safety/invariant check, reversible patch and outcome ledger.
- Model/adapter fine-tuning: training corpus provenance, LoRA/QLoRA artifact hash, external signer, registry admission and holdout transfer evaluation.
- Architecture edit: separate approval class with source-graph impact analysis, host-owned signed patch receipt, exact current base SHA, isolated test and rollback snapshot.

- [ ] Inventory actual write paths for policy weights, synaptic matrix, model adapter and executable source.
- [ ] Ensure each write path is routed through correct admission authority and its test suite.
- [ ] Prove rollback returns exact prior state after failed holdout or invariant regression.
- [ ] Keep architecture changes disabled when trusted admission evidence is missing.

### Task 5: End-to-end continuity, performance and measurement

**Files:**
- Existing Core persistence, state migration, P68 ecology, causal self-model and test harnesses.
- Add exact-head evidence under `docs/evidence/` only when generated by the real test/measurement script.

- [ ] Test bounded pending goals, stale-intent expiry, duplicate outcomes, migration and restore.
- [ ] Run deterministic multi-seed validation, held-out transfer, negative controls and rollback tests.
- [ ] Measure candidate generation/evaluation budget, source graph runtime cost, decision→receipt latency and recovery latency.
- [ ] Run restart/soak; assert user stop, resource budget and no unverified background action.
- [ ] Update scorecard only from exact-head test artifacts; separately verify latest Release ZIP before claiming released.

---

## Stage exit criteria

Task 1 closes only when exact-head CI is green for all 4 focused regressions, both Core modes, ActionGateway restart reconciliation, CEF replay and runtime typecheck. Tasks 2–5 remain separate reviewable milestones. A green unit suite alone does not certify the full self-improvement pipeline or real-world benefit.
