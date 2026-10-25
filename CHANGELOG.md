## NK1 WorkPass529 — make signed outcome ingestion idempotent only across restart (2026-10-25)

- Fixed the verified-outcome trust boundary exposed by the Node 24 WorkPass108 CI run: re-ingesting an already-authenticated signed artifact into the same live ledger now rejects as duplicate-attempt.
- Preserved the intended restart path: restoring a ledger does not restore in-process cryptographic trust, so re-verifying the exact original signed artifact may re-establish its receipt without adding a duplicate row. Conflicting signed outcomes for the same task/method/seed/attempt remain rejected.
- The existing p23-signed-outcome-artifact.mjs regression already asserts live duplicate rejection; p23-verified-outcome-artifact-authentication.mjs checks re-attestation after restore and conflict rejection. A fresh CI rerun is required before this correction is considered validated.
- This was a real failure in an adjacent trust gate, not a failure of the focused character workflow; no claim is made yet that the full PR workflow set is green.

---

## NK1 WorkPass528 — preserve Core feedback when B272's proposed action diverges (2026-10-24)

- Fixed both `OrganismCore.feedback()` paths that credit B272. B272 now receives outcome learning only when its internally generated action matches the action actually selected by the canonical Core; on a mismatch, only B272's credit update is skipped. The mismatch no longer throws and interrupts B299 personality or other outcome learners. B272's strict action-match guard remains intact.
- Replaced the experimental live-personality harness with a focused 48-cycle `OrganismCore.observe() → feedback()` test using actual selected actions and world-transition evidence. It explicitly asserts that B272/Core action mismatches occur without cutting off the rest of feedback, that B299 continues learning, and that learned personality survives restore and has a measurable effect on candidate scores under B299 lesion.
- **Focused GitHub Actions PASS (Node 24, commit `21a8a20d99fbfe7ac11c37215a3f3d9eb14439e1`):**
  - 48 outcome cycles; B272/Core action mismatches observed: 28.
  - B299 learning updates: 48; verified updates: 48; context-credit assignments: 48.
  - Sum of absolute personality action-bias magnitudes: `0 → 0.0036059369`.
  - Restore preserved all seven action-bias values exactly.
  - B299 lesion candidate-distribution difference: L1 `0.0020404621`; maximum single-action delta `0.0004192327`.
  - The trust-boundary, P67 null/typed-value metadata, and P2702 hostile-snapshot regressions also passed in the same workflow.
- Supporting fixes carried through this pass: restored missing `LearningTrustBoundary.ts` using the shared plain-data snapshot helper; exposed its canonical node budget; normalized only nullable P67 dominant-drive labels and validated `AdaptiveValueWeights` fields according to their actual typed contract; separated push and pull-request workflow concurrency to avoid mutual cancellation.
- **Validation boundary:** focused behavioral and persistence regressions are green. Full semantic TypeScript typecheck has not been independently confirmed. Several broader PR workflows still fail on separate baseline issues (missing WorkPass291/293 npm script aliases, Node 24 strip-only syntax in WorkPass99, and the independent B272 intrinsic-drive/goal assertion in WorkPass287-288). This pass does not claim those unrelated workflows or end-to-end unseen-context generalization are all resolved.

---

## NK1 WorkPass527 — validate learned personality in live Core and restore missing trust boundary (2026-10-24)

- Added a live-Core developmental experiment that learns from every action actually selected by the organism over 72 feedback cycles, rather than discarding all outcomes except `verify`. It measures action counts, learned personality bias, snapshot/restore consistency, and the candidate-distribution difference between the same restored state with B299 active versus lesioned.
- Corrected the Node 24 launch mode for the Core-level test to `--experimental-transform-types`; `--experimental-strip-types` stops at a transitive TypeScript parameter property before the test can run.
- Restored the missing `LearningTrustBoundary.ts` dependency required by `PersonalCurriculumEngine`, using the current shared `PlainDataSnapshot` implementation and exporting its canonical node budget.
- Added a focused trust-boundary contract covering canonical identity strings, accessor non-invocation, approved capability identity, and hostile envelope rejection. Registered the new test in the focused personality workflow.
- Fixed a second live-runtime contract break: Core can provide null dominant-drive/attractor labels, while P67 treats those optional string labels as absent-or-string. P67 now normalizes only explicit nulls after safe snapshotting, and its regression covers this real-Core input shape.
- **Validation status:** shared trust-boundary and P2702 tests passed; the live-Core exercise then exposed P67's nullable-label contract mismatch. A fresh rerun after this correction is required; no live-Core generalization PASS is claimed yet.

---

## NK1 WorkPass526 — protect persistent character and correct causal personality credit (2026-10-24)

- Hardened `P2702PersistentPersonalityDynamics.restore()`: canonical identity invariants and vector names now come from code-owned Kurisu profile; restored vectors are finite, bounded and schema-aligned; counters, action preferences and relationship keys are sanitized.
- Corrected action-to-trait credit assignment. Positive/negative outcomes update semantically relevant adaptive traits (for example, explore updates adaptive research-curiosity expression and playfulness, verify updates composure/directness) instead of whichever trait happened to occupy the same array index. The canonical profile now separates stable curiosity from its learned behavioral expression.
- Restricted value adaptation to the values exercised by the action instead of moving all values together after every outcome.
- Enabled gradual self-belief-anchor updates only from verified identity observations. Malformed inputs are neutralized; invalid actions do not mutate personality state; action preferences retain a signed utility offset.
- Extended the P2702 regression for hostile snapshots, invariants, dimension lengths, semantic trait/value attribution, signed preferences, verified self-belief updates and snapshot round-trips. Corrected its expected `NeuralExperienceBranch` schema version, registered `npm run test:character-personality`, and added a dedicated Node 24 GitHub Actions workflow for this focused personality regression.
- **Validation:** the dedicated Node 24 personality regression passed on the PR head (`pass: true`, `learningUpdates: 1`, snapshot/restore and hostile-state assertions passed). A full semantic TypeScript typecheck was not run. Broader workflows triggered by the PR still have unrelated failures: WorkPass291/293 reference missing test-script aliases, WorkPass99 hits Node 24 strip-only TypeScript syntax, and WorkPass287-288 fails the B272 intrinsic-drive/goal assertion; those separate contracts are outside this pass and remain unfixed. Live-Core unseen-context generalization remains an open validation target.

---

## NK1 WorkPass525 — bind self-agency learning to trusted external receipts (2026-10-24)

- Added `learnVerifiedOutcome` as an explicit evidence-gated path on `PredictiveSelfAgencySubstrate`. It requires the exact verifier-minted frozen receipt and binds tool ID, execution ID, decision ID and the complete canonical input; serialized/copied receipts cannot carry the in-process WeakMap capability.
- The trusted verifier's confidence caps caller-provided causal match. The regular `learnOutcome` path is retained for simulation/research input but now rejects malformed signals/state and learns in proportion to causal credit; a zero match does not update policy weights, agency calibration or confidence counts.
- Added regressions for copied/fabricated evidence, mismatched decision linkage, valid receipt use, and zero/partial/full causal credit.
- This adds a safe integration API; a full live-runtime call-site migration is still a follow-on task. Source and tests are committed but were not executed in this pass.

## NK1 WorkPass524 — make self-agency learning respect causal evidence (2026-10-24)

- Scaled policy-gradient updates, agency-error updates and ownership/authorship adaptation by the observed action/outcome causal-match signal.
- A zero causal match now returns diagnostics without training the action policy, shifting agency calibration, changing ownership/authorship, or inflating confidence sample counts; weaker matches receive proportionally smaller updates.
- Added regressions for zero-, partial- and full-causal-credit behavior to the self-model/personality consolidation test. Runtime execution remains unverified in this pass.

## NK1 WorkPass503 — restore relationship self-model from validated plain data (2026-10-24)

- Replaced shallow relationship-state restoration with bounded, per-model plain-data snapshotting. Accessor-backed models and top-level state are dropped without getter execution.
- Rejects malformed social metrics, non-canonical/control-character identities, malformed project/commitment lists, and invalid timestamps; restores deduplicated models within the 64-model cap.
- Extended the existing relationship-model regression for valid roundtrip, malformed-model filtering, duplicate identities and hostile accessor snapshots. Added it to the personality category's rebuild test chain.
- Reuses the existing `PlainDataSnapshot` integrity helper rather than adding another sanitization implementation or dependency; preserves B288SocialPredictiveSelfOtherBrain as the documented canonical social-brain owner.
- **Validation boundary:** code and test-chain wiring are committed; test/typecheck execution remains unconfirmed.

---

## NK1 WorkPass502 — close relationship-model input and CI follow-ups

- Corrected the relationship-model control-character guard to use code-point checks instead of an incorrectly escaped regular expression.
- Kept the P26 script alias and Node 24 transform-mode fix from WorkPass501; CI reruns are active on the branch head.
- The new relationship-model boundary test remains pending execution; no test-pass claim is made here.

---

## NK1 WorkPass501 — repair CI script aliases and Node 24 TypeScript transform

- Added the missing `test:p26:learning-input-integrity` package-script alias required by the P26 validation workflow.
- Switched `test:p23:hermes-reflective-diagnostics` from strip-only TypeScript mode to Node's transform-types mode because the imported candidate store uses TypeScript parameter properties that strip-only mode cannot execute.
- This directly addresses observed CI failures (missing npm script and `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`); the rerun is pending.

---

## NK1 WorkPass500 — guard relationship-self updates

- `RelationshipSelf.observe` now rejects malformed identity strings and non-finite/out-of-range social evidence before mutating trust, warmth, guardedness, or predictability.
- Added and registered `test:relationship-self-input-boundary` to ensure invalid inputs do not create or update relationship models.
- This protects the user/social model from corrupted or malformed observations; the test is committed but not yet executed.

---

## NK1 WorkPass475 — make cycle and causal history evidence-consistent (2026-10-24)

- Personal curriculum snapshots now accept only bounded plain-data threads with consistent identity/schema, counters and [0,1] metrics; completion/suppression counts are recomputed, and a newly observed poor outcome can reopen a formerly satisfied thread.
- Unified-cycle restore preserves valid diagnostics from mixed malformed stage lists but never accepts malformed or count-inconsistent persistence as a completed cognitive cycle. All-invalid stage lists fall back to the required-stage list.
- Updated causal-learning fixtures to attach outcome credit only when the after-state identifies the selected action and its bounded success value. External/imported rows remain preserved for review but do not inflate trusted runtime outcome counters.
- Shared runtime typecheck now includes official Node type roots and excludes fallback declarations from semantic checking; correlation IDs are checked for C0/C1 controls before whitespace trimming.
- **Verification:** focused failures were found from real Actions logs and corrected. Exact-head functional reruns are in flight; full CI and behavioral improvement are not yet claimed.

---

## NK1 WorkPass474 — reconcile cycle diagnostics and ground causal test evidence (2026-10-24)

- Unified cognitive-cycle restore now keeps valid missing-stage diagnostics from a mixed valid/invalid persisted list, while malformed entries still prevent `lastComplete` from being trusted.
- Fixed a stale causal-stream test fixture to include the observed post-action identity and bounded success value required by `CausalExperienceStream.recordOutcome()`. Runtime validation remains strict; the test no longer assumes that a changed state alone proves which action caused it.
- **Verification status:** source and fixture corrections are committed; the exact-head Actions result is being checked. These repairs clarify the evidence contract and do not claim better autonomous behavior by themselves.

---

## NK1 WorkPass473 — make personal curriculum restore-safe and reopen contradicted goals (2026-10-24)

- Replaced unchecked persisted-state spreading in `PersonalCurriculumEngine.restore()` with the shared bounded plain-data snapshot and strict validation of thread identity/family, outcome counters, context keys, timestamps and normalized [0,1] metrics. Getter-backed or malformed top-level persistence fails closed; malformed/conflicting thread rows are excluded.
- Reconciles `completedThreads` and `suppressedThreads` from unique current thread records instead of trusting persisted totals or incrementing counters on every repeated observation.
- A newly observed low outcome now prevents an otherwise historically successful thread from remaining `satisfied` solely on its accumulated average; contrary evidence can reopen the thread. Suppressed threads remain suppressed until an explicit lifecycle change.
- Extended the existing personal-curriculum regression with malformed/accessor restore cases, realistic timestamps, reopening after contrary evidence, and counter reconciliation. **Exact-head test/typecheck remains unverified; no autonomy or learning-uplift claim is made.**

---

## NK1 WorkPass472 — reject duplicate live goal identities before ecology updates (2026-10-24)

- P68 now rejects duplicate goal IDs during its bounded, accessor-safe validation phase. Previously, two live goal objects with the same ID could collide in the token-set map and each advance lifecycle counters, creating ambiguous progress/completion evidence.
- Added a regression fixture asserting that duplicate IDs throw before the ecology snapshot changes. This strengthens Hexis-inspired goal event/idempotency semantics without importing Hexis's PostgreSQL scheduler or adding a second goal owner.
- Exact-head execution is not claimed; regression source is committed for the existing branch suite.

---
