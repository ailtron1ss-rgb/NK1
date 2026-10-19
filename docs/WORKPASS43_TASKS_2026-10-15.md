# WorkPass 43 task ledger and next-pass execution plan

> Canonical strategy: `docs/integration-analysis/Plants.md`, `syns.md`, `dous.md`. This list tracks code work, dependencies and acceptance evidence; it is not a substitute for the canonical release scorecard.

## Closed in WorkPass 43

- [x] **P0-A1 — route autonomous tool execution through one coordinator.** `OrganismCore` calls `executeTool`, not a direct Gateway executor path; stable idempotency identity binds tick, tool and planner.
- [x] **P0-A2 — create stable plan identity.** Autonomous action receives a deterministic CEF `plan` node and sends the exact node ID as the Gateway decision correlation. Repeat intent after restore reuses the same node; conflicting explicit ID usage is rejected.
- [x] **P0-A3 — project receipt to causal trace.** Finalizer writes `tool-action → tool-outcome → tool-evidence`, linked by event ID and `executionId`, into the existing CEF.
- [x] **P0-A4 — persist trace replay guard.** CEF snapshot includes receipt nodes that fall outside ordinary recent-96 window; restore checks identity/stage/edges; stale index entries are pruned after ring eviction.
- [x] **P0-A5 — do not train on unknown receipt state.** Pending or non-replayable receipts block new autonomous tools; recovery-required/storage-full conditions produce reconciliation events, not failed-competence training.
- [x] **P0-A6 — recover controller accounting idempotently.** `AutonomousResourceToolLifeController.record` returns false for a previously recorded `executionId` and does not increment success/failure/efficiency twice.
- [x] **P0-A7 — require exact external outcome identity.** External observation update now matches `executionId + tool`; missing ID is a typed refusal, not a tool-name fallback.
- [x] **P1-B1 — fail closed on duplicate tool registration.** Existing tool ID cannot silently replace a registered executor.
- [x] **P1-B2 — harden the avatar message boundary.** Parent/source, origin, schema and ranges validated; invalid localStorage and expression values do not corrupt renderer state; Legacy remains reachable.
- [x] **P1-R1 — align WorkPass43 version/contract.** Root/runtime/package lock/release contract/manifest/status records aligned to root WorkPass43, runtime 35.64.0 and state schema 225.
- [x] **P1-R2 — retain analytical context with source archive.** Embedded Plants/syns/dous documents and source-decision CSVs are included in the project archive under `docs/integration-analysis/`.

## Final validation note for this archive

The gate commands were run individually. The focused causal suite (8/8), keyed ActionGateway suite (13/13), durable ledger archive suite (4/4), reafference integration (1/1), runtime typecheck, standalone runtime smoke and standalone restart-persistence all passed. Archive contracts verified 8,512/8,512 compacted members and 10,427/10,427 historical snapshot entries after the active source changes were pinned away from immutable content-addressed historical blobs. The full aggregate `npm run audit:workpass43` timed out at the runtime smoke stage during a long chained run; standalone smoke then passed. Therefore the aggregate command is not recorded as a pass. App dependencies are absent; Vite production build and actual interactive Live2D/browser E2E remain open.

## Next major pass — execution order

### Phase A — durable action reconciliation (P0)

- [ ] **A01.** Add crash injection before side effect, immediately after side effect, after external verification, inside finalizer, after finalizer, before completed receipt persistence and after completed receipt persistence but before the outer cycle checkpoint.
- [ ] **A02.** Use a real local fake executor with an append-only side-effect counter and external receipt ID; on restart prove the counter increments at most once per stable key.
- [ ] **A03.** Verify `pending` and `completed-without-response` entries across process restart. The safe state must stay blocked until the same original request is reconciled or an explicit operator recovery decision is recorded.
- [ ] **A04.** Saturate the hot ledger, archive multiple pages, restart, replay old keys and check archive/hot duplicates are harmless. Complete-line corruption must fail closed; torn-final-append recovery must preserve complete receipts only.
- [ ] **A05.** Validate a stable idempotency key is bound to tool ID, canonical input, expected output schema, decision node and autonomy context; conflicting reuse must never invoke the executor.
- [ ] **A06.** Ensure CEF trace and OutcomeCognition record are persisted with the finalized receipt or a typed recovery state; no state may claim verified success before evidence persistence completes.
- [ ] **A07.** Build a reconciliation API/UX only if needed for actual pending receipts: list redacted receipt metadata, show why automatic replay is unsafe, allow an explicitly authorized retry/reconcile action, and record operator decision/provenance. Do not introduce a second ledger.

### Phase B — observation, reafference and learning closure (P0)

- [ ] **B01.** Connect an authoritative provider/device receipt using its real `executionId` to `ExternalObserverFabric`, `OutcomeCognitionFabric` and the CEF evidence node.
- [ ] **B02.** Prove a postcondition mismatch is recorded as contradiction/negative evidence, not discarded or converted into generic executor failure.
- [ ] **B03.** Prove missing external evidence remains unknown, not verified and not negative competence evidence.
- [ ] **B04.** Verify WILL reafference accepts only the exact decision/execution lineage and independent evidence; no same-name or same-tool attribution.
- [ ] **B05.** Verify immediate learning and delayed temporal credit do not assign the same reward twice; only delayed, independent, causally grounded assignments enter adaptive policy.
- [ ] **B06.** Verify replay of a finalized action returns the same receipt/event IDs, and replay never repeats external observation integration or temporal learning.
- [ ] **B07.** Add bounded trace diagnostics to the existing runtime API/Runtime Atlas so the UI can show “executed / verified / awaiting evidence / reconciliation required” based on actual receipt state, not a visual-only progress indicator.

### Phase C — memory lifecycle integration (P1)

- [ ] **C01.** Audit `MemoryFabric` lifecycle-command IDs, idempotency and 512-entry receipt horizon; identify the actual behavior after hot receipt eviction.
- [ ] **C02.** Port only the missing Hexis supersession/revert semantics into the existing `MemoryOS2` revision history. Supersede/revert must refer to canonical memory IDs and be replayable after restore.
- [ ] **C03.** Adapt Mem0 candidate extraction/update/conflict decisions as producers only; all writes go through `MemoryFabric.applyLifecycleCommand`/`MemoryOS2`.
- [ ] **C04.** Adapt Lumina temporal decay and dreaming as bounded candidates over canonical memory entries; no second database, `Palace`, or local memory store.
- [ ] **C05.** Store UTC-normalized timestamps and explicit source/independence lineage for temporal candidates; reject malformed times rather than silently reordering history.
- [ ] **C06.** Evaluate candidate policies with an independent, labelled temporal holdout and retention safety metrics. Do not promote retrieval algorithms while measured recall uplift remains zero.
- [ ] **C07.** Add restore/replay regression covering supersede → revert → compact/decay candidate → restore, with the exact same resulting canonical IDs and no duplicate write.

### Phase D — Live2D/UI delivery surface (P1)

- [ ] **D01.** Run dependency-installed React/Vite production build from lockfiles and preserve the canonical public-asset hydration contract.
- [ ] **D02.** Run browser E2E against actual Live2D profile: ready/error, supported expression, lipsync, gaze, tap/motion, unload/reload and unavailable-model fallback.
- [ ] **D03.** Negative test same-origin sibling frame, wrong source window, wrong origin, null/array payload, oversized fields, unsupported expression, NaN/infinity, wrong motion group and malformed localStorage.
- [ ] **D04.** Verify Legacy selection works if Live2D fails to initialize and switching back to Live2D restores state without duplicate listeners.
- [ ] **D05.** Decide CDN fallback policy explicitly (local pin vs opt-in remote fallback) after dependency/SBOM and offline behavior review; do not remove required app vendor assets blindly.
- [ ] **D06.** Verify avatar telemetry/embodiment values derive from current canonical runtime snapshot; no parallel emotion state or invented “alive” indicator.

### Phase E — provider/runtime reliability (P1)

- [ ] **E01.** Run llama.cpp on target hardware with pinned endpoint/model revision; record cold/warm latency, tokens/sec, RAM/VRAM, cancellation, timeout and restart behavior.
- [ ] **E02.** Verify provider status stays “configured but unverified” until a real request succeeds; mocked provider tests are not hardware evidence.
- [ ] **E03.** Exercise streaming abort, stale provider response, reconnect/backoff and request correlation. Late responses cannot mutate a newer conversation or action decision.
- [ ] **E04.** Verify API-side capability/authorization and tool approval occur before executor entry; denied tools create typed audit evidence and no side effect.

### Phase F — release durability and provenance (P1)

- [ ] **F01.** Install from the pinned lockfiles in a clean environment and run the full `npm run audit:workpass43` suite.
- [ ] **F02.** Perform install → upgrade → injected partial commit → rollback; verify byte/state invariants and prove all active processes can recover from the rollback lock.
- [ ] **F03.** Review each nested upstream archive's exact LICENSE/NOTICE and file-level origin before code porting. SBOM inventory is evidence, not a legal conclusion.
- [ ] **F04.** Run multi-hour soak for memory growth, descriptor/socket leaks, provider recovery, repeated receipt IDs and bounded CEF/receipt archive sizes.
- [ ] **F05.** Re-evaluate weighted roadmap only when evidence files exist for each closed gate. Keep the 78.0% score otherwise.

## Source-driven policy summary

- **WILL** is the preferred source for action reafference/skill learning, but only by adapting missing algorithms to the canonical ActionGateway/CEF/temporal-credit route.
- **Lumina / Hexis / Mem0** are candidates for memory lifecycle policy, never alternative persistence owners.
- **OpenAI Agents SDK / Microsoft Agent Framework / OpenClaw / Hermes** inform typed tool outcomes, guardrails, tracing and session recovery, not a second tool runtime.
- **llama.cpp** remains an external local inference server/adapter; do not vendor its engine or claim actual target-device performance without measurements.
- **Chroma / FAISS / DSPy / Agent0 / Hyperon / AutoGPT / AutoGen / Langroid / OWL / PocketFlow** remain benchmark or selective/reference/research-only until a specific gap, license/provenance and measurable acceptance are established.

## Acceptance invariants

1. No autonomous side effect without stable identity and durable pre-execution receipt.
2. No automatic replay of an ambiguous side effect; it is reconciled or explicitly quarantined.
3. Every committed receipt has an exact execution identity and a CEF plan/action/outcome/evidence chain or an explicit typed record explaining why no plan node is available.
4. External evidence and learning credit never resolve by tool name alone.
5. One organism runtime, one ActionGateway action owner, one MemoryOS2/MemoryFabric writable memory owner.
6. Legacy and Live2D remain working presentation choices with honest unavailable states.
7. No source code is copied without file-level provenance, license check and a target module/acceptance test.
8. No release readiness increase on the basis of synthetic metrics, static analysis or a passing unit test alone.
