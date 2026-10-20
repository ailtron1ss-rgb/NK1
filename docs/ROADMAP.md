# NK1 v2.0 rebuild roadmap

Execution branch: rebuild. Stable branch: main (do not modify as part of island work). Island promotion requires code, tests, one-command start, docs and exact-head CI; merge only after review.

## Stage 0 — control plane
- [x] Create isolated rebuild branch from WorkPass93 baseline.
- [x] Write rebuild charter and six-island Definition of Done.
- [x] Document 12-layer target architecture and cross-island contracts.
- [x] Persist CHANGELOG and checkpoint pointers.
- [ ] Confirm latest Actions on branch baseline and current WorkPass93/94 findings.

## Stage 1 — core island
- [ ] Trace one production cycle from perception through plan, EthicalGate, ActionGateway, reafference and reflection.
- [ ] Remove any direct side-effect path that bypasses canonical authorization/receipt verification.
- [ ] Define the smallest versioned cycle/event contract and enforce it on the live path.
- [ ] Add regression for malformed/stale/cancelled events and no-side-effect bypass.
- [ ] Run focused tests, runtime typecheck and exact-head CI.
- Exit: one-command core test/start, documented owners, no unverified bypass in the exercised path.

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
- [ ] Fix repeated expression application and unsafe localStorage access from WorkPass94 findings.
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
