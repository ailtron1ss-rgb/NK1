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

The plan was initially authored against source SHA `5ebec445ce729a4e372f273080138aa3cbeab778`. That is a historical planning baseline, not the current branch head.

### Live refresh — 2026-11-21 18:40 UTC

- Canonical source branch: `workpass70-source` @ `a9141a085431de7a5bda3873f913ea4b4c1efab2`.
- Repository default branch: `main`; runtime implementation continues to target `workpass70-source`, while `main` remains release/metadata-only.
- Exact source-head Actions evidence: **13/13 check-runs SUCCESS** on `a9141a0...`, including clean install/build/start, NeuroCore core regression, unified organism runtime, memory explicit-forget, matched B261 holdout, ActionGateway governance, local-language resilience, Hexis lineage, module dependency audit, affect restore, browser affect and avatar motor coupling. This is the current CI snapshot, not device/soak evidence.
- Quickstart contract requires Node.js **24.x**, npm **10.8.0+**, Python **3.11.x**, Git, registry access and free ports 8080, 8081, 3310 and 8765. `npm run quickstart` builds the UI, runs doctor and starts the runtime, research bridge, UI preview and gateway with health checks. Successful startup does not prove a real LLM, Android audio, licensed 3D avatar, device soak or release parity.
- Branch census: **1,065 branch refs / 1,047 unique HEADs / 18 excess aliases across 3 duplicate-tip groups**. One group contains 17 branch names pointing at the same SHA `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`; two other groups each contain two names. Preserve all refs/history; this is an inventory finding, not deletion authorization.
- Open PR census: **272 open PRs: 206 Draft and 66 ready for review**. 247 had not been updated in the preceding seven days. The 66 ready PRs include many old, stacked or `main`-targeted changes; do not bulk-merge them.
- Current source branch is not protected and has no required status checks enforced. The 13/13 green Actions result is observed evidence, not a branch-protection guarantee.
- Prototype PR #1076 (`aspect/prototype-bilingual-memory-e2e-20261121`) has **16/16 exact-head Actions runs SUCCESS** for bilingual RU/EN retrieval, snapshot/restore, correction, explicit forget, abstention and regression checks. It remains Draft by its own explicit boundary; its branch is 3 commits ahead and 2 behind the current source from merge base `35e31d259f9141103e04ba109f782fa57fac3196`. It adds test/workflow/changelog coverage only and does not claim independent retrieval uplift.
- PR #861's older B261 branch is not a safe duplicate merge candidate: its 2026-11-12 head had failing checks, while the matched-baseline implementation and passing B261 workflow are now present on the current source line.
- Stable Release: tag `Neuro`, asset `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, metadata digest `sha256:c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- Latest published ZIP by timestamp is prerelease `workpass70-hotfix1-2026-10-19`, asset `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip`, 136,354,713 bytes, metadata digest `sha256:9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`. Neither archive's bytes have been independently downloaded and hashed in this refresh; source/ZIP parity remains **UNVERIFIED**.
- `contracts/RELEASE_LICENSE_REVIEW.json` remains pending: root license is `NOASSERTION`, runtime is private/all-rights-reserved, 477 locked npm components and source archives require human review, and redistribution approval is false.

### Prototype workstream status at this refresh

| Workstream | Current evidence | Remaining gate |
|---|---|---|
| Launch/runtime | Quickstart contract and clean startup smoke are present; source CI passes | Real configured LLM, full user-turn/restart acceptance and target-host soak |
| Persistent bilingual memory | PR #1076 synthetic RU/EN lifecycle E2E passes 16/16 on its exact head | Integrate only after current-base review; independent immutable RU/EN holdout, five paired seeds and positive confidence-supported uplift |
| Endogenous autonomy | ActionGateway, unified-organism and cognitive regression checks pass on source | 24-hour host telemetry, verified useful initiative rate, recovery/undo and false-positive analysis |
| Speech/avatar | 2D/3D motor, affect coupling and browser snapshot checks pass in CI | Real browser/WebGL visual E2E, Android/Termux speech interruption, audio-viseme drift and device soak |
| Release/legal | Release metadata and readiness contracts exist | Human license/asset decisions, independent ZIP hash/extraction manifest and exact-SHA source parity |

The original five-task plan below remains the execution structure. Status labels must remain distinct: IMPLEMENTED, CONNECTED, TESTED, DEVICE-VERIFIED, INDEPENDENTLY-PROVEN and RELEASED. A green CI run must not be promoted into a device, independent-evaluation or release claim.

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
