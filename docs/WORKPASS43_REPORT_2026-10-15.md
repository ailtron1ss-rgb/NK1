# WorkPass 43 — deep implementation pass (2026-10-15)

## Executive result

This pass made actual changes to the canonical WorkPass42 source tree. It did not import whole upstream runtimes or create a second organism. It repaired a concrete autonomous execution bypass, joined the resulting durable receipt to the existing causal fabric, made the receipt projection restart-aware, hardened exact external-outcome attribution and duplicate tool registration, and strengthened the existing Live2D bridge while retaining the UI's Legacy fallback.

**Current runtime:** Neuro-Kurisu 35.64.0, state schema 225. **Root package:** 35.0.0-super-workpass43. **Release status:** implementation workpass; not release-ready. The weighted roadmap stays at 78.0%; this pass does not replace the open real-provider, browser E2E, holdout, rollback, license and soak gates.

## 1. Actual integration work

### 1.1 Autonomous tools no longer bypass the canonical coordinator

`runtime/neuro-kurisu/src/organism/core/OrganismCore.ts` previously allowed the autonomous resource-tool planner to invoke `ActionGateway.executeTool` directly. That path was a distinct call route around `OrganismCore.executeTool` and its ordinary finalization/checkpoint behavior. The planner now calls the core coordinator, which in turn uses the existing gateway receipt contract. No second executor, ledger, or state owner was added.

The intention key is deterministic from `{version, tick, toolId, planner}`. It intentionally excludes the changeable textual scarcity/reason value. The planner emits a deterministic CEF `plan` node with an ID derived from the same intention and passes that exact ID as `decisionId`. A retry reuses the decision node rather than creating a competing plan ID; conflicting reuse of an explicit event ID is rejected. This makes the causal route explicit: **plan → tool-action → tool-outcome → tool-evidence**.

Before executing, the planner rechecks unresolved receipts. A pending receipt or completed receipt with no replayable response suppresses new autonomous calls. Recovery-required, ledger-full and storage-failure results produce an explicit reconciliation event and are not counted as competence failures. The autonomous controller now records its result by exact `executionId` and refuses to count the same receipt twice; this repairs the accounting/checkpoint gap without repeated learning credit.

### 1.2 CEF receipt projection is integrated, not parallel

`CognitiveEventFabric.ts` is still a bounded causal ledger, not a memory or world-state owner. Its new `appendToolReceiptTrace()` writes three linked nodes for a receipt and maintains a bounded `executionId → node IDs` projection index. Replaying the same still-retained receipt returns the original IDs without producing additional nodes.

The existing snapshot normally exposes the latest 96 nodes. To preserve indexed receipt traces older than that ordinary window without retaining arbitrary old observation text, the snapshot now carries only the additional sanitized receipt nodes needed by its live replay guards. On restore, the projection index accepts a row only if all three nodes exist with the expected stages, matching `executionId` and required action→outcome→evidence edges. As the event ring evicts a trace, its replay-guard row is pruned; a stale index cannot point at missing nodes indefinitely. If the whole old trace has naturally aged out, a receipt replay can rebuild a current trace rather than returning dangling IDs.

The receipt projection stores bounded metadata (tool, execution ID, result class, confidence/basis, verifier observation ID and booleans indicating whether postconditions existed/integrated). It deliberately does **not** store the postcondition prose in this extra cross-tick journal, avoiding a second copy of potentially sensitive content. Existing canonical verification/observer flows continue to own the full observation and learning decisions.

Tool traces are explicitly excluded from the denominator of same-tick operational-cycle coverage; adding a cross-tick action receipt must not distort the existing observation→prediction→action→outcome→learning→self-update metric. Normal operational cycle verification remains unchanged.

### 1.3 Exact correlation and registry integrity

`OutcomeCognitionFabric.resolveExternalObservation()` no longer selects an outcome using only a matching tool name when `executionId` is missing. It requires an exact non-empty execution identity and then matches both `executionId` and tool. This is necessary when two calls to the same tool are concurrent or adjacent; a result without a receipt identity is not allowed to award the wrong action learning credit.

`ActionGateway.registerTool()` now rejects duplicate tool IDs instead of silently replacing the previously registered executor or its capability contract. No automatic replacement behavior was introduced. An intentional replacement must be designed as an explicit audited operation in a later change, not happen as a side effect of startup order.

### 1.4 UI/Live2D boundary protection

`AvatarStage.tsx` checks both exact origin and the actual iframe `contentWindow`, requires a plain object and known message types, bounds readiness/error payloads, validates supported expression names and wraps `localStorage` read/write in try/catch. An invalid saved mode falls back to `live2d`; `legacy` remains a valid user-selectable mode.

`app/public/live2d/viewer.html` accepts control messages only from `window.parent` at the current origin. It validates message shape, expression allowlist, motion group/index, tap zone, finite numbers and permitted ranges before changing the model. The existing viewer and canonical model assets are preserved. CDN fallback policy was not silently changed; offline/CDN policy remains a separate supply-chain decision from this message-boundary patch.

## 2. Source-project decisions applied to this pass

This patch deliberately applies patterns at the existing architectural boundary rather than bulk-importing upstream code:

- **WILL:** use the real execution identity/outcome route as the foundation for reafference and future delayed skill credit; do not create another action arbiter or learner.
- **Microsoft Agent Framework / OpenAI Agents SDK:** prefer typed, exact correlation and middleware/finalizer contracts at the ActionGateway boundary; do not add a second orchestration runtime.
- **OpenClaw / Hermes:** adopt fail-closed receipt/recovery and security-boundary discipline; do not import another gateway/session owner.
- **Lumina:** keep tool creation/approval and memory consolidation inside the existing capability and MemoryFabric lifecycle; this pass does not copy its dreaming/store subsystem.
- **Hexis / Mem0:** retain provenance and lifecycle semantics in MemoryOS2/MemoryFabric; no second database or write owner was introduced.
- **llama.cpp:** continues as a local-provider adapter, not a bundled engine; real target-host inference was not addressed or claimed here.
- **Chroma / FAISS / DSPy / Agent0 / Hyperon / AutoGPT / AutoGen / Langroid / OWL / PocketFlow / Superpowers:** remain benchmark, selective reference or research/methodology candidates according to the attached source decision matrix. No bulk import, unmeasured retrieval replacement or license-sensitive copy was made in this pass.

The archive contains the prior `Plants.md`, `syns.md` and `dous.md` strategy/audit documents plus their source decision, findings and release-gate matrices under `docs/integration-analysis/`, so the next pass can continue from the same evidence without repeating discovery.

## 3. Files changed or added

### Runtime behavior

- `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts` — canonical autonomous tool routing, stable intention/plan node, unresolved receipt gate, exact result/accounting behavior, receipt CEF projection in finalizer.
- `runtime/neuro-kurisu/src/organism/system/ActionGateway.ts` — duplicate tool-ID guard and unresolved execution counting.
- `runtime/neuro-kurisu/src/organism/system/CognitiveEventFabric.ts` — stable supplied node IDs, receipt trace and replay index, exact snapshot/restore validation, sanitized receipt nodes outside recent-96 window, eviction pruning, unchanged operational-cycle metric semantics.
- `runtime/neuro-kurisu/src/organism/system/OutcomeCognitionFabric.ts` — exact external observation correlation.
- `runtime/neuro-kurisu/src/organism/system/AutonomousResourceToolLifeController.ts` — receipt-keyed controller accounting deduplication.
- `app/src/components/AvatarStage.tsx` and `app/public/live2d/viewer.html` — cross-window message source/origin/payload hardening while retaining the Legacy escape hatch.
- `runtime/neuro-kurisu/tests/big-pass-379-tool-receipt-integration.mjs` — 8 focused cases including restore window, ring eviction, stable plan ID, exact correlation and end-to-end keyed core receipt trace.

### Historical source integrity retained while code evolves

The first validation pass correctly caught that WorkPass42's active paths were also the byte source for older source-archive and 2026-10-06 snapshot manifests. Updating active code must not silently rewrite those historical meanings. I therefore preserved the original WorkPass42 bytes for `AutonomousResourceToolLifeController.ts`, `AvatarStage.tsx`, and `app/public/live2d/viewer.html` under SHA-256-named immutable blobs in `docs/archive-optimization/historical-snapshot-blobs/`, then pinned affected historical manifest entries to those blobs. The original archive member hashes remain unchanged; active source can evolve independently.

After this correction, all **8,512/8,512** members across four compacted historical source archives verify; the 2026-10-06 historical snapshot verifies **10,427/10,427** manifest entries and **18,935** content sources; the legacy deduplicated-file manifest resolves **3,873** entries with no missing sources or conflicts; and the 56-entry historical duplicate-path plan has no missing canonical sources or conflicts. The old bytes are retained, not overwritten or relabelled as the new active implementation.

### Version, process and integration docs

- Root: `package.json`, `SUPER_VERSION.json`, `CHANGELOG.md`, `README.md`, `Список дел.md`.
- Runtime contract: `runtime/neuro-kurisu/package.json`, `package-lock.json`, `VERSION.json`, `RELEASE_MANIFEST.json`, `src/organism/system/ReleaseContract.ts`.
- Cross-project contract: `contracts/integration-manifest.json`.
- Current records: `docs/PROJECT_CURRENT_STATUS_2026-10-15_WORKPASS43.{md,json}`, `docs/PROJECT_PROGRESS_SCORECARD_2026-10-15_WORKPASS43.json`, this report, task list, integration matrix and changed-files/proof manifests.
- Strategy bundle: `docs/integration-analysis/{Plants.md,syns.md,dous.md}` plus upstream integration/decision and finding CSVs.

## 4. Verification record

The exact independently run command outcomes are captured in `docs/WORKPASS43_AUDIT_RESULTS_2026-10-15.json`; changed/new files are itemized with SHA-256 pre/post hashes in `docs/WORKPASS43_CHANGED_FILES_2026-10-15.json`.

- Root/runtime release metadata: **34/34 PASS**; release metadata contract **6/6 PASS**.
- Runtime TypeScript typecheck: PASS; runtime smoke: PASS when run standalone.
- Restart-persistence: PASS when run standalone (20 cycles, restart and next-cycle assertion). A later full aggregate run timed out after entering the smoke stage although that same test passed in isolation; the aggregate run is explicitly **not** called a pass.
- New `big-pass-379-tool-receipt-integration.mjs`: **8/8 PASS**.
- ActionGateway keyed idempotency: **13/13 PASS**; durable receipt archive: **4/4 PASS**; WILL/reafference integration **1/1 PASS**, including persisted state, restart and delayed temporal assignment.
- Canonical asset hydration **6/6 PASS**; app script contracts **218/218 PASS**; browser-smoke contract **51/51 PASS**. These are unit/contract tests, not a real browser session.
- Source-provenance check **1/1 PASS** (464 locked npm components, eight canonical source archives); server import audit PASS (11 checked, no missing); UI/API linkage PASS (125 client routes, 49 Runtime Atlas surfaces, zero missing required seams); asset audit PASS with zero errors after removing all 21 generated app-side Live2D shadows.
- Historical sources: **8,512/8,512** compacted members; **10,427/10,427** historical snapshot entries and 18,935 source checks; legacy dedup manifest **3,873** entries with no missing sources/conflicts; duplicate restoration plan **56** entries with no missing source/conflict.
- Memory retrieval benchmark runs, but reports **zero recall uplift**; promotion correctly remains `not-promoted`.
- The changed TS/TSX files parse without syntax diagnostics and the inline Live2D JavaScript passes `node --check`.

Not verified and **not claimed as passed**: dependency-installed React/Vite build, interactive browser Live2D/Legacy E2E, complete aggregate `npm run audit:workpass43` execution (timed out after 300 seconds at the smoke stage despite isolated smoke PASS), the long autonomy suite, actual external provider/device receipts and reconnect, target-host llama.cpp inference, independent labelled temporal retrieval holdout, fault-injected clean-room rollback, manual nested-source licensing and long soak.

## 5. Remaining release gates and next pass

1. Inject process failure at four boundaries using an authoritative external executor: before side effect, after side effect/before finalizer, inside/after finalizer before completed-ledger commit, and after completed receipt commit before outer cycle checkpoint. Assert at-most-once external execution and recoverable exact trace/accounting after restart.
2. Exercise receipt archival under hot-ledger saturation and restore with duplicate/torn/corrupt archive rows; ensure a repeated operation is either replayed by the canonical archive or blocked for explicit reconciliation, never silently re-executed.
3. Install dependencies from lockfiles in a provisioned environment and run Vite production build plus browser tests for source/origin spoof, malformed message, unsupported expression, invalid storage, Legacy↔Live2D switching and real model readiness.
4. Run external host/provider receipt and reconnect tests and record independent observation provenance end-to-end through `ExternalObserverFabric`, `OutcomeCognition`, `CognitiveEventFabric`, WILL/reafference and canonical temporal credit.
5. Complete the independent labelled temporal memory holdout before promoting any Chroma/FAISS or other retrieval candidate; current recorded retrieval uplift remains 0.
6. Run clean-room install/upgrade/rollback fault injection, target-hardware inference measurements, nested LICENSE/NOTICE review and soak. Only then re-evaluate the weighted release score.

WorkPass 43 is a real implementation pass, but not release certification and not proof that every source project's mechanism has already been integrated. This pass closes the concrete receipt/correlation slice and packages the remaining work in an executable order.
