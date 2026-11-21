# NeuroCore Prototype 0.1 Implementation Plan

> **For agentic workers:** Execute this plan task by task. Each task is an independent review gate. Keep every task on an aspect-specific branch and open a Draft PR against `workpass70-source` until its exact-head checks and integration review pass.

**Goal:** Deliver a reproducible NeuroCore 0.1 prototype that boots as one persistent cognitive runtime, supports grounded bilingual interaction, retains and retrieves user-approved memories, demonstrates permission-bounded initiative, and connects speech and avatar embodiment with honest device-level readiness evidence.

**Architecture:** Reuse the canonical `runtime/neuro-kurisu` OrganismCore, cognitive-cycle, MemoryOS2/MemoryFabric, ActionGateway, and existing embodiment/audio adapters. Do not create parallel schedulers, memory stores, executors, or identity systems. Integrate through existing OrganismCore state and ActionGateway permission/idempotency/undo contracts; keep evaluation evidence separate from production memory and synthetic fixtures separate from independent holdout data.

**Tech Stack:** Node.js 24.x (pinned by `.nvmrc`), npm >=10.8.0, Python 3.11.x (pinned by `.python-version`), TypeScript/ES modules, existing runtime test harnesses, GitHub Actions, existing app/renderer and voice adapters.

## Global Constraints

- Canonical repository: `ailtron1ss-rgb/NK1`.
- Canonical implementation base at plan creation: `workpass70-source` @ `5ebec445ce729a4e372f273080138aa3cbeab778`. Re-read the live ref before every implementation task; do not assume this SHA remains HEAD.
- `main` remains release/metadata-only. Do not target `main` for runtime implementation.
- The latest published stable Release ZIP is dated 2026-10-19. November source changes are not released unless the exact bytes are verified in a later published artifact.
- Preserve all existing branches, PRs, archives, and source lineage. Do not bulk-merge, force-push, delete, or rebase long-lived branches as part of this plan.
- Never create a second owner for OrganismCore, MemoryOS2/MemoryFabric, ActionGateway, initiative scheduling, or embodiment state.
- Do not infer successful learning from synthetic benchmarks. Confirmatory retrieval claims require an immutable independent RU/EN holdout and at least five paired seeds; report zero or negative uplift honestly.
- No destructive or external action may bypass existing approval, permission, idempotency, postcondition, or undo-first boundaries.
- Human legal/asset review remains mandatory. `contracts/RELEASE_LICENSE_REVIEW.json` records pending review and `redistributionApproved=false`; do not publish or redistribute a new ZIP until authorized.
- Do not claim consciousness. Measure behavioral continuity, initiative, memory utility, adaptation, reliability, and latency.
- Separate status labels: IMPLEMENTED, CONNECTED, TESTED, DEVICE-VERIFIED, INDEPENDENTLY-PROVEN, RELEASED.

---

## Repository Evidence and Current Baseline

Live refresh — 2026-11-21, after the latest source integrations

- Canonical source branch: `workpass70-source` @ `ef3564c519e9f39f6d6e95834a2fcde202cdc8fa`.
- Repository default branch: `main` @ `06e01cdd0a8e60ed70991f22e842887f544d1ebf`; runtime implementation remains on `workpass70-source`.
- Runtime package version at this checkpoint: `35.90.0`. Toolchain: Node.js 24.x, npm >=10.8.0, Python 3.11.x.
- PR #1075 merged matched-baseline B261 holdout integrity; exact-head checks 9/9 passed before merge.
- PR #1078 merged an early-startup health readiness probe guard; exact-head workflows 3/3 passed before merge.
- PR #1081 merged a selective Mechanism Serendipity integration; exact-head workflows 28/28 passed before merge, including runtime typecheck, module dependency audit, clean-startup, unified-organism, and core regression. Discovery is bounded and read-only; generated candidates remain verify-only. Scientific evidence credit requires a locked five-paired-seed protocol and an independent holdout receipt; no empirical mechanism gain is claimed.
- PR #1076 merged a synthetic RU/EN persistent-memory lifecycle E2E; exact-head workflows 16/16 passed before merge. It proves the tested fixture path for reciprocal cross-language retrieval, file-backed restore, correction, explicit forget, provenance and abstention; it does not establish independent bilingual retrieval uplift.
- The latest exact-head CI results above belong to their pre-merge PR heads. No post-merge workflow runs have yet been observed on the current merge SHA `ef3564c519e9f39f6d6e95834a2fcde202cdc8fa`.
- Root/package scripts and the existing runtime harness remain the source of truth; do not add parallel memory stores, schedulers, executors, or identity systems.
- The latest GitHub Release remains tag `Neuro`, asset `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, metadata digest `sha256:c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`. Archive bytes were not independently downloaded and hashed in this pass; extraction manifest and source/ZIP parity remain **UNVERIFIED**.
- License review remains pending: root license is `NOASSERTION`, runtime is private/all-rights-reserved, and redistribution approval is false. Do not publish a new ZIP before human review and exact-source archive validation.

### Prototype workstream status at this refresh

| Workstream | Current evidence | Remaining gate |
|---|---|---|
| Launch/runtime | Clean install/startup and 30-tick organism smoke pass exact-head CI; invalid early health response is retryable | Configured real LLM, full user-turn/restart acceptance, target-host soak and recovery evidence |
| Persistent bilingual memory | Canonical MemoryOS2 synthetic RU/EN lifecycle E2E merged and tested | Immutable independent RU/EN holdout, at least five paired seeds and positive confidence-supported uplift |
| Mechanism discovery | Bounded read-only cross-domain discovery, canonical persistence and verify-only queue integrated; paired-holdout evidence receipt gate tested | Empirical validation that discovered hypotheses are causal/useful and improve a pre-registered outcome |
| Endogenous autonomy | Current cognitive/runtime and ActionGateway regression gates pass on tested PR heads | 24-hour host telemetry, useful initiative rate, undo/recovery outcomes and false-positive analysis |
| Speech/avatar | Existing 2D/3D, affect, voice and browser contracts have CI coverage | Real browser/WebGL visual E2E, Android/Termux interruption, audio-viseme drift measurement and device soak |
| Release/legal | Release metadata/readiness contracts exist | Human license/asset decisions, independent ZIP hash/extraction manifest and exact-SHA source parity |

Status labels remain separate: IMPLEMENTED, CONNECTED, TESTED, DEVICE-VERIFIED, INDEPENDENTLY-PROVEN and RELEASED. A green CI run must not be promoted into device, independent-evaluation or release evidence.

## Task 1: Establish a reproducible prototype launch and health contract

**Files:**
- Inspect: `package.json`
- Inspect: `runtime/neuro-kurisu/package.json`
- Inspect: `runtime/neuro-kurisu/src/server/server.mjs`
- Inspect: `runtime/neuro-kurisu/tests/organism-smoke.mjs`
- Inspect: `runtime/neuro-kurisu/tests/server-smoke.mjs`
- Inspect: `runtime/neuro-kurisu/tests/restart-persistence.mjs`
- Proposed create only if no equivalent contract exists: `runtime/neuro-kurisu/tests/prototype-0-1-launch-contract.mjs`

**Interfaces:**
- Consumes: existing server entry point, OrganismCore initialization, configured state store, current health/diagnostic surface.
- Produces: a documented launch/health contract and deterministic smoke assertions; no new runtime owner.

- [ ] **Step 1: Add focused failing coverage**
  
  Test clean initialization, one bounded user turn, health status, orderly shutdown, persisted state, and restart restoration. Assert that startup failure is surfaced as failure rather than a healthy status; assert that a missing optional model provider is reported as degraded capability, not fabricated successful inference.

- [ ] **Step 2: Verify the relevant failure**
  
  Run: `npm --prefix runtime/neuro-kurisu run test:prototype-0-1-launch-contract` (only after adding the script; if an equivalent existing test is found, run that exact existing script instead).
  
  Expected: the new contract test fails on the specific missing behavior before implementation.

- [ ] **Step 3: Implement the minimum behavior**
  
  Reuse existing server/core lifecycle and health surfaces. Add no parallel server, scheduler, or state store. Document required environment/configuration and distinguish ready, degraded, and failed states using existing project conventions.

- [ ] **Step 4: Verify the focused pass**
  
  Run the focused launch-contract test and `npm --prefix runtime/neuro-kurisu run test:smoke`.
  
  Expected: all launch, shutdown, health, and persistence assertions pass.

- [ ] **Step 5: Run integration checks**
  
  Run: `npm run test:runtime:smoke`, `npm run test:integration`, and `npm run typecheck`.
  
  Expected: root smoke, integration verifier, and app/runtime typechecks pass.

- [ ] **Step 6: Commit the passing deliverable**
  
  Commit only the launch contract, its implementation, focused test, and script registration. Open a Draft PR to `workpass70-source`; do not merge until exact-head checks complete.

## Task 2: Prove persistent bilingual memory utility

**Files:**
- Inspect: canonical MemoryOS2 and MemoryFabric implementation files under `runtime/neuro-kurisu/src`.
- Inspect: `runtime/neuro-kurisu/tests/memory-restore-integrity.mjs` (verify exact path before editing).
- Inspect: `runtime/neuro-kurisu/tests/big-pass-126-memory-retrieval-benchmark.mjs`.
- Inspect: `runtime/neuro-kurisu/tests/p26-holdout-provenance.mjs`.
- Inspect: `runtime/neuro-kurisu/tests/p26-sequential-learning-benchmark.mjs`.
- Proposed create only if no equivalent test exists: `runtime/neuro-kurisu/tests/prototype-0-1-bilingual-memory-e2e.mjs`.

**Interfaces:**
- Consumes: canonical memory admission, retrieval, persistence, explicit-forget, provenance and evaluation APIs.
- Produces: an end-to-end memory utility report with separate synthetic and independent evidence classifications.

- [ ] **Step 1: Add failing scenario tests**
  
  Cover a user-approved fact in Russian, a paraphrased Russian query, an English query for the same fact, restart and recall, correction of a stale fact, explicit forget, and refusal to invent an answer when evidence is absent. Assert source/session provenance on every retrieved memory.

- [ ] **Step 2: Verify the relevant failure**
  
  Run the focused new test and existing `npm run test:memory-restore-integrity` / `npm run test:cognitive-cycle-boundary` from the runtime package (confirm the script names in the current package before execution).
  
  Expected: the new scenario exposes any missing cross-language, persistence, provenance, correction, or forget behavior.

- [ ] **Step 3: Implement the minimum behavior**
  
  Fix only the canonical admission/retrieval/persistence owner identified by the failing test. Preserve source-cluster independence, privacy boundaries, bounded ledgers, and explicit-forget semantics. Do not add a second memory index or copy raw dialogue into evaluation artifacts.

- [ ] **Step 4: Verify the focused pass**
  
  Run the bilingual scenario, memory restore-integrity, retrieval benchmark, and runtime typecheck.
  
  Expected: scenario assertions pass; synthetic benchmark results remain explicitly synthetic and cannot be promoted as independent uplift.

- [ ] **Step 5: Run independent evaluation**
  
  Use an immutable, separately held RU/EN dataset with at least five paired seeds and source/session-clustered splits. Report recall/precision, abstention, correction, forgetting, latency, and confidence intervals. If independent data is unavailable, mark the task TESTED-SYNTHETIC / INDEPENDENTLY-PROVEN=false.

- [ ] **Step 6: Commit the passing deliverable**
  
  Commit only the canonical memory fix and its regression/evaluation harness. Open a Draft PR and retain raw evaluation data outside public repository history unless it is privacy-reviewed.

## Task 3: Demonstrate endogenous initiative through the existing ActionGateway

**Files:**
- Inspect: `runtime/neuro-kurisu/tests/organism-autonomy.mjs`.
- Inspect: `runtime/neuro-kurisu/tests/cognitive-cycle-boundary.mjs`.
- Inspect: `runtime/neuro-kurisu/tests/cognitive-cycle-boundary-runtime-wiring.mjs`.
- Inspect: `runtime/neuro-kurisu/tests/workpass97-autonomous-planner-gateway-route.mjs`.
- Inspect: `runtime/neuro-kurisu/tests/workpass96-action-finalizer-boundary.mjs`.
- Inspect: canonical motivation/planner and ActionGateway implementations under `runtime/neuro-kurisu/src/organism`.
- Proposed create only if no equivalent test exists: `runtime/neuro-kurisu/tests/prototype-0-1-endogenous-initiative.mjs`.

**Interfaces:**
- Consumes: persisted organism state, existing drives/goals, planner route, ActionGateway, postcondition and reflection records.
- Produces: a traceable initiative record containing trigger, internal evidence, selected goal, rejected alternatives, permission decision, execution result, and reflection.

- [ ] **Step 1: Add failing behavioral tests**
  
  Verify that a changed internal state can create a candidate initiative without a user prompt; a neutral/no-drive state does not fabricate one; a denied permission never executes; repeated idempotency keys do not duplicate effects; an uncertain action remains unresolved until reconciled; and restart preserves pending/finished initiative provenance.

- [ ] **Step 2: Verify the relevant failure**
  
  Run: `npm run test:autonomy`, `npm run test:cognitive-cycle-boundary`, and `npm run test:cognitive-cycle-boundary-runtime-wiring` in the runtime package.
  
  Expected: baseline behavior is recorded and any missing endogenous trigger or governance boundary is reproduced.

- [ ] **Step 3: Implement the minimum behavior**
  
  Extend the canonical motivation/planning path only where the failing test proves a gap. All side effects continue through ActionGateway. Keep candidate generation distinct from approval and execution. Preserve undo-first and postcondition verification; do not interpret tool ACK as proof of external success.

- [ ] **Step 4: Verify the focused pass**
  
  Run the new initiative test plus autonomy, planner route, finalizer boundary, ActionGateway and restart tests.
  
  Expected: autonomous candidates are explainable; denied, duplicate, unresolved and stale-state cases do not execute unsafe effects.

- [ ] **Step 5: Measure cadence in a real host**
  
  Collect at least 24 hours of timestamped initiative telemetry on the target runtime. Report eligible time, initiated actions, suppression reasons, false-positive rate, permission denials, and verified outcomes. The target of at least one useful explainable initiative per hour is a product target, not a synthetic-test pass criterion.

- [ ] **Step 6: Commit the passing deliverable**
  
  Commit the smallest canonical implementation and behavioral tests; open a Draft PR. Do not merge stacked or diverged scenario branches without exact ancestry analysis.

## Task 4: Connect speech and embodiment to the same cognitive state

**Files:**
- Inspect: `runtime/neuro-kurisu/tests/embodiment-voice-cognitive-context.mjs`.
- Inspect: `runtime/neuro-kurisu/tests/neko-asr-transcript-adapter.mjs`.
- Inspect: `runtime/neuro-kurisu/tests/neko-asr-embodiment-wiring.mjs`.
- Inspect: `runtime/neuro-kurisu/tests/neko-speech-admission-gate.mjs`.
- Inspect: existing embodiment, audio and renderer adapters under `runtime/neuro-kurisu/src` and app renderer directories.
- Proposed create only if no equivalent test exists: `runtime/neuro-kurisu/tests/prototype-0-1-speech-embodiment-e2e.mjs`.

**Interfaces:**
- Consumes: canonical affect/body state, ASR transcript adapter, speech admission gate, TTS/audio events, normalized renderer motion/expression channels.
- Produces: a correlated speech/affect/viseme trace with timestamps and explicit unsupported-capability diagnostics.

- [ ] **Step 1: Add failing integration cases**
  
  Cover recognized RU/EN speech, rejected low-confidence transcript, user interruption, cancellation, affect-to-expression mapping, viseme/audio clock correlation, renderer disconnect, and model fallback. Ensure one cognitive turn has one traceable ID across transcript, response, audio, and avatar events.

- [ ] **Step 2: Verify the relevant failure**
  
  Run the four observed runtime speech/embodiment scripts and capture baseline event ordering and timing.

- [ ] **Step 3: Implement the minimum behavior**
  
  Reuse existing ASR/TTS and renderer adapters. Do not invent a second avatar state machine. Bound event buffers, cancel stale speech, and expose a degraded state if audio or renderer capability is absent.

- [ ] **Step 4: Verify the focused pass**
  
  Run the focused integration test, existing ASR adapter/wiring tests, embodiment voice cognitive-context test, and runtime typecheck.
  
  Expected: transcript, response, audio, and expression events remain correlated; interruption cancels stale output without corrupting core state.

- [ ] **Step 5: Verify on target hardware**
  
  Capture real-device traces for Android/Termux and browser/WebGL separately. Measure audio-to-viseme drift (target <=80 ms), interruption response (target <=200 ms), renderer resource cleanup, foreground/background recovery, and 24-hour stability. Synthetic clocks do not satisfy device verification.

- [ ] **Step 6: Commit the passing deliverable**
  
  Commit only verified adapter/wiring changes and tests. Keep production avatar model provenance and redistribution approval as separate gates.

## Task 5: Release-candidate reproducibility and legal gate

**Files:**
- Inspect: `contracts/RELEASE_LICENSE_REVIEW.json`.
- Inspect: `tools/verify-final-release.mjs`.
- Inspect: `tools/verify-release-metadata.mjs`.
- Inspect: `tools/audit-release-license-readiness.mjs`.
- Inspect: existing release workflow files under `.github/workflows`.
- Proposed create only if no equivalent check exists: `tools/prototype-0-1-release-parity.test.mjs`.

**Interfaces:**
- Consumes: exact source commit, build outputs, release manifest, asset/dependency hashes, human legal decisions.
- Produces: a reproducible release-candidate manifest and a fail-closed readiness result.

- [ ] **Step 1: Add failing parity coverage**
  
  Verify that source SHA, build manifest, archive file list, archive size, and SHA-256 are bound to the same candidate. A missing archive, mismatched byte count, mismatched digest, stale source SHA, or pending redistribution approval must fail readiness.

- [ ] **Step 2: Verify the relevant failure**
  
  Run: `npm run test:release-license-readiness` and existing release metadata/parity tests discovered in the current root package.
  
  Expected: unresolved legal review and unverified archive bytes prevent a release-ready result.

- [ ] **Step 3: Implement the minimum behavior**
  
  Reuse existing release verification scripts and publisher workflow. Do not modify `main`, publish a Release, or change the existing ZIP until source parity and human legal approval are independently established.

- [ ] **Step 4: Verify the focused pass**
  
  Run release readiness tests, `npm run audit:quick`, and `npm run typecheck`.
  
  Expected: all automated checks pass while legal status remains visibly blocked if human decisions are still pending.

- [ ] **Step 5: Produce a release-candidate evidence bundle**
  
  Record source SHA, dependency lock digests, asset manifest, archive SHA-256, byte count, extraction manifest, test results, device evidence, and reviewer approvals. Keep candidate distinct from published Release until explicit release authorization.

- [ ] **Step 6: Commit the passing deliverable**
  
  Commit release-verification code/tests only. Release publication remains a separate, explicitly authorized operation.

## Completion Gate: Prototype 0.1

The prototype is complete only when all of the following have evidence attached to one exact source SHA:

1. Clean install and reproducible startup.
2. One persistent cognitive runtime and state restoration.
3. Grounded RU/EN conversation with evidence-backed memory retrieval, correction, and explicit forget.
4. Endogenous initiative with traceable internal trigger and permission-bounded execution.
5. Action postconditions, idempotency, and undo/recovery behavior.
6. Correlated speech, audio, affect, and avatar events.
7. Real target-device timing and soak evidence, clearly separated from CI simulation.
8. Release candidate archive parity and explicit legal/asset clearance.

A passing CI suite alone is not completion. If hardware, independent holdout data, or legal approval is unavailable, report the prototype as partially verified and name the exact blocked gate.

## Open Product Decisions

- Which local LLM/runtime and hardware profile is the minimum supported prototype target?
- Is the first public prototype browser/desktop-only, or must Android/Termux be a launch target?
- Which production 3D avatar asset is approved for use and redistribution?
- Who supplies and signs off the immutable bilingual memory holdout?
- Who is the human reviewer authorized to decide the pending root/runtime/dependency/source-archive license questions?
