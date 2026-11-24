# NK1 v2.0 rebuild roadmap

Execution branch: rebuild. Stable branch: main (do not modify as part of island work). Island promotion requires code, tests, one-command start, docs and exact-head CI; merge only after review.

## Stage 0 — control plane
- [x] Create isolated rebuild branch from WorkPass93 baseline.
- [x] Write rebuild charter and six-island Definition of Done.
- [x] Document 12-layer target architecture and cross-island contracts.
- [x] Persist CHANGELOG and checkpoint pointers.
- [x] Confirm exact-head Actions passed for Live2D expression cache change (run 39397209551, head ae861fe76dfc2b2c38ced3293f80aff100672806); WorkPass94 browser/device findings remain open.

## Stage 1 — core island (IN PROGRESS)
- [x] Add runtime validation at the public OrganismCore.observe boundary before spine-only/full-cycle routing; reject malformed observations and invalid cycle modes before side effects.
- [x] Add deterministic regression for valid modes, malformed observations, invalid mode and non-mutation; wire it into the cognitive regression workflow on the rebuild branch.
- [ ] Trace one production cycle from perception through plan, EthicalGate, ActionGateway, reafference and reflection.
- [x] Add exact regression for keyed ActionGateway finalizer ordering, replay suppression and fail-closed behavior when finalization throws.
- [x] Guard the autonomous resource/tool/life planner against bypassing the canonical OrganismCore execution wrapper; keep full cross-path authorization tracing open.
- [x] Route fresh project-tool execution through the canonical core wrapper so unkeyed outcomes are finalized consistently; add a regression guard for this path.
- [ ] Remove any direct side-effect path that bypasses canonical authorization/receipt verification; project fresh execution now uses the core wrapper, while skill/reconciliation direct gateway call sites still require per-path classification and exercised integration coverage.
- [x] Reject malformed restored ActionGateway completion receipts unless receipt identity, outcome, audit and verification fields agree; invalid rows remain recovery tombstones and never trigger automatic re-execution.
- [ ] Define the smallest versioned cycle/event contract and enforce it on the live path.
- [ ] Add regression for malformed/stale/cancelled events and no-side-effect bypass.
- [ ] Run focused tests, runtime typecheck and exact-head CI.
- Exit: one-command core test/start, documented owners, no unverified bypass in the exercised path.

- [x] Deduplicate unchanged Live2D expression application to avoid repeated expression resets; regression is in CI.
- [x] Guard legacy avatar localStorage access and test missing/throwing storage; exact-head CI pending for this change.
- [ ] Reconcile browser speech synthesis, backend voice routes and Android bridge under an explicit status/interrupt contract.
- [ ] Verify actual browser rendering, asset hydration, microphone/STT permissions, visibility/unmount interruption, target-device performance and measured audio/phoneme lip-sync.

## Stage 2 — hierarchical memory
- [ ] Map existing MemoryOS2 to working/episodic/semantic/procedural responsibilities without adding a second store.
- [ ] Contract for query/evidence/revision/snapshot/restore and sleep-time consolidation.
- [ ] Verify corrected facts suppress superseded revisions and survive restart.
- [ ] Freeze independent labelled RU/EN holdout; compare against same-corpus BM25 and no-memory controls.
- Exit: integration/restart tests pass; quality promotion remains blocked unless independent holdout supports it.

## Stage 3 — motivation and autonomy
- [ ] Bound energy/threat/curiosity/stress/confidence state and explicit decay.
- [ ] Route initiative proposals through core scheduling, EthicalGate and ActionGateway.
- [ ] Record why an initiative was selected and what outcome was verified.
- [ ] Test no prompt/no input initiative, cooldown, duplicate suppression and shutdown.
- Exit: traceable initiatives plus a 24-hour soak with at least three valid initiatives; no synthetic timer claim substituted.

## Stage 4 — embodiment
- [x] Fix repeated Live2D expression application: cache the last mapped expression and apply only on transitions; regression is wired into CI (exact-head result pending).\n- [ ] Make LegacySpriteDeck localStorage access fail-safe.
- [ ] Unify correlation/cancellation across browser TTS and Android/Termux speech while preserving provider identity.
- [ ] Test speech interruption, iframe remount, visibility, stale messages and asset hydration.
- [ ] Run browser E2E, real audio and target-device tests separately.
- Exit: browser/device evidence recorded; source-only tests are not reported as physical audio proof.

## Stage 5 — self and learning
- [ ] Define evidence-backed SelfModel and UserModel updates, correction and expiry.
- [ ] Link confidence/knowledge gaps to journal entries and bounded research triggers.
- [ ] Gate skills/adapters against fixed holdout, retention, transfer and anti-forgetting tests.
- [ ] Add temporal continuity and explicit time-since-last-interaction handling.
- Exit: correction/reversal and delayed-retention tests pass; promotion only with independent evaluation.

## Stage 6 — validation and clean migration
- [ ] Compose-based one-command start from a clean checkout.
- [ ] CI on push and PR for lint/typecheck/unit/integration, UI build/browser E2E where dependencies permit, and Docker build.
- [ ] Audit imports, ownership, scripts, workflows, dependencies, SBOM/licences, asset provenance and exact duplicate groups.
- [ ] Remove old paths only after reference/provenance checks and replacement tests pass.
- [ ] Run restart/fault injection, security/rollback checks and 24–72h soak.
- [ ] Tag v2.0.0 only after all release gates and the 12-layer criteria are evidence-backed.
