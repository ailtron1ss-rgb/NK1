## Current source-stack checkpoint — WorkPass266 (2026-10-22)

- **Source branch:** [workpass206-runtime-evaluator-wiring](https://github.com/ailtron1ss-rgb/NK1/tree/workpass206-runtime-evaluator-wiring); **PR #55 remains open/draft/unmerged:** https://github.com/ailtron1ss-rgb/NK1/pull/55
- **Code fix:** causal task/trace identities are rejected when overlong or invalid rather than truncated into a collision; restore applies the same trace-ID bounds.
- **Regression reachability:** WorkPass110 now watches the active causal-stream and Legacy/Live2D paths and runs their focused regressions.
- **Reviewed code-change baseline:** 951d7bb3f37e6c45fc63427e3edbdfed698af0f3. Later documentation commits advance branch HEAD; use the live PR for the current SHA.
- **Validation:** latest retrieved WorkPass110 job has no exposed steps or logs; a retry was requested. Do not infer successful test/typecheck execution. Real sandbox/verifier/scanner deployment and independent memory/learning uplift remain open.
- **Read first:** [WorkPass266 strategic audit](docs/STRATEGIC_PROJECT_DEVELOPMENT_AUDIT_2026-10-22.md), [canonical backlog](docs/NEURO_KURISU_FULL_RELEASE_BACKLOG_CANONICAL.md), [P23 integration roadmap](docs/P23_CROSS_SOURCE_INTEGRATION_ROADMAP.md), [research intake ledger](docs/RESEARCH_INTAKE_LEDGER.md).
- **Repository topology:** main remains the publication line with no common ancestor reported against the source stack; do not merge or rewrite it automatically.

---

## Current source-stack checkpoint — WorkPass265 (2026-10-22)

- **Current source branch:** [workpass206-runtime-evaluator-wiring](https://github.com/ailtron1ss-rgb/NK1/tree/workpass206-runtime-evaluator-wiring); **draft PR:** [#55](https://github.com/ailtron1ss-rgb/NK1/pull/55), open/unmerged.
- **Reviewed implementation baseline (before this documentation checkpoint):** `58e9c6a00b5835096dac3758968f5b9ce0eb08d2`. Documentation commits have advanced the branch since then; use the live PR link for the current HEAD. Exact-head CI/typecheck is not confirmed; previous visible Actions failures expose no runnable steps/logs, so do not infer either code failure or success.
- **Current canonical next step:** unblock exact-head CI and provision the real independent evaluation sandbox/verifier/scanner, while preparing independent RU/EN memory and memory-grounded-action evaluation.
- **Read first:** [WorkPass265 strategic audit and eight-pass plan](docs/STRATEGIC_PROJECT_DEVELOPMENT_AUDIT_2026-10-22.md), [canonical backlog](docs/NEURO_KURISU_FULL_RELEASE_BACKLOG_CANONICAL.md), [cross-source P23 roadmap](docs/P23_CROSS_SOURCE_INTEGRATION_ROADMAP.md), [research intake ledger](docs/RESEARCH_INTAKE_LEDGER.md).
- **Repository topology:** main remains the release/report line; GitHub has reported no common ancestor between it and the current source stack. Do not merge/rewrite main automatically.
- **Evidence discipline:** implementation in the branch is not proof of successful tests, production sandboxing, measured learning improvement, or consciousness.

---

## Latest continuation checkpoint — WorkPass96 (2026-10-20)

- Active work branch: `workpass79-cognitive-rebuild`; draft PR #1 remains open and unmerged.
- Skill learning now has bounded negative transfer, 30-day half-life retention decay, 180-day expiry, and rollback when later validation evidence deteriorates.
- Regressions cover transfer boundaries, forgetting, rollback, invalid feedback rejection, bounded/stratified replay, parametric generalization on a deterministic synthetic holdout, and core persistence/restart integration.
- Code head `c8d20f5` passed runtime typecheck and all five WorkPass95 workflow steps. Documentation-only commits followed; confirm the newest head's run before release.
- Exact-head CI previously exposed a `-0` versus `0` assertion failure; the code fix is committed. Do not claim the newest run passes until it completes.
- Research and evidence limits: [WorkPass96 research note](docs/CONTINUAL_SKILL_LEARNING_RESEARCH_2026-10-20.md); [checkpoint](docs/WORKPASS95_CHECKPOINT_2026-10-20.md).
- Remaining high-value work: independent external outcome verification before promotion, balanced/prioritized replay, and real environment outcome benchmarks.

## Latest continuation checkpoint — WorkPass95 (2026-10-20)

- Active work branch: `workpass79-cognitive-rebuild`; open draft PR: [#1](https://github.com/ailtron1ss-rgb/NK1/pull/1).
- WorkPass95 adds conservative validated skill transfer between near-neighbor contexts and prevents non-finite persisted/training values from poisoning the parametric policy learner.
- Regression coverage now includes positive transfer to a near context, rejection of distant-context transfer, malformed learned-parameter recovery and non-finite training controls.
- Research rationale and limits: [WorkPass95 research note](docs/CONTINUAL_SKILL_LEARNING_RESEARCH_2026-10-20.md); implementation checkpoint: [WorkPass95](docs/WORKPASS95_CHECKPOINT_2026-10-20.md).
- Exact-head CI: [WorkPass95 continual skill learning workflow](https://github.com/ailtron1ss-rgb/NK1/actions/workflows/workpass95-continual-skill-learning.yml). Treat results as unverified until the run completes successfully.

## Latest continuation checkpoint — WorkPass94 (2026-10-20)

- Active work branch: `workpass79-cognitive-rebuild`; open draft PR: [#1](https://github.com/ailtron1ss-rgb/NK1/pull/1).
- Latest detailed state and next actions: [WorkPass94 checkpoint](docs/WORKPASS94_CHECKPOINT_2026-10-20.md).
- WorkPass94 tightens `isTrustedExternalPostconditionVerification`: if an expected input is supplied, it must structurally match the **complete** action input; partial input, altered nested parameters and non-serializable values fail closed. Added a behavioral regression and a dedicated Node 22 workflow.
- WorkPass94 validation is **pending**: [WorkPass79 cognitive runtime regression run 39414533372](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39414533372) was observed pending on commit `b041767681158834540fbd979a2b97306e512e2f`. Do not infer success until the run completes green.
- Start each session by refreshing live branch head, PR state and latest Actions run.

## WorkPass94 — bind verification evidence to the complete action input

- Fixed the partial-input matching weakness in `runtime/neuro-kurisu/src/organism/system/OutcomeVerificationService.ts` using the shared canonical serializer.
- Added regression cases for exact structural match, deep clones, partial/mismatched inputs, copied verification tokens and malformed circular input.
- Added [focused CI workflow](.github/workflows/workpass94-verification-input-binding.yml).
- Evidence status: implementation and test wiring are present; the workflow result and the broader runtime typecheck/regression suite still need confirmation.

## WorkPass78 — master strategy, architecture map and 1,000-unit execution plan (2026-10-20)

- Added [NeuroCore master strategy and brain map](docs/NEUROCORE_MASTER_STRATEGY_AND_BRAIN_MAP.md): logical subsystem boundaries, cross-component interaction trace, human-brain analogy with explicit limits, provisional readiness scorecard, prioritized risk register, scientific research tracks, source inventory boundaries and staged release gates.
- Added [1,000-work-unit backlog](docs/NEUROCORE_1000_WORK_UNIT_BACKLOG.md), a 20 × 10 × 5 decomposition of domains, subsystems and lifecycle stages. All units begin PLANNED / UNVERIFIED; this is a planning framework, not a claim that tasks are completed or a mandate to create empty modules.
- Expanded [persistent start-here charter](NEUROCORE_START_HERE.md) and [AGENTS.md](AGENTS.md) with new-chat continuation, broad research / selective promotion, source inventory requirements and release discipline.
- **Important limits:** scorecard values are provisional triage estimates, not measured benchmark scores. The strategy identifies the next release blockers but does not itself close them. The complete live file inventory, call graph, dependency/license/SBOM and asset provenance still need to be generated from the current repository.
- **Next code-first priorities:** provider failure/cancellation/cooldown HTTP regressions; restart-in-flight action/request tests; live Dell G3 local-model smoke; independent RU/EN retrieval holdouts; learning-transfer controls; action verification matrix; dynamic test-runner/source/license inventory; real browser/Live2D/TTS E2E; target-device soak and release packaging.

## Current engineering pass — WorkPass76 (2026-10-19)

- Added [NEUROCORE_START_HERE.md](NEUROCORE_START_HERE.md) as the durable project charter, new-chat resume protocol and evidence-based upstream research/integration mandate.
- Added [Research Intake Ledger](docs/RESEARCH_INTAKE_LEDGER.md) with paper/repository candidates, adaptation boundaries, license/provenance checks and explicit status labels. Candidate links are a research queue, not claims of completed upstream review or integration.
- Fixed the `invokeLanguage()` completion timestamp ordering defect; source regression checks timestamp order and prefers the actual response backend for attribution.
- Added cold-retrieval residency regression and wired it into CI. It verifies retrieval does not materialize the legacy hash vector, promote cold memory or increment the legacy semantic-hit counter.
- Wired temporal fact-revision, read-only temporal inspector and bounded revision-history regressions into the active workflow.
- Added [runtime test reachability audit](tools/audit-runtime-test-coverage.mjs). The corrected audit passed in [run 39320207064](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320207064): 1,200 runnable test-shaped files, 1,124 directly referenced, 76 unreferenced candidates, 1,647 package scripts, 1,308 explicit references and zero broken paths. Candidate paths are now emitted in the audit log; the 76 are review candidates, not confirmed dead tests.
- Added [end-to-end local language HTTP regression](runtime/neuro-kurisu/tests/server-language-http-fake-provider.mjs); it passed in [run 39320623533](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320623533) using a loopback fake provider and the real server request path.
- Added [opt-in live `llama.cpp` smoke](runtime/neuro-kurisu/tests/local-llm-live-smoke.mjs) and [Dell G3 run guide](docs/LOCAL_LLM_SMOKE_GUIDE.md). CI run [39320833685](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320833685) passed the default-skip behavior without a local endpoint configured.
- **CI evidence:** [run 39320023335](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320023335) passed temporal revision/history tests; [run 39320833685](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39320833685) passed the core suite with the fake-provider HTTP integration and optional live-smoke skip. Always check the current branch head and latest Actions status before relying on a historical run.
- **Still unproven:** real `llama.cpp` inference/model quality on the Dell G3, independent retrieval uplift, learning transfer, restart-safe external action evidence, real browser/audio/Live2D E2E, target-hardware performance and subjective consciousness.

Latest continuation and next-chat entry: [WorkPass77 handover](docs/WORKPASS78_HANDOVER_2026-10-20.md). Full findings and the updated queue: [WorkPass76 repository audit](docs/WORKPASS76_REPO_SURFACE_AUDIT_2026-10-19.md). The current rebuild/evidence gates remain in [WorkPass75 ledger](docs/WORKPASS75_REBUILD_AND_EVIDENCE_LEDGER_2026-10-19.md).

## Current engineering pass — WorkPass75 (2026-10-19)

- Hardened local LLM circuit-breaker tests: deterministic injected-clock snapshots, exact cooldown boundary, exponential backoff, cap enforcement, success reset and isolation from unrelated provider failures.
- Removed the duplicate test-only backend selector; runtime and regression now exercise the same `LocalLanguageBackendPolicy` implementation.
- Added [WorkPass75 rebuild and evidence ledger](docs/WORKPASS75_REBUILD_AND_EVIDENCE_LEDGER_2026-10-19.md): canonical ownership map, staged reassembly gates, evidence boundaries, and concrete next actions.
- Updated [WorkPass74 local LLM handover](docs/WORKPASS74_LOCAL_LLM_SELECTION_2026-10-19.md) to distinguish its prior green CI run from the newer unvalidated hardening.
- **Validation boundary:** CI run [39313943292](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39313943292) passed on baseline commit `ad949249ef10305a832f8d2e0dcb7a9c7c4b355d`, before WorkPass75 changes. Do not treat that run as validation of the latest head; the new workflow run must finish green.

## Current engineering pass — WorkPass72 (2026-10-19)

- Fixed the retrieval candidate-budget off-by-one: revision and graph expansion check the cap before insertion, and fail fast if it is exceeded.
- Fixed retrieval-side memory-residency warming: candidate search no longer rebuilds non-ranking hash vectors for cold records or reclassifies them as warm.
- Gated adaptive policy and causal-replay credit on independent outcome verification; unverified observations do not affect reward/credit aggregates, and the original policy decision remains pending for later proof.
- Strengthened the mobile residency regression to require zero vector-count growth and unchanged residency-tier counts across recall.
- Expanded CI coverage across candidate coverage, numeric/fuzzy retrieval, bilingual concepts, typed intent, residency, background indexing and embedding privacy; the fixed-time numeric/fuzzy test fixtures were corrected after CI exposed their invalid temporal mode.
- Removed 21 duplicate tracked Live2D shadows from `app/public` (16.69 MB); canonical assets remain in runtime and hydrate from the hash-locked manifest before Vite.
- Working rules and navigation: [AGENTS.md](AGENTS.md); evidence/open gates: [WorkPass72 handover](docs/WORKPASS72_HANDOVER_2026-10-19.md); [exact-duplicate cleanup audit](docs/REPOSITORY_CLEANUP_AUDIT_WORKPASS72.md).
- Full goal and staged acceptance plan for the independent NeuroCore organism / Kurisu identity: [Digital-organism roadmap — WorkPass73](docs/NEUROCORE_DIGITAL_ORGANISM_ROADMAP_WORKPASS73.md).
- Validation: [WorkPass72 expanded CI passed](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39302836266) on `87564ddfd1f0d8758994c3ab0edb45511434a1b5`; a later handover-only commit records the result. No recall uplift or production-ready claim is made. Independent labelled retrieval evidence and real-world release gates remain open.

## Previous engineering pass — WorkPass71 (2026-10-19)

- Fixed retrieval benchmark fairness: baseline and candidate now evaluate the same validated bounded corpus; truncation and malformed/duplicate rows remain promotion blockers.
- Added cap-boundary and malformed-row parity regressions plus multi-seed experiment checks.
- Handover: [WorkPass71 handover](docs/WORKPASS71_HANDOVER_2026-10-19.md). No retrieval uplift was claimed.

## Previous engineering pass — WorkPass70 (2026-10-19)

- Canonical runtime `35.90.0`; persisted schema `225`; release status remains implementation-only.
- Browser speech and the Live2D viewer now share one versioned `kurisu_embodiment_intent` envelope and one monotonic speech-audio clock. Per-utterance `speechEventId`/`audioClockId`, UTF-16 boundary anchors, stale callback rejection, cancellation identity and iframe-ready replay are implemented.
- Added a Russian/English grapheme-viseme timeline with boundary-event re-anchoring. This is explicitly approximate: Web Speech does not provide PCM/phoneme ground truth in this path.
- Verification: targeted timeline/viewer-handler tests **9/9 PASS**; app script suite **227/227 PASS**; runtime TypeScript typecheck, release metadata, source/integrity checks and receipt/recovery regression groups pass. The viewer's production message handler is exercised in a VM test, not a real browser renderer.
- Chromium in this container hangs before rendering even a trivial page; app dependencies remain absent because npm registry DNS previously returned `EAI_AGAIN`. Therefore production Vite build, real browser/Live2D audio E2E, acoustic p95 offset and physical Android/Termux audio are **not verified**. Retrieval remains `recallDelta=0`, candidate `not-promoted`.
- Official weighted roadmap stays **80.1%**; release gates remain open. No increase is awarded for test or file count.
- Current pass details: [`docs/WORKPASS70_HANDOVER_2026-10-19.md`](docs/WORKPASS70_HANDOVER_2026-10-19.md), [`docs/WORKPASS70_CODE_CHANGES_2026-10-19.md`](docs/WORKPASS70_CODE_CHANGES_2026-10-19.md), [`docs/ROADMAP_GAPS_TO_TARGET_WORKPASS70.md`](docs/ROADMAP_GAPS_TO_TARGET_WORKPASS70.md).

## Previous pass — WorkPass69 (2026-10-19)

WorkPass69 established a single canonical ActionGateway owner for physical TTS, target-bound keyed interruption, honest ambiguous-result semantics, a `POST /api/organism/voice/interrupt` endpoint, and an IntegrationConsole control. The server and UI smoke tests covered the actual local request paths; this did not prove audible Android playback or physical silence. The full record remains in [`docs/WORKPASS69_HANDOVER_2026-10-19.md`](docs/WORKPASS69_HANDOVER_2026-10-19.md).

---

## Previous pass — WorkPass63

WorkPass63 hardened keyed-action uncertainty semantics and added a true temporary-filesystem side effect/lost-ACK/restart/reconciliation test. Its evidence and remaining live-provider boundary are retained in `docs/WORKPASS63_HANDOVER_2026-10-18.md`.

# Historical reference: WorkPass61 receipt-revision implementation snapshot (2026-10-18), retained below for lineage. Current status and release gates are documented in the WorkPass70 files listed at the top of this README.

# Neuro-Kurisu

> **Historical implementation snapshot: WorkPass61 (runtime 35.81.0, persisted schema 225).** WorkPass61 added append-only authoritative provider receipt evidence revisions tied to the original execution. The base receipt stays immutable and the new revision is persisted/idempotent. Real provider/device process-restart E2E, production browser/Live2D E2E and other release gates remain open. This pass hardens trustworthy external postconditions, durable idempotency for side-effecting actions, autonomous competence accounting and delayed evidence recovery. Protected API requests still use the canonical ActionGateway approval/continuation path. This is an implementation pass, not release approval.

## WorkPass61 — authoritative provider receipt evidence revisions (2026-10-18)

- Runtime `35.81.0`; persisted schema `225`; base archive `Neuro_Kurisu_WORKPASS60_2026-10-17.zip`.
- Authoritative `found` provider receipts now attach an append-only evidence revision to the existing execution instead of rewriting the original outcome projection. Exact replay is deduplicated; modified receipt content with the same identity fails closed.
- `CausalAccountabilityGraph` gets an evidence-revision node and `supersedes` edge; `CognitiveEventFabric` preserves its original action/outcome/evidence trio and stores a sanitized reconciliation revision event. Snapshot/restore and migration preserve revision references.
- `npm run test:workpass61` passes TypeScript, direct revision tests, real `OrganismCore` simulated provider-found integration, WorkPass60 checkpoint/reconciliation and WorkPass59 learning firewalls. This is simulated provider evidence, not live device E2E.
- Pass completion **8/8 (100%)**; weighted roadmap **79.3%** (+0.5 points from 78.8%). Normalized inventory: 78 tasks, 60 DONE / 10 PARTIAL / 8 TODO.
- Current details: [`docs/WORKPASS61_CODE_CHANGES_2026-10-18.md`](docs/WORKPASS61_CODE_CHANGES_2026-10-18.md), [`docs/WORKPASS61_HANDOVER_2026-10-18.md`](docs/WORKPASS61_HANDOVER_2026-10-18.md).
- Still open: real provider/device read-after-write and process kill/restart, production browser/Live2D E2E, independent memory holdout, target hardware inference, clean-room rollback, nested-source license review and soak.

---

## Historical implementation notes — WorkPass57

WorkPass57 builds on the WorkPass56 deferred semantic-index maintenance and adds outcome-truth integrity: a tool ACK cannot become independent external evidence; an observed postcondition mismatch is recorded as `executed-contradicted`; incomplete evidence remains unknown; and high-risk/mutating action identities require durable keys even when an old registration omitted the opt-in flag. A persisted bounded executionId/fingerprint index prevents duplicate causal projection, and a stable outcome receipt directory lets delayed observations reattach after recent ring eviction and state migration. Permission/approval/receipt-infrastructure failures do not poison competence learning. Learning credit is provenance-gated: positive credit requires an identified independent external source, and negative credit requires two distinct high-confidence contradictory independence keys.

TypeScript `tsc` typecheck and focused WorkPass57 tests pass. The embedding provider remains opt-in and the broad retrieval benchmark still reports `recallDelta=0`; no general recall uplift is claimed. Production Vite/browser E2E, live provider/device postconditions, target-model profiling, exact audio/phoneme lip-sync, clean-room rollback, full nested-source license review and endurance soak remain open.

**Code changes and handover:** [`docs/WORKPASS57_CODE_CHANGES_2026-10-17.md`](docs/WORKPASS57_CODE_CHANGES_2026-10-17.md), [`docs/WORKPASS57_HANDOVER_2026-10-17.md`](docs/WORKPASS57_HANDOVER_2026-10-17.md). Previous baseline documents remain preserved: [`docs/WORKPASS56_HANDOVER_2026-10-17.md`](docs/WORKPASS56_HANDOVER_2026-10-17.md).

**Open release gates:** production React/Vite build and interactive browser/Live2D E2E, live provider/device receipts and long-run recovery, audio-buffer/phoneme lip sync, independent memory-retrieval uplift, clean-room rollback, full nested-source license review and endurance soak. At the WorkPass57 historical snapshot, the weighted roadmap remained at 78.0%; the current WorkPass61 scorecard is `79.3%`, with the same live release gates still open.

---

## WorkPass56 — deferred semantic-index maintenance (2026-10-17)

- Added opt-in low-priority batch indexing under the existing `MemoryFabric.maintain()` lifecycle. `MemoryOS2.maintainSemanticIndexBatch()` indexes up to eight eligible current memories per maintenance pass, validates finite nonzero vectors, rejects stale content-hash results and caches only derived embeddings.
- Embedding-provider errors no longer cause tight retries: per-memory exponential backoff is bounded at five minutes. When a provider is disabled, busy or fails, canonical memory writes and lexical/fuzzy recall remain available.
- Background warm-up, live cognitive retrieval and semantic inspector queries now serialize access to the same local provider so the UI cannot overload a device already processing a cognitive turn. The Memory Inspector reports safe aggregate maintenance telemetry only.
- **Source-derived:** adapted the deferred batching and retry pattern from the retained Hexis MIT `services/memory_embeddings.py`; no SQL state store or second memory runtime is copied.
- **Not claimed:** no broad recall uplift (`recallDelta=0`) and no live target-model speed/quality result. Production Vite/browser E2E, real provider/device receipts, phoneme/audio-buffer lipsync, independent memory holdout, clean-room rollback, full license sign-off and soak remain open.

---

## WorkPass55 — bilingual memory retrieval and safe orphan approval recovery (2026-10-17)

- Runtime `35.76.0`; persisted organism schema `225`; this remains an implementation pass, not release approval.
- The global Action Approval Center now inspects the canonical server-side pending-ticket snapshot after load/visibility changes. An unclaimed ticket is shown with a safe preview and may be explicitly declined; the old request body is never persisted or resumed after reload.
- MemoryOS2 adds cached bilingual concept groups, curiosity/personality query intent, and balanced expansion across active concept groups. This improves a set of controlled Russian/English paraphrases while preserving original-token weights, temporal/epistemic filters, and one canonical memory owner.
- Candidate coverage uses the explicit historical `at` mode for its fixed future-dated fixture. Broad memory benchmark still reports `recallDelta=0`; no general retrieval promotion is claimed.
- Open gates: clean installed Vite/browser/Live2D E2E; long-run live provider/device receipt and recovery; audio-buffer/phoneme lip-sync; independently labelled retrieval holdout; clean-room rollback; nested-source license sign-off; target-host profiling and soak. Weighted roadmap stays 78.0%.
- Detailed gap map: `docs/ROADMAP_GAPS_TO_TARGET_WORKPASS55.md`; live status: `docs/PROJECT_CURRENT_STATUS_2026-10-17_WORKPASS55.md`; handover: `docs/WORKPASS55_HANDOVER_2026-10-17.md`.

---

# WorkPass 45 — current implementation state (2026-10-15)

The current source baseline is runtime **35.66.0** / persisted state schema **225**. WorkPass45 adds the read-only ActionGateway provider-reconciliation protocol and routes every physical camera capture through the keyed `organism.device.capture` action. HTTP capture requires `Idempotency-Key`; the old `android.capture_camera` ID is a compatibility alias, not a second executor. Local Termux camera receipts are durable, operation-bound and hash-checked, but they are **not** provider-issued receipts; if the process loses its local receipt after a device side effect, the outcome remains `unknown` and automatic retry is blocked.

Pass implementation progress is **85/100**. The cumulative release task inventory is **120: 94 DONE / 14 PARTIAL / 12 TODO**. The official weighted release roadmap stays **78.0%** until physical provider/device E2E, dependency-installed Vite/browser Live2D E2E, target-host inference, independent retrieval holdout, rollback, license review and soak have evidence.

Read `docs/WORKPASS45_REPORT_2026-10-15.md`, `docs/WORKPASS45_TASKS_2026-10-15.md`, and `docs/SOURCE_INTEGRATION_REMAINDER_WORKPASS45.md` before the next implementation pass. `docs/SOURCE_INTEGRATION_REMAINDER_WORKPASS45.csv` is the 22-row disposition of useful material still not integrated from the four original `.7z` packages and nested archives.

# Neuro-Kurisu SUPER


### Action approvals and protected external operations

The canonical ActionGateway owns approval tickets bound to the exact tool, input, operation and expected-output contract. Tickets expire after five minutes, are persisted, require explicit owner resolution and can be consumed once. Protected operations include web/research calls, code/file/system/device tools, voice activation, current and legacy outbound channels, and the research bridge. The UI only previews redacted input metadata; it does not expose the private request fingerprint.

## WorkPass43 — durable action receipts and causal restoration (2026-10-15)

The canonical baseline is **WorkPass43** (`SUPER_VERSION.json`); the writable runtime is **Neuro-Kurisu 35.64.0 / schema 225**. The main change is integration integrity, not a parallel agent: autonomous resource-tool execution now flows through `OrganismCore.executeTool` and the existing `ActionGateway` keyed receipt/finalizer contract. Each finalized tool receipt is projected into the existing `CognitiveEventFabric` as a linked action/outcome/evidence trace. Replay guards are restored only when all referenced causal nodes remain present and linked; sanitized trace nodes beyond the ordinary recent-event window are preserved in the snapshot. Exact external observation correlation requires the execution ID, duplicate tool IDs fail closed, and Live2D iframe messages validate source, origin and payload shape.

WorkPass43 regression entry points: `npm run test:tool-receipt-causal-workpass43`, `npm --prefix runtime/neuro-kurisu run typecheck`, `npm run test:runtime:smoke`, and `npm run test:restart`.

This remains an implementation pass, not release approval. React/Vite build and interactive browser/Live2D E2E are unverified because app dependencies were not installed in the source environment; the long autonomy suite timed out and is not counted as a pass. The previous weighted release roadmap remains **78.0%**; real provider/device receipts, independent retrieval holdout, target-hardware inference, clean-room rollback, nested-license review and soak remain open.

## WorkPass42 — canonical files and reversible cleanup


## WorkPass42 — canonical files and reversible cleanup

The canonical baseline is **WorkPass42** (`SUPER_VERSION.json`); the writable runtime remains **Neuro-Kurisu 35.63.0 / schema 225**. This pass removes only byte-identical copies with verified canonical sources and restoration manifests; it does not delete unique input or legacy content.

- 21 app/public Live2D shadows are hash-locked and generated before Vite dev/build by `npm run assets:sync`; use `npm run assets:clean` to omit them from the compact source tree again. App-owned `viewer.html` and `vendor/` files remain.
- `node tools/restore-historical-duplicate-paths.mjs` checks the 56 omitted exact-path copies; `npm run restore:historical-paths` materializes them. The independent 3,873-entry Legacy map remains handled by `npm run restore:legacy-deduplicated`.
- `npm run check:compacted-source-archives` verifies 8,512 historical source members; `npm run check:historical-snapshot` verifies 10,427 historical snapshot member paths.
- Reports and pass history live under `docs/history/`; the current system/owner map is `docs/PROJECT_FILE_MAP_WORKPASS42.md`, and exact cleanup statistics are in `docs/archive-optimization/cleanup-summary-workpass42.json`.

This archive cleanup has **no unique-content loss**. It preserves exact deleted bytes via canonical copies or immutable content-addressed blobs, and restore tools refuse changed hashes, symlinks and conflicting target files. Release readiness remains 78.0%; the dependency-installed Vite production build, interactive browser/Live2D E2E and real external-provider evidence are still open.

## Previous pass — WorkPass41 cycle-local causal verification and retention admission

The canonical release candidate is **WorkPass42**. The writable organism runtime is **Neuro-Kurisu 35.63.0 / schema 225**.

WorkPass41 closes two observed behavior defects rather than adding parallel subsystems. `CognitiveEventFabric.verifyOperationalCycle` validates the current six-stage causal spine by exact stage ID, stage, tick and required parent edges; unrelated old dangling parents in the bounded ring no longer lower the validity of a new cycle. Restored event snapshots are normalized, duplicate/unknown IDs and stage labels are rejected, and malformed payloads cannot enter the causal ledger. `MemoryRetentionEconomy` now uses net retention value, redundancy/harm and provenance even when storage is not under byte pressure; budget pressure further adjusts retention by value per byte.

Focused evidence: cycle lineage/restore 10/10; memory retention net value 5/5; big-pass 162 and 164 PASS; adaptive retention tests 2888 and 2894 PASS; memory substrate indexed-vs-brute-force equivalence PASS; runtime TypeScript typecheck PASS. These are targeted checks, not proof of every runtime function.

Release blockers remain dependency-installed Vite production build and interactive browser/Live2D E2E, actual local inference, authoritative external provider/device receipts and reconnect/replay, independent labelled temporal-memory holdout, full fault-injected clean-room rollback, manual nested-source license review and endurance soak. Do not mark release ready until these gates have evidence.

See `docs/WORKPASS42_REPORT_2026-10-14.md`, `docs/INTEGRATION_MATRIX_WORKPASS42_2026-10-14.md`, `docs/WORKPASS42_TASKS_2026-10-14.md`, and `docs/PROJECT_FILE_MAP_WORKPASS42.md` for current navigation; WorkPass41 history remains preserved under `docs/`.
## Current status and release limits

WorkPass40 focused restore tests pass **8/8**, SBOM/provenance tests pass, the mocked local-provider/migration test passes, and runtime TypeScript typecheck passes. These results cover focused contracts, not every feature in the repository.

Still open: installing app dependencies and completing Vite production build, browser E2E with real Live2D interaction, target-host llama.cpp inference and memory/latency measurements, external provider/device receipts and reconnect/replay, clean-room fault-injected restore/rollback, an independent labelled temporal-memory holdout, soak, and manual review of nested source licenses. The retrieval candidate is not promoted because the current synthetic recall uplift is zero.

See `docs/PROJECT_CURRENT_STATUS_2026-10-14_WORKPASS40.md`, `docs/PROJECT_PROGRESS_SCORECARD_2026-10-14_WORKPASS40.json`, `docs/WORKPASS40_REPORT_2026-10-14.md`, `docs/WORKPASS40_TASKS_2026-10-14.md`, `docs/INTEGRATION_MATRIX_WORKPASS40_2026-10-14.md`, `docs/OPEN_SOURCE_INTEGRATION_REVIEW_WORKPASS40.md`, `docs/WORKPASS40_AUDIT_RESULTS_2026-10-14.json` and `docs/WORKPASS40_CHANGED_FILES_2026-10-14.json`. Use `npm run install:all` to install both app and runtime dependencies strictly from their committed lockfiles; it validates lockfile root identity/version, bounds registry retries, and stops on the first failure. Do not claim production build is verified until `npm run build` completes in an environment with registry access and locked packages installed.

## Structure

- `runtime/neuro-kurisu` — **canonical runtime**, Neuro-Kurisu 35.63.0, schema 225.
- `app` — Grok Workspace delivery shell: routing, UI, chat, HUD, Labs, auth/data infrastructure.
- `runtime/neuro-kurisu/public/live2d` — sole canonical Live2D model/motion/texture owner; `app/public/live2d` contains only app-owned viewer/vendor pieces in the compact source archive, with 21 hash-pinned shadows hydrated before Vite dev/build.
- `app/src/legacy/avatar` — real legacy sprite compatibility surface using assets in `app/public/sprites`.
- `research/neurocore-v143` — research-only NeuroCore V143.
- `research/nomega-pass20` — governed NOMEGA research branch.
- `research/deepcode` — research-only DeepCode v21.
- `legacy` — historical branches, exact uploaded input archives and provenance snapshots.
- `contracts` — ownership, integration, verification and generated inventory contracts.
- `docs` — navigation, architecture, gaps and runbook.
- `tools` — project startup, gateway and repeatable audits.

## Ownership

There is exactly one writable organism owner: `runtime/neuro-kurisu`.

The browser never instantiates a second organism brain. UI state is a projection of the runtime HTTP API. Live2D and legacy sprites render canonical emotion/embodiment state but do not own cognition. Research candidates are isolated behind `research/research_bridge.py` and cannot auto-promote or dual-write canonical state.

See `contracts/OWNERSHIP.md` and `docs/ARCHITECTURE.md`.

## Run

Development:

```bash
npm run install:all
npm run dev
```

Production-style local start:

```bash
npm run install:all
npm --prefix app run build
npm run start
```

Gateway: `http://127.0.0.1:8080`.

## Verification

Fast structural/runtime-source audit:

```bash
npm run audit:quick
```

Full historical runtime suites remain under `runtime/neuro-kurisu/package.json`; research suites remain isolated by design.

The distribution does not ship `node_modules`. Camera, microphone, Gemini and Kobold are external capabilities; unavailable providers/hardware are surfaced as unavailable/degraded instead of fabricated success.

## Provenance

`contracts/inventory/provenance-2026-10-06.json` contains SHA-256 records for the exact uploaded source archives. The full original branches are preserved under `legacy/`.

## Documentation map

Start with `docs/START-HERE.md`, then `docs/ARCHITECTURE.md`, `docs/INVENTORY.md`, `docs/CONFLICTS-AND-GAPS.md`, `docs/DEFINITION-OF-DONE.md` and `docs/RUNBOOK.md`.

## 2026-10-08 — WILL integration Pass 2

The current SUPER tree includes the completed 16/16 dedicated WILL integration block in canonical-adapter mode: agency/reafference, portable continuity/competence, known entities/conversation aims, context accounting, deterministic HNSW-style retrieval, transport ACK/replay, record-chain integrity, LLM attribution, SDK, MCP-compatible JSON-RPC and isolated channel adapters.

The broader project sweep also fixed a concurrent `FileStateStore` save race and restored the live canonical self-agency authority bridge. Runtime, smoke, persistence, architecture, integrity, forensics and source-truth gates pass. The remaining release blockers are environment-gated UI/browser clean-room tests and long-duration release evidence; these are not falsely marked complete.

### Operational commands

`npm run doctor` · `npm run install:all` · `npm run start` · `npm run backup` · `npm run restore` · `npm run migrate` · `npm run sbom` · `npm run freeze` · `npm run release:verify`

The active UI exposes the canonical runtime through the Runtime Atlas plus WILL/Lumina/Hexis control consoles.

## FINAL4 external-source integration

The current release includes selected, adapter-only mechanisms from Conscio 4.8.2. Conscio FTS5/BM25/trigram/RRF retrieval, quarantined skill federation, peer liaison, confidence calibration, evidence-required claims and metabolic advisory are integrated without creating a second cognitive or memory owner. External source archives are preserved under `legacy/input-archives/` with provenance metadata.


## MemoryOS2 retrieval evaluation (WorkPass 11)

The canonical memory runtime includes a reproducible, offline baseline-vs-MemoryOS2 evaluation path. It accepts a read-only `MemoryOSState2` snapshot, independently labelled query JSONL, and a provenance manifest. The tool checks duplicate/unknown labels, split leakage, corpus identity, retrieval-policy fingerprints, ranking determinism, and paired-bootstrap confidence-bound sensitivity. It never changes live memory and never automatically promotes a candidate.

See `docs/MEMORY_RETRIEVAL_EXPERIMENT_PROTOCOL_2026-10-10.md` for the format and command. From `runtime/neuro-kurisu`, run `npm run run:memory-retrieval-experiment -- --help`. The included test fixture is synthetic and is not production-uplift evidence; a real independent corpus must be supplied for that conclusion.


## MemoryOS2 retrieval evidence gates (WorkPass 12)

The offline retrieval experiment now checks both recall uplift and uncertainty-aware MRR non-inferiority. Its report lists every promotion gate and each bootstrap seed's failures. Invalid explicit seeds block eligibility. CLI output is atomically published without overwriting an existing report. These gates still require independent labeled data; synthetic regression fixtures are not production evidence.


## Current release status (WorkPass 13 — 2026-10-10)

The current weighted implementation roadmap estimate is 67.80% (fixed WorkPass 7 weights, re-evaluated using WorkPass 8–12 evidence). A normalized 40-deliverable inventory reports 23 DONE, 9 PARTIAL and 8 TODO. This is implementation progress, not release readiness. The full React/Vite build, browser/mobile/Live2D E2E, independent real-corpus MemoryOS2 evaluation, clean-room recovery/rollback, soak and final SBOM/provenance remain open.

Run the metadata/lockfile contract check with `npm run audit:release-metadata`, the normalized fixture tests with `npm run test:release-metadata-contract`, or the combined WorkPass 13 audit with `npm run audit:workpass13`. A UI clean-install attempt during this workpass was blocked by npm registry DNS (`EAI_AGAIN`); no successful production build is claimed.

Current status details and next stage plan: `docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS13.md`; weighted breakdown: `docs/PROJECT_PROGRESS_SCORECARD_2026-10-10_WORKPASS13.json`; normalized per-deliverable inventory: `docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS13.json`.


## Current release status (WorkPass 14 — 2026-10-10)

The normalized inventory contains 42 unique deliverables: 25 DONE, 9 PARTIAL and 8 TODO. The weighted implementation-roadmap estimate is 67.95%; this is not release readiness. WorkPass 14 isolated the PWA/share-card unit tests and made browser-smoke baseline comparisons fail closed on new errors or UI drift.

Run `npm run test:app:scripts` for the source-only UI script suite (202 tests), or `npm run audit:workpass14` for the combined pass. Full app TypeScript tests, React/Vite production build and Playwright browser E2E remain unverified because dependencies are not installed and the npm registry previously returned DNS `EAI_AGAIN`.

Current status: `docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS14.md`; scorecard: `docs/PROJECT_PROGRESS_SCORECARD_2026-10-10_WORKPASS14.json`; task inventory: `docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS14.json`.

### WorkPass 15 — evidence pipeline regression gates

- Run `npm run test:runtime-evidence-bus` for stable event IDs, payload bounds, snapshot/counter continuity and malformed-snapshot normalization.
- Run `npm run test:outcome-verification-hardening` for immutable verifier context, strict external observation receipts and fail-closed verifier failures.
- Run `npm run test:server-smoke-poll` for bounded startup/child-exit behavior, then `npm run audit:workpass15` to combine it with reafference, agency, memory, runtime typecheck, UI/API linkage and asset-reference checks.
- A passing source/runtime audit does not imply the app dependencies are installed or that React/Vite/browser E2E passed. Use `npm run install:all` from an environment with registry access, then run the full app build and browser gates.

## Current release status (WorkPass 16 — 2026-10-10)

The normalized inventory now contains 51 deliverables: 34 DONE, 9 PARTIAL and 8 TODO. Weighted implementation progress is 68.65%, not release readiness. WorkPass16 makes browser smoke enforce blocking brand warnings and auth-configuration divergence, records indeterminate auth probes explicitly, bounds the timeout override, and atomically publishes private verdict JSON. The source-only app script suite passes 212/212. Direct app typecheck currently fails with TS2688 (missing `@types/node` and `vite/client`); `npm run build` fails with `spawn vite ENOENT`. `npm ci` timed out after 120 seconds and created no `app/node_modules`. Full React/Vite build and actual Playwright E2E remain unverified.

Run `npm run audit:workpass16` for the bounded runtime/source-only gate. Run `npm run audit:workpass16:memory-experiment` for the separate multi-seed offline retrieval experiment. These commands do not claim browser E2E or production build success.


## WorkPass 17 — autonomous project research closure (2026-10-10)

The autonomous-project DAG now distinguishes internal context from independent external research. The repeat step uses the existing allowlisted HTTPS research adapter, preflights network policy and URL before budget/retry consumption, and remains incomplete until the EvidenceFirewall promotes corroborating evidence. External promotion requires diverse source identities and content hashes. Evidence ingestion no longer completes arbitrary current project steps, and unrelated tool failures do not consume the active step's retry budget.

Run the focused gates with `npm run audit:workpass17`. WorkPass 17 does not claim real provider execution, React/Vite production build, browser E2E, or release readiness.


## External project research (WorkPass 18)

External project research is disabled unless explicitly enabled. When enabled, the adapter uses HTTPS only, pins the outbound connection to a DNS-resolved public address, revalidates each redirect against the host allowlist, bounds redirects/time/bytes, and rejects non-text responses. A specific research query is required before the request; at least three distinct topic terms must be present, and the fetched page must pass a lexical relevance gate before it can be admitted as external evidence. The query hash scopes the canonical firewall claim so that two different questions cannot corroborate each other.

Example operator configuration (replace the example hosts and URLs with sources you are authorized to use):

```bash
NEURO_PROJECT_NETWORK_ENABLED=1
NEURO_PROJECT_NETWORK_ALLOWLIST=research.example.org,docs.example.org
NEURO_PROJECT_RESEARCH_URL=https://research.example.org/paper
NEURO_PROJECT_RESEARCH_URL_2=https://docs.example.org/reference
NEURO_PROJECT_RESEARCH_QUERY="the specific hypothesis or topic to examine"
```

The relevance check is lexical, not a semantic proof that a source entails a claim. A successful live provider run is still required before external research promotion is considered operationally validated. Run `npm run test:external-project-research-transport` for deterministic transport-policy regression tests or `npm run audit:workpass18` for the focused workpass gates.
## Canonical research memory (WorkPass 19)

External research shares the existing `MemoryOS2` memory owner; it does not create a second memory database. A single source is retained only in the bounded research session. After the EvidenceFirewall observes distinct publisher identities and distinct page hashes for the same query, eligible excerpts may enter long-term recall as **hypotheses only**, with a capped confidence and source URL/hash/time provenance. A conflict quarantines those notes again. Publisher identity is derived from the serving host to avoid counting ordinary subdomains as independent sources; distinct pages from one publisher no longer create a false contradiction unless the same document changes content.

This is provenance and source-diversity handling, not semantic proof that sources entail a claim. The next implementation step is claim-specific support/refute/unknown verification; live research providers and the full React/Vite + browser/Live2D release path remain release gates. Run `npm --prefix runtime/neuro-kurisu run audit:workpass19` for the focused runtime integration path, or `npm run audit:workpass19` for the broader current workpass gates.



## WorkPass 22 — optional local NLI and conservative claim aggregation

The canonical runtime can optionally ask a local cross-encoder NLI service to score premise/hypothesis pairs. This feature is **off by default**; without `KURISU_RESEARCH_NLI_ENDPOINT`, research uses the conservative direct-text anchor path and does not claim semantic verification. NLI softmax scores are explicitly uncalibrated. Mixed/refuted claims cannot receive positive project credit; model-assisted positive credit requires support across at least two independent source-lineage families.

To run the optional local service, install its extra dependencies (`python3 -m pip install -r research/requirements-nli.txt`) and start `python3 tools/research_nli_server.py`. Configure the runtime with `KURISU_RESEARCH_NLI_ENDPOINT=http://127.0.0.1:8798/v1/nli`. Set `KURISU_RESEARCH_NLI_TOKEN` on both processes if using a protected remote HTTPS service; do not expose the loopback service to a network without a token. Thresholds can be adjusted through `KURISU_RESEARCH_NLI_MIN_SCORE` and `KURISU_RESEARCH_NLI_MIN_MARGIN`. Evaluate a fixed labelled holdout before treating these scores as reliable.

Run `npm run test:research-nli` and `npm run audit:workpass22` for deterministic integration gates. These tests use mocked inference and do **not** establish real model quality, calibration or a retrieval uplift. UI production build and browser E2E remain open.


## WorkPass 23 — safe batched local NLI and holdout evaluation

The opt-in local NLI service now pins the default DeBERTa cross-encoder to immutable upstream commit `a150876415327c80daeff35ca6f68f5ed8cf5c24`, refuses mutable revisions, loads safetensors only, disables remote model code and caps worker concurrency. Runtime claim assessment batches up to 24 premise/hypothesis pairs in one local inference request. Existing custom single-pair backends remain supported.

```bash
python3 -m pip install -r research/requirements-nli.txt
python3 tools/research_nli_server.py
python3 tools/evaluate_research_nli.py /path/to/labelled-holdout.jsonl --output /path/to/nli-evaluation.json
```

The JSONL rows require `premise`, `hypothesis` and `label` (`entailment`, `contradiction`, or `neutral`); `id` is optional but must be unique when provided. The evaluator records the exact dataset SHA-256 and reports accuracy, macro/per-class F1, confusion matrix, Brier score, cross-entropy and top-label expected calibration error. It never writes the source text into the report. HTTP is permitted only for loopback; sending text to a non-loopback HTTPS endpoint additionally requires `--allow-remote`. Use a genuinely held-out, domain-relevant dataset; do not tune thresholds on the evaluation split. The sandbox used for WorkPass23 could not resolve the package registry, so real pretrained inference remains an open gate rather than an asserted success.


## WorkPass 24 — NLI readiness, bounded load retry, and model-version provenance

The optional local NLI server now separates process liveness from model readiness: `/livez` and `/healthz` remain healthy while a model warms, whereas `/readyz` returns HTTP 503 until the pinned model is loaded. Use `python3 tools/research_nli_server.py --lazy-model-load` only when a supervisor needs the HTTP process to start before model warmup; default startup remains fail-fast. Model-loading failures expose only a sanitized failure code and use a bounded cooldown so each inference request cannot trigger another repeated model download attempt.

Each claim assessment preserves model ID and immutable revision through quote-level provenance and aggregate reporting. An assessment that switches model identity during evaluation becomes `unknown`; restore rejects semantic quotes that conflict with their parent assessment's model identity/revision. Legacy snapshots without revision metadata remain readable, but should not be treated as revision-attested evidence.

Run `npm run audit:workpass24` for the source-side implementation gate. This environment did not download real model weights or install UI dependencies, so passing mocked service tests is not a real-model quality claim and the production UI build remains open.


### Optional local NLI calibration (WorkPass 25)

NLI scores remain raw/uncalibrated by default. A reviewed calibration set can produce a candidate temperature-scaling artifact; see [`docs/RESEARCH_NLI_CALIBRATION.md`](docs/RESEARCH_NLI_CALIBRATION.md). Calibration is local-first, requires at least 50 reviewed examples per NLI class, binds to the exact model revision and never auto-promotes thresholds. A calibrated class score is not a probability that the external claim is true.


### WorkPass27 MemoryOS2 retrieval coverage and BM25 baseline

- Token posting lists now preserve all matches inside the existing 1600-memory corpus cap instead of silently retaining only the first 96 IDs. Search still scores a bounded 192 candidates, ranked by IDF, query-term coverage, exact phrase and deterministic temporal/recency/value tie-breaks.
- Hashed-vector cosine no longer gives unrelated/orthogonal candidates a free 0.5 similarity.
- Offline retrieval reports now compare the canonical candidate with true Okapi BM25 (`k1=1.2`, `b=0.75`) and record its configuration fingerprint. The current synthetic fixture shows the candidate behind BM25 at Recall@5, so promotion stays blocked pending an independent temporal holdout.

### WorkPass26 temporal MemoryOS2 inspector

The canonical memory inspector now offers read-only current, point-in-time and all-revisions inspection through Runtime Atlas. Archive mode retains expired/superseded revisions, absent `asOfAt` uses current time, and inspector preview operates on an isolated snapshot. Run `npm run audit:workpass26` for the current integration gates. This does not promote Memory 2.0: independent labelled temporal holdout/BM25 comparison, frontend production build and browser/Live2D E2E remain open.


### WorkPass28 — numeric retrieval correctness

MemoryOS2 and its Okapi BM25 comparator now retain standalone one-digit numeric terms (for example status `1` or measurement `0`), while continuing to ignore one-letter words. The retrieval fingerprint includes the tokenizer/algorithm version. English/Russian numeric-retrieval and temporal-expiry regressions pass. The corrected small synthetic fixture is at Recall@5 parity with BM25, not superiority; an independent labelled temporal holdout remains required before retrieval promotion.

## Optional local semantic memory search (WorkPass33)

The canonical MemoryOS2 store now supports opt-in embedding reranking in the Memory Inspector. Start a local Ollama server and install an embedding model (default: `embeddinggemma`), then check **“Семантический поиск (локальная модель)”** in Runtime Atlas. The endpoint is loopback-only by default; no cloud service or API key is required.

Configuration: `NK_EMBEDDINGS_ENABLED=0` disables the feature; `NK_EMBEDDINGS_PROVIDER=ollama` (default) uses `http://127.0.0.1:11434/api/embed`; `NK_EMBEDDINGS_MODEL=embeddinggemma` selects the model. For llama.cpp, use `NK_EMBEDDINGS_PROVIDER=openai-compatible`, `NK_EMBEDDINGS_BASE_URL=http://127.0.0.1:8080/v1`, and set `NK_EMBEDDINGS_MODEL` to the loaded embedding model alias. Non-loopback endpoints require explicit `NK_EMBEDDINGS_ALLOW_REMOTE=1` and HTTPS. Provider errors automatically fall back to the existing BM25/fuzzy/graph search. The embedding index is derived and bounded; it never becomes a second source of memory truth. For semantic retrieval inside the live cognitive cycle, explicitly set `NK_EMBEDDINGS_RUNTIME_ENABLED=1`; it defaults off. Its foreground budget is `NK_EMBEDDINGS_RUNTIME_BUDGET_MS=220` ms, and slow inference falls back immediately to lexical/fuzzy retrieval while at most one bounded index-warming job runs in the background.

### WorkPass34: optional semantic recall in the live cognitive cycle

The embedding-backed path is now connected to the normal memory retrieval inside `OrganismCore.observe`, not only the Memory Inspector. It remains opt-in: set `NK_EMBEDDINGS_RUNTIME_ENABLED=1` after configuring Ollama or the llama.cpp-compatible embeddings endpoint. The default foreground budget is `NK_EMBEDDINGS_RUNTIME_BUDGET_MS=220` ms (50–1000 ms); slow inference returns the canonical BM25/fuzzy result immediately while a single bounded index-warming job may continue. The derived embedding index is not a second memory store. Real-model performance and independent retrieval-quality uplift remain unverified until tested on the target machine.


## WorkPass65 update (2026-10-19)

The archive revision gate now requires concrete reconciliation evidence (bounded provider receipt ID or authoritative confirmed-not-executed status), matching request/execution/tool identities, and a finite monotonic timestamp. Run `npm run test:workpass65` from the repository root. This does not replace live provider/device or production browser E2E.

## WorkPass68 — speech side-effect truth and gateway ownership (2026-10-19)

Physical Termux speech invoked by `EmbodimentRuntime` now dispatches through the canonical `OrganismCore.executeTool` → `ActionGateway` path with stable `speechEventId` and idempotency key. `completed`, `not-started`, and `unknown` outcomes remain distinct; a post-start timeout/non-zero exit does not become a false no-effect failure and cannot earn failure-learning credit. Local fake-process/gateway regressions pass. Live Android audio postcondition, dependency-complete app build and browser/Live2D E2E remain open. See `docs/WORKPASS68_HANDOVER_2026-10-19.md`.

## WorkPass73 — local LLM response-boundary hardening (2026-10-19)

The active `llama.cpp` chat provider now reads real Fetch response bodies incrementally and cancels chunked responses when they exceed the 2 MiB byte budget, rather than buffering the entire response before checking its size. A regression covers the missing-`Content-Length` case and is wired into the active validation workflow.

Implementation notes, commit links, and the evidence boundary: [WorkPass73 handover](docs/WORKPASS73_LOCAL_LLM_STREAM_BOUNDARY_2026-10-19.md). The patch remains **implemented, pending CI observation** until a run on the new head is confirmed. This is transport/resource hardening, not proof of real-model quality or production readiness.


## WorkPass74 — local LLM first-choice routing (2026-10-19)

When `LLAMA_CPP_URL` is configured, the server request path selects local `llama.cpp` first, preserves the existing fallback chain, and applies a bounded cooldown after repeated endpoint failures before retrying. A regression covers selection, cooldown, and recovery. This does not by itself prove real-model inference or production readiness. See [WorkPass74 handover](docs/WORKPASS74_LOCAL_LLM_SELECTION_2026-10-19.md).


## WorkPass97 — Node.js 24 and continual-learning retention (2026-10-20)

The active cognitive branch now uses `actions/checkout@v7` and `actions/setup-node@v7` (Node.js 24 action runtime), sets the test runtime and `.nvmrc` to Node.js 24, and adds CI assertions for the runtime version, cognitive-core ownership and runtime smoke integration. A learning bug was fixed so fresh skill evidence refreshes the retention clock even when the validation score changes by less than the update threshold. See [WorkPass97 implementation and verification boundary](docs/WORKPASS97_NODE24_LEARNING_RETENTION_2026-10-20.md). The newly expanded workflow must pass on the new head before this pass is called CI-verified.


## WorkPass98 — multi-timescale continual replay (2026-10-20)

P23 consolidation now reserves 32 of each 64-item large replay batch for recent experiences and 32 for older experiences, selecting historical representatives across context/action strata before filling by surprise and deterministic age tie-break. This adapts the design principles of [ARROW / WMAR](https://arxiv.org/abs/2401.16650), [Task-Agnostic Continual RL](https://arxiv.org/abs/2205.14495), and [Forget-and-Grow](https://proceedings.mlr.press/v267/kang25c.html) to NK1's existing TypeScript symbolic/context-action learner; no framework-specific upstream code or new Python/PyTorch dependencies were imported. Regression tests assert the 64-item budget, exact recent quota, retention of older experiences, and unique replay selections. The same pass fixes Node.js 24 CI setup by disabling setup-node's implicit npm cache in workflows without a root lockfile and removes a duplicate YAML cache key. See [continual-learning research notes](docs/CONTINUAL_SKILL_LEARNING_RESEARCH_2026-10-20.md) and [WorkPass97/98 implementation note](docs/WORKPASS97_NODE24_LEARNING_RETENTION_2026-10-20.md). CI on the newest head has passed Node 24 setup, runtime contract audit, Actions compatibility audit, core ownership audit and runtime smoke; remaining learning/regression jobs are still running, so the whole pass is not yet CI-verified.
