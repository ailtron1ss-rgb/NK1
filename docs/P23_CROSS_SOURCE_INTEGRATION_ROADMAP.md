## WorkPass330 — connect production P23 repair staging to host-owned evaluation (2026-10-23)

- **Observed defect:** `server.mjs` could construct the repair provider and candidate store but did not pass the independent evaluation factory required by `OrganismRuntime` under production. The existing guard correctly rejected this incomplete configuration.
- **Code:** added a separate host evaluator config module contract (`NEURO_COMPOUND_REPAIR_EVALUATION_CONFIG_MODULE`) that supplies host-owned executor/verifier/safety-scanner processes, task scheduling, environment identity and production experiment authority. It is loaded as a different real module path from the candidate repair provider.
- **Least privilege:** the host config factory receives only `stateDirectory`; no runtime engine/store/registry capabilities are passed. Existing `createHostOwnedIndependentEvaluationConfigFactory` remains responsible for authority and storage-root checks.
- **Autonomy:** added explicit `NEURO_COMPOUND_REPAIR_BACKGROUND_REVISION_JSON`. It is disabled unless configured and only schedules candidate staging from eligible verified non-holdout repair evidence under the existing resource governor. It never auto-activates a candidate.
- **Hardening:** host evaluator config is required to be a regular file outside mutable state, resolved through `realpath`, and not group/world-writable on POSIX; it must also be distinct from the repair provider. The production plan must declare separate baseline/source/revision method names in both validation and holdout plans.
- **Regression/wiring:** added 12 contract cases in `workpass330-production-revision-wiring.mjs`, registered its runtime package script, root `audit:quick`, and WorkPass71 CI step.
- **Evidence boundary:** test/typecheck/CI remain unverified because Actions jobs continue to stop before executing steps. A deployment-owned evaluator module, independent host processes, fixed experiment manifests, real signed shadow receipts and a frozen paired-seed benchmark remain open. No learning metric is raised.
- Full contract and environment-variable documentation: [WorkPass330 report](WORKPASS330_PRODUCTION_REVISION_WIRING_2026-10-23.md).

---

## WorkPass329 — prevent component regression masked by composite skill fitness (2026-10-23)

- **Upstream adaptation:** reviewed Hermes Agent Self-Evolution at `0a929e3aa20e15cf04dc7c28492a7d41a5139125` (`evolve_skill.py`, `fitness.py`, `constraints.py`, `pyproject.toml`). Adapted the constraint idea natively; no upstream source was copied and no runtime dependency was added.
- **Code:** canonical `SkillLearnBenchAdapter` keeps the paired composite and adds separate maximum holdout-decline controls for task success, trajectory quality, and skill quality (defaults: 0.02 on each normalized axis). It computes baseline/candidate macro means over matched reports.
- **Behavioral regression:** `tests/p29-hermes-reflective-candidate-gate.mjs` constructs a trade-off where the overall composite improves while trajectory quality drops. The aggregate-only threshold is neutralized in that fixture so the component-specific rejection is exercised. Threshold validation is also covered.
- **Integration:** root `audit:quick` and `WorkPass71` core CI run the focused regression; donor register and map now record 28 candidates including this native adaptation.
- **Evidence:** implementation and CI wiring are committed. The focused test and runtime typecheck remain **unverified** because recent hosted Actions runs stop before runner assignment (`runner_id=0`, no steps/logs). Do not raise learning score based on authored tests or source changes.
- **Limitations:** no measured learning uplift, no production lifecycle completion, and no release ZIP update. Continue tracing actual generation/execution/verification/approval callers and obtain independent frozen paired-seed holdout evidence before promotion.

---

## WorkPass285 — evaluator capability-scope enforcement (2026-10-22)

- **Code:** independent candidate evaluation now rejects verifier-reported capability IDs not declared by the evaluated task. Out-of-scope claims fail closed and are not included in the recorded covered-capability set.
- **Regression:** added a two-split evaluator scenario where the verifier claims an unrequested `write` capability for tasks requiring `read`; the run must not be counted as verifier-passed.
- **Why it matters:** prevents a faulty or misconfigured verifier from inflating a candidate's capability coverage beyond what the task manifest requested.
- **Architecture:** this is enforced in the existing independent evaluator, before aggregation and promotion gates; no duplicate capability registry or dependency.
- **Validation:** regression authored; test/typecheck execution not performed in this pass.

---

## WorkPass284 — strict external causal-memory intake (2026-10-22)

- **Code:** `CausalExperienceStream.recordExternalLearningEvent` now rejects non-safe/negative ticks, non-finite or out-of-range metrics, and invalid optional source-memory/evidence identities before record construction. It no longer silently coerces a malformed tick to zero or clamps invalid metrics into plausible values.
- **Regression coverage:** added malformed tick, NaN metric and control-character source-identity cases to the existing causal-stream test.
- **Trust boundary:** external events remain explicitly external and ungrounded regardless of caller-supplied provenance flags. This validates input shape, not source authenticity; external events do not gain runtime-outcome status.
- **Architecture:** hardened the existing ingestion boundary, with no duplicate ledger or dependency.
- **Validation:** regression tests were authored but not executed in this pass.

---

## WorkPass283 — causal trace-to-world tick binding (2026-10-22)

- **Code:** causal outcome creation now requires `trace.tick === trace.stateBefore.tick` in addition to valid before/after snapshots and a later observed state tick. This blocks pairing an old or unrelated decision trace with a different transition.
- **Regression:** added a mismatched pre-action tick case to the existing causal experience stream test.
- **Architecture:** the existing causal stream remains the sole owner of grounded transition records; no parallel memory ledger or dependency.
- **Validation:** regression authored but not executed in this pass. The change strengthens event association; it does not authenticate the caller or persisted snapshot by itself.

---

## WorkPass282 — align P23 engine and evaluator fingerprint semantics (2026-10-22)

- **Code:** the P23 learning engine now uses the same strict canonicalization rules as the independent candidate evaluator for generated payloads and returned evaluation reports.
- **Why:** a digest must not silently equate NaN/Infinity with JSON null, or accept circular/non-plain values that the independent evaluator rejects. A mismatch between the producer and verifier canonicalization also obscures whether a report actually binds to the same bytes.
- **Boundary:** ordinary JSON-like payloads retain deterministic sorted-key canonicalization; non-finite, circular, non-plain and non-serializable values fail closed.
- **Architecture:** updated the existing canonicalizer in place; no duplicate fingerprint service and no new dependency.
- **Validation:** source change committed; tests/typecheck not executed in this pass. No measured learning improvement claimed.

---

## WorkPass281 — strict candidate-task canonicalization and sandbox run identity (2026-10-22)

- **Code:** the P23 independent candidate evaluator now rejects non-finite numbers, circular structures and non-plain objects when canonicalizing task inputs or evaluation payloads. This avoids ambiguous fingerprints while preserving the existing canonical representation for valid plain JSON-like data.
- **Code:** sandbox run IDs are rejected unless they are nonempty, bounded, unpadded and free of control characters. Invalid run IDs fail closed before verification and are not written into trusted run provenance.
- **Regression:** added cases for NaN, cyclic and Date task inputs, plus a control-bearing executor run ID that must yield an untrusted failed trial.
- **Integration:** changes remain within the existing P23 evaluator and experiment pipeline; no parallel evaluator and no new dependency.
- **Validation:** tests were authored but not executed in this pass. No score increase claimed.

---

## WorkPass280 — strict canonicalization for independent evaluation evidence (2026-10-22)

- **Code:** Hermes/P23 evidence binding now rejects NaN and infinities, circular references and non-plain object instances before computing the evaluation fingerprint. Non-finite numeric values can no longer collapse to JSON `null` and create an ambiguous canonical digest.
- **Regression:** added an independent-evaluation envelope case with a NaN quality metric; it must fail closed with a canonicalization error.
- **Integration:** strengthened the existing signed-evidence bridge; no parallel trust subsystem and no new dependency.
- **Validation:** regression authored but not executed here. Signed receipts still authenticate identity/binary outcome only; they do not authenticate the evaluation's quality metrics. No score increase claimed.

---

## WorkPass279 — sanitize restored aggregates and fail closed on invalid causal outcomes (2026-10-22)

- **Code:** causal snapshot restore now normalizes persisted counters, rolling metrics and timestamps; behavioral-impact aggregates are recomputed from eligible runtime-grounded records rather than trusted from the snapshot. Restored trace IDs are deduplicated after normalization.
- **Code:** `recordOutcome()` rejects invalid trace ticks, non-finite/out-of-range reward/success/surprise/novelty and unsafe task IDs instead of clamping malformed inputs into apparently trusted evidence.
- **Regression:** added poison-snapshot assertions for NaN/negative/infinite counters, invalid rolling metrics and forged behavioral aggregates, plus NaN outcome and control-bearing task-ID cases.
- **Architecture:** kept the changes inside the existing causal experience stream; no duplicate memory ledger and no dependency added. This is shape validation, not cryptographic authentication of persisted snapshots.
- **Validation:** tests were authored but not executed in this pass; exact-head CI remains unverified. No learning score increase claimed.

---

## WorkPass274 — legacy causal snapshot quarantine (2026-10-22)

- Restore now downgrades legacy records that claim trusted provenance but lack the runtime policy-feature vector: they become external, ungrounded, and replay-ineligible.
- Regression covers a simulated legacy row with forged runtime provenance and a grounded flag; it must not consolidate.
- This is compatibility hardening, not cryptographic snapshot authentication. Authenticated persistence/host attestation remains open.
- Exact-head tests/typecheck remain unverified: Actions job metadata has no steps and log downloads return 404. No dependency or learning-score increase.

---

## WorkPass274 — fail closed on legacy causal rows with no runtime evidence vector (2026-10-22)

- **Code:** snapshot restoration now quarantines legacy records that claim trusted provenance but lack the runtime policy-feature vector expected from `recordOutcome()`. They are canonicalized as external, ungrounded, and replay-ineligible before consolidation can see them.
- **Regression:** added a simulated legacy snapshot with forged `runtime-outcome` provenance and `stateGrounded: true`; restore must downgrade it and refuse consolidation.
- **Security boundary:** this is a compatibility hardening heuristic, not cryptographic snapshot authentication. A privileged actor able to rewrite both records and evidence fields still requires authenticated persistence / host-owned attestation, which remains open.
- **Validation:** regression source is committed, but exact-head Actions test/typecheck is still unverified because the connector returns no job steps and log downloads fail. No dependency and no learning-score increase.

---

## WorkPass273 — remove caller-controlled trust from external causal intake (2026-10-22)

- **Code:** `recordExternalLearningEvent()` now canonicalizes all imported events to `provenance: 'external'` and `stateGrounded: false`; caller-supplied provenance and grounding booleans are not authentication.
- **Learning boundary:** imported events cannot become consolidated state-transition memories or policy-replay candidates solely because an upstream caller marks them grounded. The existing runtime `recordOutcome()` path remains the only path in this stream that mints grounded runtime-outcome evidence from a decision trace and observed post-action state.
- **Regression:** tests now assert provenance canonicalization, forced ungrounded status, replay exclusion, and rejection from consolidation even when an external caller supplies `stateGrounded: true`.
- **Compatibility:** the external API remains available for imported signals and scoring; those signals are retained as unverified evidence rather than discarded. No new dependency or parallel ledger.
- **Validation:** source and regression changes are committed on the existing PR branch. Exact-head test/typecheck remains unverified until GitHub Actions exposes actionable job steps/logs. Learning scores remain unchanged; no measured task-success uplift is claimed.

---

## WorkPass272 — enforce storage-root separation by path and filesystem identity (2026-10-22)

- **Code:** extracted one canonical storage-root separation predicate and use it for both per-authority run/survive roots and cross-authority roots.
- **Security invariant:** roots are considered disjoint only if their resolved paths are not equal/nested and their filesystem identities are distinct. This covers alternate paths that refer to the same device/inode, such as mount aliases. Path comparisons are case-insensitive on Windows.
- **Regression:** added pure contract assertions for same filesystem identity under different path strings, distinct independent roots, and nested roots. The existing host-owned subprocess regression is already invoked by WorkPass110 CI.
- **Boundary:** identity checks are defense-in-depth; they do not create an OS/container sandbox or prove the verifier/scanner are independently administered.
- **Validation:** exact-head CI/test/typecheck remains unverified because available Actions job metadata exposes no steps/logs. No dependency or learning-score increase.

---

## WorkPass271 — quarantine normalized trace-ID collisions during snapshot restore (2026-10-22)

- **Code:** snapshot restoration now canonicalizes all bounded trace IDs before reconciling records. Exact duplicate rows that normalize to the same record are collapsed; conflicting rows that normalize to the same trace ID are all excluded from active causal history.
- **Dedup safety:** both valid and quarantined normalized IDs remain in the bounded duplicate guard. A retry cannot recreate an ambiguous event after restore.
- **Regression:** added legacy-snapshot cases for exact duplicate Unicode variants, conflicting payloads that collide under NFKC, quarantined-row exclusion and retry rejection without outcome-count mutation.
- **Integration:** remains within the existing CausalExperienceStream owner; no second event store and no new dependency.
- **Validation:** source/tests committed, but exact-head test/typecheck remains unverified because available GitHub Actions jobs expose no steps/logs. Learning scores remain unchanged.

---

## WorkPass270 — preserve raw normalized task ID until validation (2026-10-22)

- **Code:** removed the pre-validation trim from the external task-ingestion path. It now checks whether the NFKC-normalized value is blank without replacing it, then passes the untrimmed normalized input to the shared bounded ID validator.
- **Failure prevented:** trailing/leading task-ID control characters can no longer be erased at the call site before the shared C0/DEL/C1 guard sees them.
- **Regression:** existing task-ID boundary-control case now exercises the actual runtime ingestion path rather than only the helper's trace-ID path.
- **Validation:** exact-head runtime test/typecheck remains unverified because recent Actions jobs expose no steps or logs. No new dependency; no learning score uplift.

---

## WorkPass269 — reject boundary controls before trimming causal identifiers (2026-10-22)

- **Code:** bounded ID normalization now checks C0/DEL/C1 controls immediately after NFKC normalization and only then trims ordinary surrounding whitespace. Leading/trailing newline or tab characters can no longer disappear before validation.
- **Regression:** added leading-trace, trailing-trace and trailing-task control-character cases; all must fail before outcome state changes.
- **Integration:** the change stays in canonical CausalExperienceStream; the existing WorkPass110 causal-stream regression step covers the test path.
- **Validation:** exact-head runtime test/typecheck remains unverified because current Actions attempts expose no step list or logs. No new dependency and no learning-score uplift.

---

## WorkPass268 — broaden causal identity validation and preserve idempotency after eviction (2026-10-22)

- **Code:** causal IDs now reject C0, DEL and C1 control characters as well as blank, non-string and overlong values. The existing NFKC normalization and 120/180-character limits remain.
- **Bounded-memory behavior:** added a regression proving that when a causal record ages out of the 64-row record window, its retained deduplication identity still prevents a late retry from creating another outcome.
- **Regression:** added C1 trace-ID and C0 task-ID cases; rejected inputs must leave outcome counts unchanged. Added a bounded-window retry test.
- **Integration:** no duplicate storage subsystem and no new package dependency; the existing WorkPass110 workflow already watches the causal source/test paths.
- **Validation:** code/test changes are committed, but the GitHub Actions attempts still expose no runnable steps/logs. Do not report the regression or typecheck as passed until an actionable exact-head run is available.
- **Progress accounting:** learning scores remain unchanged; this is data-integrity/recovery hardening, not measured learning uplift.

---

## WorkPass267 — reject conflicting payloads under a reused causal event ID (2026-10-22)

- **Code:** external causal-event idempotency now accepts a repeated normalized trace ID only when the normalized event payload agrees with the existing record. Reusing the same ID with a changed task/action/outcome/identity-relevant field raises causal-external-trace-id-conflict rather than silently returning the old outcome.
- **Durable behavior:** the same conflict check applies when the deduplication record survives snapshot/restore. If the record itself has been evicted but the bounded trace-ID guard still remembers the ID, the stream remains fail-closed and does not create another outcome.
- **Regression:** added same-process and restored-state tests for changed success/reward under the same trace ID; both require an explicit conflict and unchanged outcome count.
- **Integration:** reuses CausalExperienceStream's existing owner and WorkPass110 regression path; no parallel ledger or package dependency added.
- **Validation:** the regression source is committed, but exact-head execution/typecheck remains unverified until Actions provides actionable steps/logs. Learning score estimates remain unchanged.
- **Next trust audit:** trace all external-ingestion call sites and replace caller-asserted grounding flags with canonical state-transition or verifier provenance after the contract is mapped.

---

## WorkPass266 — reject lossy causal identities and run the active regression paths

- [x] Replace silent trace/task truncation with bounded NFKC identity validation; reject empty, overlong, non-string and control-bearing identity values.
- [x] Keep strict trace ID normalization on restore so invalid persisted trace records and deduplication keys are discarded rather than rewritten into another identity.
- [x] Add regression coverage for distinct overlong task IDs, overlong runtime/external trace IDs, control characters, no state mutation on rejection, and restore sanitization.
- [x] Extend the WorkPass110 workflow's PR and push path filters to cover CausalExperienceStream, its regression, LegacySpriteDeck and the Live2D viewer; add explicit causal-stream, Legacy-avatar and Live2D integrity test steps.
- [ ] Obtain actionable exact-head workflow logs and a successful runtime typecheck/test run. The currently returned job record has no steps or log URL; do not infer source pass/failure from it.
- **Expected result:** identity keys preserve one-to-one meaning; malformed external inputs cannot be silently aliased by truncation.
- **No new dependency:** existing Node APIs are sufficient.

---


## WorkPass264 — validate external causal event identity

- [x] Require a non-empty NFKC-normalized task identity before recording external learning evidence.
- [x] Reject action values outside the canonical organism ActionKind set at the external ingestion boundary.
- [x] Add regression cases proving malformed task/action input does not mutate outcome counts.
- [ ] Execute the causal-stream regression and runtime typecheck on a functioning runner.
- **Source integration:** adapted the older replay buffer's strict intake validation principle without reintroducing its separate buffer or learner.

## WorkPass263 — reduce inherited environment leakage to evaluation authorities

- [x] Reject inheritance of common API tokens, secrets, passwords, credentials, auth/session variables, credential-profile paths, runtime injection variables, and dynamic-loader overrides.
- [x] Reject duplicate inherited environment keys.
- [x] Add regression coverage for secret-bearing variables and NODE_OPTIONS while preserving the existing PATH-based fixture launcher.
- [ ] Execute the host-owned evaluation regression and runtime typecheck on a functioning runner.
- **Boundary:** explicit `command.env` remains host-owned configuration; this check constrains implicit parent-environment inheritance. The configured executor still must provide a real OS/container sandbox.

## WorkPass262 — avoid per-frame canvas bitmap resets

- [x] Resize the Legacy avatar canvas only when its rendered width/height actually change, instead of assigning canvas dimensions on every animation frame.
- [x] Extend the existing Legacy sprite runtime regression to protect this rendering invariant.
- [ ] Execute the app script regression and app typecheck on a functioning runner.
- **Scope:** preserves the existing avatar loop, outfit catalog, crossfade, and speaking indicator; this is a rendering-path optimization, not a new avatar subsystem.

## WorkPass261 — make external causal evidence ingestion idempotent

- [x] Normalize external trace/source IDs using the same bounded NFKC identity rule as runtime outcomes.
- [x] Return the existing record for duplicate external-source retries rather than appending another outcome or incrementing metrics.
- [x] Persist external IDs in the bounded deduplication set so a restart preserves idempotency.
- [x] Add regression coverage for normalized full-width identifiers, duplicate retries, and restart replay.
- [x] Wire the causal-stream regression into `npm run test:big-pass-90:causal-stream`.
- [ ] Run the named regression and runtime typecheck on an accessible runner.

## WorkPass260 — restore diverse replay and consolidation selection

- [x] Select prioritized replay candidates with maximal-marginal-relevance-style task/context penalties instead of allowing one task to occupy the entire batch.
- [x] Apply the same diversity-aware selection to consolidation while retaining the WorkPass259 state-grounding gate.
- [x] Extend the causal stream regression to check that near-equal high-priority tasks both enter a small replay batch.
- [ ] Execute causal stream regression and runtime typecheck on a functioning runner.

## WorkPass259 — selectively reintegrate causal-learning safeguards from the older branch

- [x] Compare the exclusive CausalExperienceStream implementation in workpass71-learning-integrity against the current implementation; do not merge the historical branch wholesale.
- [x] Restore NFKC/trim/length-bounded trace identity normalization and persisted deduplication IDs that survive record eviction and restore.
- [x] Require state-grounded records before causal consolidation, preventing an ungrounded external event from entering consolidated memory solely due to high reward/surprise.
- [x] Extend the existing causal stream regression for restored duplicate traces and ungrounded external events.
- [ ] Execute the causal stream regression and runtime typecheck on a functioning runner.
- **Integration decision:** port specific missing mechanisms into the current owner; do not reintroduce the historical replay buffer as a parallel subsystem.

## WorkPass258 — pin host authority working and storage directory identity

- [x] Snapshot canonical working-directory identity during host-service preparation.
- [x] Bind run and survive storage roots to their filesystem identity and recheck directory type, identity, and private POSIX permissions at dispatch.
- [x] Extend the host-owned service regression to replace the prepared run root and require fail-closed behavior before request creation.
- [ ] Execute the targeted host-owned service regression and runtime typecheck on an accessible runner.
- **Boundary:** path/inode checks narrow replacement exposure; they do not remove final TOCTOU or replace an immutable/signed deployment and real OS/container sandbox.

## WorkPass257 — cover Legacy avatar race handling

- [x] Add regression coverage for a stable animation-loop lifetime and stale sprite-load rejection.
- [ ] Execute the app script regression and app typecheck on an accessible runner.

## WorkPass256 — prevent stale Legacy sprite loads

- [x] Cancel obsolete image callbacks when emotion/outfit requests change; an older request cannot overwrite the current sprite after a slow load.
- [x] Preserve the current visible sprite when the replacement asset fails.
- [ ] Execute a browser-level race regression.

## WorkPass255 — keep Legacy animation loop stable

- [x] Keep the canvas animation loop mounted while emotion/speech/outfit values change; read live values through refs instead of resetting the frame clock.
- [x] Preserve the existing avatar canvas and canonical outfit catalog.
- [ ] Confirm behavior in browser E2E and app typecheck.

## WorkPass254 — resolve exclusive Live2D branch changes

- [x] Compare the exact merge-base-to-tip range for `workpass94-avatar-voice-live2d-audit`.
- [x] Confirm both exclusive commits are audit documents only; no code cherry-pick is indicated by the exclusive diff.
- [x] Reuse current-branch findings to implement Live2D expression caching (WorkPass252) and safe Legacy storage (WorkPass253).
- [ ] Keep browser voice vs Android/Termux voice-provider unification open until a single approved control path and status/interruption semantics are implemented.
- [ ] Execute real browser/device E2E; retain the source branch until all potentially useful assets and UI changes are accounted for.

## WorkPass253 — harden Legacy avatar storage fallback

- [x] Wrap LegacySpriteDeck localStorage reads and writes so blocked storage cannot crash the fallback component.
- [x] Validate stored outfit identifiers against the canonical OUTFITS catalog and default invalid values to `lab_coat`.
- [x] Keep the existing LegacySpriteDeck and outfit catalog as the only owner; do not fork avatar state.
- [ ] Run app typecheck and browser test with storage access throwing SecurityError.
- [ ] Continue voice control-path unification and real browser/device validation.

## WorkPass252 — preserve Live2D expression transitions during lip-sync

- [x] Cache the last successfully applied expression in the existing Live2D viewer.
- [x] Skip duplicate expression calls while high-frequency mouth/gaze updates continue.
- [x] Extend the existing Live2D integrity regression with a guard for the transition cache.
- [ ] Execute the asset-integrity test and browser E2E to confirm real model animation behavior.
- [ ] Continue canonical browser/Android voice-provider unification and Legacy fallback hardening without creating a parallel avatar runtime.

## WorkPass251 — dispatch-time authority identity revalidation

- [x] Re-resolve and re-stat each prepared host authority executable before creating a request snapshot.
- [x] Revalidate identity and POSIX write permissions after asynchronous request-file I/O and before entering the process supervisor.
- [x] Extend the existing host-service regression to replace the scanner executable after service setup and assert fail-closed behavior.
- [ ] Run the targeted host-service regression and runtime typecheck on an accessible runner.
- [ ] Close the residual filesystem TOCTOU window through immutable/signed deployment and provision the actual OS/container sandbox launcher.
- **Boundary:** path/inode revalidation is defense-in-depth; it does not prove independent ownership, code signing, or sandbox enforcement.

## WorkPass250 — consolidate independent-evidence binding

- [x] Extract one canonical predicate for payload, task-input, environment, evaluator-plan, manifest, experiment-plan, scheduled-run, runtime-run, task, and seed identity.
- [x] Reuse the same predicate for independent verifier and safety-scanner responses; neither authority can drift toward a weaker field subset.
- [x] Preserve the existing evaluator, experiment ledger, and P23 promotion lifecycle rather than introducing parallel evidence/promotion subsystems.
- [ ] Execute the host-service regression, cross-source replay audit, and runtime typecheck on a functioning runner.
- [ ] Continue deployment work for the real OS/container sandbox and independently controlled verifier/scanner implementations.

## WorkPass249 — stop cancelled authority invocations before launch

- [x] Reject an already-aborted authority call before allocating a private request directory.
- [x] Recheck cancellation after writing the private request snapshot and before entering process supervision.
- [x] Reuse the existing AbortSignal/process-supervisor path; no new execution subsystem.
- [ ] Run the host-service regression and runtime typecheck on a functioning runner; this change is committed but not locally executed here.

## Current checkpoint

WorkPass250 code is committed on `workpass206-runtime-evaluator-wiring`. Two implementation passes completed: cancellation-aware authority dispatch and consolidation of duplicated evidence-binding rules. CI/test/typecheck remain unverified. The draft PR remains unmerged; the default branch is unchanged.

## WorkPass247 — reject mutable host authority executables

- [x] Require each resolved host authority executable to be a regular file.
- [x] On POSIX, reject executable files with group/world write bits.
- [x] Extend the existing host-service regression with a group-writable executable rejection case.
- [ ] Execute the targeted host-service regression and runtime typecheck on a functioning runner.
- [ ] Provision and verify the actual OS/container sandbox launcher and separately controlled verifier/scanner executables.
- [ ] Run matched baseline/candidate → signed evidence → authenticated approval → durable activation against host-provisioned authorities.
- **Boundary:** permission-bit checks are defense-in-depth, not signature verification, immutable deployment, or sandboxing.

## WorkPass246 — freeze host command authority and reject hard-link aliases

- [x] Snapshot caller-owned `args`, `env`, and `inheritEnv` before the first filesystem await in host command preparation.
- [x] Identify executable files by device/inode on POSIX, not only resolved path, so hard links cannot masquerade as distinct authority programs; retain normalized resolved-path identity on Windows.
- [x] Extend the existing host-service regression for mutation after service preparation and POSIX hard-link reuse.
- [ ] Execute `test:workpass243:host-owned-independent-evaluation-services` and TypeScript typecheck on a functioning runner; no result is claimed until steps actually run.
- [ ] Deploy and verify three genuinely independently controlled services, including a real OS/container sandbox launcher for candidate execution.

# Neuro Kurisu — cross-source learning integration roadmap

Latest implementation checkpoint: WorkPass246 (host-owned evaluator commands are snapshotted before async preparation; POSIX executable identity checks reject hard-link aliases); regression is wired through the existing WorkPass243 test entry point, execution remains unverified.

Scope: continue integrating mechanisms into the existing P23 learning/revision lifecycle. This is an implementation queue, not a promise that upstream mechanisms are already integrated. Preserve the current branch/PR boundary; do not merge to the default branch without explicit approval.

## WorkPass242 — candidate payload TOCTOU closure

- [x] Snapshot the caller-owned candidate payload synchronously at evaluator entry, before any asynchronous execution.
- [x] Compute the payload fingerprint from that snapshot and pass per-service clones of the same snapshot to each trial executor and safety scanner.
- [x] Add a deterministic retained-reference mutation regression to the existing independent evaluator suite.
- [ ] Run the focused evaluator regression and TypeScript typecheck on an executing CI runner; current connector-visible runner failures have not established code success or code failure.
- [ ] Provision and verify real host-owned sandbox, independent verifier, and safety-scanner authorities. Interface injection and distinct function identities alone do not prove independent service ownership.

## WorkPass243 — host-owned independent evaluation services

- [x] Add a concrete adapter that dispatches candidate execution, independent verification, and safety scanning to three distinct host-owned executables via the existing `LearningProcessSupervisor`.
- [x] Reuse bounded subprocess execution, no-shell launch, output limits, receipts, POSIX process-group termination, and AbortSignal cancellation; private JSON request files are created with mode 0600 and removed after the call.
- [x] Validate resolved executable identity, absolute host paths, executable access, private POSIX storage-root permissions, and pairwise-disjoint per-authority run/survive storage.
- [x] Require verifier/scanner response attestations to echo the exact payload/task/environment/plan fingerprints and run/task/seed identity; mismatched binding fails closed.
- [x] Pass the same immutable task/environment/plan context to the safety scanner, so scan evidence is not detached from the evaluation context.
- [x] Add a runtime-ready config factory suitable for `RuntimeConfig.compoundRepairRevision.independentEvaluationConfigForRepair`; host-owned task plans, environment fingerprint, and experiment authority remain explicit inputs.
- [x] Add `OrganismRuntime.createWithHostOwnedIndependentEvaluation` to prepare the services before construction and wire the returned config factory into the existing P23 coordinator without creating parallel learning/promotion machinery.
- [x] Register the process integration and runtime-factory regression in the existing package audit and continual-learning workflow.
- [ ] Run the integration regression and runtime typecheck on an executing runner; Actions history has previously failed before useful steps/logs were exposed, so code execution is still unverified.
- [ ] Provision the actual executor executable as a trusted OS/container sandbox launcher and verify filesystem/network/CPU/memory limits. This adapter does not itself provide kernel isolation.
- [ ] Deploy the actual verifier/scanner executable implementations and their ownership/configuration. Runtime wiring now exists through `OrganismRuntime.createWithHostOwnedIndependentEvaluation`; the deployed host must explicitly call it with its trusted commands, fixed task-plan builders, environment fingerprint, and canonical experiment authority. The runtime deliberately does not guess executable paths or create fake production authorities.

## Completed in this branch (through WorkPass243 code; runtime verification pending)

- [x] Reuse SkillLearnBench-style task success, skill quality, trajectory quality and macro-averaged task metrics.
- [x] Bind evaluator runs to exact payload/task/environment/plan identity; require an independent verifier's explicit binding attestation.
- [x] Connect optional LearningExperimentPlan + VerifiedOutcomeLedger authority; require manifest, split, prompt fingerprint, method, seed and scheduled run identity.
- [x] Keep existing P23 revision staging/promotion authoritative; evaluator itself does not promote.
- [x] Snapshot caller-owned experiment plans and capture executor/verifier/scanner entry points.
- [x] Detach executor results before async verifier/safety I/O and snapshot repair evidence before provider calls.
- [x] Snapshot provider-owned proposal, baseline, and candidate-evaluation data before returning prepared revision inputs (WorkPass220); add a retained-reference mutation regression.
- [x] Freeze the evaluator's validated runtime/environment fingerprint at construction so later caller config mutation cannot relabel runs (WorkPass221); add regression coverage for post-construction config mutation.
- [x] Snapshot proposal, baseline, candidate-evaluation data, and options inside the coordinator itself before staging, even when a caller uses a provider without the independent-evaluation wrapper (WorkPass222); add a retained-reference mutation regression.
- [x] Add targeted evaluator/provider regression commands to the learning CI workflow.
- [x] WorkPass223: return the construction-time `environmentFingerprint` snapshot in evaluator provenance, not the mutable caller-owned config field. The existing WorkPass203 regression mutates the config after construction and asserts that provenance retains the original environment identity.
- [x] WorkPass224: fail startup in `NODE_ENV=production` when compound repair revision is enabled without a host-provided independent evaluation configuration factory; added a focused regression, package script, and learning workflow step.
- [x] WorkPass225: added `compareMatchedIndependentEvaluations`, which validates each result envelope digest and refuses baseline/candidate comparisons unless task-plan and environment fingerprints match, experiment authority matches except for distinct method labels, and every paired task/trial has the same seed/split with independently bound, verifier-passed, safety-clean execution evidence. It then delegates metric scoring to the existing SkillLearnBench candidate gate.
- [x] WorkPass225 follow-up: bind each provenance split to the actual validation/holdout report array before scoring; add a cross-split tampering regression.
- [x] WorkPass225 integration repair: register the regression command in `package.json` and include WorkPass224/225 in `audit:p23:cross-source-replay`.
- [x] WorkPass226 partial: production `withIndependentCandidateEvaluation` now rejects configs without canonical experiment authority (manifest, validation/holdout plans and verified-outcome ledger); the WorkPass224 regression now covers a factory that supplies interface-shaped services but omits this authority.
- [x] WorkPass225 follow-up: bind each provenance split to the actual validation/holdout report array before scoring; this prevents a caller from relabeling a verified validation trial as holdout (or vice versa) and recomputing the outer digest. Added a cross-split tampering regression.
- [x] WorkPass225 integration repair: registered the regression script in `package.json` and included WorkPass224/225 in the canonical `audit:p23:cross-source-replay` command. The CI workflow already invokes the targeted regression.


### WorkPass235 — P23 ↔ Hermes evidence bridge

- **DONE (code):** added `bindIndependentEvaluationToVerifiedShadowEvidence` and exposed it through the canonical `P23LearningEngine`. It recomputes the P23 evaluation envelope digest/payload fingerprint, joins experiment trial identities to actual sandbox execution run IDs through evaluator-produced `runBindings`, then checks the signed shadow receipt against task, seed, manifest, binary outcome and candidate identity.
- **DONE (code):** exact one-to-one coverage is required across evaluation reports, run bindings and signed observations; validation/holdout collection membership must match the binding; duplicate/orphan receipts, unbound execution, nonzero safety findings, seed/task/manifest/outcome mismatches fail closed.
- **DONE (code):** negative outcomes remain bindable as evidence when independently verified and safety-clean. The signature authenticates only identity and binary outcome, not quality/trajectory scores; no new staging, approval or promotion authority was added.
- **DONE (regression authored and CI-wired):** extended `tests/p23-hermes-verified-evidence-binding.mjs` with envelope-digest tampering, P23-trial-to-runtime-run joins, seed mismatch rejection and safety veto; added workflow path filters and a dedicated test step.
- **PARTIAL (validation):** test and typecheck were not run in this session; CI status must be checked at the exact current head. No green result is claimed.
- **OPEN:** production verifier-key/context resolution must bind receipt signatures to independently trusted run records; connect the bridge to the actual promotion preparation/review path only after the evaluation envelope digest and signed receipt context are both revalidated at that boundary.

## Next implementation passes

### P0 — close the complete generation-to-promotion path
- Wire the production generator, sandbox executor, independent verifier and safety scanner through the existing runtime/coordinator, not a second learner.
- Ensure baseline and candidate are evaluated against the same immutable task/seed/environment plan; reject mismatched or provider-supplied unverifiable baseline evidence.
- Carry the independent evaluation envelope and digest into the existing P23 gate; do not record candidate-only outcomes as baseline evidence.
- Keep holdout inaccessible to generation, repair prompts, tuning and selection; only use it at the final comparison boundary.

### P1 — experiment integrity and decision quality
- Add matched-pair evaluation and per-task/seed joins so candidate-vs-baseline deltas cannot compare different trials.
- Add confidence intervals / bootstrap or Wilson bounds where their assumptions fit, and minimum sample/seed policy; never treat missing evidence as a zero-cost win.
- Add regression vetoes for safety, capability regressions, catastrophic task failures and distribution-shift indicators.
- Add a reproducible experiment manifest including model/tool/runtime versions, prompt/data fingerprints, seeds and resource budgets.

### P2 — source integrations with high leverage
- Hermes/Will: consolidate evidence binding, reflective reports, skill revision plans and promotion provenance in the existing lifecycle.
- SkillLearnBench: retain task-success, skill-quality and trajectory-quality dimensions, with macro-averaging to avoid task-rich families dominating.
- OpenHands/SWE-agent-style execution ideas: sandboxed tool execution, bounded retries, explicit action traces and recoverable execution failures; adapt only mechanisms that fit current runtime boundaries.
- DSPy/GEPA-style optimization: optimize prompts/policies only on training/validation evidence, with immutable experiment records and holdout untouched until final evaluation.
- AgentBench / WebArena-style task suites: use task families and environment-specific capability rubrics instead of one aggregate score.
- Research experimental alternatives (e.g. evolutionary search, verifier-guided repair, debate/critic ensembles) behind pluggable evaluators; keep them shadow-only until they beat a fixed baseline under matched evaluation and safety gates.
- Review licenses, dependency weight, local-model/VRAM cost and maintenance burden before importing upstream code; prefer narrow mechanism ports over vendoring entire projects.

### P3 — continual learning and memory integration
- Feed only verified, provenance-bound outcomes into the existing outcome ledger and replay/retention curriculum.
- Link skill-version provenance to source evidence, experiment IDs, rollback target and retention checks.
- Add forgetting/transfer tests across task families and capability-specific ablations; separate correlation from causal claims.
- Add bounded experiment scheduling driven by uncertainty/evidence debt, with explicit compute budgets and starvation protection.

### P4 — runtime deployment and operations
- Provide a concrete host adapter for real sandbox/verifier/scanner implementations and fail startup when production mode lacks them.
- Add cancellation, timeout, resource limits, retry/idempotency semantics and durable run identities.
- Run the targeted regression suite and typecheck in CI; investigate runner dispatch failures separately from code failures.
- Promote the PR from draft only after the complete path and checks are actually verified.

## Status discipline

- DONE means a code change exists on this branch; it does not imply CI passed.
- PARTIAL means the seam exists but a real production authority or end-to-end path is still absent.
- OPEN means no implementation claim is made yet.


## Cross-source integration matrix for the 120-direction plan

This matrix maps the broad integration catalogue to existing NK1 seams. It is intentionally a disposition map: a source name is a research target, not proof that its repository has been vendored or that the entire capability is production-complete.

| Direction family | Existing NK1 seam to reuse | Integration disposition |
|---|---|---|
| Agent loop, planning, tool execution | OrganismRuntime, PlanEngine, ActionGateway, embodied action executor | Reuse the canonical runtime and add bounded adapters; do not introduce a second action loop |
| Hermes/Will skill learning and reflection | P23LearningEngine, SkillRevisionPlan, HermesVerifiedEvidenceBinding, VersionedSkillCandidateStore | Port evidence binding, revision targets and skill-learning ideas into P23; keep promotion authority unchanged |
| Independent evaluation and benchmark suites | IndependentSkillCandidateEvaluator, SkillLearnBenchAdapter, LearningExperimentPlan, VerifiedOutcomeLedger | Preserve exact payload/task/environment binding, matched task/trial comparisons and untouched holdout |
| Persistent memory and consolidation | OfflineConsolidation, memory retrieval/consolidation subsystems, continuity and evidence ledgers | Connect memory records to provenance and task utility; avoid a parallel authoritative memory store |
| Replay, continual learning, forgetting/transfer | P23LearningEngine, ReplaySelectionPolicy, MultiSourceLearningMechanisms, evidence debt | Reuse bounded replay and seed-clustered evidence; add retention/transfer comparisons before changing defaults |
| Metacognition and uncertainty | OutcomeReflectionCurriculum, prediction calibration, evidence debt, causal trace ledger | Use measured prediction error and uncertainty to select verification work; do not treat self-reported confidence as proof |
| Emotional/motivational state | Organism needs/state, resource economy, goal pressure and social context | Integrate as functional control signals only when a measurable behavior change can be evaluated |
| Voice, vision and Live2D | LanguageOrgan, camera evidence processor, vision backend, embodiment and UI layers | Preserve existing perception/action interfaces; bind avatar state to real runtime state instead of animation-only imitation |
| Browser, coding and external tools | ActionGateway, tool schemas, postcondition verifier, operational journal | Require permissions, sandboxing, postconditions, cancellation and auditable action traces |
| Research, optimization, evolutionary search, critics | research bridge, candidate generation and P23 evaluator | Keep shadow-only; optimize on train/validation only; never grant experimental search direct promotion authority |
| Runtime reliability and resource limits | RuntimePerformanceGovernor, scheduler, checkpointing, file state store, recovery controller | Extend existing cancellation, budget and recovery boundaries rather than layering another supervisor |
| Security and provenance | RealityEvidenceLedger, verified outcome ledger, signed promotion approval, canonical fingerprints | Fail closed on missing identity, mismatched evidence, safety violations or unverified execution |

### WorkPass223 disposition

- **DONE (code):** corrected a provenance mismatch that allowed the returned evaluator report to read a later-mutated environment fingerprint despite the evaluator capturing the original fingerprint at construction.
- **DONE (code):** production runtime startup now rejects compound-repair revision wiring that lacks a separate independent-evaluation configuration factory; a targeted regression is registered in the learning workflow.
- **PARTIAL:** regression commands are registered, but this connector session did not execute them or run TypeScript checks. Latest visible Actions failures occur before any job step starts (`runner_id: 0`, `steps: []`), so they do not validate or identify code-level failures.
- **OPEN:** verify the full generation → sandbox → independent verification → safety → matched comparison → staging → shadow evidence → signed promotion path using real host-provided authorities. No fake production adapters should be added merely to make the path appear complete.


## Large-pass execution queue for the 120-direction integration catalogue

The queue below is ordered by dependency and risk, not by novelty. Existing NK1 modules remain the source of truth; external projects contribute mechanisms, not competing runtime architectures.

| Pass | Priority | Integration work | Upstream patterns to adapt | Acceptance evidence | Status |
|---|---|---|---|---|---|
| WorkPass225 | P0 | Bind baseline and candidate to the same immutable task/seed/environment; reject missing, duplicate, cross-split or mismatched run identities before scoring deltas | AgentBench/WebArena task identity; SkillLearnBench trial metrics | Matched-pair join keyed by manifest/task/seed/environment/method, report-array split binding, and negative tests | DONE (code; CI not yet verified) |
| WorkPass226 | P0 | Connect the real host sandbox, independent verifier and safety scanner; reject self-attested execution and missing postconditions | OpenHands/SWE-agent execution boundaries | Real host adapter contract, no fake production defaults, fail-start tests | PARTIAL: production now requires canonical experiment authority; actual trusted host sandbox/verifier/scanner wiring remains OPEN |
| WorkPass227 | P0 | Carry signed/digested evaluation evidence through the canonical P23 staging gate; keep holdout outside generation, repair, tuning and candidate selection | DSPy/GEPA experiment discipline | Holdout-access boundary tests and gate-level evidence digest checks | OPEN |
| WorkPass228 | P1 | Add confidence bounds, minimum sample policy and catastrophic-regression vetoes to promotion decisions | Benchmark statistics and conservative release gates | Small-sample, missing-data, regression and uncertainty tests | OPEN |
| WorkPass229 | P1 | Add a reproducible experiment manifest for model/tool/runtime versions, prompts, data fingerprints, seeds, budgets and retries | Reproducible research / experiment tracking | Identical manifest reproduces identical plan identity; any changed input changes digest | PARTIAL: plans/fingerprints exist; complete host manifest remains OPEN |
| WorkPass230 | P1 | Merge Hermes/Will-style skill evidence and reflective repair into existing P23 plans and versioned skill store | Hermes, Will, Voyager | A verified failure produces a versioned candidate with traceable source evidence; no second learner | PARTIAL: evidence/repair seams exist; full trusted loop remains OPEN |
| WorkPass231 | P1 | Connect episodic replay, goal/affect salience, memory consolidation and capability-specific retention tests | Letta/MemGPT, Voyager, cognitive replay | Replay records retain provenance; transfer/forgetting regressions cover multiple task families | PARTIAL: replay and salience mechanisms exist; causal retention evidence remains OPEN |
| WorkPass232 | P1 | Integrate uncertainty-driven metacognition: decide when to ask, search, retry, verify or stop using observed calibration | Reflection/critic patterns; uncertainty-aware agents | Calibration metrics and action-choice outcomes, not self-reported confidence alone | OPEN |
| WorkPass233 | P2 | Add task-family environment suites and realistic tool/browser/code tasks with postcondition verification | AgentBench, WebArena, SWE-agent | Separate per-family results, stable task versions, no aggregate-only promotion | OPEN |
| WorkPass234 | P2 | Connect multimodal perception, speech, UI and Live2D to runtime state and actual actions | Existing vision, language and embodiment seams | UI/avatar changes correspond to observable state transitions and trace IDs | PARTIAL: runtime perception/embodiment exists; complete UI-to-state binding requires audit |
| WorkPass235 | P2 | Add shadow-only prompt/policy optimization, verifier-guided repair and optional critic/evolutionary candidates | DSPy/GEPA and experimental search | Fixed baseline, validation-only optimization, bounded budgets, holdout isolation, no direct promotion | OPEN |
| WorkPass236 | P2 | Unify tool permissions, sandbox limits, cancellation, idempotency, checkpoints and recovery across external tools | OpenHands/SWE-agent operational patterns | Interrupted/duplicated actions recover without duplicate side effects | PARTIAL: individual controls exist; unified production adapter remains OPEN |
| WorkPass237 | P2 | Consolidate event/provenance contracts and deduplicate overlapping subsystem responsibilities | NK1 event bus, evidence ledgers, capability registry | One canonical authority per responsibility; compatibility migration and no premature deletion | OPEN |
| WorkPass238 | P3 | Add provenance-bound continual learning, skill rollback, transfer/forgetting checks and bounded experiment scheduling | Voyager lifelong skill library; memory consolidation research | Every promoted version links evidence, evaluation, rollback target and retention results | PARTIAL: components exist; end-to-end governance remains OPEN |
| WorkPass239 | P3 | Audit local model routing, VRAM/resource budgets, cache and queue behavior under mobile/low-memory profiles | Local-model serving patterns | Measured resource ceilings and graceful cancellation/fallback | OPEN |
| WorkPass240 | P3 | Source/license/dependency review for each upstream mechanism; port narrowly rather than vendor entire projects | Hermes, Will, OpenHands, SWE-agent, DSPy, GEPA, Letta, Voyager, AgentBench, WebArena, SkillLearnBench | Source URL/commit/license, adapted files, dependency/VRAM impact and retained attribution | OPEN |

### WorkPass224 follow-through

- **DONE (code):** evaluator provenance uses the captured environment fingerprint; production compound-repair revision fails closed if independent evaluation authority is not configured.
- **PARTIAL:** regression test and CI wiring are present, but successful execution has not been established in this session.
- **OPEN:** real trusted host adapters, matched baseline/candidate evidence and holdout-isolated final promotion remain the P0 implementation targets.

### Cross-source implementation rules

1. Never copy a source project's whole agent loop if NK1 already has an equivalent; port the mechanism behind the canonical interface.
2. No experimental optimizer, critic, debate, evolutionary search or self-modifying proposal may write to the trusted candidate store or promote itself.
3. Training and validation may drive generation/tuning; holdout is exposed only to the final independent comparison and cannot feed back into the same candidate decision.
4. Every claim of improvement must be supported by matched task/seed/environment evidence, sample policy, safety checks and a reproducible manifest.
5. A source integration is not DONE because a class, adapter, checklist or placeholder exists. DONE requires the capability to be connected to the canonical runtime and to produce attributable evidence.
6. Never delete overlapping code until callers, persistence formats, UI/Live2D links, licensing and migration paths have been checked.


### WorkPass225 implementation checkpoint

- **DONE (code):** added a canonical matched-evaluation boundary to `IndependentSkillCandidateEvaluator.ts`. It checks SHA-256 envelope integrity before trusting either evaluation, requires exact task-plan/environment identity, requires matching manifest/validation/holdout plan fingerprints and distinct baseline/candidate method labels when experiment authority is present, and joins trial bindings by task/trial while requiring equal seed/split, trusted run identity, verifier pass, and zero safety violations.
- **DONE (integration code):** reuses `evaluateSkillLearnBenchCandidate` for the actual paired multi-axis score and holdout gate; no parallel scoring or promotion engine was added.
- **DONE (regression code):** added `tests/workpass225-matched-independent-evaluation.mjs` covering successful pairing, environment mismatch, seed mismatch, unsafe evidence, and post-evaluation tampering. Registered `test:workpass225:matched-independent-evaluation` and wired it into the learning workflow path filters and job steps.
- **PARTIAL:** code and CI wiring are committed; this pass has not executed the test/typecheck locally. CI must actually dispatch before this is considered validated.
- **NEXT:** WorkPass226 — provide a concrete production host adapter contract for sandbox/verifier/scanner with bounded execution and independently verified postconditions; inspect the real runtime wiring and avoid dummy production implementations.


### WorkPass225 follow-up — split provenance and audit integration

- **DONE (code):** matched comparison now verifies the split recorded in every trial binding matches the array containing its report (`validation` or `holdout`) before calculating any gate metrics. This closes a data-labeling gap that could otherwise change which gate sees a report while preserving task/trial identifiers.
- **DONE (regression code):** added a regression that relabels a candidate trial's split and recomputes the evaluation digest; the comparison must still reject it.
- **DONE (wiring):** added the missing `test:workpass225:matched-independent-evaluation` npm script and included WorkPass224/225 in `audit:p23:cross-source-replay`. The workflow already includes the script in its job and path filters.
- **PARTIAL:** the source/test/wiring edits exist on the PR branch; no successful execution is claimed until Actions actually runs the steps.


### WorkPass226 — production authority boundary (partial)

- **DONE (code):** the independent-evaluation provider rejects a production configuration factory that returns sandbox/verifier/scanner-shaped interfaces without canonical `experimentAuthority`. The authority must be present before the evaluator can be constructed, and its existing evaluator validation binds manifest entries and validation/holdout plans.
- **DONE (regression code):** extended the production authority regression with interface-shaped but authority-free config; it must fail closed before the evaluator executes.
- **PARTIAL:** this closes the configuration-authority gap but does not prove that the injected executor, verifier, or safety scanner are real trusted host services. A provider can still supply function-shaped objects; production wiring must bind these to actual sandbox/postcondition/safety implementations and verify provenance of the authority provider.
- **NEXT:** WorkPass226 continuation: trace real runtime service ownership, construct an explicit trusted-host adapter using existing ActionGateway / ExternalPostconditionVerifier seams where contracts fit, add timeout/cancellation and run identity binding, then test fail-closed behavior end-to-end. Do not label the real host path DONE until this wiring is demonstrated.


### WorkPass227 — bounded independent evaluation service calls

- **DONE (code):** executor, verifier and safety scanner calls now use a configurable per-service deadline (serviceTimeoutMs, default 30 seconds, accepted range 10 ms–5 minutes). Each service receives an AbortSignal; deadline expiry aborts that signal and rejects the bounded call.
- **DONE (fail-closed behavior):** executor timeout is treated as non-executable evidence; verifier timeout cannot produce trusted binding or task success; safety-scanner timeout aborts the evaluation rather than treating missing safety results as clean.
- **DONE (regression code and wiring):** added tests/workpass227-bounded-independent-evaluation.mjs, registered test:workpass227:bounded-independent-evaluation, added the test to the continual-learning workflow's PR/push path filters and execution steps, and appended it to audit:p23:cross-source-replay.
- **IMPORTANT LIMIT:** AbortSignal is cooperative. A host executor/verifier/scanner must observe the signal and actually terminate its underlying process/request. The evaluator's deadline prevents waiting indefinitely for a response but cannot kill a non-cooperative remote process by itself. Real host adapter wiring remains OPEN.
- **Validation:** no local execution or successful GitHub Actions result is claimed in this pass; keep PR draft until the new regression and runtime typecheck actually execute successfully.
- **Next pass (WorkPass228):** integrate signal propagation into the actual host sandbox/process supervisor, guarantee process-tree termination and resource quotas, then bind cancellation/timeout receipts to run provenance and reject stale late results.


### WorkPass228 — connect cooperative cancellation to the existing process supervisor (partial)

- **DONE (code):** the existing LearningProcessSupervisor accepts an optional AbortSignal, rejects already-cancelled work before spawning, kills the supervised child on abort, and writes a distinct `cancelled` execution receipt. Receipt validation accepts the new terminal state.
- **DONE (regression code):** extended the existing process-supervisor regression to cover active cancellation and cancellation before spawn.
- **Reuse/integration:** this adapts the existing P23 process supervisor instead of introducing a competing subprocess runner. It also gives WorkPass227's evaluator deadlines a concrete host-side cancellation seam when an adapter passes the signal through.
- **OPEN:** current `child.kill('SIGKILL')` terminates the direct child only; process-tree containment and OS/container isolation remain the responsibility of a stronger host sandbox. The evaluator still needs a concrete trusted adapter that maps candidate payload/task inputs to an approved command; do not execute arbitrary generated payloads as shell commands.
- **Validation:** code and test wiring are committed; test/typecheck/CI success remains unverified in this pass.


### WorkPass229 — preserve terminal process state across cancellation races

- **DONE (code):** the existing `LearningProcessSupervisor` now records the child `close` event before resolving the run promise and ignores late abort notifications once the child has closed. This prevents an abort racing with process completion from relabeling a completed receipt as `cancelled`.
- **Reuse/integration:** this is a narrow correctness fix inside the existing P23 supervisor; no parallel runner or new authority was added.
- **PARTIAL:** the race guard is committed, but this pass has not run the targeted supervisor regression or TypeScript typecheck. A deterministic regression for close/abort ordering and actual process-tree containment remain open.
- **NEXT:** add a deterministic race regression and continue the trusted-host adapter path; process-tree/container isolation must remain explicit rather than inferred from direct-child SIGKILL.


### WorkPass230 — process-group cancellation for P23 learner runs

- **DONE (code):** on POSIX, the existing `LearningProcessSupervisor` starts each supervised command in its own process group and routes timeout, output-limit, and abort termination through group-level `SIGKILL`, so ordinary descendants in that group are terminated alongside the direct child.
- **DONE (race hardening):** timeout/abort handlers now ignore late notifications after the direct child has emitted `close`, preserving the terminal receipt state.
- **PARTIAL:** Windows still uses direct-child termination; descendants that deliberately detach or escape the process group are not contained. This is not a substitute for an OS/container sandbox. Targeted regression and runtime typecheck have not been executed in this pass.
- **NEXT:** add a descendant-process regression on POSIX, then wire the trusted host adapter to the existing ActionGateway/postcondition verifier without permitting arbitrary candidate payloads to become shell commands.


### WorkPass231 — descendant-process termination regression

- **DONE (code):** extended the existing `tests/p23-learning-process-supervisor.mjs` with a regression where a supervised parent launches a same-process-group descendant that would write a delayed marker. After the parent's bounded timeout, the test asserts the marker never appears, exercising the POSIX process-group termination path rather than only checking the direct child's signal.
- **Integration:** the existing `test:p23:learning-process-supervisor` command already includes this test file and is included in `audit:p23:cross-source-replay`; no parallel test harness or process manager was added.
- **PARTIAL:** the regression is committed but has not been executed here. Timing and process-group behavior still need confirmation in the CI runner; Windows uses direct-child semantics, and this is not a sandbox against detached/escaped descendants.
- **NEXT:** run the targeted supervisor regression and runtime typecheck, then wire the trusted host executor to ActionGateway/postcondition verification with explicit capability and path boundaries.


### WorkPass232 — snapshot command identity before asynchronous registration

- **DONE (code):** `runLearningProcess` now snapshots the scheduled-run record and command inputs (argument vector, environment entries, inherited-environment key list, and scalar command fields) before any asynchronous trusted-registration call. The command later spawned and fingerprinted can no longer be changed by mutating caller-owned objects during the registration await.
- **DONE (regression code):** added a gated registration test that mutates the original command's argument vector and executable while registration is pending; the run must execute the original snapshotted command and emit its expected output.
- **Compatibility fix:** the process-descendant regression is now POSIX-only, matching the implementation's process-group guarantee; Windows remains direct-child semantics rather than failing a test for a guarantee it does not provide.
- **PARTIAL:** source and regression are committed, but this session has not run the test or TypeScript typecheck. CI must execute the targeted supervisor test before this is considered validated.
- **NEXT:** inspect and bind the real trusted host command factory to approved capabilities and postcondition verification; continue the P23 → Hermes/Will integration through existing skill/evidence contracts, not a parallel learner.

### WorkPass233 — bind execution identity to effective environment inputs

- **DONE (code):** command fingerprints now include the effective values for explicit environment keys and inherited environment keys, not only their names. This accounts for runtime-owned environment fields that intentionally override caller-provided values. The receipt stores only the SHA-256 digest, not a copy of environment values; this strengthens provenance when environment configuration changes execution behavior.
- **Determinism:** explicit environment keys use locale-independent ordering before hashing.
- **DONE (regression code):** added a regression proving distinct explicit environment values produce distinct command fingerprints. Expanded the async-registration mutation test to change the caller's environment value after registration begins and assert the child still sees the original snapshotted value.
- **PARTIAL:** tests/typecheck have not been run in this session. Current workflow jobs available through GitHub have failed before any steps execute (steps array is empty), so they neither validate nor establish a code-level failure.
- **NEXT:** validate the process-supervisor tests in an executing runner; then finish the trusted host adapter using approved command capabilities and independent postcondition evidence.


### WorkPass234 — pin trusted registration capability and effective working directory

- **DONE (code):** LearningProcessSupervisor now snapshots the trusted registrar's function and runtime version before the first asynchronous filesystem operation. A caller retaining the registrar object cannot replace the registration method or relabel runtime identity while the supervisor prepares directories.
- **DONE (code):** resolves the command working directory synchronously and uses that exact absolute path both for the command fingerprint and for spawn; changing the process-wide cwd during an asynchronous registration wait cannot make execution drift from the recorded directory identity.
- **DONE (regression code):** added mutation regressions that replace the registrar method/version immediately after scheduling and change `process.cwd()` while registration awaits; only the originally captured registrar runs and the child executes in the directory already bound to its fingerprint.
- **Source-pattern integration:** this tightens explicit-capability and immutable-run-boundary principles used in sandboxed coding-agent execution (OpenHands/SWE-agent-style) while preserving NK1's single P23 supervisor and verified-outcome gate. No upstream package was vendored; this is a narrow mechanism port.
- **PARTIAL:** code and regression are committed; this session has not executed the supervisor test or TypeScript typecheck. The real host-owned command factory, sandbox, verifier and safety-scanner wiring remains OPEN; a generic subprocess supervisor is not a sandbox.


## WorkPass236 — exact-payload promotion-chain integration

- **DONE (code):** the P23 ↔ Hermes bridge now rejects an independent evaluation envelope whose payload fingerprint differs from the exact versioned candidate under review. Signed identity/outcome receipts cannot be borrowed to substantiate a different candidate payload.
- **DONE (code):** added approveIndependentlyEvaluatedSkillCandidate to the existing P23LearningEngine promotion path. It requires the staged candidate's payload fingerprint and persisted revision evaluation fingerprint to match the independent envelope, evaluates the envelope's own validation/holdout reports through the existing SkillLearnBench fitness gate, and binds the candidate's persisted signed shadow observations before delegating activation to the existing authenticated approval/store path.
- **DONE (code):** canonical evidence serialization fails explicitly for non-JSON-serializable primitive/key values, and malformed/cyclic evaluation envelopes are rejected through the normal fail-closed result rather than escaping as an exception.
- **DONE (regression authored):** added exact-candidate-payload mismatch and cyclic/non-canonicalizable-envelope rejection coverage to test:p23:hermes-verified-evidence-binding; the existing learning workflow already watches both changed source files and executes this targeted test.
- **PARTIAL:** code and regression are committed; the test, TypeScript typecheck, and exact-head GitHub Actions have not yet been observed passing. Promotion still requires production-configured trusted signing/context and authenticated human approval.
- **OPEN next:** run the exact-head regression/typecheck; then connect and verify the trusted host's run-context resolver and approval authority in a real shadow execution, including restart/replay and duplicate prevention.

### WorkPass237 — close the caller-supplied baseline gap in promotion

- **DONE (code):** `approveIndependentlyEvaluatedSkillCandidate` no longer accepts an arbitrary pair of report arrays as its baseline input. It now requires the full independent baseline envelope and passes baseline + candidate through the existing `compareMatchedIndependentEvaluations` boundary before any fitness decision.
- **DONE (integration):** reused the existing P23 independent evaluator, experiment authority and SkillLearnBench paired gate; no duplicate evaluator/scorer/store was created. Existing store-level receipt and signed approval checks still run at activation.
- **DONE (defensive behavior):** malformed or missing envelopes are rejected before nested property access, including calls from untyped JavaScript.
- **DONE (regression + CI wiring):** extended `p23-hermes-production-promotion-gate.mjs` to assert free-form baseline report arrays and malformed envelopes are rejected before approval; added the test to the learning workflow's path filters and explicit steps, and included both Hermes regressions in `audit:p23:cross-source-replay`. Execution remains unverified.
- **PARTIAL:** source and regression are committed, but the targeted test, typecheck and exact-head Actions have not been observed passing.
- **OPEN:** add an end-to-end regression through the promotion method with durable registry-backed shadow receipts and authenticated approval; then exercise restart/replay and duplicate promotion against the real host runtime.

### WorkPass238 — crash recovery for the durable trusted-run registry

- **DONE (code):** registry lock files now identify the owning PID and hostname. When exclusive lock creation collides, the registry may reclaim the lock only if the lock is parseable, belongs to the same host, and the OS returns `ESRCH` for the recorded PID.
- **DONE (safety):** live processes (including `EPERM`), remote-host owners, malformed/legacy lock files and ambiguous errors continue to fail closed. No age-based lock stealing was introduced; successful registrations retain the existing durable write/rename/fsync sequence.
- **DONE (regression authored):** the trusted-run registry test now covers provably stale same-host lock recovery while retaining contention and corrupt-state cases.
- **DONE (integration):** the existing workflow step/path filters already run the registry regression; the canonical `audit:p23:cross-source-replay` aggregate now also includes it.
- **PARTIAL (validation):** test/typecheck and exact-head Actions have not been run/observed in this pass.
- **OPEN:** verify on an actual runner; add a subprocess crash/restart integration case for the full signed-receipt → registry resolution → candidate-store activation path, including duplicate receipt/replay rejection under authenticated approval.


### WorkPass239 — durable signed promotion across restart, with replay rejection (2026-10-21)

- **DONE (code):** hardened trusted-run registry stale-lock recovery with a unique quarantine path, exact-content recheck, exclusive reacquisition, and an owner token so cleanup cannot unlink a replacement lock. Ambiguous ownership remains fail-closed.
- **DONE (integration):** added an end-to-end regression that builds a proposal from signed manifest-bound paired outcomes, stages the candidate in the durable store, registers trusted execution contexts, ingests three candidate-bound signed shadow receipts, restarts both authorities, rejects receipt replay, verifies a detached Ed25519 approval, promotes by active-version CAS, and reconstructs/re-authenticates the active state after another restart.
- **DONE (P1/P3 bridge):** the test exercises existing paired outcome evidence, task/seed/manifest/runtime-bound shadow receipts, persistent registry/store recovery, duplicate-run rejection, signed authorization and active-state reconstruction without introducing a second learner or registry.
- **DONE (CI wiring):** registered `test:workpass239:durable-signed-promotion-e2e`, added it to `audit:p23:cross-source-replay`, and added an explicit continual-learning workflow step/path filter.
- **PARTIAL (P0):** this closes the durable evidence → authenticated approval → activation segment. The production host still must provide and wire the actual generator, isolated sandbox executor, independent verifier and safety scanner; the test's signing keys are generated fixtures and are not production authority.
- **PARTIAL (P1):** restart, receipt replay and repeated-promotion rejection are now covered in one flow. Multi-process crash/kill contention and end-to-end matched baseline/candidate execution through a real host sandbox still require execution evidence.
- **PARTIAL (P2):** reuse the existing P23 process supervisor, runtime scheduler, Hermes receipt binding and SkillLearnBench gate; no third-party execution framework was vendored. Real host-owned sandbox/verifier/scanner provisioning remains OPEN rather than being simulated.
- **PARTIAL (P3):** signed outcomes and candidate provenance now traverse a durable restart path; retention, transfer and capability-ablation experiments still need real task suites and bounded compute budgets before any learning-uplift claim.
- **Validation:** code and workflow are committed, but this pass did not execute the new test or typecheck. Do not mark it PASS until exact-head CI runs the step successfully.


### WorkPass240 — prevent self-attesting evaluator authority configurations (2026-10-22)

- **DONE (code):** the existing independent candidate evaluator now rejects configurations where executor, verifier, and safety scanner reuse the same object or the same underlying function. Different interface labels are not accepted as proof of independent authority.
- **DONE (regression authored):** extended the existing bounded-evaluation regression with both same-object and shared-function attacks; both must fail before candidate execution. Reused the existing test/workflow rather than adding another parallel harness.
- **PARTIAL (P0/P2):** this closes a concrete configuration-level self-attestation gap, but cannot prove service ownership or process isolation. Production still must bind these distinct capabilities to independently controlled host services and a real OS/container sandbox; function identity checks are defense-in-depth, not a substitute for trust-boundary deployment.
- **PARTIAL (validation):** source/test commits are on the draft PR branch. The targeted test and runtime typecheck have not been executed locally; exact-head Actions must confirm both before this pass is marked validated.
- **OPEN next:** implement and wire a host-owned sandbox capability that provides enforceable resource limits and process-tree containment, bind the independent verifier and scanner to host-owned services, and test cancellation/timeout against real descendant processes and stale-result replay.


#### WorkPass240 follow-up — close the direct-construction production bypass

- **DONE (code):** production experiment-authority enforcement now lives inside `createIndependentSkillCandidateEvaluator` validation itself, not only in `withIndependentCandidateEvaluation`. Direct callers cannot construct the evaluator in production without the canonical manifest, validation/holdout plans and verified-outcome ledger.
- **DONE (regression authored):** the existing bounded-evaluation test temporarily sets `NODE_ENV=production` and asserts direct construction fails before execution when authority is absent; the prior environment is restored in a `finally` block.
- **PARTIAL:** this closes a code-path bypass, not host trust ownership. The actual executor/verifier/scanner must still be supplied by separately controlled host services and a real sandbox.
- **Validation:** exact-head test/typecheck remains unconfirmed; do not mark PASS until Actions actually runs the test step.


### WorkPass241 — align direct scheduler candidate identity with the production parser (2026-10-22)

- **DONE (code):** `P23TrustedShadowLearningScheduler` now enforces the same 64-hex candidate fingerprint contract as `parseTrustedShadowLearningScheduleConfig`. Direct construction of `OrganismRuntime` can no longer bypass the parser's candidate identity format requirement.
- **DONE (regression authored):** extended the existing runtime trusted-shadow scheduler test with a malformed direct-construction case; it must throw before any process execution.
- **PARTIAL (P0/P2):** this removes a config-path inconsistency but does not itself provision a staged candidate, trusted signer, sandbox or independent verifier.
- **Validation:** exact-head Actions currently fails before any steps/logs are available; local execution/typecheck has not been performed. Keep status unverified.


## WorkPass244 — canonical manifest identity across host authority boundary

- **DONE (code integration):** `CandidateExecutionContext` now carries `manifestFingerprint` separately from `planFingerprint`; when the canonical experiment authority exists, the value comes from `VerifiedOutcomeLedger.manifestFingerprint()`.
- **DONE (code integration):** host verifier and safety-scanner protocol checks require an exact manifest-fingerprint echo, preventing a response bound to the plan digest alone from being misrepresented as manifest-bound evidence.
- **DONE (regression update):** the host-service protocol fixture now exercises a non-null manifest digest.
- **PARTIAL:** process receipts use the canonical manifest digest when available; configurations without canonical experiment authority use the evaluator plan digest only for supervisor bookkeeping, while the request context keeps manifest identity null.
- **OPEN:** run exact-head regression and typecheck on a functioning CI runner; deploy real sandbox/verifier/scanner executables; verify matched baseline/candidate execution through the durable shadow-evidence and authenticated-approval path. Process separation alone is not OS sandboxing.


## WorkPass245 — bind canonical experiment plan and scheduled run

- **DONE (code):** verifier and safety-scanner response validation now requires exact `experimentPlanFingerprint` and `plannedRunId` echoes, not merely the evaluator plan digest and runtime run ID.
- **DONE (fixture):** existing host-service protocol regression scripts echo these fields from the immutable request context.
- **OPEN:** exact-head test/typecheck on an executing CI runner; actual OS/container sandbox; production verifier/scanner deployment; full promotion-chain e2e with host-issued evidence and authenticated approval.


## WorkPass248 — bind executor output to the supervised run identity

- **DONE (code):** the host-owned executor adapter now requires its JSON response `runId` to equal the invocation run ID used by the process supervisor, including the canonical scheduled run ID when experiment authority is configured.
- **DONE (regression authored):** the existing host-authority process fixture now returns a detached run ID on demand and asserts the adapter rejects it before verifier/scanner evidence can be produced.
- **WHY:** independent verification of a trace must not accidentally bless an executor-minted identity detached from the actual supervised invocation.
- **OPEN:** execute the targeted host-service regression and runtime typecheck on an available runner; provision and exercise the real OS/container sandbox launcher plus independently controlled verifier/scanner; complete matched baseline/candidate activation e2e with host-issued evidence. This identity check does not itself provide OS isolation.


## WorkPass275 — provenance-scoped causal replay and consolidation

- **DONE (code):** snapshot restore now preserves grounded trust only for records explicitly marked `runtime-outcome` and carrying a valid 16+ dimensional policy-feature vector; `experience-replay` and `skill-repair` rows fail closed to external/ungrounded.
- **DONE (code):** replay admission requires runtime-outcome provenance, `stateGrounded === true`, explicit `replayEligible === true`, and finite bounded policy features. Consolidation likewise requires runtime-outcome provenance and explicit grounded state.
- **DONE (regression authored):** added a forged `skill-repair` snapshot with plausible features and caller-set grounding/replay flags; it must be downgraded and cannot replay or consolidate.
- **OPEN:** this is provenance consistency hardening, not snapshot authentication. Persisted data can still forge `runtime-outcome` plus a plausible vector; trusted persistence needs host-authenticated integrity/attestation. Exact-head CI and typecheck remain unverified while Actions exposes no usable job logs.


## WorkPass276 — isolate runtime adaptation metrics from imported evidence

- **DONE (code):** behavioral-impact/context-divergence aggregation now includes only grounded `runtime-outcome` rows. External/derived imports can remain visible for analysis but cannot inflate the runtime's observed adaptation metric.
- **DONE (regression authored):** four imported events with deliberately varied actions must still produce zero runtime behavioral-context samples and zero behavioral-impact score.
- **OPEN:** quantify behavioral-impact calibration against real longitudinal tasks; the metric remains a proxy for action-distribution change, not proof of improved competence or human-like learning.


## WorkPass277 — validate persisted causal record shape

- **DONE (code):** restore now rejects rows with invalid normalized task/trace IDs, unsupported actions, non-finite/out-of-range causal metrics, malformed timestamps/IDs, oversized policy vectors, and invalid replay metadata.
- **DONE (regression authored):** malformed snapshot rows with NaN reward, an unsupported action, and control-bearing task identity are rejected and cannot enter replay.
- **OPEN:** this schema validation is not cryptographic authenticity. A forged but well-formed `runtime-outcome` snapshot can still claim runtime provenance; host-authenticated persistence remains the next trust-boundary task.
- **VALIDATION:** regression is authored but has not been executed on a functioning runner; exact-head CI remains unverified.


## WorkPass278 — require valid observed state transitions

- **DONE (code):** the causal outcome API now rejects unsupported selected actions, malformed/non-normalized before/after state vectors, invalid ticks, and transitions whose resulting state is not later than the pre-action state.
- **DONE (regression authored):** non-finite pre-action energy and a same-tick post-state must not mint grounded causal evidence.
- **OPEN:** a valid in-process transition is still not a host-authenticated durable attestation. Snapshot authentication and exact-head execution remain open.
- **VALIDATION:** tests authored, not yet executed on a functioning runner.
