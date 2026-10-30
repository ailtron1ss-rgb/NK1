## [NK1][Aspect 02] Add semantic truth labels to the legacy sprite reference inventory (2026-10-30)

- Transcribe the prior WorkPass622 pixel-audit descriptions into per-sprite semantic metadata for 25 exact manifest-ID matches, including corrected pose/action roles where filenames are misleading.
- Leave seven unmatched legacy IDs explicitly pending fresh visual review; never infer expression or pose from a filename. Record that this pass did not re-open or re-verify the PNG pixels.
- Extend the inventory regression to enforce exact 25/7 coverage, source attribution, honest review status and the absence of inferred labels for unmatched sprites.
- Preserve all 32 source PNGs as static references only; no production art, licensing clearance, 2.5D layers or Release ZIP update is claimed.

## [NK1][Aspect 02] Inventory existing static sprite references without promoting them to production art (2026-10-30)

- Add a source-tree inventory for all 32 existing public sprite PNGs, retaining their manifest IDs, sheet grouping, byte sizes and Git blob SHA-1 identifiers at the observed `workpass70-source` commit.
- Explicitly classify these files as legacy static-pose references, not Original 2D layered masters or 2.5D source layers; preserve the separate visual-audit reference and mark licensing as not revalidated.
- Add a regression test proving the inventory exactly covers the 32 sprite-manifest entries and cannot silently claim production-art eligibility; expose it as `npm run test:original-2d-existing-assets`.
- This is a provenance/indexing pass, not a pixel re-review, rights clearance, artwork creation or Release ZIP update.

## [NK1][Aspect 02] Reject malformed asset entries before inventory checks (2026-10-30)

- Fail closed when a manifest contains null, primitive or structurally incomplete asset entries, or when contract groups/status vocabulary contain non-string values. This prevents malformed JSON structures from reaching inventory filters and property access as uncaught runtime exceptions.

## [NK1][Aspect 02] Fail closed on malformed art manifests (2026-10-30)

- Guard the executable Original 2D asset validator against non-object contracts/manifests and malformed required arrays before inventory iteration. Invalid structure now produces a controlled validation failure instead of an unhandled `.filter`/`Set` exception.
- Preserve the explicit boundary: the inventory remains a planning contract and no production artwork is inferred from empty slots.

## [NK1][Aspect 02] Establish Original 2D art identity and production contract (2026-10-30)

- Add an executable `npm run validate:original-2d-assets` gate that checks contract coverage, safe asset paths, file existence, SHA-256 integrity and source/preview separation before artwork can advance through the manifest. It reports authored versus pending slots without treating the planning inventory as completed art.

- Add a 24-slot machine-readable asset inventory for the master character, six turnarounds, ten expressions, three independent outfits and four accessory slots; all entries explicitly remain `not-authored` until real source artwork and verified exports exist.
- Add manifest regression gates for contract coverage, unique IDs, safe relative paths, honest status transitions and SHA-256/source/preview provenance before review or approval.

- Add a machine-readable Original 2D character art contract that pins the current SVG concept identity, palette, composition guides, required views/expressions/outfits, layer order and production handoff requirements.
- Add a Russian production brief defining the visual identity lock, turnaround/expression/outfit/prop sheets, stable layer naming, pivot metadata, export/provenance requirements and acceptance gates.
- Scope SVG paint-server IDs with React `useId`, preventing gradients, pattern and filter references from colliding when multiple Original 2D previews are mounted in the same document.
- Add focused regressions for instance-scoped SVG references, identity defaults, art-contract boundaries and state-driven component wiring.
- This pass improves the Original 2D foundation and art-production contract; it does not claim that layered production artwork, a finished expression atlas, independent garment assets or a 2.5D rig have been authored.

## [NK1][восприятие] Deep P41 world perception, identity tracking, and evidence calibration (2026-10-30)

- Keep OrganismCore as the single canonical owner of runtime perception; runtime publishes the exact post-Core event instead of running a duplicate PerceptionEngine.
- Track identical object instances separately using stable provider IDs or geometry in an explicitly shared coordinate frame; preserve primary IDs and cross-modal aliases, estimate smoothed velocity, and do not correlate across unknown frames. Bind scene-graph relations to exact P41 entity IDs when track identity is unambiguous; abstain on equidistant spatial tracking candidates. Require a Core-owned external outcome receipt before applying empirical calibration.
- Measure current cross-modal evidence coverage using per-modality observation timestamps and a bounded freshness window; separate action-outcome alignment from semantic corroboration. Retry IDs are generation-scoped and epistemic claim replay is idempotent.
- Separate reported model quality, service success and empirically verified accuracy; calibrate only from human/independent evidence IDs with replay protection.
- Distinguish same-modality persistence, independent cross-modal corroboration and explicit claim supersession; expire stale active-perception requests and reject time-rewound P41 samples.
- Add deep P41 and Core integration regressions (including verifier receipt validation), document research inspirations and retain backward compatibility for existing persisted P41 snapshots. Physical device and independent labelled-dataset validation remain separate gates.

## [NK1][восприятие] Harden world-observation integrity and semantic change detection (2026-10-29)

- Reject malformed world-context coercions: null/blank numerics no longer become zero; malformed text, booleans, evidence kinds and source IDs no longer become facts.
- Preserve known/unknown flags for object value, visibility and collection state; wire the normalizer into live OrganismRuntime → core.observe() ingress. Run PerceptionEngine in the runtime cycle and route salient events into RuntimeEvidenceBus and multimodal workspace.
- Gate physical observations on freshness and sampled-at plausibility; initialize baselines without false motion and represent sensor availability separately.
- Emit sensor changes across successive cycles, make resource-pressure notifications transition-based, and detect same-cardinality world fact/object/event updates.
- Add five focused integrity tests, including a real OrganismRuntime ingress smoke, `npm run test:world-perception` and a dedicated GitHub Actions gate; real device validation remains a separate gate.

## [NK1][Cognitive] Unified ownership and restart-safety pass (2026-10-29)

- Removed the duplicate runtime reality-evidence ledger; the embodied loop now records through the canonical Core-owned ledger, and snapshots merge by immutable evidence ID rather than replacing evidence from another writer.
- Hardened reality-evidence ingestion, restore and merge: malformed ticks/timestamps/classes/claims/confidence are rejected at write time; malformed persisted rows and duplicate IDs are excluded; canonical projections retain a single cumulative history.
- Preserved runtime-namespaced event-fabric, resource-economy and unified-cycle snapshots in the explicit state-migration whitelist.
- Made same-tick duplicate feedback a bounded diagnostic no-op, restoring the close guard from verifier history so repeated callbacks cannot abort learning/consolidation after restart.
- Connected the existing unified cognitive substrate's bounded action bias to governed candidate scoring.
- Made the architecture contract independent of the caller's working directory and added a focused ownership/restart regression covering merge, corrupt restore input, migration, restart and scoring-path wiring.
- Added dedicated CI steps for ownership, cycle-order and architecture-contract checks.
- Evidence boundary: implementation and CI wiring are committed on the candidate branch; hosted CI execution and target-device end-to-end behavior must still be verified on the resulting commit.

## [NK1][WorkPass622] Correct semantic sprite routing after visual PNG review (2026-10-29)

- Visually inspect the 32 manifest sprites and correct expression/action candidate maps for actual depicted poses instead of trusting misleading legacy filenames.
- Stop `preferLab` from overriding semantic suitability: several `lab_*` sprites actually depict sleep, phone use, Dr Pepper or unrelated poses; route explore, verify, rest, reflect, respond and wait to suitable imagery.
- Add regression assertions and detailed per-asset visual audit notes. Keep legacy file paths stable for compatibility.

## [NK1][WorkPass621] Add true 3D embodiment wired to organism state (2026-10-29)

- Add a selectable Three.js WebGL body built from 3D geometry; explicitly label it as a procedural concept because no redistributable canonical Kurisu 3D model is present in the tracked source tree.
- Allow self-contained local binary VRM/GLB models up to 90 MiB to replace the concept, with browser-local IndexedDB persistence, safe reset, model bounds/centering, available animation clips and recognized bone/morph targets. Model bytes are never uploaded to NK1 servers.
- Wire the same action, emotion, arousal/valence, gaze, wake/sleep, thinking and speech-viseme state from OrganismSnapshot into the 3D body; preserve Live2D, sprites and the authored SVG concept.
- Pin Three.js 0.180.0 in app dependencies/lockfile, add regression tests and document visual/VRM/licensing boundaries. No unverified third-party model asset was copied.

## [NK1][WorkPass620] Make Legacy sprite poses genuinely action-aware (2026-10-29)

- Fix a remaining selector gap: the first sprite pass only chose action poses when they overlapped the current expression's candidate list, so a neutral expression could still show a crossed-arm frame during exploration/rest/verification.
- For active non-dialogue actions (explore, verify, rest, reflect), now select from the real shipped action-specific sprite candidates, with profile and lab preferences preserved when there is a compatible candidate. Response/wait continue to respect the emotion-specific candidate set first.
- Extend the legacy sprite regression to guard the action-driven candidate path and deterministic selection. No new sprite assets or lip-sync capability are claimed.

## [NK1][WorkPass619] Fix avatar render timing and visual-quality seams (2026-10-29)

- Apply Live2D gaze/head/eye/viseme parameters at Cubism's `beforeModelUpdate` boundary, after authored motion and physics updates; earlier ticker writes could be overwritten during render.
- Add small additive head/gaze offsets, constrain motion groups/indexes to actual shipped clips, and report unavailable clips instead of silently treating them as successful.
- Enable capped DPR=2/auto-density in both Live2D viewer entry points and in the Legacy sprite canvas.
- Replace wall-clock sprite pose cycling with deterministic action-aware selection and pass organism action/thinking state into Legacy.
- Remove the misleading torso ring drawn over still sprites, improve SVG Original's default palette/hair clip, and make Auto pose reflect basic action/emotion context while preserving manual overrides.
- Add regression assertions for active-viewer timing, sprite determinism, model/media references, texture profiles, motion coverage, sprite manifest integrity and SHA-locked canonical assets.
- This source pass does not claim browser/device visual E2E or a refreshed Release ZIP; real device validation and the human license/redistribution release gate remain required.

## [NK1][WorkPass618] Expose Original 2D avatar as a selectable mode (2026-10-29)

- Integrate the existing `KurisuOriginalStage` SVG prototype into the active avatar selector beside Live2D and Legacy, without replacing the motor-intent repairs.
- Restore the saved Original selection and pass organism emotion, action, arousal, gaze, speaking, thinking and viseme state into the component.
- Keep the editable clothing, colour, pose, motion-style and scale controls; explicitly classify this as a 2D concept, not a completed 2.5D/3D body.
- Add regression assertions for selector wiring and outfit/pose persistence. Production build, browser render and Release ZIP refresh remain pending.

## [NK1][WorkPass617] Bridge Live2D embodiment intent and add deterministic motor planning (2026-10-29)

- Fix the protocol mismatch between `AvatarStage` (`kurisu_embodiment_intent`) and the Live2D viewer, with strict protocol-v1 validation, monotonic state-version rejection, and normalization to the bundled model's actual motion groups.
- Route protocol-driven mouth poses into the animation ticker's `lipTarget`; previously a direct core-parameter update could be overwritten by the next frame.
- Include `motionToken` in motion identity, allowing a semantic intent change to replay the same motion group/index without restarting it on ordinary state/viseme updates.
- Add a deterministic bounded motor-intent selector for rest/listening/reflection/inspection/explanation/comfort/response and integrate it into the active avatar path.
- Add `test:avatar-motor-intent` with unit/regression checks for planning, schema bounds, cancellation, viewer wiring, token-aware motion identity, and lip target routing.
- Fix a CI-discovered regex-literal syntax error in the new viewer-wiring assertion by using a direct source-string check.
- Replace the lip-target static regex with a direct source-string assertion after CI exposed lost escapes in the template-generated test source.
- This is a Live2D protocol and high-level intent integration repair. It does not add a 3D skeleton, IK, garment simulation, free joint control, or measured autonomous motor-policy performance. The Release ZIP is not changed by this source-branch pass; build/E2E/device tests remain to be run.

## [NK1][WorkPass616] Wire metadata candidate mode into independent bilingual retrieval evaluation (2026-10-29)

- Add an explicit `metadataRecallEnabled` benchmark option that applies only to the isolated candidate arm; the baseline arm remains the canonical retriever and is unchanged.
- Bind the candidate mode into the retrieval-configuration SHA-256 fingerprint and report it in experiment configuration/guardrails, so a result cannot be mistaken for the canonical configuration.
- Add `--candidate-mode canonical|metadata` to the external bilingual holdout runner. Canonical is the default; unknown values fail closed. Metadata mode requires the same independently sourced and labelled external dataset, corpus and provenance requirements as canonical evaluation.
- Extend runner contract and synthetic benchmark tests to check configuration isolation, fingerprint changes, the persistent independent-review gate, and the absence of automatic promotion. Synthetic tests validate plumbing only and do not claim retrieval uplift.

## [NK1][WorkPass615] Unify the cross-context skill-transfer safety floor (2026-10-29)

- Export one `MIN_TRANSFER_SIMILARITY01 = 5 / 6` constant and use it in both P23LearningEngine's legacy bias path and SkillRetrievalAugmentation's retrieved-skill bias path. Similarity below this floor may still be surfaced for inspection, but cannot influence action ranking.
- Fix a real safety regression where a promoted skill with similarity `0.556` added a nonzero execution bias despite the legacy path rejecting the same dissimilar context.
- Replace brittle exact replay counts in `p23-true-learning.mjs` with the actual health-adaptive replay invariants: positive bounded count, no duplicates, newest/recent coverage, and retention of older evidence. Goal-aware replay receives the same budget-cap and recent-window checks.
- This is a transfer-boundary and test-validity repair, not a measured learning-uplift claim.

## [NK1][WorkPass614] Add opt-in metadata-aware memory recall with index integrity checks (2026-10-29)

- Add a separate bounded postings index over curated tags, entities, and an allowlist of topic/context fields; keep metadata terms out of content BM25 document-frequency statistics.
- Add an explicit constructor flag `metadataRecallEnabled`, disabled by default, so the production/default ranker and answerability policy do not silently change before independent RU/EN holdout improvement is established.
- When explicitly enabled, allow metadata postings to nominate candidates and give metadata its own bounded ranking channel; only sufficiently overlapping metadata may satisfy the answerability gate.
- Rebuild and maintain metadata postings on encode/restore/removal and expose `metadataIndexMismatch` in `indexDiagnostics()`.
- Add a read-only regression covering metadata-only discovery, baseline-default isolation, snapshot/restore, and index consistency. This is a focused synthetic contract; it does not claim independent recall uplift or automatically promote the feature.

## [NK1][WorkPass612] Make installer, doctor and CI reliability checks follow the pinned Node runtime (2026-10-29)

- Read the expected Node.js major from root `.nvmrc` through a shared helper used by installer and doctor, removing stale Node 22 assumptions while the project pins Node 24.
- Define a shipped artifact as a Git-tracked path rather than any ignored local `node_modules` or runtime state found on a developer machine; retain a conservative filesystem fallback when Git is unavailable.
- Extend the CI reliability gate and regression tests to reject workflow Node pins that drift from root `.nvmrc`.
- Make the installer-deadline regression treat terminated zombie processes as no longer running, avoiding false failures on hosts that delay reaping orphaned children.
- The P26 Node workflow pin is already corrected by earlier merged changes and is intentionally not duplicated here. This change does not alter license approval gates or claim release readiness.

## [NK1][WorkPass611] Restore scale-invariant latent-program revision and constitutional vote polarity (2026-10-29)

- Make the B276 structure-revision gate scale-invariant: retain the absolute credit-spread floor and also permit revision when relative spread is material at a sufficient mean credit level. This prevents upstream reward gating from disabling program revision merely by compressing credit magnitude.
- Pass constitutional constraint pressure with the correct polarity at both quorum vote sites, so stronger constraints are not inverted into an approval signal.
- Scope is limited to latent-program revision reachability and quorum polarity. Prior focused tests passed on the original candidate branch; this clean port needs exact-head CI before merge. No memory recall uplift or end-to-end autonomy claim is made.

## [NK1][WorkPass610] Restore brain-fusion runtime loading under Node 24 strip-only TypeScript (2026-10-29)

- Remove TypeScript parameter properties from the five brain-fusion runtime classes so Node's strip-only TypeScript loader can import them without an unsupported-syntax exception.
- Separate erased lifecycle interfaces into a type-only import and export the brain-fusion runtime modules through the organism barrel.
- Replace the invalid `node --check`-against-TypeScript fallback with `stripTypeScriptTypes`, and resolve the pinned compiler from runtime, app, or root lockfiles before syntax-only fallback.
- Add a direct runtime-load regression and include it in `test:rebuild-recovered`. This validates module loading and constructor defaults only; it does not claim improved learning, recall, autonomy, or consciousness.

## [NK1][WorkPass609] Repair stale big-pass-126 retrieval benchmark fixture against the current provenance contract (2026-10-29)

- `tests/big-pass-126-memory-retrieval-benchmark.mjs` asserted `schemaVersion === 3` while the report schema advanced to 6, and its `datasetProvenance` omitted the now-required `licenseId` and `contentSha256`. Both caused the suite to abort on the first assertion, masking every downstream check.
- Bind provenance to the exact canonical dataset via `fingerprintMemoryRetrievalDataset(examples)` instead of a hardcoded or omitted hash; add the explicit `licenseId` required for `provenanceComplete`.
- Rebind the sliced `insufficient` sub-case provenance to that slice's own fingerprint so it still exercises the `insufficient-labelled-holdout-or-corpus` gate rather than failing earlier on provenance.
- This is a test-fixture repair only. It restores coverage of the existing retrieval benchmark; it does not change retrieval behavior, does not claim recall uplift, and leaves `recallDelta=0` / `not-promoted` unchanged.

## [NK1][WorkPass608] Attribute retrieval cost to the selected execution path (2026-10-28)

- Add isolated lexical preview diagnostics so candidateCount/cost no longer reads whichever query last mutated live MemoryOS2 diagnostic state.
- Attribute semantic retrieval cost to the actual attempt using corpus scan size, embedding backfill work and provider latency, bounded to [0,1]; report cost source and selected count in MemoryFabric runtime diagnostics.
- Extend the live fake-provider regression to assert lexical and semantic paths use their own cost evidence, not stale prior-query diagnostics.
- The estimate is an adaptive-policy workload signal, not a benchmark of real CPU cost or evidence of retrieval uplift.

## [NK1][WorkPass607] Commit only the selected cognitive retrieval result (2026-10-28)

- Keep the lexical fallback preview read-only while the optional semantic path is deciding; previously fallback accounting/access updates occurred even when semantic retrieval replaced it.
- Add a canonical MemoryOS2 selected-read commit that rechecks ID, exact content, temporal validity and eligibility before updating access/retrieval state for only chosen rows.
- Record one MemoryFabric/UnifiedMemorySystem retrieval outcome for final selected rows, including semantic retrieval; add a fake-provider runtime wiring regression for feature-flag behavior and exactly-once accounting.
- This verifies runtime accounting and wiring, not real-provider retrieval uplift.

## [NK1][WorkPass606] Reject stale in-flight semantic embeddings (2026-10-28)

- Capture content hash and exact input text before each asynchronous embedding request; accept a returned vector only if the current canonical record still exists, remains eligible, and retains that exact content identity.
- Prune stale/wrong-provider/malformed cache rows before computing semantic coverage so invalid cache entries cannot inflate diagnostics.
- Add a controlled await-boundary regression that revises a memory while an embedding request is pending and proves the old vector is not cached or used for ranking.
- This protects semantic-index freshness; no retrieval uplift is claimed.

## [NK1][WorkPass605] Validate semantic embedding vectors before indexing (2026-10-28)

- Validate query and document vectors for array shape, finite numeric components, dimension bounds, expected-dimension match, and non-zero norm before semantic ranking/cache insertion.
- Normalize accepted vectors consistently with background semantic-index maintenance; ignore malformed document vectors and fall back to canonical lexical retrieval if no valid semantic candidates remain.
- Add fake-provider regressions for NaN, Infinity, empty/zero-norm query vectors, malformed document vectors, and the all-invalid fallback path.
- This is provider-output integrity and failure-recovery work; no retrieval uplift is claimed.

## [NK1][WorkPass604] Port transfer-integrity and sample-level forgetting evidence to canonical source (2026-10-28)

- Port the WorkPass579–580 transfer-probe integrity and continual-outcome sample-transition diagnostics onto the current canonical source instead of merging the stale, divergent PR branch.
- Require exact service-minted external-postcondition receipts for both replay retention and transfer-sample credit; caller booleans cannot independently validate a probe.
- Keep a bounded transfer-probe ID/fingerprint ledger and make restore fail closed: serialized flags are demoted and transfer-validation counters reset because process-local verifier authority cannot survive JSON serialization.
- Report matched pass→fail and fail→pass transitions by stage, task, and task family; include the new regressions in the recovered runtime test aggregate.
- These are integrity and descriptive-evaluation improvements, not evidence of real-corpus learning uplift. `main` and the Release ZIP remain untouched.

## [NK1][WorkPass603] Reject malformed retrieval labels before normalization (2026-10-28)

- Count blank and non-string `relevantIds` entries on bounded raw inputs before filtering; malformed labels now invalidate dataset integrity even when sanitized rows still match a clean-content fingerprint.
- Add a regression for mixed malformed/clean labels and a path-scoped Actions gate for runtime typecheck and retrieval experiment integrity checks.
- This is evaluation-integrity work only; no recall uplift or release readiness is claimed.

## [NK1][WorkPass601] Document exact release-license review blockers (2026-10-28)

- Record the current publisher audit's 135 missing review/evidence items, affected archive/license paths, dependency fingerprint, and required human decision sequence in `docs/RELEASE_LICENSE_REVIEW_WORKLIST_2026-10-28.md`.
- Keep the release gate fail-closed; the worklist does not approve licensing or redistribution and does not enable publication.

## [NK1][WorkPass598] Expose canonical retrieval dataset fingerprint (2026-10-28)

- Export the source tree's canonical labelled-dataset fingerprint through a narrow wrapper around the existing hash function.
- Keep benchmark execution and provenance generation on the same canonical algorithm, allowing duplicate-label tests to bind their exact dataset bytes without a second implementation.
- Exact-head CI is pending.

## [NK1][WorkPass598] Preserve duplicate retrieval labels through integrity validation (2026-10-28)

- Keep repeated ground-truth memory IDs until dataset-integrity inspection; duplicate labels remain visible to the promotion gate instead of being silently deduplicated.
- Bind the duplicate-label regression to a matching canonical fingerprint and complete provenance, proving that label integrity alone blocks promotion.
- Exact-head validation is pending; no passing result is claimed until the combined regression workflow completes.

## [NK1][WorkPass599] Place verified outcome predicate at method scope (2026-10-28)

- Hoist the verified-outcome predicate beside the method-level external-evidence classification so the scientific-method and adaptive-policy paths share the same initialized trust gate.
- Preserve the original condition: a world transition or explicit external project evidence is still required; no self-reported success is promoted.
- Exact-head typecheck and dependent CI are pending. No pass is claimed until those runs complete.

## [NK1][WorkPass597] Restore verified outcome gate scope (2026-10-28)

- Move `verifiedPolicyOutcome` to the surrounding outcome-processing scope so the scientific-method gate uses the same predicate as adaptive-policy feedback.
- Preserve fail-closed semantics: the gate remains true only for a world transition or explicit external project evidence.
- Validation is pending on the exact PR head; no passing result is claimed before CI completes.

## [NK1][WorkPass596] Make scientific evidence idempotent and bounded (2026-10-28)

- Require a non-empty, NFKC-normalized, bounded evidence string for verified hypothesis updates.
- Reject repeated evidence receipts and non-finite/out-of-range success scores before mutating project status, evidence or confidence.
- Extend the verified-science regression with duplicate-receipt and NaN-score cases. The registered scenario was not run; no passing result is claimed.

## [NK1][WorkPass595] Close intrinsic experiments through verified outcomes (2026-10-28)

- Use a canonical `explore` action instead of the non-selector label `inspect` for uncertainty-led intrinsic experiments.
- Bind each generated proposal to its `ScientificMethodEngine` project by experiment ID and tick.
- Only credit the project when its proposed action actually ran and the world-transition/external evidence gate verified the outcome. Unverified rewards no longer change hypothesis confidence; a concluded project marks its linked queue item validated/rejected with evidence references.
- Add a focused regression for unverified evidence rejection, verified multi-observation conclusion, and idempotent completion; register it in `test:rebuild-recovered`. Tests were not run.

## [NK1][WorkPass594] Keep Hexis storage failures distinct from conflicts (2026-10-28)

- Extracted the Hexis evidence-ingest reason-to-HTTP mapping into a pure helper shared by the server and integration smoke test.
- Preserve 404 for missing canonical memory, 409 for immutable trace-ID/provenance conflicts, and 400 for malformed/invalid submissions; map canonical evidence write failures to 500 rather than misreporting them as client conflicts.
- The existing Hexis server smoke test now directly checks all four mappings as well as its live conflict/replay path. Test/CI execution is still unconfirmed; no Release ZIP update or learning uplift is claimed.

## [NK1][WorkPass593] Preserve duplicate relevance labels in source fingerprints (2026-10-28)

- Ported the focused benchmark-integrity correction into the canonical source stack: relevance labels are sorted for order-independent fingerprints but are no longer deduplicated before provenance hashing.
- Added a regression binding the clean dataset hash to a duplicated-label input; the duplicate-label dataset must have a different fingerprint, invalid provenance hash, failed integrity gate and blocked promotion.
- This is an evidence-integrity fix only. No retrieval uplift is claimed, and the GitHub Release ZIP was not rebuilt or changed by this source edit.

## [NK1][WorkPass592] Keep intrinsic experiments explicitly unverified (2026-10-28)

- Mark every ordinary intrinsic experiment as `epistemicStatus: hypothesis`, `status: candidate`, and `verificationRequired: true`, matching the existing dream-association boundary.
- Extend the existing WorkPass490 scenario so generated proposals cannot silently omit their epistemic status or appear validated by default. Its command is already part of `test:rebuild-recovered`.
- The change was committed to the source branch. Tests were not run; no behavior pass is claimed.

## [NK1][WorkPass591] Embed audited SBOM and provenance in the release ZIP (2026-10-27)

- The provenance gate regenerates the CycloneDX SBOM and current WorkPass provenance in the runner workspace; those outputs are not part of the immutable commit tree until committed.
- Overlay the exact audited `contracts/SBOM.final.json` and current `contracts/SOURCE_PROVENANCE_LICENSES_WORKPASSN.json` bytes into the ZIP created from the validated source SHA.
- Validate that each expected archive member appears exactly once and is byte-identical to the checked output; rerun ZIP integrity and unsafe-path checks after replacement.
- Keep the exact source SHA in the release report and checksum the final ZIP. Human license/redistribution approval remains a separate mandatory gate; no approval is inferred.

## [NK1][WorkPass590] Synchronize validated source release workflow (2026-10-27)

- Publish from source pushes as well as successful core-validation workflow runs; wait for exact-SHA targeted regression and Hexis source-lineage checks before release.
- Recheck branch freshness before and after packaging; build a dated ZIP, report, and SHA-256 manifest for that exact source SHA without overwriting existing tags.
- Preserve pinned Node, current SBOM/provenance, and release-license-readiness gates in both release workflows.
- Fail closed when a required CI or license-readiness gate fails; existing release assets remain untouched.

## [NK1][WorkPass589] Close Mem0 OSS/runtime wiring validation gap on current source (2026-10-27)

- Upgrade the existing opt-in Mem0 adapter with explicit Platform/OSS API modes, local-only OSS defaults, an explicit unsafe-HTTP opt-in for non-loopback hosts, and provider-specific API headers/routes.
- Add independent self-hosted OSS route/scope/write-delete gate coverage and a runtime wiring contract test for disabled-by-default remote recall, bounded candidates, and untrusted low-priority prompt injection.
- Add both tests to the dedicated Mem0 audit and the integration-closure gate; run the workflow on pull requests targeting `workpass70-source`.
- Preserve the existing runtime, LanguageOrgan, and server integration already present on current source; no duplicate re-wiring and no remote-memory auto-promotion.
- Validation is pending on the new PR head. No Release ZIP was changed.

## [NK1][WorkPass588] Port Hexis trace-conflict telemetry onto the current source baseline (2026-10-27)

- Preserve the first accepted source trace when an immutable trace ID is reused with conflicting provenance, while incrementing a separate conflict diagnostic.
- Flush the rejected-conflict audit event before returning HTTP 409 so the telemetry survives a server restart.
- Extend the live server smoke regression for exact replay, one conflict increment, original-trace preservation, and restart persistence.
- Based on current `workpass70-source` head `e6830bf`; the earlier stale PR's duplicate retrieval patch is intentionally excluded. Fresh CI and the Release ZIP are still pending.

## [NK1][WorkPass587] Enforce source-payload schema preservation in local skill generation (2026-10-27)

- Validate the local-model revision output against the source payload root type before returning it to P23.
- For object payloads, require every pre-existing top-level key to remain present; added keys remain possible, while silent loss of source fields is rejected before independent execution.
- Extend the generator unit test with root-type and missing-field rejection cases.
- Candidate generation remains untrusted; fresh evaluation, evidence binding, approval and activation gates remain unchanged.

## [NK1][WorkPass586] Wire the verified P23 lifecycle to the local revision generator (2026-10-27)

- Add `generateAndStageReflectiveSkillRevisionWithLocalModel` to P23LearningEngine so the existing bounded local-model generator is directly usable without caller-authored adapter code.
- Keep candidate generation separate from the existing authenticated proposal, fresh independent evaluation, shadow evidence, human approval and activation boundaries.
- Add an integration contract proving the exact dataset fingerprint, validation evidence, revision plan and evidence fingerprint flow through the adapter without sending per-case holdout details.
- The standalone generator already has its own unit test; this adds engine-wiring coverage. Full Core/Hexis CI result pending.

## [NK1][WorkPass585] Preserve deterministic morphological recall during provider timeouts (2026-10-27)

- Add a deterministic token-root evidence path to the answerability gate. A strong stem-prefix match can ground a memory even when a long query dilutes aggregate fuzzy coverage.
- Add a regression using the live cognition timeout query `I cannot authenticate to my user profile` against the stored `authentication`/credential-recovery memory; this tests the local lexical fallback independently of external embedding availability.
- The preceding Core run passed causal and learning paraphrase assertions after lineage-gated concept recall, then found this timeout lexical-retrieval regression. Full rerun is pending.

## [NK1][WorkPass584] Extend lineage-grounded concept recall to learning episodes (2026-10-27)

- Permit strong concept-bridge recall for non-causal-worded learning questions only when the target is an episodic record with explicit decision ID, observation ID, outcome direction and at least 0.55 concept coverage.
- Keeps the broader paraphrase route evidence-bound; no type/salience/recency-only candidate gets promoted through this condition.
- Follow-up CI after WorkPass583 confirmed the causal paraphrase passed and exposed the related Russian learning-episode wording; this commit targets that exact case.

## [NK1][WorkPass582] Preserve causal paraphrase recall with explicit lineage (2026-10-27)

- Allow strong bilingual concept-bridge evidence to pass the answerability gate for causal questions only when the candidate has explicit causal links or a decision/observation/outcome lineage.
- This restores paraphrase retrieval such as a Russian question about why a launch failed matching an English episode about an expired approval ticket, without enabling broad recency-only fallback.
- The current Core run passed the fuzzy retrieval contract but found this causal paraphrase regression. The targeted rule is added; re-run validation is required.

## [NK1][WorkPass581] Preserve strong fuzzy evidence in the answerability gate (2026-10-27)

- Allow MemoryOS2's high-confidence character n-gram evidence (`fuzzy >= 0.45`) to satisfy the grounded-recall gate without requiring exact-token coverage.
- This restores the explicit spelling/inflection recovery contract while leaving zero-overlap, low-fuzzy unsupported queries subject to abstention.
- The current regression run reached the recovered suite but failed the existing fuzzy-memory test because the first gate required both fuzzy evidence and exact coverage. This correction addresses that failure; final CI is still pending.

## [NK1][WorkPass580] Align identifier regression clock with fixture validity (2026-10-27)

- Correct the new RUN-501 regression to query at its explicit fixture timestamp. The test seeds memory at a future timestamp and must use `temporalMode: 'at'`; otherwise the temporal eligibility layer correctly excludes the item before the identifier gate is evaluated.
- This is a test-fixture correction, not a relaxation of temporal safety or answerability thresholds.
- Core regression rerun is required; identifier holdout and the full retrieved-memory regression remain unverified on this fix.

## [NK1][WorkPass579] Preserve exact-identifier retrieval under grounded abstention (2026-10-27)

- Extend MemoryOS2 answerability gating with an exact-identifier evidence path for structured IDs, incident/run IDs and long hexadecimal identifiers.
- This prevents high-information lookups such as `RUN-501` from being rejected solely because generic query words dilute the token-coverage ratio; ordinary no-match queries remain fail-closed.
- Add a direct identifier-retrieval regression alongside the existing no-match, typed recall and exact lexical fixtures.
- The preceding Core regression exposed `Recall@3 = 0` in the temporal/identifier holdout; that failure is explicitly addressed here. Fresh CI is required before this fix is considered validated.

## [NK1][WorkPass578] Correct escaped cues and bilingual retrieval boundaries (2026-10-27)

- Fix over-escaped English voice-mode regexes and restore intended word-boundary/whitespace matching.
- Split English word-boundary cues from Russian temporal/causal substrings in MemoryOS2, because JavaScript word boundaries do not reliably treat Cyrillic letters as ASCII word characters.
- No tests or runtime checks were run. This pass repairs source-level matching errors introduced in the preceding passes; downstream behavior remains unverified.

## [NK1][WorkPass577] Route affective appraisal into backend voice planning (2026-10-27)

- Pass the current canonical cognitive-field emotion, valence and arousal through `OrganismRuntime` and `EmbodimentRuntime` into `VoicePlan`.
- Use bounded, conservative prosody adjustments for joy, curiosity, anxiety, sadness, frustration, anger and protective affect; negative high-arousal states are routed toward focused/regulatory delivery rather than hostile escalation.
- Keep pitch, rate, volume and pause values under the existing final clamps. No dependencies added; tests/audio playback were not run.

## [NK1][WorkPass576] Fix evidence-gate token cardinality and verify the integrated branch (2026-10-27)

- Correct the grounded-recall gate to use `Set.size` for MemoryOS2's query-token set; the previous implementation incorrectly used array `.length`.
- The preceding GitHub typecheck failure was caused by this new gate and is acknowledged as a regression. A fresh CI run must pass before the gate is considered validated.
- This entry supplements WorkPass575's answerability gate; it does not claim production-corpus recall uplift or update the Release ZIP.

## [NK1][WorkPass575] Align backend TTS language and speech modes with text (2026-10-27)

- Replace the fixed `ru-RU` VoicePlan language with bounded Cyrillic/Latin script inference, matching the browser embodiment's existing two-language heuristic.
- Add English phrases for greeting, self-disclosure, explanatory/lecture and disagreement voice modes; existing Russian cues remain supported.
- No dependencies added. Runtime/browser/audio checks were not run in this pass.

## [NK1][WorkPass575] Gate memory recall on grounded evidence (2026-10-27)

- Add a final answerability gate to MemoryOS2 hybrid retrieval: recency, salience and type bonuses alone no longer justify returning a memory for a no-match query.
- Require direct phrase/coverage/entity/fuzzy/concept support, with bounded category-only recall exceptions for explicit identity, episode, goal and procedure requests.
- Expose the gate decision in retrieval diagnostics so abstention can be evaluated instead of inferred from ranking scores.
- Add a regression for unsupported queries, identity recall, episodic recall and exact lexical retrieval; register it in the recovered runtime suite.
- Validation status: code and regression are committed; CI result pending. Synthetic fixtures do not demonstrate real-corpus recall uplift.

## [NK1][WorkPass574] Bind response voice to post-response emotional state (2026-10-27)

- Refresh the canonical organism snapshot after a chat response before assigning the assistant turn's emotion, avoiding use of the pre-response label by AvatarStage's browser TTS.
- Keep the generated reply durable if the follow-up UI snapshot request fails; surface the refresh error without discarding the chat turn.
- Tests were not run in this pass. Browser speech/Live2D synchronization still needs end-to-end verification on real audio clocks.

## [NK1][WorkPass573] Stabilize query-derived memory retrieval context (2026-10-27)

- Remove lifetime counters `semanticQueries` and `linkUpdates` as fallback signals for temporal/causal routing; current query intent and explicit temporal mode now define the context.
- Add a regression that performs 80 general retrievals, then checks that explicit temporal and causal queries select separate contextual-policy buckets.
- Register the regression in `test:rebuild-recovered`. The test was added but not run in this pass; no pass result is claimed.
- Code is committed to `workpass70-source`; independent holdout uplift and Release ZIP refresh remain pending.

## [NK1][WorkPass572] Keep causal life graph summaries coherent after direct mutations (2026-10-27)

- Make standalone `CausalLifeGraph.upsertNode` recompute derived chain/evidence metrics by default, including updates to an existing node.
- Let `recordCycle` batch node upserts with recomputation disabled and retain its single end-of-cycle recompute, avoiding repeated full graph scans during normal cognition.
- Add a regression asserting that `observedChains` is current immediately after a direct upsert; this also makes graph snapshot/restore round-trips deterministic.
- Validation status: pushed to source branch; CI result pending.

## [NK1][WorkPass571] Restore compatibility memory at the persisted lifecycle tick (2026-10-27)

- Move legacy/multi-timescale compatibility consolidation after restoration of CanonicalMemoryLifecycleAuthority.
- Use the restored logical tick rather than the new instance's initial tick when importing compatibility rows.
- Extend the memory subsystem round-trip regression to assert the imported tick is preserved.
- Validation status: source and regression committed; CI/test execution and Release ZIP refresh remain unverified.

## [NK1][WorkPass570] Persist cognitive memory state across restarts (2026-10-27)

- Wire MemoryRetentionEconomy, MemoryCausalEconomy, CausalLifeGraph and MemoryWorldCausalBridge into MemorySubsystemRuntime snapshot/restore.
- Add a round-trip regression that seeds learned retention weights, evidence-to-outcome lineage, autobiographical causal graph state and verified memory-to-world prediction evidence.
- Register the regression in the runtime recovered-suite command.
- Validation status: code and regression committed; execution/CI and Release ZIP refresh remain unverified.

## [NK1][Hexis] Surface immutable trace conflicts as HTTP 409 (2026-10-27)

- Map `source-trace-id-conflict` to HTTP 409 Conflict while keeping missing canonical memory as 404 and malformed/invalid submissions as 400.
- Extend the live server smoke test to reject conflicting provenance for an existing trace ID, then replay the original lineage and assert an idempotent duplicate rather than a second write.
- Add a focused source-lineage CI gate for runtime typecheck, canonical evidence-lineage tests, and live server smoke tests whenever the server, Hexis adapter, provenance logic, tests, or this changelog change.
- Validation status at commit time: CI pending; no retrieval-uplift or Release ZIP refresh is implied.

## [NK1][WorkPass569] Require explicit session lineage for autobiographical recall ranking (2026-10-27)

- Hardened `isConversationMemory`: stable conversation/session ID or key remains the strongest signal; otherwise only explicit history fields, typed history labels, or source labels naming a history import can identify conversation memory.
- Stopped treating arbitrary `context` values such as `relationshipId="conversation-17"` or untyped notes containing “discussion summary” as conversation lineage.
- Corrected regex escaping in key/value normalization so camelCase, snake_case, kebab-case and spaced session keys normalize as intended. Added direct tests for the pure lineage classifier: relationship IDs and untyped notes are rejected, stable session IDs and typed history/import markers are accepted, and an explicitly disabled history field is rejected. Existing retrieval fixtures continue to test session-memory ranking.
- This is a ranking/provenance-boundary fix. The fixtures do not establish real-world recall uplift, and release readiness remains gated on the separate human license review.

## [NK1][WorkPass512] Add reproducible human retrieval annotation pipeline (2026-10-27)

- Add a local prepare/finalize CLI for frozen MemoryOS2 corpora, query splits, human-assigned relevant memory IDs and explicit unanswerable labels.
- Bind packs to snapshot/query/catalog fingerprints; bind finalized labels to the benchmark's canonical dataset fingerprint and require source provenance plus an exact license identifier.
- Reject duplicate or near-duplicate cross-split queries, changed queue identity, unknown memory IDs, incomplete annotations and insufficient EN/RU train/answerable/unanswerable counts.
- Add regression coverage for hash parity with MemoryRetrievalBenchmark, privacy-aware local packs, no fabricated labels, fail-closed invalid annotations and no-overwrite publication; wire it into core CI and integration closure.
- Test annotations are synthetic fixture data only. This creates a reproducible process for independent evidence; it does not prove retrieval uplift, approve licenses, or update the Release ZIP.

## [NK1][WorkPass568] Improve bilingual autobiographical and session recall (2026-10-27)

- Prioritize explicit profile questions before broad recall phrasing, and recognize Russian/English prompts about previous conversations and sessions as episodic recall.
- Boost social memory for episodic questions only when stable conversation/session lineage or explicit conversation-history metadata is present. Relationship IDs, speaker role, message index and turn sequence alone do not count as dialogue identity.
- Extend the existing query-intent regression with profile precedence, session snapshot/restore and camelCase/snake_case/kebab-case/spaced key variants; add a deterministic 30-query lexical-tie goldset.
- Include both tests in `test:rebuild-recovered`. Synthetic fixtures validate routing and bounded type preference only; they do not establish production-corpus recall uplift or release readiness.

## [NK1][WorkPass511] Add a fail-closed human license readiness gate (2026-10-27)

- Added a hash-bound review manifest for root/runtime project policies, the locked npm SBOM component fingerprint, every source archive, and every detected repository LICENSE/NOTICE.
- Allow a six-hour maximum age for inventory generated at release-audit start so a long test chain does not fail only because execution took more than 15 minutes.
- The release audit rejects pending reviews, missing/extra inventory entries, stale hashes, changed dependency fingerprints, stale SBOM/provenance timestamps, and any decision without a human reviewer plus evidence reference.
- Wired the unit regression into recovered Core CI and the audit into WorkPass70/release audit paths. Added static regressions for both automatic publishers and all canonical package release scripts. The initial manifest is intentionally pending; this makes unresolved licensing an explicit release blocker rather than treating license-file detection as approval.
- Added the same provenance/license gate to both workflow_run-based release publishers, before archive packaging and gh release create, so a green Core run alone cannot bypass the unresolved manual licensing review.
- This is a process-integrity gate, not legal advice or a declaration that any specific third-party archive is approved for redistribution.

## [NK1][WorkPass510] Gate release audits on current SBOM provenance (2026-10-27)

- Wire the existing `test:provenance-current` into root `audit:workpass70` and runtime `release:audit`, `release:final`, and `release:final3`.
- Release validation now regenerates and checks the CycloneDX SBOM and source-archive/license-evidence inventory instead of silently relying on the older tracked report.
- This proves inventory/hash structure only. Ambiguous imported-source licensing still requires manual review; no release ZIP, legal approval, or readiness score is advanced by this change.

## [NK1][WorkPass509] Harden Hexis source-trace identity and future evidence bounds (2026-10-27)

- `SourceMonitor.record` now treats trace IDs as immutable: exact replay is idempotent; conflicting payload reuse increments the conflict counter and cannot replace the first record.
- Restore deduplicates persisted trace IDs, preserves the first valid lineage and counts conflicting duplicates rather than silently shadowing the observation.
- The canonical Hexis evidence bridge independently rejects future-dated observation timestamps even if `provenance.capturedAt` is fresh; writes continue through `MemoryFabric.attachEvidenceSource`.
- Regressions cover spoofed trace-ID reuse, malformed restored snapshots, future-dated SourceMonitor/P65 observations, and non-mutation of canonical evidence/confidence after rejection.
- This hardens provenance boundaries only; it does not prove retrieval uplift or validate the divergent outer integration PR #236.

## [NK1][WorkPass508] Harden intrinsic experiment input boundaries (2026-10-27)

- Clamp uncertainty, prediction-error, novelty and dream-confidence inputs to finite unit values before scoring. Non-finite state cannot create a spurious experiment or corrupt information-gain metrics.
- Sample the logical timestamp once per experiment and inject clock/ID suffix providers for deterministic regression tests, while preserving runtime defaults.
- Normalize dream-memory identifiers and keep dream-derived associations as unverified verification candidates; they cannot become factual memories through this path.
- Register the regression in both the recovered-core suite and P23 revision lane. This establishes boundary and determinism behavior, not autonomous-behavior quality.

## [NK1][WorkPass507] Enforce planner memory budget across the full cognitive recall cycle (2026-10-27)

- Fixed the advanced/internal-goal recall path in `OrganismCore`: when `cognitiveExecutionPlan.run.memory` is false, it now returns an empty packet instead of silently retrieving memories.
- Routed distinct advanced fallback queries through the bounded async `MemoryFabric.retrieveForCognition` adapter; same-query recall reuses the already-fetched packet to avoid duplicate retrieval.
- Added `test:workpass507:planner-memory-gate` and wired it into `test:rebuild-recovered`, so the source-contract regression runs with the recovered core suite.
- The test protects routing/budget policy, not real-world retrieval uplift. Exact-head CI remains required; no scorecard increase, production-readiness claim, or Release ZIP update is made.

## [NK1][WorkPass507] Count unique memory IDs in retrieval precision (2026-10-27)

- Fixed `precision@K` so repeated rows with the same relevant memory ID cannot inflate the metric as multiple independent hits.
- Kept duplicate corpus IDs promotion-blocking; the regression verifies the diagnostic metric remains honest even for an invalid corpus.
- This corrects evaluation accounting only. It does not improve retrieval ranking or establish positive recall uplift.

## [NK1][docs] Record outer integration divergence gate (2026-10-27)

- Synchronized the canonical handoff after PR #252 merged into `fix/outcome-projection-index-restore-2026-10-26` at `109df0b3ea1d47eb108c09e7a595a23a09aa2bfc`.
- Recorded that outer PR #236 is 361 commits ahead and 111 behind current `workpass70-source`, with GitHub reporting `dirty`; direct merge is blocked until the integration tree is reconciled against current source.
- Kept release and retrieval-quality claims unchanged. Test PASS evidence remains bound to exact SHA and is not automatically transferred to the post-squash head.

## [NK1][docs] Sync canonical state with WorkPass496 and Hexis stack (2026-10-27)

- Update the canonical project map with WorkPass496 bilingual retrieval gates and the current Hexis stack status.
- Record that PR #255 was merged into its intermediate parent branch after 13 passing workflows on exact child head `a995911b9eeba78d3d6e68931c3527bf32d49b12`; parent PR #252 is still the promotion path and needs exact-head validation at squash commit `8299e157bde6256dabfe2e62dba3bc198efa3a01`.
- Explicitly keep the integration stack separate from `workpass70-source` and the published Release ZIP. No learning-quality score or release state is raised.

## [NK1][docs] Canonical project state map (2026-10-27)

- Added `docs/NK1_CANONICAL_PROJECT_STATE_RU.md` as the handoff page for the end goal, closed cognitive loop, subsystem map, source-of-truth branches, validation boundaries, release gates and engineering-pass rules.
- Updated `NEUROCORE_START_HERE.md` to point to the canonical map and mark the old WorkPass272 handoff as historical.
- Rebased this documentation change on the current source base including WorkPass496; readiness and learning scores remain unchanged, and the published Release ZIP was not touched.

## [NK1][WorkPass496] Require language-stratified memory retrieval evidence (2026-10-27)

- Added explicit en / ru / other dataset labels to the MemoryOS2 retrieval benchmark and bound provided language labels into the dataset fingerprint without changing fingerprints for legacy unlabelled datasets.
- Reports baseline, candidate, train/holdout counts, recall/MRR deltas and paired-bootstrap intervals per language. Incomplete tags, a missing English/Russian slice, undersized per-language holdout, recall/MRR regression, unsafe retrieval or worse abstention cannot pass the new promotion gate.
- The CLI validates and preserves explicit language labels. The regression covers English-only, incomplete annotations, balanced synthetic RU/EN strata, valid annotation passthrough and invalid locale labels.
- Synthetic fixtures verify the gate contract only. No independent labelled bilingual corpus, positive real-world recallDelta, model promotion, production readiness or Release ZIP update is claimed.

## [NK1][WorkPass494] Close the four-pass integration set through one release gate (2026-10-27)

- Added `audit:nk1-integration-closure` to run the Hexis canonical-lineage + restart checks, the offline retrieval holdout experiment, the Mem0 adapter safety regressions and the authenticated disabled-provider HTTP smoke as one deterministic command.
- Wired the closure command into `release:final`, avoiding separately repeated versions of those same checks.
- This is a code-level release gate; passing it does not substitute for production DB migration, real browser/Live2D E2E, Android/Termux synchronization, endurance soak, independent retrieval uplift or license review.

## [NK1][WorkPass493] Port opt-in Mem0 Platform external recall onto canonical source (2026-10-27)

- Ported the isolated Mem0 adapter from the divergent integration branch without importing that branch's unrelated runtime changes.
- Kept MemoryOS2 as the sole canonical memory owner. Mem0 results are returned separately by an authenticated read-only route and remain tagged as unverified data, never instructions.
- Both `NK_MEM0_ENABLED=1` and `NK_MEM0_COGNITIVE_RECALL=1` are required before remote results may enter language context. Default configuration remains disabled and no live provider call is made by CI.
- Added bounded/redacted prompt insertion, configured-user scope checks, response/timeout limits, and opt-in-only destructive-operation controls inside the adapter; no delete/write endpoint is exposed.
- Added server auth/no-network HTTP regression, isolated adapter tests, an inert-by-default live-contract probe and a path-scoped CI workflow.
- Exact-head CI is the merge gate. The live Mem0 provider contract, real credential configuration, retrieval uplift and the published Release ZIP are not claimed validated or updated in this pass.

## [NK1][WorkPass492] Support unanswerable retrieval holdout through the offline CLI (2026-10-27)

- Fixed the offline JSONL parser so explicitly unanswerable examples (`answerable: false`, `relevantIds: []`) reach the existing abstention-safety benchmark instead of being rejected or having answerability lost.
- Kept the parser fail-closed: non-boolean answerability, answerable rows without relevance labels, and unanswerable rows with relevance IDs are rejected before report publication.
- The CLI summary now emits answerable/unanswerable holdout counts, unsupported retrieval rate and correct abstention rate.
- Added CLI end-to-end regressions proving the four-unanswerable-query holdout reaches the promotion gate and contradictory labels fail closed; included those tests in the WorkPass71 source validation workflow.
- The multi-seed determinism signature now covers abstention and unsupported-retrieval metrics as well as ranking metrics.
- This improves evaluation coverage only. It does not claim positive recall uplift; production uplift still requires an independently labelled holdout corpus.

## [NK1][WorkPass490] Integrate Hexis evidence lineage through canonical memory (2026-10-27)

- Added a bounded provenance envelope for declared source identity, capture time, evidence class, and content fingerprint. A matching SHA-256 fingerprint is an integrity check, not source authentication.
- Routed Hexis evidence through the existing MemoryFabric mutation gateway; MemoryOS2 remains the canonical memory owner. Added explicit idempotent duplicate detection and strict rejection of inference/model echoes as independent observations.
- Persisted the Hexis-specific source monitor with the root OrganismCore projection and added request-bound validation that rejects accessor-backed request/trace properties.
- Added focused lineage regressions and a server restart test covering first acceptance, identical replay, fingerprint tampering, and root-snapshot restoration.
- WorkPass491: evidence is now written through a dedicated MemoryOS2/MemoryFabric `attach-evidence` lifecycle command with canonical command receipts; `updateSignals` remains restricted to signal fields, and identical evidence replays remain idempotent.
- The first integration attempt was based on a stale pre-WorkPass461–489 tree and was superseded; this pass is rebased on the then-current `workpass70-source` head. Exact-head CI is required before promotion; no retrieval uplift or release readiness is claimed.

## [NK1][WorkPass489] Align cycle-order assertion with the runtime-owned snapshot API (2026-10-27)

- The broad source regression moved past the embodiment-order check and exposed another stale WorkPass319 symbol: the test expected `setUnifiedCognitiveCycle`, while the current runtime persists the completed snapshot through `setRuntimeUnifiedCognitiveCycle`.
- Assert the actual runtime-owned Core API inside the cycle-closing block. The assertion still requires the snapshot of the just-evaluated unified cycle to be persisted before completeness evidence is emitted; no cycle gate or production code is bypassed.
- Re-run the broad exact-head source regression and WorkPass110 before considering the source integration pass closed.

## [NK1][WorkPass488] Anchor embodiment-order regression to the active cycle (2026-10-27)

- The broad recovered-runtime regression reached WorkPass319 after passing the restored action-receipt tamper gate, finalizer boundary, canonical planner wrapper, project reconciliation, causal replay, and memory-doctor CLI checks.
- The WorkPass319 static test used a file-global `indexOf` for `setEmbodiment`, so it found the earlier initialization-time call rather than the cycle's actual embodiment persistence after `closeB380TemporalLife`. The runtime already commits the cycle embodiment at the required point.
- Scope the lookup to begin after the life-course update and assert it exists there; retain the full ordering contract through cycle ledger, evaluation, completeness evidence, and evidence persistence. No runtime behavior or acceptance criteria are loosened. Re-run the broad suite on the new exact head.

## [NK1][WorkPass487] Make the CLI future-evidence fixture exceed the policy tolerance (2026-10-27)

- The canonical MemoryOS2 doctor classifies an observation/freshness timestamp as future evidence only when it exceeds the current time by more than five minutes. The CLI test used a timestamp just 60 seconds ahead and incorrectly expected the future-evidence counter to increase.
- Move the fixture to one hour ahead, matching the existing WorkPass314 unit test and preserving the production five-minute tolerance and error-reporting behavior. This corrects test data; no validator threshold was weakened.
- Re-run the broad recovered-runtime workflow on the exact updated head before closing pass 2.

## [NK1][WorkPass486] Route compound-skill steps through the canonical Core wrapper (2026-10-27)

- WorkPass97 caught the remaining direct ActionGateway execution path in compound skill steps. It duplicated finalization for unkeyed execution and bypassed the single Core-owned tool-ID normalization/finalizer wrapper.
- Extend `OrganismCore.executeTool` with optional finalization context keys and route compound skill steps through it. The wrapper still returns immediately for keyed actions and replays because ActionGateway owns their atomic finalization; unkeyed skill steps are finalized once by Core with the preserved runtime-input keys.
- Remove the skill-local manual finalizer to avoid double-finalization. The route regression verifies project execution, reconciliation, and compound skill dispatch all use the canonical wrapper. Exact-head source regression and WorkPass110 re-run required.

## [NK1][WorkPass485] Route project tool execution through Core-owned wrappers (2026-10-27)

- The recovered-runtime contract check found that fresh project tool execution and receipt reconciliation called ActionGateway directly from OrganismCore's project loop, bypassing the canonical Core wrapper that normalizes legacy tool aliases and owns unkeyed-outcome finalization/checkpointing.
- Route those two dispatches through `this.executeTool(...)` and `this.reconcileToolExecution(...)`. Existing keyed project operations retain the operation idempotency key, so ActionGateway still owns atomic finalization and retries are not finalized twice.
- This aligns the production path with the existing WorkPass97 wiring contract; exact-head recovered rebuild and runtime typecheck must pass before the integration is considered closed. `main` and the published Release ZIP remain unchanged.

## [NK1][WorkPass484] Quarantine corrupted restored action receipts (2026-10-27)

- The broad recovered-runtime suite found that ActionGateway restored a completed ledger row by cloning its response without checking that the response execution ID and tool matched the ledger's canonical identity. A same-key retry could therefore replay a forged success response after restart.
- Restore now retains the completed key but withholds its response unless the response's execution/tool identity, audit acceptance/outcome/verification projections and bounded serialized size agree. Invalid receipts become fail-closed recovery tombstones; side effects are not rerun and valid receipts remain replayable.
- WorkPass95 has four tamper regressions (execution identity, verification contradiction, audit outcome contradiction and oversized payload). The exact-head broad regression must be rerun to confirm this fix. No release or learning-uplift claim is made.

## [NK1][WorkPass483] Check grounded causal replay features before sampling (2026-10-27)

- The broad source regression exposed a stale static wiring assertion: it searched for the state/outcome feature vector *after* the call to `selectCausalReplayBatch`, even though the production pipeline correctly constructs `causalCandidates` and their `policyFeatures01` first.
- Reorder the source-wiring assertion to prove the real contract: feature vector creation occurs after `replayPending` starts, completes before causal selection, and causal selection remains before the adaptive final selector. Keep energy, goal-pressure, and actual outcome feature assertions intact.
- Runtime implementation is unchanged; this corrects test ordering rather than weakening grounding requirements. Replay sweep and sequential benchmark passed on the preceding exact head; broad source regression rerun required.

## [NK1][WorkPass482] Bound replay cadence to preserve current-task plasticity (2026-10-27)

- The exact-head replay-policy sweep showed that a requested 1:1 old/current update cadence drove the new-task score to 0.52 on seed 17, below the unchanged 0.60 diagnostic acceptance threshold, despite separated context features.
- `P26TrueLearningEngine.trainInterleaved` now enforces a configurable `maxReplayFraction01` independent of the absolute `maxReplayUpdates` budget. The default 0.25 schedules at most one replay update per four current rows; zero disables replay, and an explicit value up to 1 allows caller-directed higher rehearsal rates.
- The sweep retains its 0.60 threshold and reports requested/effective cadence; regressions cover default cadence, explicit replay disablement and invalid fractions. This is a synthetic stability diagnostic only, not evidence of external-task generalization or production learning uplift.
- The full source regression exposed a context-aware retention control that intentionally needs aggressive rehearsal; that benchmark now explicitly opts into `maxReplayFraction01: 1` instead of relying on the new conservative default. No threshold was weakened.
- Targeted exact-head checks passed on `0e820796adf584b7cb5a2d2256090287830bf05a`. Re-triggering the source-branch broad regression after retarget; final broad result remains pending. `main` and the published Release ZIP remain unchanged.

## [NK1][WorkPass481] Separate candidate execution from verifier trust (2026-10-27)

- A successfully executed candidate was marked non-executable whenever the independent verifier failed, conflating two separate signals.
- `IndependentSkillCandidateEvaluator` now records well-formed execution under `executability` independently, while unbound/missing verifier evidence still fails task success and does not publish a trusted run ID or observed trace.
- Existing WorkPass203 regression explicitly checks this distinction. No learning uplift is claimed; exact-head CI remains required.

## [NK1][WorkPass480] Restore authority-fixture permissions between regressions (2026-10-27)

- The WorkPass243 regression intentionally chmods the executor to a group-writable mode, but left that mode in place before testing run-root replacement. The later call therefore failed on executable permissions before reaching the intended run-root identity guard.
- Restore the fixture executable to its original private mode after the writable-executable assertion. Runtime security checks are unchanged; the regression now isolates the condition it is meant to test.

## [NK1][WorkPass479] Share the canonical versioned-skill candidate ID contract (2026-10-27)

- Runtime staging and the signed-shadow integration fixture now use the same `computeVersionedSkillCandidateId` function, including the explicit null provenance component when no revision provenance is supplied.
- This removes duplicated hash-shape logic that drifted after provenance became part of the ID contract. Identity semantics are unchanged; no learning-quality uplift is claimed.

## [NK1][WorkPass478] Preserve persisted P23 trace-cache recency on restore (2026-10-27)

- P23 restore constructed deduplication caches from durable rows before persisted cache entries, which could move an older row to the head and discard the cache's newest-first order.
- Restore now preserves validated persisted cache order first and reconciles trace IDs recoverable from durable experience/replay rows afterward. Missing caches still recover IDs from their persisted rows.
- Updated the WorkPass310 restore regression to assert newest-first ordering plus durable replay-ID reconciliation. Learning uplift is not claimed.

## [NK1][WorkPass467] Add bounded conflict-gated interleaved learning (2026-10-27)

- Implemented the `P26TrueLearningEngine.trainInterleaved` API already exercised by the sequential-learning benchmark.
- The path prevalidates both fresh and replay streams before weight changes, bounds candidate comparisons to at most 64 per considered replay row, blocks replay rows whose near-identical state/action has a contradictory reward, and retains separate counters for online updates, replay updates, blocked rows and eligible rows.
- Current/replay learning rates and target mode are explicit options; replay candidate caps no longer stop processing the remainder of fresh-task rows.
- Validation is pending on the newly updated head. Previous Core CI had failed because this method was missing; do not infer benchmark success until its current exact-head run finishes.
- Previously confirmed P26 holdout provenance now passes, with `trainingExposure01` separate from `generalizationEvidence01`. P23 restore ordering and the signed-shadow candidate-ID expectation remain open blockers.

## [NK1][WorkPass466] Separate training exposure and independently verified holdout maturity (2026-10-27)

- Added `trainingExposure01` and `independentHoldoutSamples` to P26 learning metrics. Online updates and replay increase exposure without being counted as generalization evidence.
- Added a deduplicated `recordVerifiedHoldout` path bound to evidence/task/protocol/verifier/sample-set identities and bounded baseline/learned scores. Only verified independent evidence advances `generalizationEvidence01`; legacy `recordHoldout` remains diagnostic-only.
- Persist and restore holdout evidence IDs, recompute maturity from those IDs rather than trusting an arbitrary scalar, and normalize restored exposure from online/replay counters.
- Fixed the ADWIN stationary-mean test to use floating-point tolerance. The P26 workflow was red on the prior head for this exact-value assertion; a new exact-head run is in progress.
- **Still open:** P23 restore loses the newest processed trace ID under its bounded list policy; P110’s signed-shadow integration has a stale expected candidate ID. Those failures remain explicit and have not been bypassed. The latest implementation is awaiting exact-head CI confirmation.
- No `main` or published Release ZIP changes; no retrieval or learning uplift is claimed until holdout tests pass.

## [NK1][WorkPass465] Close additional source CI regression defects (2026-10-27)

- Fixed a duplicate `snapshotResult` declaration in the independent candidate evaluator regression discovered by the runtime script-integrity audit.
- Updated the versioned skill candidate-store regression to pass the current rollback approval object contract and use an explicit test-only rollback verifier.
- Adjusted authenticated promotion/rollback signature verification to validate the PEM as Ed25519 and pass the PEM string to the minimal verifier API, removing a stale custom-shim type mismatch without weakening signature checks.
- **Still open:** P23 restore does not preserve the newest processed-trace ID at the front of its bounded restored cache; P99 still assumes an exact replay batch count despite adaptive selection; runtime typecheck still reports Core nullability/registrar and incomplete Node shim errors. These are not marked fixed.
- Latest edits require fresh exact-head CI. No retrieval/learning uplift is claimed; `main` and the published Release ZIP are unchanged.

## [NK1][WorkPass464] Repair cognitive scoring, replay evidence fixtures and Live2D expression stability (2026-10-27)

- Rebalanced B272 predicted goal value to avoid saturation masking a high-confidence intrinsic-drive signal; the WorkPass287–288 contract run passed on the preceding integrated head.
- Fixed replay/causal fixtures so trace tick, selected action, observed postcondition and retained outcome metadata represent the same event.
- Corrected the seed-bootstrap order-invariance fixture to hold evidence identity and observation metadata constant while changing insertion order.
- Updated Hermes tamper coverage to change signed runtime identity, exercising signature/receipt trust validation rather than the earlier binary-outcome mismatch guard.
- Cached the last successfully applied Live2D expression so redundant state messages do not restart the same expression.
- Exact current-head CI is still required for the latest edits. Runtime typecheck currently has outstanding type errors in large Core/nullability sites and the custom Node shim contracts; no retrieval or learning uplift is claimed. No Release ZIP or `main` changes were made.

## NK1 Integration — unify non-main branch heads (2026-10-23)

- [MERGE] Compared the branch tips against `nk1-integration-workspace-2026-10-22`: every historical non-main branch checked was already an ancestor (GitHub compare reported `behind_by=0`). The only new divergent line was `workpass326-ci-runtime-hardening`.
- [MERGE] Prepared a conflict-resolved tree based on the integration workspace, preserving its `.nvmrc=24`, porting CI reliability checks/docs from WorkPass326, adding the P26 Action runtime upgrade, and preserving both parent histories for the final union merge.
- [VALIDATION] Static configuration checks pass for WorkPass71, WorkPass79 and P26. The six updated CI-audit tests have **not** been executed on this exact integration tree because Actions jobs still terminate before runner assignment.
- [SCOPE] The union is intended to fast-forward every non-main branch ref to the common merge commit. The `main` ref is explicitly excluded and will not be changed.

## NK1 WorkPass327 — root-cause triage for Actions startup failures (2026-10-23)

- [DIAGNOSIS] Compared nine fresh/representative failed jobs with one earlier successful control run. All nine failures stopped after 1–2 seconds with `runner_id=0`, blank runner name, and zero steps; the control run had a runner and eight successful steps.
- [HYPOTHESIS] Prioritized account-level Billing & Licensing lock because a public GitHub Community case reports the same symptom and a billing-lock annotation. This is **not yet confirmed for the NK1 account** because the current connector cannot read the bodies of this run's two check-run annotations.
- [VALIDATION] Ran the new CI policy unit tests locally on Node.js 22.16.0: 6/6 passed. Verified the two current workflow files use checkout/setup-node v7, the root .nvmrc, a runtime assertion, the rebuild PR trigger, and a 20-minute cognitive test timeout.
- [LIMITATION] GitHub Actions still fails before the first step on the latest HEAD. Do not repeatedly rerun while runner startup is blocked; inspect Billing & Licensing first, then rerun checks only after the account condition is resolved. No release ZIP was rebuilt or published.

## NK1 WorkPass326 — CI runner/runtime hardening (2026-10-23)

- [HARDENED] Upgraded the WorkPass71 and WorkPass79 workflows to current first-party Actions versions compatible with the GitHub Actions Node.js 24 runtime, avoiding retired Node.js 20 action runtimes.
- [HARDENED] Both workflows select the project's Node.js version from the root `.nvmrc` and assert that the selected runtime matches the pin before running tests.
- [HARDENED] Raised the WorkPass79 cognitive regression job timeout from 8 to 20 minutes to reduce avoidable false failures during the existing multi-suite regression run.
- [DOCUMENTED] Added `docs/CI_RELIABILITY_RUNBOOK_RU.md` to distinguish runner startup failures from application/test failures and to preserve precise verification/release evidence.
- [REGRESSION] Added `tools/verify-ci-reliability.mjs` and built-in Node test cases; both validation workflows run this guard so retired Action majors, drift from `.nvmrc`, missing runtime assertions, a too-short cognitive timeout, and missing CI coverage for rebuild pull requests are rejected before the main suite.
- [VALIDATION] Static workflow edits have been committed on `workpass326-ci-runtime-hardening`. Actions execution remains unverified because the observed account-level runs terminate before runner assignment and execute zero steps. No claim of green CI or release publication is made.

## 2026-10-23 — Reconcile conflicting P26, micro-cycle, and tool-gateway implementations

- Integrated the 18-feature P26 schema and semantic snapshot migration from `rebuild` into the current `ParametricPolicyLearner`, retaining the existing learner API and hyperparameter safeguards. The three interaction features are recomputed from energy/novelty/goal-pressure; legacy weights are migrated by feature name so `actionCost` remains attached to `actionCost` at index 17.
- Restored `finiteOr` in `OperationalMicroCycleRuntime` and used it at the micro-cycle's sensor/observation boundary (body energy, capacity, thermal strain, surprise, battery, freshness, CPU and RAM input), with [a regression guard](runtime/neuro-kurisu/tests/operational-microcycle-finite-input.mjs). Invalid/non-finite inputs now take safe fallbacks instead of turning live state into NaN-derived extremes.
- Replaced the autonomous tool learner's duplicated outcome list in `OrganismCore` with the already-shared `wasToolExecutorEntered` classifier. The recovered planner-route regression now checks this single policy rather than allowing Core and ActionGateway to drift apart.
- Optimized production replay indexing: `P23LearningEngine.replayPending` now builds a first-write-wins trace-to-experience index and carries the matched experience through causal/adaptive selection, avoiding repeated full-store scans while keeping the current adaptive selector final.
- Avatar preference storage is consolidated through `safeLocalStorage` in both `LegacySpriteDeck` and `AvatarStage`; regression coverage now checks both components. The recovered regression aggregate invokes `test:learning-replay`, the cognition/causal wiring tests, action-gateway tests, project reconciliation tests, micro-cycle checks, and the root avatar/Live2D tests.
- These are committed code/wiring changes, not claimed test passes: hosted Actions jobs still stop before a runner is assigned (`runner_id: 0`, no steps/logs available).

---

## 2026-10-23 — Centralize avatar preference storage

- Rewired `LegacySpriteDeck` and `AvatarStage` to use `safeLocalStorage.ts` for optional view/outfit/voice preferences instead of accessing `window.localStorage` directly. Reads fall back to safe defaults and failed writes do not disable current-session controls.
- Expanded `safeLocalStorage.test.mjs` to enforce that both components use the adapter for their persisted preferences and do not regress to direct storage access. The existing root regression aggregate already includes `test:avatar-storage`.
- Source-level checks confirm neither component contains direct `window.localStorage.getItem/setItem` calls and both import the shared adapter. The test itself has not been run because GitHub Actions jobs are still failing before a runner starts.

---

## 2026-10-23 — Wire recovered cognition boundary and causal replay into runtime

- `OrganismRuntime.stepInternal` now calls `assertCognitiveCycleBoundaryInput(observation, 'full')` immediately after the environment observation is materialized and before the runtime dereferences nested observation data or sends it to `OrganismCore.observe`. Added `cognitive-cycle-boundary-runtime-wiring.mjs` so the validator cannot quietly become an unused helper again.
- Connected `CausalReplaySampler` to `P23LearningEngine.replayPending` as a bounded prefilter over a 16-value state/outcome feature vector. The existing adaptive `selectReplayBatch` remains the final selector, preserving its health-adaptive capacity, recency handling, salience, novelty, replay-count and goal-priority ranking. The causal sampler uses diversity/causal/learning-quality signals only to constrain the candidate pool; it does not rewrite outcomes or claim a measured learning improvement.
- Added `causal-replay-runtime-wiring.mjs` and registered it in `test:rebuild-recovered`.
- Code and command wiring are committed. Hosted CI remains unverified because recent Actions jobs terminate before runner allocation (`runner_id: 0`, no steps, unavailable log blobs); these tests are not claimed as passed.

---

## 2026-10-23 — Restore missing files and connect regression coverage

- Added 31 files that were absent from the integration tree: rebuild's `CognitiveCycleBoundary.ts` and `CausalReplaySampler.ts`, their tests/benchmarks, action-finalizer/planner/reconciliation receipt tests, schema/holdout/replay evaluations, avatar-storage helper and test, Live2D expression-cache test, rebuild handover/checkpoint docs, avatar/voice audit artifacts, and the WorkPass318 branch-consolidation and finite-input regression artifacts.
- Registered 14 runtime commands including `test:rebuild-recovered`, added app commands `test:avatar-storage` and `test:live2d-expression-cache`, added the root `test:rebuild-recovered` entry point, and wired it into `workpass71-validation.yml`.
- Static manifest check confirmed all 14 underlying test files exist and are referenced by their package scripts. Hosted Actions has been triggered, but the latest jobs fail before receiving a runner (`runner_id: 0`, no steps, no downloadable job log); this is not evidence that these tests failed and no pass is claimed.

---

## 2026-10-23 — Multi-branch integration checkpoint

- Created merge commit [3f99f58](https://github.com/ailtron1ss-rgb/NK1/commit/3f99f58ab15fbb5c4ce29fd0f58fdc5ef8a49518) on `nk1-integration-workspace-2026-10-22`, recording the cognitive rebuild and continual-learning source histories as parents: `workpass120-verified-skill-revision-gate`, `workpass93-hermes-reflective-learning-gate`, `workpass71-learning-integrity`, `workpass71-learning-eval-paired-seeds`, and `workpass73-audit-fixes`.
- Kept the integration tree as the merge result because the audited source paths already exist in the target tree and inspected target versions are more expansive than their older source-branch snapshots (notably `P23LearningEngine.ts`, `VerifiedOutcomeLedger.ts`, `package.json`, and their associated tests). This avoids rolling back stronger integrated behavior.
- This commit unifies Git history while retaining the current source snapshot; it does **not** claim that every line-level difference across all branches has been semantically reconciled or that tests passed. Remaining work is to audit residual file-level behavior differences and get hosted Actions jobs to execute.

---

## 2026-10-23 — Cross-branch source-path coverage verified

- Compared the integration tree recursively with `workpass79-cognitive-rebuild`, `workpass93-hermes-reflective-learning-gate`, `workpass118-multi-source-learning-integration`, `workpass120-verified-skill-revision-gate`, and `workpass88-avalanche-forgetting-metrics`.
- All checked source, test, workflow, and vendor paths from these snapshots already exist by pathname in the integration tree; no duplicate file-copy operation was needed.
- Reviewed representative learning overlaps: the integration `P23LearningEngine.ts` contains additional promotion/evaluation/evidence bindings beyond the WorkPass120 snapshot, and the target skill-revision test contains additional checks. Older snapshots must not overwrite these versions.
- This is source-tree/path and sampled-file verification only. It does not claim full branch-history merge, passing tests, successful hosted CI, or an updated Release ZIP.

## 2026-10-23 — Integration workspace CI activation

- Added `nk1-integration-workspace-2026-10-22` to the push and pull-request branch filters of `.github/workflows/workpass71-validation.yml`. The integrated branch can now trigger the existing Node.js 24 core regression suite, including WorkPass319–325 cognitive-cycle, persistence, resource-budget, interrupt-accounting, and causal-spine checks.
- This is workflow wiring only; it does not claim that the checks have passed. The current branch's Actions run must complete before validation can be reported.

## WorkPass325 — connect all eleven phases to the live Core decision loop (2026-10-22)

- Extended `OrganismCore`'s actual decision trace so appraisal, attention, memory, goal selection and planning are emitted between prediction and action. The phase payloads are derived from Core's current homeostatic state, global-workspace items/capacity, last-retrieved memory IDs, active goals and governed action candidates.
- Replaced the prior six-stage anchor type with anchors for the five additional phases and passed all eleven event IDs into the same `verifyOperationalCycle()` and `UnifiedCognitiveCycle.evaluate()` call. The internal cognitive loop now verifies the full causal spine: observation → prediction → appraisal → attention → memory → goal → plan → action → outcome → learning → self-update.
- This complements WorkPass321's outer grounded world/embodiment trace; WorkPass323 keeps these two temporal scopes in separate persisted namespaces, so their evidence and counters no longer overwrite each other.
- Added `tests/workpass325-core-eleven-phase-causal-loop.mjs`, registered `test:p325:core-eleven-phase-spine`, and wired a dedicated CI step. It checks phase ordering, required parent links, anchor coverage and that the internal verifier consumes the expanded stage map. Hosted execution remains pending until Actions successfully starts job steps.

---

## WorkPass324 — count cognitive interrupts as episodes, not repeated ticks (2026-10-22)

- Fixed `CognitiveDependencyGraph.resolve()` so the cumulative `interrupts` metric counts a newly started or distinct interrupt episode rather than incrementing on every frame while a single interrupt remains active.
- Continuous priority changes and reordered-but-equivalent domain lists no longer inflate the counter; a new type/domain set or a reactivated interrupt after a clear starts a new episode. A persisted active episode is not counted again on restart.
- Added `tests/cognitive-dependency-interrupt-episode-workpass324.mjs`, registered `test:p324:interrupt-episodes`, and wired a dedicated WorkPass71 CI step. Hosted execution remains unverified while Actions jobs fail before executing steps.

---

## WorkPass323 — isolate nested cognitive-loop persistence (2026-10-22)

- Fixed a state-ownership collision between `OrganismCore` and the outer `OrganismRuntime`: both were persisting a `CognitiveEventFabric`, `CognitiveResourceEconomy`, and `UnifiedCognitiveCycle` into the same three schema fields despite representing different decision horizons. This let the wrapper overwrite the Core's event lineage/budgets/cycle counters, and later restart could feed one loop's snapshot into the other.
- Added dedicated persisted slots and explicit setters for the outer embodied/world-feedback loop (`runtimeCognitiveEventFabric`, `runtimeCognitiveResourceEconomy`, `runtimeUnifiedCognitiveCycle`). Existing fields remain the Core-owned internal decision-loop state. The two loops now persist independently instead of fighting over the same fields.
- Added a backward-compatible read fallback in runtime initialization: when loading older persisted state with no outer-specific slot, the wrapper seeds from the legacy field once, preserving the existing history; following saves write only to namespaced runtime slots.
- Added `tests/workpass323-cognitive-loop-persistence-separation.mjs`, registered `test:p323:cognitive-loop-persistence-scope`, and added a dedicated CI step. The check verifies the schema/setter/restore/save boundary and prevents future reintroduction of writes into Core-owned fields. Hosted execution remains unverified because recent Actions jobs fail before their steps start.

---

## WorkPass322 — harden persisted cognitive resource budgets (2026-10-22)

- Changed `CognitiveResourceEconomy.restore()` from broad object spreading/coercion to a version-aware whitelist restore. Corrupt counters, string-valued budgets, non-finite values, invalid modes and timestamps no longer silently propagate into the organism's live compute/attention/learning/memory budgets.
- Counter restore accepts only non-negative safe integers; unit budgets remain finite and clamped to [0,1]; timestamps/ticks are normalized; unknown persisted keys are dropped; unsupported schema versions fail before live state changes.
- The allocation path now normalizes tick/time and saturates the persisted cycle count at JavaScript's safe-integer limit.
- Added `tests/cognitive-resource-economy-workpass322.mjs`, registered `test:p322:cognitive-resource-restore`, and wired a dedicated WorkPass71 CI step. It is committed but not claimed as passed while hosted jobs fail before running steps.

---

## WorkPass321 — expand the canonical cognitive trace to eleven connected phases (2026-10-22)

- Extended the existing `CognitiveEventFabric` operational record with appraisal, attention, memory, goal and plan events. The runtime now feeds those stages from its actual homeostatic state, global workspace selection, retrieved memory context, canonical goal selection, and generated plan rather than leaving them as unrecorded parallel concepts.
- Added causal edges for the complete phase spine: observation/prediction → appraisal → attention → memory → goal → plan → action → outcome → learning → self-update. Core six-stage callers remain compatible; when optional phases are supplied, verification checks their event identity, tick ownership and required parent edges.
- The runtime records and verifies this expanded trace only after its real feedback, learning, continuous memory/identity integration and embodiment update path, joining the WorkPass319 ordering correction to the richer graph.
- Added `tests/workpass321-expanded-cognitive-phase-spine.mjs`, registered `test:p321:expanded-cognitive-phase-spine`, and added an independent WorkPass71 CI step. It covers all eleven event identities, parent links, snapshot/restore and six-stage backward compatibility. It is committed but hosted execution is not yet confirmed because GitHub Actions jobs are still failing before any step starts.

---

## WorkPass320 — defensive restore for the cognitive dependency graph (2026-10-22)

- Hardened `CognitiveDependencyGraph.restore()` so persisted data is treated as untrusted input: unsupported schema versions fail before state mutation, counters and ticks normalize to safe non-negative integers, invalid wake-mask bits are discarded, and the derived dirty-domain count is recomputed from the normalized mask.
- Normalized interrupt state (strict booleans, bounded priority and strings, unique known domains only), ignored unknown `domainTransitions` keys, and rejected malformed/non-finite persisted counter values instead of allowing them into live state.
- Restored each domain's previous dirty flag from the persisted wake mask, preventing a false burst of domain-transition counts on the first equivalent frame after restart. Transition/cycle counters saturate safely at JavaScript's maximum safe integer.
- Added `tests/cognitive-dependency-graph-workpass320.mjs`, registered `test:p320:cognitive-dependency-restore`, and wired a dedicated WorkPass71 validation step. Hosted execution remains pending because recent GitHub Actions jobs failed before any step ran (`runner_id=0`).

---

## WorkPass319 — causal ordering for the canonical cognitive cycle (2026-10-22)

- Moved the authoritative operational-cycle trace and unified-cycle evaluation until after `core.feedback()`, grounded world-transition learning, embodied-consequence learning, continuous memory/identity integration, neural causal tracing, life-course update, and embodiment persistence have completed.
- Previously, the runtime wrote `learning` and `self-update` stage events and evaluated cycle completeness before invoking `core.feedback()`. That let the causal ledger claim a completed learning/self-update stage before the mutations it represented had actually run. The stage trace now records those claims only after the real update path completes.
- The existing `CognitiveEventFabric` and `UnifiedCognitiveCycle` remain the canonical owners; no duplicate cognitive subsystem or external dependency was added. Cycle-completeness evidence is now persisted after the post-update verification.
- Added `tests/workpass319-cycle-order.mjs`, registered `test:p319:cycle-order`, and added a dedicated WorkPass71 validation step. The test is an architectural phase-order contract; it does not replace runtime integration tests.
- GitHub Actions availability remains blocked before test steps start (`runner_id=0` in the recent run evidence). The regression is wired into CI but has not been executed by that hosted workflow yet.

---

## WorkPass318 — standalone read-only memory doctor CLI (2026-10-22)

- Added `scripts/memory-doctor.mjs` and the `npm run memory:doctor -- <state-file>` command. It audits the explicit primary state file's canonical `facets.advanced.memoryOS` projection and emits a bounded JSON report.
- Supports JSON state and V8 serialization when `NEURO_STATE_FORMAT=v8`; JSON compatibility payloads remain readable in V8 mode. The CLI deliberately does not fall back to `.bak`, repair, or rewrite state, so it cannot quietly audit a different file than the operator requested.
- Exit status contract: 0 = no error-severity integrity failures, 2 = doctor found integrity errors, 1 = read/parse/schema/runtime error, 64 = usage error. Warnings may exist with status 0 and are reported separately from errors.
- Added a dedicated regression for JSON/V8 input, capped output, error status, missing input and proof that a damaged state file is not mutated; added a separate validation workflow step. Actual CI execution is still blocked by GitHub's runner not starting (`runner_id=0`, zero executed steps).

---

## WorkPass317 — bounded cross-memory dreaming hypotheses (2026-10-22)

- Extended the existing `MicroDreamEngine` with a deterministic, bounded associative dreaming pass that examines at most 24 recent memory records and emits at most three candidate connections per sweep.
- Candidate scoring uses shared non-stopword concepts, rarity across the supplied memory set, input confidence/salience and topic distinctness. Pairs already joined by a canonical semantic link are excluded. The source filter also rejects dream-generated, quarantined/unknown, expired, low-confidence, simulated-provenance and low-authority records before scoring, reducing self-reinforcing and poisoned-memory loops.
- New associations are explicitly marked `kind: association` and `validationStatus: candidate`, retain source memory IDs and the shared-term explanation, are deduplicated for a six-hour cooldown, and are persisted in the existing MicroDream state. The dreaming pass never writes new links into canonical memory; promotion remains a separate evidence-gated step. Low-trust/quarantined, unknown, expired, weak-confidence, simulated-provenance, duplicate-ID and self-generated dream memories are excluded before scoring.
- Added `IntrinsicExperimentGenerator.fromDreamAssociation()`: an eligible candidate can enter the existing `facets.memory.experiments` queue as a `verify` task only, with `epistemicStatus=hypothesis`, `status=candidate`, a verification-required flag and both source-memory IDs. High-pressure intrinsic questions take priority; stronger candidate questions can seed the normal scientific-method path with `dreamId` and source-memory provenance tags. This is a verification proposal, not a fact or canonical semantic link.
- Wired the bounded sweep into the existing 12-tick microdream cycle using a 24-record view of canonical MemoryOS2 state; added a dedicated regression/CI step for deterministic IDs, duplicate suppression, restart behavior, source non-mutation, already-linked-pair exclusion, rejection of low-trust/quarantined/expired/self-generated inputs, and adaptation of candidates into the ordinary verification queue without factual promotion. Exposed `OrganismCore.microDreamDiagnostics()` and `microDreamSnapshot()` as read-only inspection surfaces. Pair ordering/keys use locale-independent sort order so deterministic output remains stable across runtime locales.
- In the same continuation, closed remaining high-level self-model write bypasses through predictive observation and recovery, and normalized social evidence/episodes to canonical person IDs across visual aliases. See WorkPass315–316 entries for corresponding tests and details.

---

## WorkPass316 — trust-adaptive relational tether and social-state persistence fix (2026-10-22)

- Added a HYVE-inspired relational tether to `SocialMindKernel`. Trust half-life adapts to current trust; relationship strength, warmth and predictability decay toward neutral during long inter-session gaps, with bounded elapsed-time and deterministic persisted timestamps.
- Fixed a canonical-state bug: `ensurePerson()` previously returned a clone from `observePerson()`, so `recordOutcome()`, `observeText()` and `observeRelation()` could update a detached copy instead of the stored person. It now resolves the live canonical record after observation/recomputation.
- `observePerson()` now returns the refreshed persisted view after recomputation. Older snapshots without a relational timestamp migrate using `lastSeenAt`.
- Added `relational-tether-workpass316.mjs` and a dedicated CI step. It tests outcome-state persistence, inter-session decay, deterministic restart behavior, and canonical ownership of evidence/episodes when multiple sensor identities resolve to one person. Fixed alias handling across observations, action/statement receipts, user-mind reconstruction, relationship lookup, and outcome learning so aliases do not fork social identity or misattribute evidence. Public second-order belief updates also resolve aliases before forming their keys. CI execution still depends on an available GitHub Actions runner.

---

## WorkPass315 — evidence-gated self-model identity updates (2026-10-22)

- Added a CAKN-inspired write-time gate to `SelfModelEngine.learnGoalOutcome()`: action preferences continue to learn from bounded rewards, while `agencyBelief` and `identityCoherence` change only when a verified, independent outcome is bound to a non-empty receipt from the trusted world-transition or external-verification path.
- Added accepted/rejected gate counters and a compact last-decision record for observability. Restore normalizes gate counters and the last-decision record so older persisted self-model snapshots remain compatible.
- Wired the canonical OrganismCore outcome path to supply verification, independence, source class and a decision/tick-bound receipt. Unverified or correlated outcomes cannot revise the high-level self model through this learning path.
- Added a dedicated `self-model-evidence-write-gate-workpass315.mjs` regression covering missing evidence, correlated evidence, source/receipt mismatch, accepted evidence, snapshot migration, and attempted bypasses through predictive observation and recovery. Those paths now update prediction calibration/continuity state without directly rewriting high-level identity or agency beliefs; those beliefs change through the verified-independent outcome gate. Execution remains pending because GitHub Actions jobs are being rejected before the first step starts.

---

## WorkPass314 — memory hygiene doctor and holdout receipt integrity (2026-10-22)

- Added a bounded, read-only `MemoryOS2.doctor()` report for content-hash mismatch, duplicate IDs/content candidates, unresolved links, dangling revision pointers, non-reciprocal revision chains, repeated revision sequences, future-dated evidence, duplicate independence keys and memory-index corruption.
- Exposed the report through both the canonical `MemorySubsystemRuntime.doctor()` owner and `OrganismCore.memoryDoctor()`; the diagnostic path does not mutate or automatically delete memories. Severity totals remain correct even when the detailed issue list is capped.
- Hardened `evaluateSkillRevision()` so the same method/verifier/evidence receipt cannot be counted more than once under different task IDs. Reused receipts are rejected before paired holdout evaluation.
- Added a dedicated `memory-doctor-workpass314.mjs` regression covering non-mutation, corrupted records, and bounded report accounting; added a separate CI step for it. Replayed holdout receipts are covered by `p23-verified-skill-revision-gate.mjs`. Actions runner availability remains unverified: prior executions were rejected before starting any steps (runner_id=0).

---

## WorkPass313 — evidence-grounded user-mind reconstruction and EILS control signals (2026-10-22)

- Extended the existing SocialMindKernel with explicit environment, observation, belief, intention, and action tracks. These categories remain separate so inferred intent cannot silently become an observed action.
- User-model entries retain evidence references and are bounded by same-person, non-expired observation receipts. Direct observations require an exact claim-matching receipt; generic intent cues and cross-person evidence cannot masquerade as direct facts. Missing evidence downgrades claims to unresolved and caps confidence.
- Added an explicit action-observation receipt and snapshot/restore coverage; exposed the existing canonical social kernel through the organism package index.
- Adapted Letta's sleep-time principle inside the existing MemoryConsolidationController: awake cycles are capped at four selected consolidation decisions, while sleeping cycles may process a larger batch (at least 12, capped at 32). The controller records both paths in persisted diagnostics; this is a synchronous bounded-budget adaptation, not a claim of a separate asynchronous sleep agent.
- Extended the existing MotiveEcologyFabric with EILS-inspired curiosity, stress and confidence signals plus entropy-floor, plasticity and trust-region controls. Curiosity/stress modulate existing explore/verify/reflect/rest biases, and these controls are passed from the live OrganismCore cycle into P28PlasticitySubstrate to affect prototype novelty thresholds and bounded learning rates; no parallel motivation subsystem was added.
- Added WorkPass313 regression coverage for evidence separation, cross-person rejection, snapshot/restore, EILS signal direction, and real P28 prototype modulation; wired it into npm scripts and the workpass71 validation workflow. Verification remains blocked: recent Actions jobs ended with runner_id=0 and no steps/logs, so no code test has actually executed in CI or locally in this environment.

---

## WorkPass312 — reconcile P23 replay/dedupe identity caches after restore

- Rebuilt the processed-trace cache from restored experience rows first, then persisted cache entries; replayed-trace cache follows the same rule for replay-update rows.
- Missing cache entries can no longer reopen a persisted trace for experience insertion or replay learning after restart.
- Reconciled outcome counts, open evidence-debt count, skill-candidate count and promotion count with restored rows or the authoritative lifecycle store.
- Extended the WorkPass310 regression with snapshots whose identity caches are empty but whose experience/replay rows exist.

---

## WorkPass311 — keep P23 restore regression executable JavaScript

- Removed TypeScript-only `as never` assertions from the `.mjs` restore regression. Node executes this file as JavaScript; those casts would have caused a parse error before any assertions ran.
- The runtime still receives the same deliberately invalid values, so the rejection and no-partial-mutation cases remain covered.

---

## WorkPass310 — sanitize P23 learning restore and correct learning-window direction

- Replaced P23LearningEngine's shallow snapshot spread with schema-version checks and field-by-field reconstruction of persisted rows, checksum and metrics.
- Invalid rows (bad identities/actions, non-finite or out-of-range signals, impossible timestamps/windows) are quarantined. ID caches are deduplicated and bounded; restored histories retain newest entries, matching the runtime's prepend-on-write ordering.
- Unsupported versions and non-plain root values are rejected before live learner state is mutated.
- Fixed a metric-direction bug: P23 prepends newest experiences, but recent and early error windows were sliced from opposite ends. Recent calibration now uses the head, the oldest retained window uses the tail, and replay calibration reads newest updates.
- Added an adversarial regression for corrupted arrays/metrics/checksum, unsupported versions, no partial mutation, newest-first bounds, and an expected 0.875 learning-delta fixture.
- Wired the regression into learning/promotion and broad core-regression workflows. CI remains unverified while jobs are queued before runner assignment.

---

## WorkPass309 — fence re-entrant admission decisions

- Recheck the clock generation immediately after the admission callback returns. A policy that synchronously stops/restarts the scheduler can no longer return `run: true` and still launch a now-stale task.
- Added a regression that calls `stop()` from within `decide()` and asserts zero executions.
- Complements WorkPass304's asynchronous restart fencing and WorkPass305's null/undefined fail-closed handling.

---

## WorkPass308 — unify push and pull-request concurrency groups

- Standardized workflow concurrency keys on the head branch name (`github.head_ref || github.ref_name`) instead of using the PR number for pull requests and the full ref for pushes.
- The previous keys separated push-triggered and pull-request-triggered runs for the same branch, so both could remain queued despite `cancel-in-progress: true`. The shared key lets newer runs replace stale duplicate runs across those event types.
- Applied the key consistently to the 10 active workflows with concurrency control.

---

## WorkPass307 — pin semantic TypeScript validation across CI jobs

- Added `npm ci --prefix app --ignore-scripts --no-audit --no-fund` to WorkPass79, 94, 95, 106 and 110 before their runtime typecheck step.
- This installs the TypeScript compiler locked by the app workspace, matching `scripts/typecheck-runtime.mjs`'s intended compiler-selection order instead of depending on an ambient runner-global `tsc` or a syntax-only fallback.
- Expanded path filters on WorkPass94/95/106/110 to run when the app package manifest or lockfile changes, because those files supply the pinned compiler.
- Increased WorkPass79's timeout from 8 to 15 minutes to accommodate deterministic dependency setup alongside the regression suite.
- CI is configured for semantic checking, but actual results remain pending while the new runs are queued for runner assignment.

---

## WorkPass306 — align CI path filters with actual runtime configuration

- Corrected the previous workflow-path patch to watch the file the typecheck script actually consumes: `runtime/neuro-kurisu/tsconfig.clean.json`, not nonexistent `tsconfig.json`.
- Added `scripts/typecheck-runtime.mjs` to the regression triggers wherever the workflow invokes runtime typecheck, so edits to the compiler-selection/fallback logic cannot bypass those checks.
- Added `scripts/audit-actions-runtime.mjs` to the continual-learning workflow triggers because that workflow runs this audit.
- The correction prevents configuration edits from being silently skipped by the intended file filters. Workflows remain unvalidated until Actions can assign a runner.

---

## WorkPass305 — reject empty clock-policy decisions

- Corrected a fail-open edge: when a configured `decide` callback returned `null` or `undefined`, the scheduler treated that as “no policy” and used the default `run: true` decision.
- The default run decision is now used only when no callback is registered; an installed policy that returns no decision throws, is counted as a failure, and skips the task.
- Added regression coverage for both `null` and `undefined` policy responses, asserting that neither can run a task.
- GitHub Actions remains non-validating while jobs fail before a runner is assigned.

---

## WorkPass304 — fence stale runtime-clock generations and serialize wakeups (2026-10-22)

- Every start/stop now advances per-clock generation tokens; a completed stale task cannot re-admit work or schedule a timer into a newer runtime generation.
- Timer callbacks only remove their own timer handle, preventing an old callback from deleting a fresh timer entry.
- A per-clock active-task guard keeps rapid restarts from overlapping autonomous tasks; retry wakeups remain bounded by the existing minimum cadence.
- Added an async regression that restarts a clock while a task is active and asserts both eventual recovery and maximum same-clock concurrency of one.
- CI still fails before runner assignment in the current GitHub Actions history; this code/test change is committed but not runtime-validated.

---

## WorkPass303 — repair invalid control-character regex (2026-10-22)

- Fixed a malformed Unicode character-class escape in B272's persisted-ID validator. Node.js reports a syntax error for the doubled escapes, which prevents the goal-generation module from loading.
- Added a regression restoring a snapshot containing a control-bearing goal identifier; the record must be quarantined.
- The malformed regex was independently reproduced in Node.js 22. Full runtime suite execution remains blocked by GitHub Actions jobs failing before runner assignment.

---

## WorkPass302 — make goal outcome credit idempotent and ledger-bound

- Added a persisted `lastOutcomeTick` watermark. A generated goal's outcome can now update weights and memory at most once per tick; duplicate/out-of-order credits fail before any learner state mutation.
- Restore now remembers the latest observed outcome tick even when a conflicting duplicate-tick row is quarantined, preventing a damaged ledger from reopening that tick for replay.
- Duplicate outcome rows for the same tick are quarantined as a group instead of allowing ambiguous evidence into the active ledger.
- Goal-outcome memory now requires a positive bounded update count and a matching retained outcome row with the same goal ID and last-update tick; fabricated zero-update memory is not admitted.
- Added regressions for duplicate online credit, restore watermark persistence, zero-update memory injection, and duplicate ledger ticks.
- Existing snapshots without the new watermark remain compatible: the watermark is reconstructed from stored outcome history. Execution is still blocked at GitHub runner initialization, so these assertions are not claimed as passing.

---

## WorkPass301 — runtime clock fail-closed decisions and bounded scheduling

- The runtime clock now validates registration inputs, clock identifiers, start targets and adaptive decisions before using them.
- A thrown/invalid admission decision no longer defaults to `run: true`; the task is skipped and the clock enters a bounded retry path.
- Post-task decision failures are caught and rescheduled rather than escaping the clock promise and silently stopping future wakeups.
- Error-handler failures are counted but cannot prevent the clock from being rescheduled.
- Repeated zero-delay decisions are bounded to a 50 ms cadence to prevent an accidental busy loop; valid initial delay 0 remains supported.
- Added regression scenarios for fail-closed admission, throwing error handlers, bad start/configuration and second-decision failures.
- Source/tests are committed; test execution remains unverified because the repository Actions jobs currently fail before runner initialization.

---

## WorkPass300 — JavaScript syntax audit for runtime tests

- Added a conservative restore regression for snapshots where incomplete-cycle counters understate the total. Unaccounted history must be classified as incomplete, keeping complete + incomplete equal to total and broken lineages within the incomplete subset.
- Extended WorkPass84 script-integrity audit to run `node --check` against every `.mjs` test directly referenced by package scripts. It reports the exact failing path and makes syntax errors a hard audit failure.
- This prevents TypeScript-only syntax from silently entering JavaScript test files again. The script and regressions are committed; execution remains unverified while Actions jobs fail before runner initialization.

---

## WorkPass299 — keep runtime regressions valid JavaScript (2026-10-22)

- Removed TypeScript-only `as` assertions accidentally introduced into `.mjs` regression files in WorkPass296/298. These files execute as JavaScript under Node and would otherwise fail at parse time before exercising the intended guards.
- Retained the same invalid-input and unsupported-version assertions using plain JavaScript objects/null values.
- This was a source-level static correction after reviewing the committed changes; tests remain unexecuted because the current Actions jobs fail before runner/step initialization.

---

## WorkPass298 — endogenous goal-state integrity and outcome binding (2026-10-22)

- Rebuilt B272 snapshot restoration around fixed-dimension vectors/matrices, allow-listed action identities, bounded finite metrics/counters, and validated histories/memory.
- Unsupported schema versions now fail before state mutation; malformed event rows and outcome memories are quarantined rather than admitted to learning.
- Current goal identity is recomputed from its normalized vector so restored IDs cannot point at a different goal representation.
- Step input now requires a safe monotonic tick, finite bounded latent vectors, finite [0,1] needs/traits/reward signals, and valid optional intrinsic-drive confidence.
- Outcome learning now requires exact tick, generated goal ID, and action binding; non-finite/out-of-range evidence is rejected before changing weights/counters.
- External evidence now contributes a small, bounded positive learning-credit term instead of being an unused input.
- Online goal-outcome memory is capped at 256 records with oldest-evidence eviction; this closes unbounded growth under long autonomous sessions.
- Added adversarial restore, invalid input, mismatched-outcome, no-partial-mutation and evidence-credit regressions. Execution remains unverified until the repository's runner dispatch starts executing steps.

---

## WorkPass297 — workflow dispatch, timeout and trigger coverage hardening (2026-10-22)

- Added explicit least-privilege `contents: read` permissions to workflows that had relied on implicit defaults.
- Added workflow-level concurrency and bounded job timeouts where absent; stale runs of the same workflow/PR are cancelled instead of competing for runners.
- Aligned the WorkPass287-288 workflow to the maintained checkout/setup-node major and disabled implicit package-manager caching for its test-only job.
- Activated the full WorkPass71 regression gate for pull requests into the current stacked base as well as release/source bases.
- Corrected WorkPass79/94/95/99 branch filters so the active WorkPass206 branch/base flow is not silently bypassed.
- Expanded trigger filters to include package lockfiles, runtime TypeScript config, Node shims, and the Node version input when relevant.
- WorkPass99 PR triggers now cover the replay policy/engine/configuration files and every replay test invoked by its benchmark.
- WorkPass94 triggers now cover key outcome-ledger/promotion-gate tests and sources that its job already executes.
- These repository-owned CI fixes do not repair GitHub-hosted runner dispatch. Current jobs still report runner_id=0 and zero executed steps, so test validation remains blocked upstream of checkout.

---

## WorkPass296 — fail-closed cognitive snapshot and stage identity hardening (2026-10-22)

- Unsupported persisted state versions now fail before mutating runtime state.
- Snapshot counters partition every cycle; unaccounted history is conservatively classified as incomplete rather than disappearing from aggregate totals.
- Invalid stage names/types in persisted missing-stage metadata now fail closed instead of being filtered into an empty list that could falsely certify completion.
- Restored completion now requires at least one counted complete cycle.
- Runtime entry checks reject null/non-object input and invalid stage-ID containers with deliberate errors.
- Inherited/prototype-provided stage IDs no longer satisfy required cognitive-cycle evidence.
- Cycle accounting stops before unsafe-integer overflow.
- Added regression checks for each boundary above. CI is still not evidence of these tests passing because the currently sampled jobs failed before any runner step was recorded.

---

## WorkPass295 — reconcile restored cognitive-cycle history (2026-10-22)

- Hardened `UnifiedCognitiveCycle.restore`: complete and incomplete counters are now disjoint subsets of total cycles; broken lineages cannot exceed incomplete cycles.
- A restored `lastComplete` flag is accepted only when at least one cycle exists, the last tick is valid, and the missing-stage set is empty.
- Empty missing-stage state on a zero-cycle snapshot is normalized back to the required stages, avoiding a false appearance of completed history.
- Added regression cases for over-counted restored counters and empty-history false completion.
- Tests and typecheck have **not** been executed in this environment; the repository's recent Actions runs are currently failing before recording steps. Do not interpret this commit as validated by CI.

---

## WorkPass294 — bound CI run storms and record Actions failure evidence (2026-10-22)

- Audited metadata across all 52 GitHub Actions history pages (5,158 runs). The latest 2,400 runs on pages 1–24 all concluded as failures; older pages contain mixed successful/cancelled/failed results.
- Sampled four current failed jobs; each has zero recorded steps and no runner name. Log download returned `BlobNotFound`, so the root cause is not established and no test failure is invented.
- Added per-workflow concurrency groups to WorkPass105, WorkPass106/108, WorkPass110, and WorkPass287–288 to cancel superseded runs for the same PR/ref.
- Aligned the WorkPass287–288 cognitive-contract workflow to Node.js 24.
- The concurrency change reduces duplicate CI work; it does not by itself repair the unavailable job execution/logging. No CI pass or production readiness is claimed.
- Detailed evidence and next actions: [WorkPass294 Actions history audit](docs/WORKPASS294_ACTIONS_HISTORY_AUDIT_2026-10-22.md).

---

## WorkPass293 — define branch-level completion gates (2026-10-22)

- Added `docs/architecture/branch-goals.md` with concrete responsibilities and exit criteria for `main`, `rebuild`, the active stacked runtime/evaluator branch, and the Hermes skill-evolution lane.
- Explicitly records that PR #55 is stacked on `workpass203-independent-candidate-evaluator`, not a direct merge to `main`; branch completion requires executable end-to-end evidence and reconciled dependencies.
- Makes the single-owner rule explicit across core, memory, motivation/goals, embodiment, self-model, and validation. This is a roadmap artifact, not evidence that those gates are already met.

---

## WorkPass292 — unify intrinsic motivation with canonical endogenous goal genesis (2026-10-22)

- **Structural integration:** `B272EndogenousGoalGenesis` now accepts optional `intrinsicDrive01` and `intrinsicDriveConfidence01` signals. A drive influences predicted goal value only in proportion to its bounded confidence, while the existing `intrinsicReward01` contract remains backward-compatible.
- **Single owner:** removed the temporary standalone initiative-candidate method from `IntrinsicMotivationEngine`; it owns drive computation, while B272 remains the canonical endogenous goal generator. This avoids creating a competing goal lifecycle.
- **Regression:** extended the B272 goal-genesis test to compare baseline, calibrated-drive, and zero-confidence cases. Added this test to the focused workflow for push and pull-request events.
- **Research adaptation:** follows the useful separation in Letta sleep-time compute (memory/state work separate from active response) and Hermes self-evolution (candidates must be evaluated), but adapts it to NK1's existing typed goal owner rather than importing another agent framework. References: [Letta sleep-time compute](https://www.letta.com/blog/sleep-time-compute/), [Hermes Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution).
- **Validation:** hosted Actions jobs have repeatedly failed before exposing steps, so the new regressions remain unverified. No dependency added; no learning uplift or consciousness claim.

---

## WorkPass291 — reject reused cognitive-stage event identities (2026-10-22)

- **Causal accounting:** required stages must have distinct event IDs. Reusing the observation ID as the prediction ID (or otherwise reusing an ID across required stages) now marks the conflicting stages missing instead of counting a fabricated complete cycle.
- **Regression:** added duplicate-identity coverage to `tests/workpass287-unified-cycle-contract.mjs` and corrected its sequential tick fixture after adding the monotonic tick guard.
- **Boundary:** IDs are still caller-supplied; cryptographic provenance and proof that the corresponding runtime action actually happened are not yet enforced by this class.
- **Validation:** GitHub Actions has repeatedly failed before exposing any job steps; these tests remain unexecuted/unverified in the hosted workflow. No passing status is claimed.

---

## WorkPass290 — enforce monotonic cognitive world ticks (2026-10-22)

- **Causal ordering:** the unified cognitive-cycle recorder now rejects duplicate ticks as well as regressing ticks. Replaying the same world tick can no longer silently inflate the number of evaluated cycles or skew rolling averages.
- **Regression:** `tests/workpass287-unified-cycle-contract.mjs` now checks duplicate and regressing tick rejection.
- **Scope:** this protects cycle accounting; it does not prove that stage IDs correspond to real executed components. Independent event provenance and end-to-end runtime wiring remain future work.
- **Validation:** hosted Actions jobs have repeatedly failed before exposing any steps; this regression remains unexecuted/unverified in CI. No test pass is claimed.

---

## WorkPass289 — connect intrinsic drives to evidence-gated initiative candidates (2026-10-22)

- **Integration:** `IntrinsicMotivationEngine.proposeInitiative()` converts an active internal drive into a typed `intrinsic-goal-candidate` only when it is grounded by bounded observation/prediction identities, world-evidence quality, and causal-continuity signals.
- **Safety boundary:** candidate creation is not tool execution, task completion, or proof of autonomy. Low-quality/missing evidence yields no candidate; external execution still belongs to the existing action/approval path.
- **Repair:** corrected malformed template-literal syntax in goal reasons and tightened control-character checks on initiative evidence IDs.
- **Regression:** extended `tests/workpass288-intrinsic-motivation-contract.mjs` with initiative gating, weak evidence, invalid metrics, and malformed identity cases. Existing workflow already watches these files.
- **Validation:** GitHub Actions previously failed before exposing any steps; this pass has not yet received a confirmed test result. No dependency added and no measured autonomy uplift claimed.

---

## WorkPass288 — harden intrinsic-drive signals and persistence (2026-10-22)

- **Unified motivation state:** external uncertainty, prediction error, novelty, goal pressure, social need, energy, success and world-evidence quality are normalized to finite bounded signals before drive computation.
- **Derived aggregate:** restored `overall` is recomputed from the six drive values rather than trusting a persisted summary that could disagree with the dominant drive.
- **Restore safety:** invalid drive metrics are normalized, unknown dominant labels are rejected, the dominant drive is reconciled with the strongest restored signal, and invalid timestamps fall back to a safe current timestamp.
- **Regression:** added `tests/workpass288-intrinsic-motivation-contract.mjs` and registered `test:workpass288:intrinsic-motivation`.
- **CI:** added `.github/workflows/workpass287-288-cognitive-contracts.yml` to run both focused contracts on relevant pushes and pull requests using Node 22.12, without adding runtime dependencies. The workflow run failed before any step appeared; GitHub reports an empty steps list for the job. The focused tests therefore remain unexecuted/unverified, and this is not evidence of a code-level test failure.
- **Architecture:** keeps the existing `IntrinsicMotivationEngine` as the single drive owner; no parallel motivation subsystem or new dependency.
- **Validation:** test/typecheck execution has not been observed in this session; no passing status or measured autonomy uplift is claimed.

---

## WorkPass287 — harden the unified cognitive-cycle evidence contract (2026-10-22)

- **Runtime:** `UnifiedCognitiveCycle` now rejects invalid, non-finite, fractional, negative, or regressing world ticks; parent-integrity input must be finite and in the range 0–1.
- **Evidence quality:** required stage IDs must be bounded non-empty strings without control characters. Blank or control-bearing IDs cannot make a cycle appear complete.
- **Persistence:** restored counters, metrics, tick values, and missing-stage arrays are normalized instead of allowing NaN/Infinity or unknown stage names into the cycle snapshot.
- **Isolation:** `snapshot()` returns a detached missing-stage list so caller mutation cannot alter internal cycle state.
- **Regression:** added `tests/workpass287-unified-cycle-contract.mjs` and registered `test:workpass287:cognitive-cycle` in the runtime package.
- **Scope:** this is a shared-cycle contract hardening pass, not a claim of consciousness or an end-to-end autonomous loop. No dependency added. Test/typecheck execution has not been observed in this session; no pass is claimed.

---

## WorkPass286 — recent engineering changes handover (2026-10-22)

- Added `docs/reports/2026-10-22-recent-engineering-changes.md`, consolidating the 20–22 October change families, known validation gaps, and next implementation gates.
- Explicitly distinguishes source changes from verified behavior and feature-branch work from merged `main` history.
- No runtime behavior or dependencies changed in this documentation-only pass; WorkPass282–285 test/typecheck execution remains unverified.

---

## WorkPass285 — independent evaluator capability scope (2026-10-22)

- The independent candidate evaluator now rejects verifier claims for capabilities outside a task's declared required-capability set.
- Added regression coverage for out-of-scope capability claims. Tests/typecheck not executed; no new dependency or measured learning-score uplift.

---

## WorkPass284 — strict external causal-memory intake (2026-10-22)

- External causal-memory ingestion now rejects invalid ticks, malformed metrics and unsafe optional source/evidence identities rather than coercing them into plausible records.
- Added regressions for invalid external payloads. Tests/typecheck not executed; no new dependency or measured learning-score uplift.

---

## WorkPass283 — causal outcome tick binding (2026-10-22)

- Causal experience records now require a decision trace and its pre-action state to refer to the same world tick.
- Added a regression for mismatched trace/state ticks. Test execution remains unverified; no dependency or learning-score uplift claimed.

---

## WorkPass282 — P23 fingerprint canonicalization consistency (2026-10-22)

- Unified the P23 engine's canonicalization semantics with the independent candidate evaluator for candidate payload and evaluation fingerprints.
- Non-finite numbers, cyclic structures, non-plain objects and non-JSON-serializable values are rejected rather than fingerprinted ambiguously.
- No dependency added. Test/typecheck execution remains unverified; no learning-score uplift claimed.

---

## WorkPass281 — independent evaluator input and run identity hardening (2026-10-22)

- P23 evaluation fingerprinting rejects non-finite numbers, circular inputs and non-plain objects before execution.
- Sandbox run IDs must be bounded and free of control characters before independent verification or trusted evidence binding.
- Added regression coverage for malformed task inputs and control-bearing run IDs.
- No dependency added. Test execution remains unverified; no learning-score uplift claimed.

---

## WorkPass280 — strict canonicalization of evaluation evidence (2026-10-22)

- Independent evaluation evidence fingerprints now reject NaN/Infinity, circular references and non-plain objects instead of canonicalizing invalid values ambiguously.
- Added regression coverage for NaN quality metrics in the signed-evidence binding path.
- No dependency added. Test execution remains unverified; no learning-score uplift claimed.

---

## WorkPass279 — causal memory trust-boundary hardening (2026-10-22)

- Causal snapshot restoration now sanitizes aggregate counters, normalized rolling metrics and timestamps, and recomputes behavioral aggregates from eligible runtime-grounded records.
- Runtime causal outcome recording now fails closed on invalid trace ticks, malformed reward/success/surprise/novelty values and unsafe task identities.
- Added regression coverage for poisoned persisted aggregates, NaN outcome reward and control-bearing task IDs.
- No new dependencies. Tests have been authored but not executed; no learning-score uplift is claimed.

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

## WorkPass266 — reject lossy causal identity normalization and wire active regressions (2026-10-22)

- **Code:** CausalExperienceStream no longer truncates task/trace identity keys. NFKC-normalized empty, overlong, non-string, or control-bearing IDs are rejected; restore drops records whose trace IDs violate the same bound.
- **Failure prevented:** distinct overlong identities could collapse to one key and be mistaken for duplicate delivery, silently losing an event or merging evidence.
- **Regression:** added cases for two distinct overlong task IDs, overlong/control-bearing trace IDs, no mutation after rejection, invalid persisted identity cleanup, and long runtime trace IDs.
- **CI wiring:** the WorkPass110 workflow now triggers for causal-stream and Legacy/Live2D files and includes the causal-stream, Legacy-avatar and Live2D integrity regressions; the current source branch was added to push triggers.
- **Validation:** GitHub returned the WorkPass110 job as failed with steps=null and logs_url=null; a retry was requested. This is not a code/test PASS and does not identify a source failure. Exact-head runtime/app typechecks remain unverified.
- **Dependencies:** no new package is required; the code change uses existing Node APIs and the standard library.


## WorkPass264 — validate external causal event identity (2026-10-22)

- **Code:** external causal ingestion now normalizes and requires a non-empty task ID and rejects action labels outside the canonical organism action set before mutating state.
- **Source integration:** selectively adapted strict intake-validation principles from the historical continual replay buffer; no parallel replay subsystem was added.
- **Regression authored:** invalid task/action inputs must throw and leave the causal outcome count unchanged.
- **Validation:** targeted regression and runtime typecheck remain unconfirmed.

## WorkPass263 — reduce inherited environment leakage (2026-10-22)

- **Code:** reject inherited environment keys matching common credentials, secrets, tokens, passwords, auth/session material, credential-profile paths, runtime injection variables, and dynamic-loader overrides; duplicate inherited keys are also rejected.
- **Regression authored:** secret-bearing environment keys and NODE_OPTIONS must be rejected while the existing PATH-only test launcher remains usable.
- **Validation:** host-service regression and runtime typecheck are not confirmed passing. Current HEAD has no commit status records; three available PR-triggered workflow records failed before visible job steps and their logs are unavailable, so these results do not establish a code failure.

## WorkPass262 — avoid per-frame canvas bitmap resets (2026-10-22)

- **Code:** LegacySpriteDeck now updates canvas width/height only when layout dimensions change, avoiding repeated bitmap clears and drawing-context resets during every animation frame.
- **Regression authored:** added assertions to the existing Legacy sprite runtime test.
- **Validation:** app script regression and typecheck have not been confirmed executed.

## WorkPass261 — idempotent external learning intake (2026-10-22)

- **Code:** normalize external evidence trace IDs, return the original record for repeated source identities, persist those identities through snapshots, and avoid duplicate outcome counts on bridge retries.
- **Regression:** added same-process and restore-path checks, including NFKC-equivalent identifiers.
- **Developer workflow:** added `npm run test:big-pass-90:causal-stream` to execute the existing causal stream regression.
- **Validation:** test/typecheck execution has not yet been confirmed.

## WorkPass260 — diversify causal replay and consolidation (2026-10-22)

- **Code:** ported diversity-aware maximal-marginal-relevance-style selection from the older learning-integrity branch into the current CausalExperienceStream for both prioritized replay and grounded consolidation.
- **Regression authored:** a near-equal second task must not be crowded out by repeated examples from one task in a small replay batch.
- **Validation:** causal-stream regression and runtime typecheck have not been confirmed passing.

## WorkPass259 — selectively restore causal learning safeguards (2026-10-22)

- **Source integration:** compared the historical workpass71-learning-integrity CausalExperienceStream against the current owner and ported selected safeguards instead of merging the old branch.
- **Code:** normalized trace IDs (NFKC, trim, bounded length); persisted de-duplication IDs across bounded record eviction and restore; consolidation now accepts only state-grounded records.
- **Regression authored:** restored outcomes cannot be recorded twice; high reward/surprise alone cannot consolidate an ungrounded external event.
- **Validation:** causal-stream regression and runtime typecheck have not been confirmed passing.

## WorkPass258 — pin host authority working and storage paths (2026-10-22)

- **Code:** bind prepared authority working directory, run root, and survive root to filesystem identity; recheck identity, directory type, and private POSIX permissions at dispatch.
- **Regression authored:** replacing the executor scratch root after setup must fail closed before request creation.
- **Validation:** runtime regression and typecheck have not been executed on an accessible runner; no green status is claimed.

## WorkPass257 — cover Legacy avatar runtime races (2026-10-22)

- Added app script regression coverage for the stable canvas loop and stale image callback cancellation. Test authored, not yet executed.

## WorkPass256 — prevent stale Legacy sprite loads (2026-10-22)

- **Code:** obsolete sprite image callbacks are detached/cancelled on emotion or outfit change so late loads cannot overwrite the latest requested sprite.

## WorkPass255 — stabilize Legacy avatar animation loop (2026-10-22)

- **Code:** the canvas loop now reads current speaking/outfit values through refs and is not restarted for each emotion/speaking update, preserving its animation clock.

## WorkPass254 — resolve exclusive Live2D branch changes (2026-10-22)

- **DONE (branch audit):** compared the two commits exclusive to `workpass94-avatar-voice-live2d-audit`; both add audit documents only, with no exclusive code diff to cherry-pick.
- **DONE (evidence reused):** reproduced two findings on the active source branch and addressed them through WorkPass252 (expression transition cache) and WorkPass253 (safe Legacy localStorage).
- **OPEN:** browser Live2D/voice and Android/Termux E2E remains unverified; the source branch is retained, not deleted or merged.

## WorkPass253 — harden Legacy avatar storage fallback (2026-10-22)

- **DONE (code):** LegacySpriteDeck now catches unavailable/throwing localStorage on read and write, validates persisted outfit IDs against the canonical outfit catalog, and falls back to `lab_coat` without preventing the sprite UI from mounting.
- **Integration:** the existing Legacy fallback is retained; no new avatar or persistence subsystem was introduced.
- **Validation:** app typecheck and browser regression have not been executed on a functioning runner; no green status is claimed.

## WorkPass252 — preserve Live2D expression transitions during lip-sync (2026-10-22)

- **DONE (code):** the Live2D viewer now caches the last successfully applied expression and avoids reissuing the same model expression on every embodiment update. Mouth/gaze updates no longer repeatedly restart an unchanged expression animation.
- **DONE (regression authored):** the existing Live2D asset-integrity test now guards the expression-cache and transition check.
- **Validation:** source regression and browser/Live2D end-to-end behavior have not been executed on a functioning runner/device; no green status is claimed.

## WorkPass251 — revalidate host authority executable identity at dispatch (2026-10-22)

- **DONE (code):** prepared executor/verifier/scanner commands now re-resolve and re-stat the executable before request creation and again after the request snapshot is written, rejecting a replaced executable identity or newly unsafe POSIX write permissions.
- **DONE (regression authored):** extended the existing host-owned evaluation service test to replace the scanner executable after service construction and assert fail-closed dispatch.
- **Boundary:** this narrows executable replacement exposure but does not eliminate the final filesystem TOCTOU window and does not replace signed/immutable deployment or an OS/container sandbox.
- **Validation:** test and typecheck have not been executed on a functioning runner; no green status is claimed.

## WorkPass250 — consolidate independent-evidence binding (2026-10-22)

- **DONE (code):** extracted a single exact-context binding predicate and reused it for both independent verifier and safety-scanner responses.
- **Structural consolidation:** payload/task/environment/plan/manifest/experiment-plan/scheduled-run/runtime-run/task/seed binding now has one implementation instead of two parallel checks, reducing the chance of future security drift.
- **Validation:** targeted test and typecheck have not been executed in this pass; no green status is claimed.

## WorkPass249 — stop cancelled authority invocations before launch (2026-10-22)

- **DONE (code):** host-owned authority invocation now fails before request-directory allocation if its AbortSignal is already aborted, and rechecks after writing the private request snapshot before invoking process supervision.
- **Integration:** reuses the existing cancellation and LearningProcessSupervisor path; no parallel runner or authority subsystem was added.
- **Validation:** regression and typecheck remain unverified until a functioning runner executes them.

## WorkPass247 — protect host authority executable integrity (2026-10-22)

- **DONE (code):** host-owned executor, verifier, and safety-scanner commands are rejected at preparation if the resolved executable is not a regular file or is group/world-writable on POSIX.
- **DONE (regression authored):** extended the existing host-service regression with a POSIX group-writable executable rejection case; reused the existing test entry point.
- **PARTIAL:** this is executable-integrity hardening only. It does not establish signatures, immutable deployment, OS/container sandboxing, or independent service ownership.
- **Validation:** regression is committed but not executed in this pass; exact-head Actions and typecheck remain unverified.

## WorkPass246 — immutable host command authorities (2026-10-22)

- Closed a host-configuration TOCTOU gap: `prepareCommand` now snapshots executable arguments, environment overrides, and inherited-environment keys before its first asynchronous filesystem operation. Later caller mutation cannot silently alter a prepared executor/verifier/scanner command.
- Strengthened authority separation beyond path-level `realpath`: on POSIX, startup now compares device/inode identity, rejecting distinct executable paths that are hard links to the same underlying file. Windows retains normalized resolved-path identity.
- Extended the existing WorkPass243 host-service regression with post-preparation argument mutation and POSIX hard-link alias cases; reused the existing package/CI entry point rather than adding another harness.
- **Validation:** regression code is authored and committed; it was not executed in this session. Exact-head Actions/typecheck status remains unverified. This does not replace deployment of actual independently controlled services or an OS/container sandbox.

## WorkPass243 — host-owned evaluation subprocess adapter (2026-10-22)

- Added `HostOwnedIndependentEvaluationServices.ts`, a concrete adapter from the canonical independent evaluator to three distinct host-owned executable services: candidate executor, independent verifier, and safety scanner.
- Reused `LearningProcessSupervisor` for no-shell child-process launch, bounded runtime/output, process-group termination on POSIX, execution receipts, and AbortSignal cancellation. Each invocation receives a private mode-0600 JSON request file and must return a strict JSON object on stdout; nonzero exit, timeout, cancellation, output overflow, malformed JSON, or malformed service results fail closed.
- Added startup validation for absolute executable/working/storage paths, executable access, distinct resolved executables, private POSIX storage-root permissions, and disjoint run/survive roots across all three authorities.
- The verifier and scanner subprocess protocols must echo the exact payload/task/environment/plan fingerprints and run/task/seed identity they attest; mismatched or stale attestations are rejected before their results enter the evaluator.
- Extended the evaluator safety-scanner contract to receive the same immutable task/environment/plan context as execution and verification. Added a runtime-ready async config-factory seam that prepares trusted executables once and can be passed to `RuntimeConfig.compoundRepairRevision.independentEvaluationConfigForRepair`.
- Added `workpass243-host-owned-independent-evaluation-services.mjs` to exercise the three process protocols and runtime-ready factory, and registered it in `package.json`, the canonical `audit:p23:cross-source-replay` command, and the continual-learning workflow's path filters/test steps.
- **Boundary:** this adapter provides real supervised process separation, not an OS sandbox by itself. The configured executor must be a trusted sandbox launcher enforcing filesystem/network/resource restrictions. The host must explicitly use `OrganismRuntime.createWithHostOwnedIndependentEvaluation` or provide the returned factory to runtime config; the runtime does not silently invent production commands.
- **Validation:** regression is authored and CI-wired, but has not been executed in this session. Exact-head Actions/typecheck status is not yet confirmed; no pass is claimed.

## WorkPass242 — freeze candidate payload across asynchronous trials (2026-10-22)

- Fixed a time-of-check/time-of-use gap in the canonical independent evaluator: it now structured-clones the candidate payload once at evaluation entry, computes the payload fingerprint from that immutable snapshot, and passes clones of that same snapshot to every sandbox execution and safety scan.
- Previously, a caller retaining the original object could mutate it after the first trial yielded; later trials could then execute changed content while retaining the initial payload fingerprint. That path is now closed.
- Added a deterministic regression to the existing independent-evaluator test: it blocks the first trial, mutates the caller-owned payload while the evaluation is suspended, resumes the trial, and asserts both trials received the original payload and the result retains the original fingerprint.
- Reused the canonical evaluator and existing CI test wiring; no parallel evaluator or test harness was added.
- **Validation status:** code and regression are committed to the draft PR branch. Tests/typecheck and exact-head GitHub Actions have not been run/confirmed in this pass; no green result is claimed. Production host-owned sandbox/verifier/scanner provisioning remains open.

## WorkPass237 — promotion requires matched independent baseline/candidate evidence (2026-10-21)

- Replaced the promotion entry point's caller-supplied baseline report arrays with a complete independently evaluated baseline envelope. Promotion now delegates to the canonical `compareMatchedIndependentEvaluations` boundary before scoring or activation.
- This reuses the existing SkillLearnBench paired gate while requiring integrity-checked baseline and candidate envelopes, identical task plan/environment/experiment manifest, distinct method labels, one-to-one task/trial/seed/split matching, verifier-bound runs, and safety-clean evidence. A caller can no longer pass an unrelated baseline report collection to make a candidate appear eligible.
- Added an explicit runtime guard for absent/malformed envelopes before dereferencing nested fields. The existing store still independently re-verifies persisted signed shadow receipts and the authenticated approval at activation.
- Source patterns adapted: matched-pair experimental design, provenance-bound evidence, and fail-closed tool authority from the existing P23 evaluator and Hermes bridge; no parallel evaluator, scoring engine, or promotion store was introduced.
- **Regression + CI wiring:** extended `p23-hermes-production-promotion-gate.mjs` to prove that caller-supplied baseline report arrays and malformed envelopes fail before approval is reached; added the test and P23LearningEngine to the learning workflow path filters and an explicit execution step, and included both Hermes regressions in `audit:p23:cross-source-replay`.
- **Validation caveat:** source change and regression are committed; test execution, typecheck, and exact-head Actions are not yet confirmed passing. Keep the PR draft and do not claim promotion works in production until the trusted execution path and approval service are exercised end to end.
## WorkPass235 — join independent P23 evaluations to signed Hermes shadow evidence (2026-10-21)

- Added `bindIndependentEvaluationToVerifiedShadowEvidence` and exposed it through the existing `P23LearningEngine` instead of creating a second evidence lifecycle. The bridge recomputes the canonical evaluation digest and checks the payload fingerprint before consuming any receipt.
- Joins experiment trial IDs to actual execution run IDs through P23's independently verified `runBindings`; validates validation/holdout membership, planned-run identity presence, seed, task, manifest fingerprint, binary outcome, unique run/receipt coverage, and zero safety violations.
- Requires every evaluation report and binding to have a one-to-one signed receipt. Failed but independently verified trials remain bindable as negative evidence; mismatched outcomes, seeds, task IDs, manifests, duplicate receipts, untrusted bindings, or safety violations fail closed.
- Signed receipts authenticate candidate identity and binary outcome only. Skill/trajectory quality metrics remain unauthenticated by the signature, and this bridge grants no staging, approval, or promotion authority. Existing P23 gates and the candidate store remain authoritative.
- Extended `tests/p23-hermes-verified-evidence-binding.mjs` with cross-system joins and seed/safety mismatch regressions; the existing `test:p23:hermes-verified-evidence-binding` command already covers the file.
- **Validation caveat:** code and regression were committed to the draft PR branch, but this session did not execute the test or TypeScript typecheck. No green CI claim is made; production signer/context authority remains external.

## WorkPass149 — prepare promotion requests only from verified shadow provenance (2026-10-21)

- Added `scripts/create-skill-promotion-approval-request.mjs` for offline/deployment workflows that need a signable Ed25519 request outside the live HTTP API. It binds the request to the exact candidate/version/payload, current active-version CAS, configured shadow threshold and complete evidence fingerprint.
- Unlike a raw JSON checklist, the CLI requires the configured trusted shadow-verifier public keys and durable trusted-run registry, verifies every stored shadow observation's Ed25519 signature and independent run/task/seed/manifest/runtime context, and refuses to create a request when any observation is untrusted.
- It rejects non-shadow candidates, failing/insufficient runs, stale base-version CAS, missing/malformed/non-Ed25519 keys, malformed registry/store snapshots, symlink/oversized files, and invalid request identifiers. Output is explicitly an **unsigned request only**; it never embeds an approval private key or activates a skill.
- Added regression coverage for signed context-bound evidence, tampered-signature rejection, approval payload binding, insufficient shadow runs, ineligible candidate state and stale active-version CAS; registered the script/test in the P23 workflow and aggregate verified-skill lifecycle suite.
- **Not claimed:** successful exact-head CI/typecheck or production approval service/runner evidence. Actual promotion remains gated by the separate signed-approval verifier and candidate store.

## WorkPass148 — authenticate promotion and revalidate restored active skills (2026-10-21)

- Added a detached Ed25519 promotion-approval contract separate from shadow-verifier keys: `NEURO_SKILL_PROMOTION_APPROVAL_KEYS_JSON`. Signed approvals bind approver ID/time, a unique approval ID, exact candidate ID/version/payload, proposal/outcome fingerprint, expected active version, required shadow-run count and a digest of the full shadow evidence set.
- The authenticated verifier rejects unknown approvers, malformed/non-Ed25519 keys, tampered payloads, stale new-activation approvals, mismatched candidate/CAS/evidence context and signatures re-used against altered observations. The private approval key stays outside NK1.
- Added Core-owned `approveVerifiedSkillCandidate` and authorized API operations to inspect the verified candidate lifecycle, generate a candidate-bound promotion request, and apply its signed artifact. An unconfigured approver cannot even request a promotion payload; every API remains under the server's existing authorization gate.
- Persisted active skills are no longer trusted merely because their JSON snapshot is structurally valid: the candidate/payload/version relationship, signed approval and every shadow observation are revalidated on restore and store reads. The 15-minute freshness applies to new activation; it does not silently expire a previously active skill.
- Extended candidate-store regression coverage with valid Ed25519 activation, evidence-digest tampering rejection, one-use lifecycle protection, restore after approval freshness expiry, and startup denial when approval authority keys are absent. Bootstrap regressions cover approval-key parsing and Ed25519 enforcement; CI path triggers include the new module.
- **Not claimed:** successful exact-head CI/typecheck, production key rotation/approval service, authenticated rollback authority, production runner success or learning uplift. GitHub Actions jobs continue to fail before exposing steps/logs; test execution is unverified.

## WorkPass147 — add verified-evidence candidate staging CLI (2026-10-21)

- Added `scripts/stage-verified-skill-candidate.mjs`: reads a bounded JSON bundle containing a task manifest, signed outcome artifacts, baseline/candidate method IDs and the candidate P23 policy skill.
- The tool validates configured trusted Ed25519 public keys, rejects symlink/oversized bundles and unknown bundle fields, re-verifies **every** supplied signed outcome against the exact manifest, and fails closed if any row is rejected or the paired holdout proposal does not pass strict minimum evidence thresholds.
- It mints the authentic proposal in-process and stages through `OrganismCore.stageVerifiedSkillCandidate` into the same separate, atomically persisted candidate store used by the runtime. It does not initialize/flush the live organism state file, activate the candidate or create approval.
- Added a regression that builds signed holdout fixture artifacts, stages the candidate, reconstructs a fresh Core to verify durable persistence, then tampers with a signed artifact and confirms it cannot stage a second candidate.
- **Not claimed:** successful CI/typecheck, production verifier-key supply-chain quality, real benchmark uplift, or automatic promotion. Fixture signing keys are generated only by tests.

## WorkPass146 — exercise signed shadow evidence through the canonical Core path (2026-10-21)

- Exposed `OrganismCore.stageVerifiedSkillCandidate` and a read-only candidate lifecycle snapshot, delegating to the existing P23 engine/store. Staging still requires the exact authentic proposal object issued by `proposeVerifiedSkillPromotion`; copying a proposal JSON cannot bypass the store's module-private identity check.
- Added an end-to-end regression that ingests signed holdout outcomes into `VerifiedOutcomeLedger`, creates a genuinely accepted proposal, stages it via Core, runs a child through the real `OrganismRuntime` clock and durable registry, and writes a signed shadow observation in the per-run directory.
- The test asserts the observation is accepted only after Ed25519 signature verification plus candidate version, run ID, task, seed, manifest and runtime context binding; exactly one observation is appended and the candidate remains inactive (no automatic promotion).
- Registered the integration test in `package.json` and the continual-learning workflow.
- **Not claimed:** successful runner-backed CI/typecheck, production deployment of trusted keys/runner config, authenticated promotion authority, or any measured learning uplift. The signer in this regression is fixture-only; production private keys must remain outside NK1.

## WorkPass145 — wire production shadow runner configuration and signed observation ingestion (2026-10-21)

- Production `server.mjs` now reads `NEURO_SKILL_SHADOW_SCHEDULER_JSON` through a fail-closed configuration parser and passes the validated config to `OrganismRuntime`. No setting keeps the clock disabled; enabling requires an explicit candidate ID, task/version, runtime version, manifest/plan fingerprints and child command.
- The runtime scheduler now optionally reads a signed observation from a safe basename inside the fresh per-run directory, caps it at 1 MiB, rejects symlink/non-file paths, parses a JSON object and requires both observation and signed payload run IDs to match the supervisor-created run.
- Only then does the adapter call `OrganismCore.recordVerifiedSkillShadow`; the canonical candidate store still performs exact candidate-version, signature and independently persisted task/seed/manifest/runtime-context checks. Missing or rejected evidence is exposed through diagnostics and journal metadata.
- Added a config-parser regression for explicit opt-in, invalid JSON, missing candidate identity, malformed fingerprints, unsafe filenames, invalid inherited environment names and unknown fields. Added it to the P23 workflow alongside the existing real-runtime child/registry integration test.
- **Not claimed:** successful exact-head CI/typecheck, valid signed-observation end-to-end acceptance, promotion approval authority, production verifier-key provisioning, or learning uplift. Shadow scheduling remains disabled unless operators explicitly configure it.

## WorkPass144 — wire trusted shadow execution to the runtime clock (2026-10-21)

- Added `P23TrustedShadowLearningScheduler` and connected it to `OrganismRuntime` as a dedicated one-shot runtime clock. The execution path now goes through the Core-owned API that persists trusted run context before spawning the candidate/shadow child process.
- Scheduling is explicit opt-in through `RuntimeConfig.trustedShadowLearning`; no child process is launched by default. The clock gates launches on runtime lifecycle, awake state, cognitive budget, battery, RAM pressure and thermal strain.
- The runtime exposes last-run diagnostics, writes bounded execution-status journal events, and drains in-flight shadow work during shutdown. Each scheduled attempt gets a unique run ID and a seed that changes even if only the maintenance clock advances.
- Added a real `OrganismRuntime` integration regression that launches a child process and verifies the durable registry binds the same run/task/seed/manifest/runtime identity. Registered the regression in `package.json` and the P23 GitHub Actions workflow.
- **Boundary:** the process receipt remains execution-only. This change does not parse/accept signed skill observations, provide verifier keys or authenticated promotion approval, prove learning uplift, or claim CI/typecheck success.
 
## WorkPass143 — validate trusted verifier key algorithm at bootstrap (2026-10-21)

- `VerifiedSkillLifecycleBootstrap` now parses each configured PEM with Node's crypto key parser and accepts only Ed25519 public keys, matching the evidence verifier's `verify(null, ...)` signature mode.
- Malformed PEM and incompatible key algorithms now fail at startup instead of leaving a misleading non-empty trusted-verifier configuration that can never validate evidence.
- Extended bootstrap regression coverage for valid Ed25519 acceptance and RSA rejection, while preserving default-deny behavior for an empty key set.
- **Not claimed:** production key provisioning, authenticated promotion approval, successful CI/typecheck, scheduler integration, or learning uplift.

## WorkPass142 — close direct supervisor bypass for trusted shadow runs (2026-10-21)

- Hardened `runLearningProcess`: `candidate` + `shadow` execution now fails closed unless a host-owned trusted registrar is supplied, even when callers bypass the Core coordinator.
- Reject trusted-registration capabilities on baseline/control or other non-shadow lanes to prevent provenance contamination.
- Extended the real child-process regression to assert an unregistered candidate/shadow process cannot start. The existing continual-learning workflow already runs this regression; no duplicate CI step was added.
- **Not claimed:** deployed scheduler adoption of the Core API, verifier-key provisioning, authenticated approval, successful CI/typecheck, or learning uplift. These remain open P0s.

## WorkPass141 — exercise the Core-owned durable execution path (2026-10-21)

- Replaced the Core-entry test double with a real `OrganismCore` backed by `FileStateStore`; the test launches a real child process through the Core-owned candidate/shadow route.
- Assert the durable trusted-run registry contains the exact run/task/seed/manifest/runtime binding and that a new Core instance re-registers the same context idempotently after restart.
- Added fail-closed integration coverage: corrupt registry state rejects execution before the child can create its marker. Baseline/control remains rejected without changing trusted registry state.
- This proves the Core API and durable registry boundary together in a focused regression; it still does not establish that a deployed scheduler invokes the API. CI runner provisioning remains unverified.
 
## WorkPass140 — Core-owned trusted shadow execution entry point (2026-10-21)
- Added `OrganismCore.runTrustedSkillShadowLearningProcess(...)` as the runtime-facing route into the trusted coordinator. Callers cannot inject a different registrar; Core supplies its own registration hook.
- Added a regression that exercises the actual Core prototype method, checks context fields, runs a real child process, and rejects baseline/control lanes before registration.
- Wired the regression into the verified-promotion workflow. This establishes an official Core API, but does not claim an existing scheduler or deployed caller has adopted it; that route still needs to be identified and wired.

## WorkPass139 — enforce shadow-lane identity at coordinator boundary (2026-10-21)

- Restricted `runTrustedShadowLearningProcess` to the explicit `arm: candidate` + `method: shadow` identity before any registry call or child process spawn. The generic process supervisor remains reusable for ordinary benchmark/control runs; those lanes cannot accidentally gain trusted shadow provenance by using the coordinator.
- Extended the coordinator regression to reject baseline/control and non-shadow methods and assert the registrar is never called for rejected lanes.
- **Boundary:** this narrows accidental misuse but does not itself authenticate the host or wire a production caller. CI remains infrastructure-failed before steps (runner ID 0, empty steps); no tests/typecheck or learning uplift are claimed.

## WorkPass138 — canonical OrganismCore-to-supervisor trusted run bridge (2026-10-21)

- Added `TrustedShadowLearningRunCoordinator.ts` as the single typed host-side entry point that binds `OrganismCore.registerTrustedSkillShadowRun` to `runLearningProcess`.
- The coordinator requires the core registration surface and a host-supplied runtime version; it awaits durable registration before process spawn and propagates registry failures so no child is launched on failed registration.
- Added a focused regression covering host context binding, successful launch after registration, rejection on registration failure, and missing registrar rejection; wired the test into the P23 continual-learning workflow.
- **Boundary:** no pre-existing production caller of `runLearningProcess` was found in the current tree, so this creates the canonical integration entry point but does not prove that a deployed orchestration path invokes it. Production end-to-end execution, verifier-key provisioning, authenticated promotion approval, CI success and measured learning uplift remain unverified.

## WorkPass137 — register trusted shadow runs before learner process spawn (2026-10-21)

- Added an explicit host-owned trusted registration capability to `runLearningProcess`. When supplied, it persists run/task/seed/manifest/runtime identity before spawning the child process.
- Registration failures abort before spawn, so an unavailable trusted registry cannot produce a run that downstream code mistakes for a registered shadow execution.
- Added a focused supervisor regression and wired it into the P23 continual-learning workflow.
- **Boundary:** the runner's registration capability must still be bound by the production orchestration caller to `OrganismCore.registerTrustedSkillShadowRun`; repository search did not identify an existing production call site that constructs this supervisor invocation. No production end-to-end shadow run or learning uplift is claimed. CI/typecheck are not yet verified.

## WorkPass136 — production bootstrap for verified skill shadow lifecycle (2026-10-21)

- Configure the canonical P23 learner at OrganismCore construction with durable candidate storage and a durable trusted-run registry.
- Bind signed shadow receipts to independently persisted run/task/seed/manifest/runtime context.
- Load trusted verifier public keys from `NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON`; absent keys reject evidence and malformed configured keys fail startup.
- Keep promotion authorization explicitly default-deny until an authenticated approval authority is integrated.
- Expose internal core hooks for the trusted supervisor to register run context before receipt ingestion and then submit verified shadow observations.
- Add a focused bootstrap regression and CI wiring. Test execution and typecheck still require a successful runner.

## WorkPass133 — isolate bootstrap uncertainty from incomplete seeds (2026-10-21)

- Corrected the deterministic seed-cluster bootstrap identity: only complete paired seeds that actually contribute to the estimate now determine its resampling stream. Incomplete seed records remain excluded from the estimate and no longer perturb the interval for an otherwise identical complete sample.
- Added a regression that builds the same complete paired sample with and without extra incomplete-seed evidence and asserts identical bootstrap intervals.
- Research refresh: inspected the published SkillLearnBench evaluation structure and the public retention-bench / AgentMemoryBench descriptions. Adapted only evaluation protocol ideas: separate skill/trajectory/outcome evidence; test hard-reset survival separately from stored-record persistence; report online, replay, transfer and repair modes independently. No upstream code or dataset was copied.
- **Verification status:** source and regression committed to the work branch; execution, typecheck and exact-head CI still need confirmation. No measured learning uplift is claimed.

## WorkPass132 — deterministic seed-cluster bootstrap sensitivity (2026-10-21)

- Added a reproducible percentile bootstrap interval over seed-level aggregates in `VerifiedOutcomeLedger.comparePairedBySeed` and family-stratified comparisons. The resampling unit remains the independent seed, not correlated task cells or retries.
- Sorted seed aggregates before resampling and added a reverse-arrival-order regression, so identical evidence produces identical intervals regardless of ingestion order.
- Skill-promotion eligibility now requires positive lower bounds from both the existing small-sample Student-t interval and the bootstrap sensitivity interval, alongside the existing gain and evidence gates.
- Added regression assertions for deterministic intervals, interval coverage of the observed mean, no interval with a single seed, and bootstrap-backed promotion.
- Research adaptation: the controlled-comparison and multi-level diagnosis principles from SkillLearnBench, plus bootstrap/strong-baseline discipline in replay evaluation protocols. No upstream code or dataset copied.
- **Verification status:** code and regression sources committed; execution/typecheck/exact-head CI still pending confirmation. This changes measurement rigor, not proven learning quality.

## WorkPass131 — bind signed shadow receipts to trusted execution identity (2026-10-21)

- Adapted the in-toto attestation principle of binding authenticated claims to explicit subjects: shadow receipts now have to match trusted run ID, task ID, random seed, manifest fingerprint and runtime version supplied by an independent resolver.
- Added restart/promotion regressions for run, task, seed, manifest and runtime mismatches. No upstream code was copied and no runtime dependency was added.
- **Verification status:** source and tests committed; local test/typecheck and exact-head CI are not yet confirmed. Production trusted-run resolver and approval authority remain open.

## WorkPass116 — seed-clustered verified learning comparisons (2026-10-20)

- Added `VerifiedOutcomeLedger.comparePairedBySeed` and `comparePairedByFamilyAndSeed`. The independent statistical unit is now a seed-level aggregate rather than each correlated task cell.
- Requires complete attempt-1 baseline/candidate coverage for the exact task set within a seed; incomplete seeds are excluded as a whole, and retries cannot inflate sample counts or silently replace the primary attempt.
- Uses a small-sample Student-t interval across paired seeds and reports no interval for a single seed. Existing task-cell APIs remain available for compatibility.
- Added `p23-seed-clustered-outcome-comparison.mjs`, registered the npm script, and wired the regression into the continual-learning workflow.
- Evidence boundary: this fixes the statistical unit and missing-cell handling in the evaluation path; it does not demonstrate real-world learning uplift. Exact-head Actions and runtime typecheck are pending.

## WorkPass115 — matched hard-reset retention evaluation (2026-10-20)

- Added `ResetRetentionEvaluation.ts` to compare independently verified task outcomes across stateless prior `P`, uninterrupted ceiling `C`, and reset-survival `R(k)` arms on the same manifest/task/seed.
- Computes normalized retention `(R-P)/(C-P)`, excludes saturated/unlearnable tasks where `C-P` is too small, stratifies by task family, and derives uncertainty from seed-level aggregates rather than treating task cells as independent samples.
- Requires independent-verifier evidence references, score bounds, stable task-family identity, unique observations and complete matched arms. Added an adapter from the canonical `VerifiedOutcomeLedger`, binding the evaluation to its full manifest fingerprint and selecting only the requested split; duplicate attempts require an explicit selection policy rather than silent latest-wins behavior.
- Added direct-fixture and ledger-adapter regressions and wired them into the continual-learning workflow for PR and branch pushes. The module evaluates supplied outcomes; it does not itself kill/restart the process, and deterministic fixtures are not evidence of real NK1 retention or skill abstraction. Await exact-head CI before calling this pass validated.

## WorkPass114 — paired continual-learning uncertainty without pseudo-replication (2026-10-20)

- Corrected `ContinualBenchmarkComparison.ts`: the prior implementation flattened every task score across paired runs before computing the confidence interval. Since tasks within a run share the same seed, that could treat correlated task cells as independent observations and make uncertainty look artificially small.
- The comparison now averages task success and forgetting within each run first, then calculates paired deltas and 95% Student-t intervals across matched seeds. Small samples use conservative t critical values (including df=1), rather than the overly narrow normal approximation; one paired run produces no confidence interval. `pairedN` now consistently means matched independent runs for both metrics.
- Preserved strict pairing by manifest fingerprint and seed, identical task-set checks, duplicate-run rejection, and reporting of unpaired runs. Expanded regressions for run-level sample counts, interval behavior and invalid same-method comparisons; CI triggers on push for the comparison test too.
- This is a statistical-validity correction, not a learning-performance gain. No replay strategy or promotion threshold was changed; the learning score remains unchanged until real verifier-backed matched-seed outcomes exist.

## WorkPass113 — task-family stratification for continual learning (2026-10-20)

- Added family-level checkpoint summaries to `ContinualOutcomeMatrix.ts`: pooled verified pass counts/rates per stage plus family-level forgetting and backward transfer.
- This makes aggregate regressions harder to hide: a replay strategy that improves memory tasks but harms transfer tasks can now be inspected by family instead of relying only on the overall mean.
- Added a regression that checks family-specific final pass rates and forgetting. Pooled counts are reported without a misleading pooled confidence interval because task outcomes may not be independent.
- CI caught two integration issues: the missing-cell fixture needed a full two-stage sequence after the new cardinality guard, and the new workflow still used deprecated Node 20-based Actions v4. Both were corrected; rerun exact-head CI before marking this pass fully validated.
- Still measurement infrastructure only: no live learner was run, no replay policy was promoted, and the overall learning score is unchanged.

## WorkPass112 — matched-seed evidence matrix and uncertainty reporting (2026-10-20)

- Fixed a malformed pre-training fixture that accidentally passed a boolean as the seed ID; the test now supplies the same explicit seed set to every task/method cell.
- Expanded the continual outcome adapter with per-task/per-stage counts, pass rates, task-family identity and Wilson 95% intervals. Small samples remain visibly uncertain instead of collapsing to a single pass-rate point estimate.
- Added regression assertions for exact seed pairing, baseline parity, train/holdout isolation, missing baseline cells and cell-level intervals. This remains evidence-pipeline code; the fixture does not measure live learner performance.
- Research adaptation: AgentMemoryBench separates online, replay, transfer and repair modes; SkillLearnBench separates skill quality, trajectory quality and verified task outcome; retention-bench emphasizes process resets and distinguishing stored records from integrated learning. NK1 now exposes more granular outcome evidence, but still needs a real runner, independent tasks, and process-reset experiments. No upstream code/data copied in this pass.

## WorkPass111 — verifier-ledger to continual-learning matrix (2026-10-20)\n\n- Added `ContinualOutcomeMatrix.ts`, an adapter that builds task-by-checkpoint score matrices from `VerifiedOutcomeLedger` evidence instead of hand-entered scores. It filters to the selected split and attempt 1, accepts only independent-verifier or human-review authority, and binds output to the exact manifest fingerprint.\n- Enforces unique stage IDs/methods, complete task × stage coverage, and identical seed sets for every cell; retries cannot inflate scores and mismatched seed sets fail closed. Optional pre-training baseline produces forward-transfer inputs without fabricating missing values.\n- Added regression cases for matched-seed aggregation, train/holdout isolation, missing cells, duplicate stage definitions and uneven seed sets. This adapter still consumes recorded evidence; it does not execute the learner or independently retrieve/validate external artifacts.\n\n## WorkPass110 — continual-learning retention and transfer metrics (2026-10-20)

- Added a reusable sequential-task metric module reporting final average score, peak-to-final forgetting, backward transfer, and forward transfer relative to an explicit reference policy.
- Enforces a square task-by-stage score matrix, unique task identities, finite [0,1] scores and explicit handling of missing pre-training baselines; unavailable forward-transfer values remain null rather than being fabricated.
- Added focused regression coverage and wired it into the full P23 verified-outcome suite. The module consumes measured scores; it does not itself run a model or establish NK1 performance.
- Research adaptation: continual-learning evaluation commonly separates final competence from forgetting and transfer. This is an NK1-local metric implementation, not copied benchmark code. Use the same tasks/seeds and a fixed reference policy before comparing replay strategies; do not compare results across changed task manifests.

## WorkPass109 — signed verifier outcome artifacts (2026-10-20)

- Added Ed25519 signed outcome artifact verification, binding each payload to the exact task-manifest fingerprint, task version, verifier identity, run ID, task/method/seed/attempt and outcome.
- Only keys explicitly supplied in the trusted verifier-key registry are accepted. Tampered payloads, unknown keys, manifest drift, version/verifier mismatch, malformed artifacts and duplicate attempts are rejected before they can enter the ledger.
- Added focused fixture tests for valid signatures, tampering, wrong manifest, unknown verifier keys, version mismatch and duplicate replay; wired into the P23 suite and CI.
- This is a verification primitive, not a production trust-root deployment: independently fetching artifacts, key rotation/revocation, verifier governance, and learner/promotion integration remain open. Private keys must stay outside NK1.

## WorkPass108 — collision-safe paired evaluation and manifest binding (2026-10-20)

- Replaced delimiter-concatenated paired-outcome identity with JSON tuple encoding for `[taskId, seed, attempt]`, so unusual task identifiers cannot accidentally merge independent evaluation cells.
- Added `VerifiedOutcomeLedger.manifestFingerprint()`: a stable SHA-256 digest over sorted, versioned task-manifest fields. It changes when task prompt fingerprints, versions, verifier IDs, family assignments or evaluation splits change, and is independent of manifest insertion order.
- Added regressions for separator-bearing task IDs, exact paired sample count, manifest order stability and digest invalidation after task/version/verifier/split/prompt changes. Wired both tests into the full P23 verified-outcomes suite and the WorkPass108 workflow.
- This digest provides a stable manifest binding token for future verifier-run artifacts. It is not a signature and does not authenticate who generated an artifact; trusted verifier execution, artifact retrieval and production learner integration remain open.
- No replay defaults or automatic promotion changed. Scores remain unchanged until outcome-based benchmark runs demonstrate task success, retention and transfer.

## WorkPass105 — verifier-grounded outcome ledger (2026-10-20)

- Added `VerifiedOutcomeLedger.ts`: versioned task manifests, normalized SHA-256 prompt fingerprints, cross-split duplicate-prompt leakage rejection, version/verifier/evidence provenance checks, self-report rejection, duplicate-attempt protection, and paired baseline/candidate comparisons.
- Paired summaries report sample size, pass rates, absolute gain, discordant wins, and approximate 95% intervals. Pairing is keyed by task, seed, and attempt to avoid comparing mismatched trials.
- Added `tests/p23-verified-outcome-ledger.mjs`, package script `test:p23:verified-outcomes`, and dedicated Node 24 Actions workflow.
- Synthetic fixtures validate the evaluator contract only; they are not evidence of NK1 task performance. The ledger is not yet wired to production training or persistence; no model weights, replay defaults, or skill promotion rules changed.
- Research adaptation: SkillLearnBench's separation of skill/trajectory/outcome evaluation and continual-learning benchmarks' same-sequence comparisons inspired the local verifier-first contract. No third-party code or datasets were copied.

## WorkPass104 — multi-seed replay proxy summary (2026-10-20)

- Expanded the reservoir comparator from five hand-picked seeds to 50 deterministic seeds and added mean, sample standard deviation, and approximate 95% intervals for selection-composition metrics.
- The summary includes historical/post-shift coverage, oldest-stream representation, context/action strata, and mean surprise. Assertions check the reported seed count and interval arithmetic.
- These intervals describe variation between this fixed set of sampler seeds only. They are not task-outcome confidence intervals and do not establish improved learning, retention, or transfer.
- No production policy/default changed; outcome-grounded same-stream evaluation remains the P0 gap.

## WorkPass103 — replay baseline robustness and CI repair (2026-10-20)

- Fixed WorkPass102 workflow setup: `actions/setup-node@v7` enables package-manager caching by default, but this repository has no root npm/yarn lockfile. Disabled package-manager caching for this dependency-free Node 24 harness rather than inventing a lockfile.
- Added a deterministic multi-seed inclusion-frequency regression for Algorithm R. Across 400 seeds it checks that no stream-position inclusion rate deviates grossly from expectation; this is a statistical sanity guard, not evidence of task-learning uplift.
- CI was rerun after the workflow fix; the exact-head run is pending/active at commit `71c3b6a0e631aead7305b8ac28eef66d884a9497` and must not be called PASS until completed.
- The reservoir remains an experimental baseline; no replay default or production training behavior changed.

## WorkPass101 — age-aware replay ablation (2026-10-20)

- Added optional logical-tick half-life discounting to historical surprise priority; the default remains unchanged.
- Made context/action stratum identity collision-safe with JSON tuple encoding and hardened tick ordering for non-finite values.
- Added regression cases for stale high-surprise vs recent moderate-surprise selection, invalid half-life fallback, deterministic output, and delimiter collisions.
- The existing shared selector is still the canonical owner used by runtime and benchmark; this is not a second implementation.
- Evidence boundary: the tests validate selection mechanics only. They do not establish higher task success, better transfer, or reduced forgetting. Keep age discount disabled until same-stream task-outcome ablations justify a setting.

## WorkPass100 — shared configurable continual-learning replay (2026-10-20)

- Extracted the P23 replay selection into `ReplaySelectionPolicy.ts` and wired the runtime to that shared implementation, eliminating the risk that benchmark logic and production selection drift apart.
- Added a typed runtime configuration seam for deterministic ablations. Defaults stay at 64 samples maximum / 32 recent; configured capacity is clamped to 1–64 and recent quota to 0–capacity.
- Added standalone regressions for selector invariants and runtime configuration; expanded the benchmark to compare recent-only, surprise-only, and multi-timescale selection with recent quotas 16, 32 and 48.
- Updated `docs/P23_CONTINUAL_LEARNING_SCORECARD_2026-10-20.md` with current engineering estimates, research comparisons and the evidence boundary.
- Research adaptation: ARB (AISTATS 2026) motivates future policy-alignment-aware replay, but it is not copied wholesale; adding it safely requires verified outcome provenance and controlled task-stream comparisons.
- **Exact tested code head CI PASS:** `891e56f58373377ea6a325552fe2d1e389f6d71b`. [Replay selector + 16/32/48 quota sweep](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39421560741), [Node 24 + continual skill learning](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39421553511), [cognitive runtime regression](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39421553534), and [verification input binding](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39421553538) all passed on the same code head. Later scorecard/changelog commits are documentation-only.
- Evidence boundary: selector coverage and synthetic batch composition are implementation evidence only; no independent task-success, retention, transfer or production-learning uplift is claimed.

## WorkPass93 — harden core ownership exemption and add durable checkpoint (2026-10-20)

- Replaced the field-name-only constructor exemption with an exact field + constructor policy: `operationalMicroCycle:OperationalMicroCycleRuntime`.
- Added an executable adversarial regression guard to `audit-core-ownership.mjs`: only the exact documented pair is exempt; a mismatched constructor, renamed field or unrelated owner is counted.
- Added durable continuation/evidence report: [WorkPass93 checkpoint](docs/WORKPASS93_CHECKPOINT_2026-10-20.md).
- Code commits: `8bcffba1511e1327ae71f7500295d31ccffa3c73` (policy module), `ce804abde19ccd20868cd579032431550ca1c35a` (audit integration).
- Validation boundary: exact-head CI for WorkPass93 must be checked before marking this pass validated. The prior WorkPass92 CI run is a baseline only, not evidence for these changes.
- Remaining gates are unchanged: live llama.cpp on Dell G3, independent RU/EN retrieval uplift, learning transfer/anti-forgetting, restart-safe action proof, browser/Live2D/TTS E2E, soak, packaging and release security.

## WorkPass92 — enforce core ownership audit in CI (2026-10-20)

- Wired the existing audit:core-ownership into the regression workflow. The first run exposed a diagnostic defect: it printed PASS before applying the constructor ceiling, then failed. The report now computes the final status after all gates and lists the direct constructor owners.
- The audit showed six direct constructors, including the explicitly documented OperationalMicroCycleRuntime orchestration owner. The ceiling now counts the other five and names the single explicit exception; this is not a blanket increase of the limit.
- Exact-head CI PASS: https://github.com/ailtron1ss-rgb/NK1/actions/runs/39380982918, code head 04f16761704760a6c347a77e113a7a9221b661fe. CORE_OWNERSHIP=PASS errors=0 directConstructors=6 countedDirectConstructors=5 and all other workflow steps passed.
- This is architecture-boundary/integrity evidence, not proof of end-to-end cognitive quality. No global readiness score is increased by the audit alone.

## WorkPass91 — memory-to-action evidence path (2026-10-20)

- Added a deterministic sandbox integration regression that composes the canonical MemoryOS2 current retrieval/revision/snapshot-restore path with the production ActionGateway and its durable idempotency ledger.
- Scenarios cover an explicit preference correction, suppression of the superseded preference, retrieval after memory restore, missing evidence requiring clarification, grounded action arguments, a verified in-memory tool result, and no duplicate execution after restoring the action ledger.
- Wired the regression into the existing cognitive Actions workflow.
- First exact-head run exposed a test-oracle bug: the harness did not check whether the current query matched the memory's topic. The oracle now checks query-topic relevance, and the regression passes without weakening assertions.
- **Exact-head CI PASS:** [Actions run 39380460196](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39380460196), test commit `12ed8ee0029c9c62d5abaef1141d403d68fcc34e`. Log confirms corrected preference retrieved, superseded preference suppressed, snapshot restore works, missing evidence yields `clarify`, sandbox action verified, restored receipt preserves execution ID, and executor count remains 1.
- Evidence boundary: the scenario oracle is test-only, not proof that the live autonomous planner already performs this mapping correctly. All side effects are in-memory; no external tool is called. No retrieval uplift, learning gain, live LLM performance, or consciousness claim is made.

## WorkPass88 — reject silent benchmark-label truncation (2026-10-20)

- Retrieval benchmark reports now count source rows whose IDs, query text, or relevance labels exceed canonical bounds; bounded diagnostic execution is allowed, but `datasetIntegrity.validForPromotion` becomes false.
- Bumped benchmark report schema to v5 and added a regression with 25 relevance IDs, ensuring truncating the 25th label cannot silently authorize promotion.
- Synthetic fixture/harness-only change: no external-data quality uplift is claimed. Exact-head Actions verification is recorded in the handover below.

## WorkPass83 — проверка честности retrieval benchmark (2026-10-20)

- Добавлен `tests/workpass83-retrieval-benchmark-truth.mjs`: фиксированный двуязычный корпус из 12 воспоминаний, 4 train-запроса и 8 holdout-запросов, сопоставление метрик кандидата с Okapi BM25 и bootstrap-конфигурацией.
- Регрессия подтверждает, что offline benchmark не мутирует live MemoryOS2; train/holdout query leakage блокирует promotion; статус promotion согласован с набором gates.
- GitHub Actions run [39372815361](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39372815361) — PASS: benchmark test, memory residency, provider policy/boundary, end-to-end cancellation и server HTTP smoke.
- Synthetic fixture получил Recall@3/MRR 1.0 у обеих сторон. Это только проверка harness и не независимое evidence retrieval uplift; наблюдаемая разница равна нулю, качество не повышено.
- Следующий gate — независимый, версионированный RU/EN holdout с заранее зафиксированными relevance labels и сравнением Recall@k/MRR; затем live llama.cpp на Dell G3, process restart/recovery, transfer/anti-forgetting и soak.

---

## WorkPass79 — локальная устойчивость языкового контура (2026-10-20)

- Добавлен отдельный регрессионный набор для канонического `LocalLanguageBackendPolicy`: локальный backend имеет приоритет, ошибка переводит его в cooldown, повторные ошибки увеличивают паузу по ограниченной экспоненте, посторонние сбои не приписываются llama.cpp, успешный ответ сбрасывает breaker.
- Добавлен тест реального интерфейса `OpenAICompatibleLocalChatProvider`: фактическая идентичность модели, bounded max_tokens/temperature, HTTP 503, malformed JSON, пустой ответ, лимит 2 MiB, timeout AbortSignal и запрет не-loopback endpoint/redirect.
- Подключены `test:workpass79:local-language-policy`, `test:workpass79:provider-boundary` и агрегирующий `test:workpass79` в runtime `package.json`.
- Добавлен GitHub Actions workflow `.github/workflows/workpass79-cognitive-regression.yml` для policy-регрессии, границ provider и HTTP smoke существующего серверного пути с контролируемым локальным провайдером.
- Первый Actions run подтвердил policy-тест, но выявил ошибку окружения workflow: Node 22.12 не экспортировал `node:sqlite`, который импортирует сервер. CI обновлён с жёсткого `22.12.0` на актуальную линию Node 22; это устраняет известную причину запуска, но повторный run ещё должен подтвердить результат.
- Это узкий reliability-pass, не заявление об улучшении качества генерации, когнитивном обучении или готовности организма к релизу.

---

## WorkPass72 — memory residency, verification-gated learning and source cleanup (2026-10-19)
- Fixed a candidate-budget off-by-one in revision/graph expansion: both now check the 192-item cap before insertion, with a fail-fast invariant and diagnostic-rich regression assertion.
- Fixed a resource/residency defect in `MemoryOS2.retrieve()`: cold candidates were assigned freshly rebuilt hash vectors and promoted to warm even though the hash similarity was not part of ranking.
- Removed the non-ranking hash-cosine computation from retrieval. The legacy persisted `semanticHits` field remains schema-compatible but is no longer incremented by that misleading proxy.
- Strengthened `p2697-mobile-residency.mjs` to require unchanged vector materialization and unchanged tier counts across a retrieval.
- Expanded GitHub Actions to run the memory retrieval, query-intent, residency, background-index and embedding-privacy regressions.
- Added `AGENTS.md` as the canonical working guide and an exact-hash cleanup inventory. Removed the 21 manifest-listed Live2D shadows from `app/public` after confirming SHA/size parity and automatic hash-verified hydration; 16,690,663 bytes of duplicate tracked payload removed. The remaining 18 exact duplicate groups (39 excess paths) are preserved pending individual reference/provenance review.
- Expanded CI exposed fixed-time fixture errors in numeric and fuzzy retrieval: both seeded 2033 timestamps while calling `temporalMode: 'current'`, which deliberately uses wall-clock time and ignores `asOfAt`. Both tests now use explicit point-in-time mode; a further CI pass is required.
- Gated adaptive memory-policy learning on independently verified delayed outcomes; unverified observations get zero policy reward and do not mutate adaptive policy state; the decision stays pending until independently verified evidence arrives, allowing delayed verification to learn from the original decision. Added separate attempt/resolution diagnostics and regression coverage. Restore discards legacy reward aggregates when snapshots lack verification provenance and safely normalizes malformed counters. CI now includes real semantic-embedding retrieval, cognition-facing semantic integration, delayed policy credit and organism-level policy decision flow.
- Follow-up provenance audit found that replay validation still accepted a caller-supplied `independentVerified: true`; a verifier-issued external-postcondition result is now required, with identity-bound capability checks, late-proof promotion and idempotent causal-credit upgrade. The new regression is committed and awaiting CI.
- This is a residency/resource correctness pass, not a retrieval-quality uplift or production approval. Independent labelled retrieval evidence remains open. The P2684 residency regression specifies that retrieval leaves cold records cold and explicit `get()` owns vector materialization.

---

## WorkPass71 — retrieval benchmark corpus parity (2026-10-19)
- Fixed an evaluation fairness defect: BM25 filtered malformed rows, while the MemoryOS2 candidate previously restored them. Invalid rows could occupy top-k positions in only the candidate arm. Candidate now restores the exact validated corpus used by BM25; malformed/truncated input still blocks promotion.
- Truncated input still fails the corpus-integrity/promotion gate; this change improves diagnostic comparability and does not make truncated evaluation eligible.
- Added regressions for a 1,601-row cap boundary and malformed-row parity, proving both arms see the same valid corpus.
- Added the retrieval experiment regression to WorkPass71 GitHub Actions validation.
- Added `docs/WORKPASS71_HANDOVER_2026-10-19.md` with current ownership/navigation, safe cleanup rules and next work queue.
- No recall uplift or release-readiness improvement is claimed; CI result and independent holdout remain required.

---

## WorkPass 70 hotfix 1 — grapheme timing and continuum timescales (2026-10-19)
- Fixed speech viseme segmentation to use grapheme clusters, while preserving the UTF-16 offsets emitted by browser SpeechSynthesis boundary events.
- Added an explicit exclusive end offset for each grapheme frame; boundary indices inside combining/ZWJ sequences now map to that grapheme rather than the following frame.
- Preserved the original UTF-16 positions across CR/LF/tab runs by replacing whitespace characters individually instead of collapsing the run.
- Fixed a continuum-memory expression precedence bug: nullish-coalescing previously captured the subtraction's right operand, so the expert used fast/medium values rather than the intended fast-minus-medium and medium-minus-slow differences.
- Added regression coverage for combining marks, regional-indicator flags, ZWJ emoji, whitespace offsets and the continuum timescale calculation.
- Scope remains an implementation hotfix. Real browser/Live2D playback timing, Android TTS timing, independent retrieval uplift and production release gates remain open.

---

## WorkPass 69 — keyed physical speech interruption and UI (2026-10-19)
- Removed the duplicate `android.speak` physical executor; legacy calls resolve to the single canonical `organism.device.speak` owner.
- Added `organism.device.speech.interrupt`, a target-bound, idempotency-keyed ActionGateway action. Ambiguous termination remains unknown; an accepted request explicitly does not prove that Android audio is silent.
- Exposed `POST /api/organism/voice/interrupt`, `neuroApi.voiceInterrupt`, and an `Interrupt speech` operator control.
- Extended controlled Termux process concurrency tests and actual server/UI smoke coverage. No-ticket direct speak/listen/turn requests retain approvalRequired behavior.
- Runtime `35.89.0`, schema `225`. Runtime typecheck, TTS tests, server-smoke and UI-smoke pass. Real Android audio, production app build/browser/Live2D E2E, live provider/device and independent retrieval uplift remain open; weighted roadmap stays 80.1%.

---

## WorkPass 70 — unified embodiment intent and speech timeline (2026-10-19)
- Replaced separate parent-to-viewer lipsync, expression and body postMessages with one protocol-versioned `kurisu_embodiment_intent` v1 envelope and a JSON schema. The contract carries stateVersion, speechEventId, audioClockId, phase, audioTimeMs, expression, mouth, gaze, body motion, priority and a target-bound cancellation token.
- Replaced one-word-at-a-time mouth pose changes with a Russian/English grapheme-viseme timeline sampled from one monotonic clock. `SpeechSynthesis` boundary `charIndex` re-anchors text timing, and boundary `elapsedTime` anchors the audio-time clock when available. This remains approximate because the browser API exposes no PCM/phoneme stream.
- Added viewer stateVersion rejection of stale messages, monotonic audio-clock protection, strict cancellation-token binding, and target model reset on ended/cancelled/unknown states.
- Added stale callback guards across new-turn, stop, voice selection changes and iframe remount; a fresh `live2d_ready` handshake replays the current embodiment state into the new viewer instance.
- Added nine regression tests for English/Russian pose classes and viewer message-handler state transitions, UTF-16 boundary indices, monotonic re-anchoring, clock sampling, strict intent validation, stale callback ownership, and schema/channel alignment. The helper passes strict TypeScript checking.
- Scope caveat: this is a deterministic browser speech timeline synchronized to available SpeechSynthesis boundary events, not phoneme-perfect PCM analysis. Production browser E2E, dependency-complete app build, actual Live2D model parameter timing and real Android/Termux audio clock remain open.

---

# Changelog

## WorkPass 67 — 2026-10-19
- Removed the unused direct dependency `@hookform/resolvers`: no active app source imports resolver functions, and the package introduced an unnecessary optional `ajv@^8` peer against the Ajv 6 line needed by ESLint.
- Removed only the resolver and its now-unreferenced `@standard-schema/utils` lock entries; kept ESLint's required Ajv 6 entries intact.
- Added a no-network dependency contract test covering package/lock alignment, absence of stale resolver entries, active-source import scan and SBOM consistency.
- Fixed `install:all` deadline enforcement: timed-out npm process groups are terminated as a unit (TERM, then KILL escalation), and the installer exits fail-fast instead of hanging on descendant-held streams. Added a regression proving the child process does not survive timeout.
- Regenerated SBOM/source provenance and runtime release/architecture/archive manifests for runtime `35.87.0`, persisted schema `225`.
- Registry DNS remains an external blocker for complete `npm ci` and production Vite build; browser/Live2D E2E and live provider/device acceptance remain open.

---

## WorkPass 65 — 2026-10-19
- Tightened archived receipt revision authorization: revision must preserve key/request/execution/tool identity and use a finite monotonic timestamp.
- A reconciled flag alone is no longer accepted as proof: revisions require a bounded provider receipt ID or the explicit authoritative `confirmed-not-executed` terminal state.
- Added regression coverage for evidence-free forged revisions; retained unresolved recovery and restart/replay coverage.
- Release gates remain open; no live provider/device or browser production build is claimed.

# WorkPass 64 — archived receipt reconciliation and recovery retention (2026-10-18)

- Stop spilling unresolved/unverified action outcomes out of the hot ActionGateway ledger. Verified results, explicit no-effect outcomes and authoritative provider-confirmed absence remain eligible for disk archive; if no safe victim exists, admission fails closed before another mutating adapter call.
- Add checksum-protected append-only archive revisions for authoritative reconciliation of a legacy archived unresolved receipt. Revision is permitted only with the same request hash, tool ID and execution ID, and only while the older outcome remains unresolved; verified terminal receipts and identity changes cannot be rewritten.
- Merge archived and hot-ledger metadata into the read-only redacted recovery count/snapshot so legacy unresolved entries remain visible and the newest archived revision overrides stale snapshots.
- Add `workpass64-archived-receipt-reconciliation.mjs` and preserve prior archive, WorkPass63 filesystem lost-ACK, WorkPass62 SIGKILL and WorkPass61 evidence-revision regressions. Bound child-process fault-test execution with process-group cleanup on timeout so a lost close/pipe event cannot hang audits indefinitely.
- Runtime typecheck and focused regression suites pass. This is an implementation pass, not release approval; live provider/device, production UI/browser/Live2D, independent retrieval quality, rollback/license review and soak remain open.

---

# WorkPass 63 — Action uncertainty firewall + real filesystem recovery (2026-10-18)

- Hardened ActionGateway so keyed mutating adapter exceptions and `ok:false` responses without explicit no-effect evidence keep the durable execution pending for read-only reconciliation; trusted adapters can explicitly report `failed-no-effect` or `executed-partial`.
- Unverified/contradicted/partial completed outcomes remain visible in the redacted read-only recovery queue. Reusable skill execution pauses on unresolved postconditions, blocks fallback mutations, and suppresses incorrect skill-repair/learning signals.
- Fixed reconciliation finalization split: a pending-first action with a later authoritative receipt creates one canonical action/outcome/evidence record; receipts arriving after an already-finalized outcome use the existing append-only evidence-revision path.
- Added `workpass63-filesystem-side-effect-recovery.mjs`: separate durable target and provider receipt files; lost ACK after actual target write; new child process restores runtime, reads the provider receipt without re-execution, independently reads target state, retains original `executionId`, and proves one external mutation after replay.
- Runtime typecheck, WorkPass63 uncertainty/skill tests, filesystem recovery E2E, WorkPass61 core-reconciliation regression and WorkPass62 two-SIGKILL suite pass.
- **Not release approval:** the test uses a temporary local filesystem target, not a real remote provider/device; production app dependencies could not be installed because npm registry DNS/network resolution is unavailable in this environment. Browser/Live2D E2E, independent memory holdout, rollback, license review, target GPU profiling and soak remain open.

---

## WorkPass 62 — process-kill recovery and visible ActionGateway recovery queue (2026-10-18)

- Added a read-only, redacted unresolved execution queue in `ActionGateway`, exposed through `OrganismCore`, an authorized API route and Runtime Atlas. It shows reconciliation availability and operation age without exposing raw inputs, key hashes, request fingerprints or provider payloads; it does not retry actions.
- Added a genuine child-process SIGKILL integration: simulated provider accepts a side effect and the process dies before ACK; after restart, read-only reconciliation confirms the state without executing twice.
- Added a second crash window after evidence finalization but before the completed receipt commits. The next process recovers the prior pending receipt, reuses the same execution identity, deduplicates the evidence revision, and eventually commits one completed receipt.
- Verification: runtime typecheck and `test:workpass62` pass. The app typecheck could not run because app dependencies are absent in this environment; production Vite/browser/Live2D E2E and real provider/device checks remain open.
- Runtime `35.82.0` / persisted schema `225`. WorkPass62 is **8/8 scoped code deliverables (100%)**; weighted roadmap rises from `79.3%` to `80.1%` (+0.8 p.p.). This is not release approval.

---

## WorkPass61 — authoritative provider receipt evidence revisions (2026-10-18)

- Added a bounded, append-only evidence revision ledger to OutcomeCognitionFabric for authoritative provider-found receipts; base execution/outcome fingerprint remains immutable.
- Added evidence-revision nodes and supersedes edges to CausalAccountabilityGraph.
- Added sanitized, persistent tool-reconciliation revision events to CognitiveEventFabric without rewriting the canonical action/outcome/evidence trio.
- Wired OrganismCore reconciliation finalization through the revision contract; exact replay deduplicates, changed payloads conflict, and provider side effects are not executed again.
- Preserved revision ledger and trace references across snapshot/restore and state migration.
- Verification: `npm run test:workpass61` PASS. Live provider/device, physical process restart, production UI E2E and remaining release gates stay open.

# WorkPass 61 — 2026-10-18

- Added a dedicated append-only `OutcomeProjectionEvidenceRevision` for authoritative provider-found receipts. A new receipt strengthens or disputes knowledge for the same `executionId` without changing the immutable original outcome fingerprint or receipt record.
- `CausalAccountabilityGraph` now adds deterministic `evidence-revision` nodes and explicit `supersedes` edges; replay of the same provider receipt maps to the existing revision, while the same receipt ID with changed evidence is rejected.
- `CognitiveEventFabric` appends a sanitized `tool-reconciliation` evidence revision parented by the original canonical outcome. The original `tool-action` / `tool-outcome` / `tool-evidence` event IDs and projection hash remain immutable. Revision IDs and events survive snapshot/restore; the bounded revision ledger fails closed rather than evicting idempotency references.
- `OrganismCore.finalizeToolOutcome` routes authoritative provider receipt results through the revision contract rather than calling `OutcomeCognitionFabric.project` with a conflicting changed fingerprint. Provider receipt IDs are stored as hashes in cognition/CEF revision records.
- Added direct replay/conflict/migration coverage and an integration test that starts with an executor failure, reconciles an authoritative `found` receipt, verifies no duplicate execution, and checks durable revision state.
- Runtime bumped to `35.81.0`; schema remains `225`. WorkPass61 closes the previously open code-level provider-found finalization gap. Real provider/device restart E2E and all remaining release gates remain open.
- **WorkPass61: 8/8 scoped code deliverables (100%).** Overall weighted roadmap rises from `78.8%` to `79.3%` for code-path completion only; this does not count as live adapter validation or release approval.

---

# WorkPass 60 — 2026-10-17

- `AutonomousProjectExecutor` now persists a versioned active project-step checkpoint containing project/step/tool identity, request fingerprint, stable operation key, `decisionId`, stage and correlation data. Snapshot schema moved from v6 to v7 with compatibility restore for v6 snapshots.
- `OrganismCore.executeProjectTool` reuses the checkpoint identity on resume, blocks payload changes while a prior side effect is unresolved, and attempts read-only provider reconciliation instead of dispatching the action again.
- Project status exposes a redacted active-operation state without returning the secret-like operation key or request fingerprint.
- `ActionGateway` can request provider reconciliation for a previously completed-but-unverified receipt. Unknown provider status preserves `reconciliation-required`; it is not treated as proof that no side effect occurred.
- Added focused checkpoint and reconciliation-resume tests, WorkPass60 script aliases, current status, progress scorecard, handover and release metadata.
- **Known blocker:** a later authoritative `found` receipt still collides with `OutcomeCognitionFabric`'s changed-fingerprint guard for the same `executionId`. The runtime fails closed; a first-class append-only evidence revision/supersession contract and real provider/device restart E2E remain open.
- WorkPass60 implementation progress: **8/8 scoped code deliverables (100%)**. Official weighted roadmap: **78.8%**. This pass is not release approval.

# WorkPass 59 — 2026-10-17

- Added one shared `wasToolExecutorEntered` contract for outcome classification.
- Pre-execution gate results (`approval-required`, `unavailable`, `policy-refused`, key/receipt failures and uncertain reconciliation) stay in the ActionGateway audit trail without creating false action/outcome cognition, external-trust updates or competence learning.
- Reusable skill repair/aggregate learning is now gated by actual executor entry; unavailable/ambiguous steps create a visible paused trace and do not demote skill competence. Partial replay followed by a blocked step no longer masquerades as a complete replay.
- Project executor failure counters and action benchmark samples are now updated only when the tool executor was actually entered; non-execution blocks are logged separately.
- Runtime bumped to 35.79.0; persisted schema remains 225. WorkPass58 release gates remain open; weighted roadmap score is not inflated.

# WorkPass 58 — composite execution preflight and action lineage (2026-10-17)

- `OrganismCore.executeReusableSkill()` now preflights the full primary/repair/fallback tool candidate set before the first step. A missing or malformed parent idempotency key fails closed before any partial work.
- Stable parent-bound step idempotency keys and per-step `decisionId` values are propagated with host-supplied autonomous attribution, expected output keys and exact resolved execution metadata into the canonical finalizer.
- `executeProjectTool()` validates mutation key requirements before spending project budget and carries normalized execution options through ActionGateway and approval continuation.
- External HTTP project endpoints no longer trust client-supplied `autonomous=true`; preflight rejection is surfaced explicitly rather than implied success.
- Added core integration coverage for preflight, no partial execution, persisted step receipts, stable lineage, keyed replay and no budget spend on rejection. Replaced timer-based memory-index test synchronization with a deterministic provider barrier.
- Added shared `idempotencyPreflightHttpStatus`: an explicitly malformed key returns HTTP 400; an omitted required key returns HTTP 428; unrelated endpoint result codes are left unchanged.
- Runtime is `35.78.0` / schema `225`. WorkPass58 is 100% complete against its 8 scoped deliverables; official weighted roadmap remains 78.0%. Production browser E2E, live provider/device postconditions, independent retrieval uplift, target inference, rollback, nested-source license review and soak remain open.

---

## WorkPass 57 — external outcome truth, durable action keys and late-evidence recovery (2026-10-17)

- **P0 — external evidence:** an `external-postcondition` only counts as verified success when a bounded external observation ID and explicit expected/observed postconditions match. A credible mismatch is preserved as an explicit contradiction and returns `executed-contradicted`; a missing/incomplete postcondition remains unknown. `tool-contract` can never be relabelled as world evidence.
- **P0 — action durability:** derive durable-idempotency requirements from action identity/capability and protected operation class, not only from a legacy `requiresIdempotencyKey` opt-in. Reject unkeyed mutation-like actions before invoking the executor.
- **P0/P1 — causal integrity:** `OutcomeCognitionFabric` stores bounded executionId/fingerprint receipts and deduplicates repeated projections. `CausalAccountabilityGraph` keeps a bounded stable outcome receipt directory so delayed observations can rehydrate the exact outcome after the recent graph ring evicts it. Persist and migrate both indexes.
- **P1 — learning integrity:** permission/approval/unavailable/receipt-infrastructure outcomes are not treated as tool incompetence; unknown late evidence is recorded without negative credit; one contradiction stays as prediction-error evidence, while negative learning requires two distinct high-confidence independence keys.
- **Compatibility:** stale receipt/reconciliation tests now mint exact one-time approvals under the WorkPass53–56 policy before invoking protected actions. Added tests for contradictory postconditions, late evidence after ring eviction/state migration, and replay deduplication.
- **Release metadata:** synchronized `VERSION.json`, `RELEASE_MANIFEST.json`, `ReleaseContract.ts`, root `SUPER_VERSION.json` and the archive manifest to WorkPass57/runtime `35.77.0`/schema `225`. Removed stale nonstandard `scripts` metadata from `package-lock.json`; zero runtime dependencies remain.
- **Evidence:** runtime TypeScript `tsc` typecheck passes; focused WorkPass57, action crash reconciliation, tool receipt integration (9/9), provider reconciliation (5 scenarios), evidence/retired-receipt, background memory indexing and embedding privacy tests pass.
- **Not claimed:** no general memory retrieval uplift (`recallDelta=0`, not promoted); no production Vite/browser E2E or live provider/device-side-effect validation; no clean-room rollback, complete nested-license sign-off or soak. This is an implementation pass, not release approval.

## WorkPass 56 — deferred semantic-index maintenance and provider serialization (2026-10-17)

- Added opt-in, bounded background embedding maintenance inside the existing MemoryFabric maintenance cycle; canonical MemoryOS2 writes never wait for indexing.
- Validates vector count/dimensions/finiteness/nonzero norm, rejects stale content via content hashes, bounds the derived-vector cache, and applies per-memory exponential retry backoff capped at five minutes. Failure leaves canonical lexical/fuzzy retrieval available.
- Serializes background indexing, live cognitive embedding retrieval and explicit Memory Inspector semantic queries through the same provider lane; busy foreground cognition wins, and low-priority maintenance skips active recall windows. Multiple queued inspector queries do not fan out concurrent local model calls.
- Adds redacted aggregate maintenance telemetry to the existing Memory Inspector endpoint/panel.
- Sanitizes common credentials, bearer/API tokens, private keys, email, phone-like values, credentialed URLs and long numeric IDs inside the embedding adapter before caching/transmitting text; this is targeted heuristic minimization, not a universal PII classifier.
- **Source-derived:** adapted the deferred batched-worker/retry pattern from retained Hexis MIT `services/memory_embeddings.py`; no second canonical memory store or SQL backend copied.
- **Open:** local embedding provider and target-host perf not run; broad independent retrieval still `recallDelta=0`; production build/browser E2E, live provider/device receipt loop, exact audio lip-sync, clean-room rollback, full nested-source license review and soak remain open.

## WorkPass 55 — bilingual memory concept bridge and safe orphan approval recovery (2026-10-17)

- Added a safe recovery view to the global Action Approval Center: server-persisted pending tickets without an in-tab continuation are discoverable after load/refresh and can be explicitly declined. Raw original request bodies are never persisted or replayed from an orphan ticket.
- Extended canonical MemoryOS2 retrieval with pre-tokenized English/Russian domain concept groups, typed intent for curiosity/personality/goal/reason questions, and balanced low-weight concept expansion across multiple active topics. Existing original tokens, temporal/epistemic guards, and MemoryOS2/MemoryFabric ownership remain authoritative.
- Improved controlled cross-language paraphrase retrieval and removed repeated alias tokenization from the candidate path. Fixed the candidate-coverage fixture to use explicit historical `at` semantics rather than a wall-clock `current` mode.
- **Not claimed:** the small broad holdout still reports `recallDelta=0`; no general memory-retrieval uplift or algorithm promotion. Production Vite/browser E2E, live provider/device receipts, accurate audio lip-sync, rollback, full nested-source license review and soak remain open. Readiness remains 78.0%.

## WorkPass54 — app-wide approval continuation (2026-10-17)

- Added a global root-level `ActionApprovalCenter` and in-tab continuation broker that waits for owner choice, resolves the canonical ActionGateway ticket, and retries the exact captured JSON-object request once with `approvalId`.
- Sensitive request bodies remain in a closure in the current tab; no local/session storage was added. Decline, expiry, duplicate ticket and failed resolve do not trigger an automatic retry. Malformed/out-of-contract TTLs and non-replayable request bodies are not offered for auto-continuation.
- Removed competing Runtime Atlas resolve controls; adapted the fail-closed approval principle from the retained Hexis MIT source without copying its implicit chat approval exception.
- App/root version 35.0.0-super-workpass54; runtime 35.75.0; schema 225.
- Release status remains implementation-workpass; app build and live browser E2E are not claimed.

## WorkPass 54 — app-wide exact-request approval continuation (2026-10-17)

- **DONE — real UI integration:** added a global Action Approval Center in the root route. Any POST API request that returns a structured `approvalRequired` challenge can suspend its original promise, show only the canonical safe preview, and wait for owner resolution.
- **DONE — exact continuation:** after approval the client calls the canonical permission resolver, then retries the original path and JSON body once with the one-use `approvalId`; changed inputs are not reconstructed from the preview and the body is never persisted to browser storage. Decline or expiry rejects the original call without retrying the side effect.
- **DONE — single resolver UI:** Runtime Atlas remains the read-only server-side queue/history. Removed its competing approve/decline buttons so it cannot resolve a ticket while the originating action is suspended in the global center. Orphaned tickets after refresh are explicitly treated as non-resumable and should expire rather than be approved from stale UI.
- **SOURCE-DERIVED DESIGN:** adapted the fail-closed “no approver means no consent” principle from the retained Hexis `core/tools/policy.py` and `tests/core/test_approval_gate.py` into the existing canonical ActionGateway/client surface; intentionally did not copy Hexis’s implicit CHAT approval exception. Source remains under `legacy/input-archives/hexis-main-2026-10-08/` with its MIT license.
- **PRESERVED:** server remains the only durable permission owner; raw body and request hash are never exposed in approval cards or persisted in localStorage/sessionStorage. Existing IntegrationConsole/ResearchDock can still handle errors if automatic continuation is unavailable.
- **OPEN:** real installed Vite build and interactive browser E2E remain blocked by absent app dependencies in this environment; external provider/device receipts, exact audio lipsync, independent recall uplift, clean-room rollback, complete nested source license review and soak remain open. Overall roadmap stays 78.0%.

## WorkPass 53 — persisted explicit action approvals across execution and direct adapters (2026-10-16)

- Added a canonical ActionGateway approval lifecycle: exact tool/input/operation binding, five-minute expiry, durable pending/approved/consumed state, serialized admission/consumption and one-time replay prevention.
- Protected direct voice speak/listen/turn, chat speech, both modern and legacy outbound transport endpoints, and standalone research bridge subprocess probes. The research bridge fails closed when the runtime approval gateway is unavailable.
- Added an owner-facing Operator Console approval card that shows only a redacted parameter preview and can approve then resubmit the exact captured operation once; Runtime Atlas keeps the cross-surface review queue.
- Extended redaction for bearer tokens, secret query parameters, URL userinfo, email and phone-like values in approval previews.
- Verified focused ActionGateway, bridge unit and live local runtime + Python bridge E2E flows. Production Vite/browser E2E and real provider/device side-effect validation remain open.

## WorkPass 52 — qualified project execution and progress observability (2026-10-16)

- **DONE — project progress integrity:** `AutonomousProjectExecutor.completeToolStep` now reserves an outcome ID only after project/tool/step and research-gate checks pass. Verified tool execution alone is not step completion.
- **DONE — real qualifying attempts:** added persisted `qualifyingAttempts`; only relevant outcomes meeting the required evidence threshold count toward `minAttemptsBeforePromotion`. This prevents a weak result plus one strong result from silently satisfying a two-confirmation rule after restart.
- **DONE — no false progress:** incomplete/underqualified results now return `null` to the `OrganismCore` progression path, so they cannot advance project progress or promote a compound skill. Weak evidence applies bounded backoff and can eventually block the step instead of spinning.
- **DONE — honest learning score:** unqualified outcomes no longer raise project execution fitness or skill-promotion readiness.
- **DONE — persisted state upgrade:** internal project-executor state version is now `6`; old snapshots restore with `qualifyingAttempts=0`, so historical success counters cannot masquerade as independent evidence. Outer organism schema remains `225`.
- **SOURCE-DERIVED GOVERNANCE:** adapts the probation/independent-evidence principle documented in the included NOMEGA Pass16 `skill_governance_v1.py` to the existing TypeScript executor; no second Python runtime or parallel skill governor was added.
- **DONE — runtime visibility:** existing `/api/organism/projects/active` includes a sanitized read-only execution plan with per-step status, required evidence, qualifying attempts, dependencies, blockers and retry tick; `RuntimeAtlas` renders this as a progress panel. No tool inputs/URLs are exposed in this panel.
- **EVIDENCE:** runtime typecheck; qualified-attempt/persistence, receipt idempotency, research gates, compound project DAG and autonomous project-life tests pass.
- **OPEN:** production app build/browser E2E, live provider/device execution, true audio-buffer/phoneme lipsync, broad memory recall uplift (still zero), clean-room rollback, full upstream-license sign-off and soak. Official weighted roadmap stays at 78.0%.

## WorkPass 51 — causal credit, verified episodic outcomes and intent-aware memory retrieval (2026-10-16)

- **DONE — temporal attribution:** n-step temporal return now excludes outcomes explicitly targeted to another `decisionId`; capacity overflow explicitly expires the oldest unresolved decision with zero learning eligibility/confidence rather than silently dropping it. Core application skips expired assignments.
- **DONE — evidence integrity:** positive Reafference requires a declared independent source and `supported`/`corroborated` reconciliation; high model confidence cannot stand in for independence.
- **DONE — memory integration:** independently reconciled exact-decision, non-replayed external outcomes now become provenance-linked episodic facts in the single canonical MemoryOS2 and idempotently update P33 interest evidence. The episode preserves decision/execution/observation links, lineage and expected-vs-observed outcome.
- **DONE — retrieval:** MemoryOS2 adds bounded Russian/English intent-kind/context ranking for event recall, how-to, identity/preferences, goals, causal reasons and factual questions. Controlled identical-lexical fixtures pass.
- **MEASURED LIMITATION:** broad memory benchmark still returns `recallDelta=0`; no retrieval candidate was promoted and no general recall improvement is claimed.
- **EVIDENCE:** runtime typecheck and targeted temporal-targeting, Reafference codec/integration, restart-persistence and query-intent tests pass.
- **OPEN:** real provider/device receipt loop, production Vite/browser/Live2D E2E, phoneme/audio lipsync, target-host inference, independent retrieval holdout uplift, clean-room rollback, nested-source license review and soak. Official weighted roadmap remains 78.0%.

## WorkPass 50 — interest continuity, autonomous runtime loop and embodied dialogue (2026-10-16)

- **DONE — code:** connected P33's sole interest-profile owner to active goals, retained evidence-backed memories, self-authored goals, selected initiatives and explicit thread-linked responses. Positive/engaged feedback gently raises the relevant domain; negative feedback applies a small domain-local correction and never overwrites canonical traits. Feedback evidence IDs are idempotent and persisted with profile provenance.
- **DONE — runtime fix:** autonomous social quiet time and reciprocity now use the user conversation channel rather than treating every cognitive/sensory cycle as an incoming chat turn. This closes a control-flow issue that could keep a spontaneous initiative from reaching generation.
- **DONE — integration path:** a test drives the real `OrganismRuntime` background scheduler through a deterministic provider seam, staged text, UI acknowledgement, explicit user feedback, durable flush and process restart without redelivery. This is a real runtime path test, not a live external-provider test.
- **IMPLEMENTED — body/voice:** `AvatarStage` has opt-in browser/system speech, language/voice selection, cancellation on turn/toggle/unmount and word-boundary-driven approximate mouth shapes. Live2D receives actual mouth form/open, gaze, emotion, thinking/gesture and per-turn motion signals. This is not phoneme-perfect lipsync and awaits production-browser verification.
- **PRESERVED:** canonical MemoryOS2/P33/AutonomousSocialInitiativeEngine owners, schema 225, legacy assets and the four original source archives. No competing personality, memory or scheduler was introduced.
- **OPEN:** production Vite build/browser/Live2D E2E, configured live provider long-idle run, audio-buffer/phoneme synchronization, independent retrieval uplift (still zero), target-host inference, external device receipts, clean-room rollback, full nested-source license review and soak. Weighted release roadmap remains 78.0%; no claim of release readiness or proven subjective consciousness is made.

## WorkPass 49 — unified provider-context privacy boundary (2026-10-16)

- **DONE — code:** applied the same safe-recall filter to persisted recent memories, known-entity facts and world-facts before normal cognitive, self-initiated dialogue and cognitive-proposal prompts. Safe evidence remains available; unsafe stored facts are omitted whole rather than partially rewritten. Direct user input remains a separate explicit interaction channel.
- **DONE — code:** restoration now strips unsafe topics/messages from persisted social initiative state and defers pending work that fails the privacy gate; an unsafe generated unsolicited message cannot be staged for UI delivery and leaves the pending queue.
- **DONE — tests:** expanded queue and prompt regressions cover credentials/email-like data in recalled memory, entity facts, world facts, restored pending initiatives and generated outbound messages; positive controls confirm safe context is retained. Runtime TypeScript typecheck passes.
- **PRESERVED:** canonical MemoryOS2 owner, existing `AutonomousSocialInitiativeEngine`, existing language context budget, schema 225, user source archives, Legacy and Live2D. No new memory owner or parallel privacy subsystem.
- **OPEN:** the filter is still heuristic and does not replace data-classification policy or user consent for cloud providers. Production Vite build/browser E2E, real provider/device loop, audio/viseme synchronization, target-host inference, independent retrieval holdout, clean-room rollback, complete source-license sign-off and soak remain release gates. Official weighted roadmap remains 78.0%; this pass does not claim consciousness or release readiness.

## WorkPass 48 — initiative grounded in memory, goals and current affect (2026-10-16)

- **DONE — code:** extended the existing `AutonomousSocialInitiativeEngine` to rank candidate discussion topics by salience, freshness and source. `OrganismCore` supplies current active goals and evidence-backed consolidated learning memories (pattern, goal-learning and self-model), along with live curiosity/reflection candidates; no separate personality or memory owner was introduced.
- **DONE — code:** connected the existing emotion appraisal snapshot to a bounded, transient conversational tone hint. `LanguageOrgan` uses it only to modulate expression naturally; stable `KurisuCanonProfile` and the existing safety/tool boundaries remain authoritative.
- **DONE — code:** added 14-day semantic near-duplicate topic suppression and removed repeated generic fallback when all supplied topics are stale/duplicates. The engine waits for a genuinely eligible candidate rather than pretending the same topic is a new thought.
- **DONE — prompt privacy gate:** one shared sanitizer rejects credential/medical-secret-like topics, email-addresses and phone/long-number patterns before candidate selection and autonomous recollection enters the language prompt. This is targeted filtering, not a universal PII detector.
- **DONE — social semantics:** UI delivery acknowledgement no longer changes `reciprocity01`. Delivery proves receipt by the client, not that the user reciprocated or liked the message.
- **DONE — test fixes:** extended direct queue/prompt regressions and corrected the legacy personhood test to use valid timestamps and account for the documented `recovery-after-process-gap` narrative episode. Release schema remains 225.
- **EVIDENCE:** runtime TypeScript typecheck; WorkPass48 queue, prompt and trait-salience tests; personhood/runtime-restore integration; social consolidation; server import and UI/API linkage audits; release metadata contract tests pass.
- **OPEN:** provider-backed idle run, app dependency install/Vite production build, browser UI/Live2D E2E, real-device audio/viseme synchronization, provider/device receipts, external retrieval holdout, clean-room rollback, manual license sign-off and soak are not established by this pass. Official weighted roadmap remains 78.0%; this does not assert consciousness or release readiness.

## WorkPass 47 — endogenous dialogue reaches the user-facing chat (2026-10-16)

- **DONE — code:** expanded the existing `AutonomousSocialInitiativeEngine` from a latent social-pressure signal into a durable conversational intent queue. It selects specific topics from active goals and cognitive reflection, tracks quiet-time/cooldown, avoids fake `ambient-network` contacts, and migrates older entries safely.
- **DONE — code:** added a Kurisu-persona, context-budgeted prompt for self-initiated thoughts. The language result is staged as a durable pending message; a small authorized API exposes it and acknowledges delivery exactly once.
- **DONE — UI:** the canonical chat store polls the pending queue at most every five seconds, inserts each message with a stable id, saves it to the browser chat cache, then sends the acknowledgement. Spontaneous messages do not request voice output or activate tools/search.
- **DONE — upstream-informed personality integration:** adapted WILL's graded trait-salience / two-channel concept (source archive license: Apache-2.0) into a small deterministic projection of existing B270 learned traits. Numeric bias remains owned by B270; the same evidence-gated shift is surfaced as a top-K verbal self-observation in normal, autonomous, and cognitive-proposal prompts. Tiny/unsupported drift is excluded; no second persona engine and no state-schema migration.
- **DONE — first embodied response mapping:** avatar gaze/head tilt follow mapped cognitive/emotional state, and per-utterance motion tokens trigger an existing Live2D `Special` movement. Phoneme-level speech synchronization and browser/device E2E remain open.
- **DONE — requirements:** added `docs/NEURO_KURISU_VISION_AND_66_DECISIONS_WORKPASS47.md`, covering all 66 requirements and distinguishing the user's explicit answers from proposed default decisions for unanswered items.
- **DONE — library:** preserved original user source archives byte-for-byte as `/Нейро Курису/Исходники/{one,two,three,four}.7z`.
- **DONE — metadata:** runtime 35.68.0 / schema 225; persisted schema unchanged.
- **OPEN:** real UI/Vite browser run, actual local/host inference, live unsolicited-dialogue observation over a long idle period, state restart E2E, and full device/Live2D E2E have not been verified in this pass. This feature does not establish subjective consciousness.

## WorkPass 46 — deterministic offline Live2D runtime (2026-10-16)

- Removed unpinned CDN script fallbacks from the active app Live2D viewer. Pixi, Cubism Core and pixi-live2d-display now load only from the versioned local assets shipped in the archive. A missing asset becomes a visible Live2D-unavailable condition and preserves the existing Legacy sprite fallback rather than silently executing remote code.
- Added `docs/NEURO_KURISU_66_PROJECT_QUESTIONS_WORKPASS46.md`: 66 distinct, plain-language requirements questions across personality, memory, cognition, autonomy, UI/Live2D and target-device/integration strategy. Answers are intended to guide code priorities, not create a parallel architecture.
- Aligned root/runtime release metadata to WorkPass46 / runtime 35.67.0 / schema 225.
- Scope note: this pass does not claim production Vite build, interactive browser E2E, real-device receipts, target-host inference or release readiness.

## WorkPass 45 — provider reconciliation and canonical physical camera receipts (2026-10-15)

- Added a read-only `ActionGateway.reconcileToolExecution` protocol with explicit `found`, authoritative `not-found`, and `unknown` outcomes. Reconciliation never executes the tool; `unknown` preserves the pending receipt and never becomes negative competence evidence. Concurrent lookups coalesce, and finalization/commit remain owned by the existing ActionGateway receipt flow.
- Added a durable Termux camera receipt sidecar with atomic exclusive creation, strict local permissions, operation/key binding, replay under the same key, conflict rejection, and retained-image SHA-256 verification. A missing local receipt after an ambiguous hardware side effect remains `unknown`, never fabricated as `confirmed-not-executed`.
- Removed camera bypasses: `organism.device.capture` is the canonical `ActionGateway` owner and requires an idempotency key; legacy `android.capture_camera` calls normalize to the canonical ID, while raw `EmbodimentRuntime.captureCamera` fails closed. Autonomous embodied execution and cognition capture both route through the canonical gateway.
- Hardened `/api/organism/vision/capture` to return HTTP 400 before invocation if `Idempotency-Key` is missing. `/api/organism/vision/capture-if-useful` either skips safely or returns an explicit key-required response. The live Node server smoke now covers these HTTP contracts.
- Fixed a pre-existing release-contract mismatch (embedded `35.64.0` vs canonical package `35.65.0`) by aligning runtime package/lock, `ReleaseContract`, `VERSION.json`, `RELEASE_MANIFEST.json`, root `SUPER_VERSION.json`, and `contracts/integration-manifest.json` to runtime `35.66.0`, WorkPass45, schema 225.
- Preserved historical source blobs, single ActionGateway side-effect ownership, MemoryOS2/MemoryFabric memory ownership, Legacy, and Live2D. No retrieval candidate is promoted; measured retrieval uplift remains zero.
- Release gates remain open: the Termux camera is not tested on a real device (receipt tests use synthetic fixtures), and a process crash after camera capture but before local receipt persistence remains unresolved unless the platform exposes authoritative receipt lookup. Dependency-installed Vite build, interactive browser E2E, external provider replay/reconnect, target-host inference, independent retrieval holdout, clean-room rollback, source-license sign-off, and soak remain open.

## WorkPass 44 — replay-safe external evidence and action reconciliation (2026-10-15)

- Made keyed action execution expose a deterministic `executionId`, `decisionId`, and SHA-256-derived provider-facing idempotency token through `ToolExecutionContext`; a pending/uncertain receipt remains reconciliation-required and is never blindly re-executed. This enables compatible adapters to forward stable idempotency to providers but does not prove every provider honors it.
- Changed causal semantics so missing verification is `unknown`, not `contradicted`; only an explicit failed postcondition creates negative evidence. `OutcomeCognitionFabric` keeps original tool outcomes immutable and projects later external evidence separately.
- Connected `OrganismCore.ingestExternalObservation` into `CognitiveEventFabric` as deterministic `external-evidence` nodes with an exact parent outcome, stable observation identity, sanitized/hash-only payload, and restore validation. Conflicting reuse of an execution/observation ID fails closed.
- Added replay protection to temporal credit assignment, external observation assessment/source reliability, external evidence trust, P84 autobiography and behavior-continuity updates, and P83 grounded belief continuity; identical external evidence no longer inflates confidence/reward/revisions after replay or restore.
- Added MemoryFabric Bloom tombstones for retired keys beyond its exact 512-receipt hot ledger; possible reuse of an aged-out mutation key requires reconciliation instead of silently applying a duplicate write. A corrupted tombstone filter fails closed for unknown keys.
- Added crash-injection/restart regressions for pre-effect persistence failure, post-effect/finalizer uncertainty, completed-ledger persist failure, stable executor context, exact replay and key conflict. Typecheck and focused regressions pass individually.
- Preserved one ActionGateway side-effect owner, one MemoryOS2/MemoryFabric write owner, canonical CEF/temporal credit/trust/P84 owners, Legacy/Live2D, and historical source blobs. Root/runtime release metadata aligned to WorkPass44 / runtime 35.65.0 / schema 225.
- Preserved byte-exact pre-WorkPass44 bytes for the three evolved historical source files in SHA-256 content-addressed blobs and redirected 12 compact-manifest/snapshot references; compact archive and historical snapshot checks returned to 8,512/8,512 and 10,427/10,427 after the in-pass mismatch was found.
- Release gates intentionally remain open: real external adapters must prove provider-side idempotency and receipt reconciliation; dependency-installed Vite build/browser Live2D E2E, target-host model inference, independent temporal retrieval holdout (current uplift zero; candidate not promoted), clean-room rollback, manual license sign-off and soak are not certified. Official weighted roadmap score stays 78.0%.

## WorkPass 43 — durable autonomous action receipts and causal restore (2026-10-15)

- Closed the autonomous resource-tool execution bypass: `OrganismCore` now routes the planner through its canonical `executeTool` method and ActionGateway's keyed durable receipt/finalizer path, using a stable per-tick/per-tool intention key.
- Added keyed `tool-action → tool-outcome → tool-evidence` projections to the existing `CognitiveEventFabric`. Replays return original IDs while those nodes are retained; snapshots preserve sanitized receipt nodes beyond the ordinary 96-event window and restore rejects mismatched/dangling replay guards.
- Added failure-closed behavior: unresolved receipts block new autonomous calls and unknown execution state is not learned as a failed capability. Autonomous accounting is deduplicated by `executionId` to repair the checkpoint gap without double-counting.
- External observation correlation now requires the exact `executionId`; tool-name fallback is rejected. `ActionGateway.registerTool` rejects duplicate IDs instead of silently replacing an executor.
- Hardened AvatarStage and Live2D iframe messaging with exact same-origin/source checks, structured payload validation, expression/motion allowlists, bounded numbers and guarded localStorage access.
- Focused WorkPass43 receipt/causal/restore tests: 8/8; runtime typecheck, smoke/restart and prior idempotency/archive regressions recorded in the pass report. App build/browser E2E remain unverified in this environment; the long autonomy suite timed out and is not counted as a pass.
- Runtime release contract aligned to 35.64.0 / schema 225; root release line is 35.0.0-super-workpass43. Weighted release score remains 78.0% because external provider/device receipts, real provider inference, independent temporal retrieval holdout, clean-room rollback, license sign-off and soak remain open.

## WorkPass 41 — 2026-10-14


## WorkPass 42 — source-first archive cleanup (2026-10-14)

- Removed 21 byte-identical app/public Live2D shadows from the compact source tree; dev/build hash-verifies and materializes them from `runtime/neuro-kurisu/public/live2d`, and `assets:clean` removes only unchanged generated copies. App-specific viewer/vendor assets remain.
- Removed two byte-identical Lumina/Letta ZIP aliases while retaining the canonical raw-source archives.
- Removed 27 identical same-relative-path source copies shared by Kurisu v9/v56 and 27 identical forensic/history report copies. The generic path restoration manifest now contains 56 exact-hash entries; the existing 3,873-entry Legacy manifest is preserved.
- Moved 68 historical root reports under `docs/history/workpasses/root-reports/` without changing their bytes; added an indexed file map and one canonical archive-optimization runbook.
- Rebound historical source manifests to exact matching canonical files or immutable blobs; 8,512/8,512 compact-source members and 10,427/10,427 historical snapshot records verify. Ten evolved historical snapshot entries use eight content-addressed old-version blobs.
- Added fail-closed cleanup/restoration commands and tests; changed path deduplication is reversible and refuses symlinks, hash drift and overwrites.
- Release roadmap remains 78.0%. Production Vite build, interactive browser/Live2D E2E, actual external receipts, independent labelled retrieval holdout, clean-room rollback, license sign-off and soak remain open.
- Fix cycle-local causal verification: `CognitiveEventFabric.verifyOperationalCycle` verifies six operational stages by exact ID, stage, same tick and required parent edges; stale dangling links caused by bounded-buffer eviction can no longer poison current-cycle verification.
- Normalize restored cognitive events; ignore duplicate IDs, unknown stages, malformed ticks and non-object payloads, preserving valid historical event IDs and fail-closed causal verification.
- Fix `MemoryRetentionEconomy` decision baseline so net utility, harm/redundancy and provenance directly affect admission even without byte pressure; byte-pressure value-per-byte remains an additional adjustment.
- Add 10 focused cycle-lineage/snapshot assertions and 5 retention-net-value assertions; existing big-pass 162/164, adaptive-memory 2888/2894, memory-substrate equivalence and runtime typecheck pass.
- Align release metadata to root 35.0.0-super-workpass41, runtime 35.63.0, state schema 225. Preserve WorkPass40 and all older records as history.
- Release blockers remain: dependency-installed Vite build and browser Live2D E2E, actual target-model inference, real provider/device receipts and replay, independent temporal retrieval holdout, clean-room fault-injected rollback, nested-source license sign-off and soak.

- Final reconciliation: embedded runtime release contract fixed at 35.63.0 / schema 225, version and phase are covered by regression checks.
- Consolidated 5 identical historical content blobs across snapshot/source archive manifests into a single immutable payload each (31,893 raw bytes).
- Final checks: 8,512/8,512 source members; 10,427/10,427 snapshot records; app scripts 218/218; 34/34 release metadata; 6/6 contract; architecture 0 missing/cycles/Legacy leakage.

## WorkPass 40 — 2026-10-14
- Harden `restoreBackup`: atomically claim `organism-runtime.lock`, verify staged bytes, reject symlink backup members, replace the complete supported state-file set, and roll back staged state after failed commit; regressions cover exact set, path traversal, symlink rejection and lock release.
- Add `tools/super-sbom.mjs` CycloneDX 1.5 inventory for 464 locked npm components and ten embedded source archives; record hashes, declared licenses, archive member counts and repository NOTICE/LICENSE evidence without treating inventory as legal sign-off.
- Add opt-in loopback-only OpenAI-compatible `llama.cpp` chat provider to existing P40 Model Ecology; old snapshots gain the provider profile without replacing user profiles. No model weights bundled and no target-hardware inference claimed.
- Align root/version metadata, runtime package/lock, `ReleaseContract`, `VERSION.json`, `RELEASE_MANIFEST.json`, `SUPER_VERSION.json`, and `contracts/integration-manifest.json` to runtime 35.62.0 / schema 225 / WorkPass40.
- Current WorkPass40 validation: state backup 8/8; SBOM/provenance 1/1; local chat provider/migration tests; runtime typecheck. Production UI build, live llama.cpp inference, real provider receipts and clean-room fault-injected restore remain release blockers.


## WorkPass39 — 2026-10-14
- `ExternalObserverFabric`, `ExternalEvidenceTrust`, and `EvidenceFirewall`: SHA-256 IDs for new evidence while preserving existing stored identifiers.
- `CognitiveNetworkBus`: confidence- and energy-aware utility, invalid/duplicate/restored-signal normalization, bounded affect action prior.
- `OrganismCore`: real emotion/feeling/interoception inputs compete for global attention; salience evidence fusion prevents evidence loss; stale broadcasts cannot affect actions with network disabled.
- `CognitiveArchitectureMap` and Runtime Atlas: read-only 14-system / 22-flow map and live health surface.
- Repaired historical source manifests to immutable SHA-addressed WorkPass38 byte blobs; preserved restoration after current code changes.
- Added upstream reuse review (14 projects/docs); no external code download is claimed because registry/Git DNS failed.
- Runtime 35.61.0 / schema 225. Retrieval candidate remains not-promoted (`recallDelta=0`); Vite build remains blocked by `EAI_AGAIN registry.npmjs.org`.

## WorkPass 39 — cognitive architecture and evidence hardening (2026-10-14)

- Runtime version 35.61.0 / schema 225.
- Added the read-only CognitiveArchitectureMap for 14 existing brain-like systems and 22 directed feedforward/feedback/governance/provenance flows; exposed owners and live composed-system health through `/api/organism/cognitive-architecture` and a readable Runtime Atlas panel.
- New external evidence identities in ExternalObserverFabric, ExternalEvidenceTrust and EvidenceFirewall use SHA-256 over canonical serialized payloads; legacy persisted identifiers are retained on matching records.
- CognitiveNetworkBus utility now incorporates bounded confidence and energy cost instead of merely carrying those fields.
- Added public upstream review for 14 projects/docs and explicit integration/non-promotion decisions; no direct upstream source cloning claimed.
- Focused runtime typecheck and four WorkPass39 tests pass. Production Vite/interactive Live2D E2E, real provider receipts, independent retrieval holdout, clean-room rollback and soak remain open.

# WorkPass 38 — 2026-10-14: indexed durable action archive

- Added an append-only, SHA-256-checked JSONL archive for completed ActionGateway receipts. Each record is fsync'd before hot-ledger capacity is reclaimed; replay loads a receipt from disk by offset while the in-memory index retains only key/request hashes, offsets and record lengths.
- Integrated the archive with file-backed OrganismCore through a validated FileStateStore sibling path and load-before-restore ordering.
- Keyed side effects fail closed when no durable persister exists. Same-key requests reserve their in-flight slot before asynchronous archive lookup; capacity admission is serialized across different keys.
- Removed silent receipt eviction and restore-time snapshot slicing. Conflicting duplicate keys fail closed; incomplete trailing writes are truncated and complete-record corruption is rejected.
- Focused ActionGateway + archive tests: 17/17 pass; runtime TypeScript typecheck passes. Real remote provider receipts, app production build/Live2D browser E2E, labeled retrieval holdout, clean-room rollback and soak remain open.

---

# WorkPass 37 — durable action receipts and verified reafference — 2026-10-13

- Runtime release contract aligned to **35.59.0 / schema 225**; schema 223 and 224 migration regressions cover initialization and receipt preservation.
- ActionGateway now persists idempotency receipts and blocks uncertain replay after an action when durable completion cannot be committed.
- Reusable skill steps and project execution APIs use stable deterministic idempotency keys; key conflict, restore, concurrency and bounded response cases covered by 13 focused tests.
- Verified independent postconditions pass through the canonical ExternalObserverFabric. Temporal credit uses only the exact caller-supplied pending decision ID.
- Retrieval benchmark time semantics are corrected; measured synthetic uplift remains zero and promotion stays disabled.
- Focused runtime typecheck, 13/13 ActionGateway suite, 17/17 WILL suite and schema migration alignment pass. Production Vite/browser Live2D E2E, real provider evidence, independent retrieval holdout, clean-room rollback and soak remain open.
- Full details: `docs/WORKPASS37_REPORT_2026-10-13.md`; source disposition: `docs/INTEGRATION_MATRIX_WORKPASS37_2026-10-13.md`.

---

# WorkPass 36 — consolidation of runtime primitives and immutable source lineage — 2026-10-13

- Reconciled stale `ReleaseContract` metadata with the canonical runtime package/integration manifest (35.58.0, schema 224); schema-223 snapshot migration and metadata agreement are covered by a dedicated regression test.
- Added `UnicodeTokenizer` for Lumina/Conscio with explicit compatibility options: Unicode NFKC, locale-lowercasing and minimum token length stay shared while underscore/hyphen behavior remains layer-specific.
- Consolidated repeated FNV-1a/cosine calculations and identical action-cost constants into shared canonical modules without collapsing non-equivalent distance metrics or experiment-specific costs.
- Consolidated stable serialization and SHA-256 adapter code across WILL, Letta, Lumina, Hexis and Conscio while preserving the legacy fingerprint byte format for persisted identities.
- Bounded MemoryOS2 per-memory revision history to 64 events, sanitized old snapshots and included revision bytes in memory budgeting; preserved legacy source associations as provenance rather than unresolved canonical links.
- Optimized duplicate relation discovery in the memory compatibility coordinator using token postings and exact-content lookup, checked against the prior search behavior.
- Fixed a source-archive provenance bug: mutable active paths are no longer used as the only source of historical bytes. Historical members now restore from immutable SHA-256-addressed blobs, and source archives/snapshot/legacy de-dup manifests verify without missing or changed files.
- Tests at this pass: runtime typecheck PASS; WorkPass36 targeted shared primitives/action costs/indexed memory/revision history/lineage/serialization/tokenizer tests PASS; WILL agency suite 17/17; app script suite 212/212 and release metadata 6/6 at earlier checkpoint; source archive verification 8,512/8,512; historical snapshot 10,427 entries; legacy dedup map 3,873 entries.
- Progress for this implementation pass: 90/100. Weighted release readiness remains 72.9%; full app dependency-installed typecheck/build, browser/Live2D E2E, real model/provider behavior, labelled temporal retrieval holdout and high semantic-function evidence remain open.

---

# WorkPass 35 — WILL pre-arbitration integration and reproducible legacy dedup — 2026-10-13
- WILL competence теперь обучается только на подтверждённых исходах (`verifiedUses`); неподтверждённый `success` не повышает success rate/confidence, а legacy snapshots без verified ledger восстанавливаются нейтрально. Добавлены regressions; WILL bridge suite 17/17, runtime typecheck и organism smoke PASS.

- Moved the bounded WILL agency ranking step before `P69ConstitutionalArbiter.arbitrate()`, fixing the prior ordering where P69 had already selected a candidate before WILL scores were adjusted. P69 still owns final selection and veto policy; WILL has no independent final authority.
- Limited WILL score delta to ±0.04, aligned utility/confidence updates, and corrected diagnostics to retain the true pre-adjustment `base01` and actual applied `delta01`.
- Added an integration regression for baseline/delta semantics and bounded influence. Dedicated WILL bridge suite passes 17/17; runtime TypeScript typecheck passes.
- Removed byte-identical expanded WILL and Neuro-Kurisu 35.30 trees plus exact duplicate dated Lumina/Letta ZIPs. Original source ZIPs are retained. `tools/materialize_legacy_archive.py` checks archive SHA-256 before restoring both trees; restored payloads matched 606/606 and 4,022/4,022 files. Final package is about 200.4 MB versus 230.6 MB for WorkPass34 (about 13.1% smaller).
- Aligned root/runtime version and release metadata to WorkPass35 / runtime 35.58.0 / schema 224. Active application UI, runtime, legacy avatar rendering and Live2D paths were not removed.
- Readiness remains 72.9%; actual local model execution, independent temporal holdout, production browser/Live2D E2E, clean-room recovery/rollback and soak remain open.

---

# WorkPass 32 — typo-tolerant hybrid retrieval for canonical MemoryOS2 — 2026-10-13

- Added a bounded token-level character-trigram index, maintained during encode, forget, capacity eviction and snapshot restore. Query token variants can discover candidates through shared n-grams instead of requiring an exact token posting.
- Replaced the two-list BM25 + hashed-token-vector rank fusion with weighted RRF across BM25, query-token coverage, fuzzy character similarity, entity overlap and graph/temporal relationship support. Zero-score channels no longer assign arbitrary ID-ordered ranks.
- Removed the hashed-token projection from final ranking and redistributed the unavailable semantic channel's fusion weight to real retrieval match quality. Diagnostics explicitly report that no true embedding provider is configured.
- Added English spelling-variant and Russian inflection/spelling regressions, including index maintenance and snapshot restore. Retrieval score fusion passes the existing controlled comparison (8/8 for the fused profile vs 6/7 for the legacy lexical-only alias); the offline multi-seed synthetic experiment remains `not-promoted` and is not evidence of production uplift.
- Runtime TypeScript, fuzzy retrieval, candidate coverage, numeric retrieval, multi-seed experiment, WorkPass31 lifecycle replay, WorkPass30 provenance lineage and HTTP server smoke pass. Independent temporal holdout, true embedding inference, frontend production build and browser/Live2D E2E remain open.

---

# WorkPass 31 — unified canonical memory lifecycle gateway — 2026-10-13

- Routed canonical memory writes, revision/status changes, signal/context updates and forgetting through `MemoryFabric.applyLifecycleCommand`; `MemoryOS2` remains the only writable store.
- Added a bounded, persisted 512-entry mutation receipt journal. Exact retries skip mutation and duplicate events; reusing a command ID for a different payload throws a typed conflict.
- Added stable command receipts for legacy/multi-timescale compatibility ingestion and restore, then routed Hexis and external-research write paths through the same gateway.
- Patched `StateMigrations` to retain and sanitize valid receipts through the normal persisted-state normalization path; malformed receipts are discarded.
- Added `memory-lifecycle-command-workpass31.mjs` covering retry/restore, changed-payload conflicts, compatibility consolidation, no-op updates, forgetting and the journal cap.
- Typecheck, WorkPass29/30 source/lineage regressions and the WorkPass31 lifecycle/migration scenario pass. Release audit, retrieval benchmark, UI build/browser E2E and release durability remain separate/open; no release readiness or retrieval uplift is claimed.

# WorkPass 30 — unified independent-source provenance inside canonical MemoryOS2 — 2026-10-13

- Integrated a bounded `MemoryEvidenceSource` trail into the single canonical MemoryOS2 record: up to 8 visible independent lineage entries plus a 32-key replay guard, included in persistence normalization and memory byte estimation.
- Connected the real `OrganismCore.integrateExternalResearchMemory` path to the EvidenceFirewall/ProjectResearchSession-derived `sourceLineageKey`; publisher/host stays provenance, but syndicated mirrors sharing one lineage count as one source vote.
- Canonical duplicate content from a genuinely independent lineage merges into the existing record; repeated or mirrored ingestion cannot ratchet confidence upward. External material remains hypothesis-only and capped.
- Added an end-to-end runtime integration regression for publisher/mirror/independent source rows, snapshot/restore, bounded evidence history, source-vote accounting, Runtime Atlas inspection and byte-estimate stability.
- Runtime 35.53.0 / schema 224; the existing retrieval benchmark remains at synthetic Recall@5 parity with BM25. This is provenance integration, not a measured retrieval uplift or release sign-off.
- Still open: independent labelled temporal holdout, dependency-complete UI production build/browser Live2D E2E, real pretrained NLI inference and live provider run, clean-room restore/rollback, soak and final RC sign-off.

# WorkPass 27 — MemoryOS2 candidate coverage + true BM25 baseline — 2026-10-13

- Removed the arbitrary 96-ID per-token posting-list cap while retaining the existing 1600-memory corpus bound and 192-candidate query bound. Candidate selection now uses IDF support, matched-term coverage, exact phrase, temporal validity, revision priority, recency/value signals and stable ID tie-breaks.
- Corrected hashed-vector cosine similarity so orthogonal or negatively similar vectors do not receive a free 0.5 semantic score.
- Replaced the benchmark's binary token-overlap comparator with corpus-scoped Okapi BM25 (`k1=1.2`, `b=0.75`). Reports include exact baseline configuration and SHA-256; multi-seed report signatures now bind that fingerprint.
- New 260-record candidate coverage/order-permutation regression passes; runtime typecheck, temporal inspector, R15/R16 memory behaviors, retrieval benchmark, multi-seed experiment and real HTTP server smoke pass.
- Important result: the small synthetic retrieval fixture shows candidate Recall@5 delta -0.25 against BM25 (paired interval [-0.75, 0.25]). Candidate stays **not-promoted**; independent labelled temporal holdout, further ranking improvements and frontend/browser release gates remain open.

---

# WorkPass 26 — temporal MemoryOS2 inspector closure — 2026-10-13

- Fixed `temporalMode=all` to preserve expired/superseded revisions; corrected absent/null `asOfAt` so it defaults to current time rather than Unix epoch.
- Added an isolated, side-effect-free `MemoryOS2`/`MemoryFabric` preview path and routed inspector queries through it.
- Exposed memory query, current/as-of/all-revisions mode, point-in-time and bounded record count in Runtime Atlas; added focused regression coverage.
- Runtime typecheck and targeted memory suites pass. Independent temporal holdout/BM25 comparison, React/Vite build, browser/Live2D E2E and release gates remain open.

---

# WorkPass 25 — version-bound NLI temperature calibration — 2026-10-11

- Added `tools/fit_research_nli_calibration.py`: deterministic scalar temperature scaling over a dedicated labelled calibration JSONL; requires >=50 examples/class, a deterministic group-disjoint train/validation split, explicit dataset source and labeling protocol, fixed dataset SHA-256 and exact serving model identity; output excludes sample text, is private (0600), atomic, and refuses overwrite by default.
- Added strict `KURISU_NLI_CALIBRATION_FILE` loading: artifact schema, class balance, source/label provenance, temperature bounds, NLL improvement eligibility, unpromoted state, model ID and immutable revision must all match. The serving process applies temperature scaling only on explicit opt-in; otherwise scores remain raw.
- Propagated calibration method, dataset hash, sample count and temperature through HTTP response, NLI result, claim atoms/quotes and aggregate model provenance. Mixed calibration identity during one assessment fails closed; restore rejects tampered/inconsistent calibration metadata. Overall claim `calibratedProbability` remains null because class calibration is not a real-world truth probability.
- Added calibration CLI, service artifact, malformed-response, private-output/no-overwrite and restore-tampering regressions; updated WorkPass 25 scripts and aligned root/runtime versions.
- The calibration fitter and contract were tested with a loopback mock service only. Registry DNS prevented downloading/running the pinned pretrained weights, so no real NLI calibration or model uplift is claimed. UI build, browser E2E, temporal memory holdout and release gates remain open.

---

# WorkPass 22 — optional local semantic NLI + claim-level gating — 2026-10-11

- Added an opt-in HTTP cross-encoder NLI backend in canonical runtime with strict endpoint validation, HTTPS requirement outside loopback, redirect refusal, request/response bounds, timeout, no-store behavior and explicit failure-to-unknown handling. The path is disabled unless `KURISU_RESEARCH_NLI_ENDPOINT` is configured.
- Added `tools/research_nli_server.py`, an optional local Python service using `cross-encoder/nli-deberta-v3-xsmall`, plus a separate `research/requirements-nli.txt`; model weights are not bundled with the project and research text is not logged by the service. Scores remain explicitly uncalibrated.
- Added conservative atomic-claim splitting and top-sentence selection. Partial support across a compound claim remains `unknown`; mixed/contradicted claim evidence blocks positive project progress credit. When model-assisted verification is active, positive credit requires at least two independent model-scored lineage families.
- Persisted model identity, raw score triplets, quote offsets and atom assessments with strict restore validation. Added mocked-backend runtime cases, isolated local service contract tests, and a real OrganismCore→HTTP NLI integration fixture covering independent support, mixed evidence and complete service outage.
- Validation: runtime TypeScript; claim evidence (20); lineage (8); semantic NLI path (20, mocked backend); NLI service contract (3, mocked model stack); executor idempotency (5); project research gates. The actual pretrained weights/inference, score calibration and independent holdout have **not** been run here.
- Still open: labelled/adversarial NLI holdout, confidence calibration, live research providers, independent MemoryOS2 temporal holdout, dependency-complete Vite production build/browser E2E, clean-room restore/rollback, soak and release sign-off.

---


## WorkPass 21 — source lineage, syndication control and canonical memory dedup (2026-10-11)

- Added bounded research-source lineage matching: canonical URL normalization, exact extracted-content identity and conservative near-duplicate detection using 5-token shingles with minimum text length and overlap thresholds. Short topical snippets are not merged by subject overlap alone.
- `ProjectResearchSession` reconstructs source lineages on restore rather than trusting persisted labels; the evidence session reports the count of duplicate lineages.
- `EvidenceFirewall` now counts connected publisher↔story-lineage families for external corroboration, blocking multiple domains that republish one story from manufacturing a second independent source. Same-document content-version conflict detection remains intact.
- Canonical MemoryOS2 stores one hypothesis note per source lineage and retains bounded mirror URLs as provenance. Evidence stays hypothesis-only; no semantic entailment or world-truth claim is introduced.
- Added eight source-lineage cases and extended the real `OrganismCore` project-research integration scenario. Runtime TypeScript, claim evidence, lineage, project-research gates and outcome idempotency tests pass.
- Still open: true NLI/semantic entailment, automatic atomic-claim extraction, broader press-release/source genealogy, independent temporal memory holdout, live external provider run, dependency-complete UI build/browser E2E and final release durability gates.

# WorkPass 20 — claim evidence + action receipt integration — 2026-10-11

- Fixed research action mapping so `ActionGateway` no longer drops publisher identity, serving host, fetch timestamp or explicit claim before project-step verification.
- Added claim-scoped exact-text evidence records with stable claim identifiers, support/refute/mixed/unknown verdicts, quote offsets, URL/document identity, page hash, normalized publisher key and retrieval time. The module explicitly refuses to represent exact string matching as calibrated semantic entailment.
- Bound research sessions and MemoryOS2 notes to the canonical claim hash; independent direct support/refute anchors become a visible mixed state. Mixed text evidence now quarantines prior related hypotheses in canonical MemoryOS2 even if different document URLs prevent document-level conflict detection. All unverified external material remains hypothesis-only.
- Fixed autonomous project outcome replay: executor state v5 keeps a bounded persisted 512-ID ledger and associates receipts with exact `executionId`/`stepId`, preventing duplicate and stale outcomes from completing later steps that call the same tool.
- Added an end-to-end Core integration scenario for one-source unknown, two-source textual support, mixed-source quarantine and claim provenance, plus five outcome replay/restart scenarios.
- Aligned root release metadata to `20.0.0-super-final6` and runtime `35.42.0`, synchronized the runtime lockfile, added `audit:workpass20`, and refreshed the normalized task inventory and scorecard.
- Runtime TypeScript, claim evidence cases, external transport/research/firewall/persistence, executor lifecycle/recovery and idempotency suites pass. React/Vite app build, live-provider research, semantic NLI, independent retrieval holdout, browser E2E, rollback drill and soak remain open.

---

# WorkPass 13 — release metadata contract + unified project progress — 2026-10-10

- Aligned root `package.json` version with `SUPER_VERSION.json` (`20.0.0-super-final3`) while preserving implementation-workpass release status.
- Added a root-level `audit:workpass12` alias and a repeatable `audit:workpass13` command.
- Corrected broken install instructions (`npm --prefix app ci`); README and runbook now invoke `npm run install:all`, which runs `npm ci` with the app directory as the actual working directory. Extended the metadata contract test to keep this fix from regressing.
- Added `tools/verify-release-metadata.mjs` to validate version alignment, app/runtime lockfile root identity and dependency consistency, runtime/schema metadata, workpass lineage, changelog/task-list presence and non-release-ready status.
- Added node:test contract tests for a valid fixture, root version mismatch and lockfile drift.
- Reviewed WorkPass 7 scorecard and WorkPass 8–12 reports/tasklists; created normalized, non-duplicated 40-deliverable status inventory: 23 DONE, 8 PARTIAL, 9 TODO.
- Recomputed the fixed-weight implementation scorecard from 63.55% to 67.80% by updating only Memory 2.0 (45%→60%) and transport/replay (20%→40%); this is implementation progress, not release readiness.
- Attempted clean `npm ci` for the UI. It could not complete because registry lookup failed with `EAI_AGAIN`; no dependency-complete UI build or browser E2E is claimed.
- No real-corpus MemoryOS2 uplift or release-ready status is claimed.

# WorkPass 12 — Memory 2.0 confidence-aware review gates — 2026-10-10

- Added an MRR bootstrap non-inferiority gate in addition to the recall-uplift gate; a favorable point estimate is insufficient when uncertainty permits an unacceptable MRR regression.
- Applied the same MRR lower-bound requirement independently to every seed in the multi-seed sensitivity report.
- Exposed an explicit per-gate promotion decision and per-seed failures so reviewers can see all failed conditions. Invalid explicit bootstrap seed values now block candidate eligibility and the effective seed is recorded honestly.
- Made offline JSON report publication atomic and exclusive: flush temp file, publish without overwrite, clean temporary outputs on handled failures.
- Added tests for MRR uncertainty rejection, invalid seeds, CLI report cleanup, no-overwrite, and added `audit:workpass12`.
- Verification: benchmark regression, experiment CLI/regression, runtime typecheck, server import audit (10 checked/0 missing), UI/API linkage (124 routes/48 Atlas surfaces/0 missing) and server smoke all PASS.
- No real-corpus uplift or release readiness is claimed; independent labeled temporal holdout, full UI/browser E2E and clean-room release gates remain open.

# WorkPass 10 — WILL transport contract + channel replay hardening — 2026-10-10

- Bound envelope IDs to canonical request fingerprints; exact repeats return the existing envelope while same-ID/different-request collisions fail explicitly.
- Added a bounded persisted idempotency index and migration-safe snapshot backfill; queue/pending pressure now applies backpressure instead of silently dropping pending deliveries.
- Rejected ACKs for unknown envelopes; detected conflicting ACK outcomes; removed ACKed work from both queue and pending; made replay idempotent and non-recursive.
- Strengthened the Lumina→Will inbound endpoint to validate prior result payloads before replay. Changed-content key reuse and uncommitted/unknown prior outcome now fail closed with HTTP 409.
- Added real HTTP regressions and repeatable `audit:workpass10`. Runtime typecheck, transport/adapter/server smoke, UI/API linkage, import audit, Memory benchmark regression and asset audit passed.
- Does not claim exactly-once remote delivery or release readiness; remote receipts, browser E2E, complete UI build, clean-room recovery and soak remain open.

# WorkPass 9 — external message idempotency contract — 2026-10-10

- Hardened the canonical Conscio peer-message queue: reusing an idempotency key with the same sender, recipient, space, and canonical payload replays the original message; using the same key for a different logical message returns an explicit conflict and does not enqueue a duplicate.
- Hardened the Hexis outbox: blank idempotency keys are rejected, key reuse with changed kind/channel/payload returns an explicit conflict, and existing keys remain deduplicated even after a failed terminal attempt to avoid retry-after-uncertain-delivery duplicates.
- Exposed HTTP 409 for idempotency-key conflicts and HTTP 400 for missing Hexis outbox keys; persisted conflict counters in each existing adapter state.
- Added adapter and real HTTP regressions for canonical JSON key ordering, same-key/different-payload conflicts, missing keys, and replay behavior. Added `audit:workpass9` so this package can be rerun consistently.
- Scope is limited to existing Conscio/Hexis owners; no extra transport, outbox, or delivery owner was introduced.

# WorkPass 8 — memory benchmark evidence integrity — 2026-10-10

- Hardened the existing MemoryOS2-vs-lexical benchmark: duplicate example IDs, repeated normalized queries, train/holdout overlap, duplicated gold labels, unknown relevant memory IDs, malformed examples, and truncated request sets now block candidate eligibility.
- Added explicit dataset provenance (`datasetId`, version, source reference and labeling protocol) as a required evidence gate before a benchmark can mark a candidate eligible for separate review.
- Made dataset/corpus fingerprints and paired query ordering deterministic; added seeded bootstrap confidence intervals for recall@k and MRR.
- Connected bounded seed/sample/provenance options through the existing HTTP endpoint and expanded benchmark/server-smoke regressions. The endpoint remains read-only and does not auto-promote candidates.
- Validation: benchmark regression and runtime TypeScript typecheck pass. Synthetic fixtures are harness tests only; a real labeled multi-seed holdout, complete UI build/browser E2E, recovery and soak remain open.

# WorkPass 6 — agency evidence + reafference — 2026-10-09

- Added a WILL-inspired, bounded `AffordanceField` projection to canonical `OrganismDecisionTrace`; the trace explicitly records that the layer does not influence selection and that `OrganismCore` remains the selector owner.
- Added `ReafferenceEvidenceCodec` to link externally observed postconditions to one exact pending canonical decision; evidence gates distinguish confirmed outcomes from independently corroborated contradiction. Feedback returns through existing `CanonicalTemporalCreditAuthority` and `adaptivePolicy` only.
- Fixed target-specific temporal-credit resolution so a provided `decisionId` cannot credit unrelated pending decisions in the same temporal window.
- Fixed directional contradiction strength for explicit same-field conflicts, preventing lexical mismatch from erasing strong contrary evidence.
- Added five regression tests; they cover candidate projection, exact credit targeting, contradiction accounting, evidence gates and a real core integration including state snapshot/migration/restart persistence.
- Runtime typecheck, integration-workpass, server smoke, WILL 9/9, WILL surfaces 3/3, Lumina 3/3, Hexis, Letta and Conscio targeted integration gates pass.
- Weighted roadmap score updated to 60.0% (+3.0 percentage points); this is implementation progress, not release readiness. Full app build/browser E2E, Memory 2.0 holdout, recovery/rollback and soak remain open.

# WorkPass 5 — agency execution contract — 2026-10-09

- Added a versioned MotorSchema contract with bounded steps, safe identifiers, validated action kinds, prior-step-only bindings, declared output checks, bounded attempts/resource cost and verified-only execution.
- Connected MotorSchema compilation to the existing `ProceduralSkillLibrary`; it does not introduce a second skill database or executor. Execution still uses the canonical `ActionGateway`, postcondition verification and existing procedural-skill promotion rules.
- Extended `ActionGateway` with optional fail-closed availability and competence gates and explicit outcome classes: `unavailable`, `competence-insufficient`, `policy-refused`, `execution-failed`, `executed-unverified`, `executed-verified`.
- Kept policy refusal separate from competence and execution results in the action audit; `OutcomeCognitionFabric` now persists the class for normal, compound-skill and project tool calls. The MotorSchema input validator uses real UTF-8 byte counts, canonical JSON normalization, and fail-closed handling for cycles/non-plain objects. Added `npm run audit:workpass5` plus targeted regression coverage.
- Overall roadmap score is now 57.0% on the weighted scorecard; this is implementation progress, not release readiness. Full typecheck/app build, browser E2E, benchmark holdout, clean-room recovery and soak remain open.

# Hotfix — 2026-10-09

- Fixed a production chat failure where synchronous WILL language-completion telemetry returned `undefined`, but the server attempted to await `.catch()` on that value. Attribution now remains best-effort and cannot invalidate a successful chat response.
- Extended the real HTTP server smoke test to POST `/api/organism/chat` and assert a valid language response.


## 2026-10-08 — Hexis integration

- Added Hexis evidence-based belief revision, source-independence accounting and temporal memory projections.
- Added learning review, retention/forgetting governance and fidelity receipts.
- Added guarded HMX 1.7 portable subject staging/export/import against canonical MemoryOS.
- Added transactional outbox and connector policy/rate/approval gates.
- Added risk-aware execution placement and persistent integration state.
- Added active Hexis Control Center; all current 41 integration API methods have UI coverage with no missing routes or unused methods.
- Excluded credential-bearing Hexis `.env.local` and Gmail OAuth secret JSON from provenance.
- Kept full Hexis PostgreSQL/Agent/Memory/Identity stack out of canonical runtime to preserve single-owner architecture.

# Changelog — 2026-10-08

## WILL integration Pass 2 / project hardening

- Completed the dedicated WILL integration block at 17/17 mechanisms while keeping Neuro-Kurisu as the single canonical organism owner.
- Reworked deterministic vector retrieval into a deterministic HNSW-style graph adapter with measured distance-comparison counts and explicit recall/reduction promotion evidence.
- Added provider/model completion attribution to the persistent WILL integration state.
- Added provider-neutral subject SDK semantics, MCP-compatible JSON-RPC tools/resources, and isolated Discord/WhatsApp/HTTP/MCP/generic channel mapping.
- Added transport replay re-feed, idempotent ACK accounting and tamper-evident record-chain verification.
- Moved WILL integration ownership into OrganismSystemFabric so OrganismCore keeps the canonical ownership boundary.
- Hardened HTTP surface with request rate limiting, payload size enforcement, malformed JSON handling and explicit timeout configuration.
- Expanded server smoke coverage to the WILL SDK/MCP/integrity surfaces.
- Added a version matrix and Pass 2 integration report documenting available Library archives/checksums and the exact source baseline used.
- Restored the live `canonicalSelfAgencyAuthority` bridge expected by the existing self-agency integration test without creating another authority instance.
- Serialized concurrent `FileStateStore` writes per store and corrected the concurrency/P7 test cleanup to await the durable runtime stop boundary.

## Validation

- Runtime TypeScript typecheck: PASS.
- WILL integration tests: 9/9 PASS.
- WILL SDK/MCP/channel surface tests: 3/3 PASS.
- Server smoke: PASS.
- Organism smoke: PASS.
- Integrity audit: PASS.
- Architecture audit: PASS (cycles=0, legacyLeakage=0).
- Core ownership audit: PASS (directConstructors=5).
- Release contract, source-truth and hygiene audits: PASS.
- Full UI dependency/browser gates remain environment-blocked by absent `app/node_modules`; no false PASS is claimed for those release gates.

# Changelog — 2026-10-06

## SUPER internal optimization / integration hardening

- Restored the complete original Grok Workspace `.grok` reference/skills tree in `app/.grok`.
- Reworked canonical UI normalization to remove synthetic zero-filled inner-world and empty embedding projections.
- Wired UI identity traits directly to canonical `neuralGerminalOrganismB270.traitValues`.
- Replaced the Live2D error-state portrait label with an explicit unavailable state; no procedural avatar fallback remains.
- Renamed legacy outfit logic as visual-profile compatibility and restricted it to the 32 real sprite assets.
- Removed an unreachable duplicate `sum3` symbolic expert branch.
- Added repeatable inventory/asset-audit tooling and refreshed integration/version contracts.
- Release excludes generated runtime state, caches, bytecode and dependency trees.

# Changelog — 2026-10-05

## SUPER merge

- Established Neuro-Kurisu 35.40.0 as the single canonical writable organism runtime.
- Converted the Grok Workspace browser organism into archived reference code; the UI now consumes canonical runtime state over HTTP.
- Added canonical `/api/organism/ui-snapshot` integration and backend-driven chat state.
- Added Live2D messaging/embodiment synchronization and local vendor-first loader with CDN fallback.
- Integrated 32 Kurisu v9 sprite frames plus the v9 sprite resolver/outfit catalog and v56 crossfade presentation pattern.
- Reworked Labs to show canonical semantic-world metrics rather than maintain a second browser brain.
- Added P33 identity trait display to the HUD.
- Added a research bridge for NeuroCore V143, NOMEGA Pass20 and DeepCode v21.
- Added ownership and integration manifests plus branch comparison evidence.
- Fixed P38 replication-consistency semantics in Neuro-Kurisu.
- Fixed DeepCode RSSM reshape, Option-Critic batch shape, and BYOL burn-in/action sequence alignment.
- Fixed DeepCode gradient audit timing so gradients are measured before optimizer clearing.
- Added `app/.grok/app-env.json` to restore the Workspace's documented auth-off template contract without introducing secrets.
- Preserved uploaded source archives under `legacy/input-archives/` for provenance.

## Validation

- Neuro-Kurisu runtime typecheck: PASS.
- Neuro-Kurisu smoke/server/P34/P25/P26/P38 and core-ownership audits: PASS.
- NOMEGA selected Pass20/consolidation/evidence tests: 16 PASS.
- NeuroCore V143 tests: 8 PASS.
- DeepCode 300-step CPU smoke: PASS.
- Independent Workspace utility test subset: 189/197 PASS; the remaining failures depend on hidden `.grok/skills/og` reference fixtures that were not present in the source archive.
- Full UI typecheck/build remains environment-blocked by unavailable `app/node_modules` in this execution environment.


## 2026-10-08 — final hardening v2

- Added byte-accurate API body limits and correct 413/400 semantics.
- Added Runtime Atlas read-only UI surface and expanded client wiring audit.
- Removed generated Python bytecode from shipped provenance tree.
- Added release tooling: doctor, install, backup/restore, migrate, schema/version/config migration, SBOM, freeze and final verification.
- Added operational alert thresholds and runtime health guard.
- Added rollback parent metadata and reverse-apply rollback patch.
- Revalidated WILL/Lumina/Hexis integration, persistence recovery and R22/R23/R26 targeted neural/world/memory regression suites.
## FINAL3 — Letta governance + release hardening

- Added Letta-derived source-branch state boundaries: canonical/research/legacy/provenance-only.
- Added configurable telemetry policy with local-only/redaction/export controls.
- Added generated-artifact provenance and human-review promotion gate.
- Added credential-bearing provenance path audit.
- Preserved `letta-main-2026-10-08.zip` as provenance-only source; no Letta runtime/database imported.
- Fixed the final release runner to include Letta governance and HTTP hardening tests.
- Increased input-hardening readiness window to accommodate canonical runtime startup.
- Re-generated archive manifest after all release metadata changes.
- Runtime typecheck and targeted integration/recovery gates pass.


## FINAL4 — 2026-10-08 — Conscio 4.8.2 integration

- Added Conscio-derived FTS5/BM25/trigram/RRF retrieval as an index over canonical MemoryOS data.
- Added evidence-gated skill federation: quarantine → trial → review → promotion, with post-review immutability.
- Added source-state boundaries and provenance-only protection for external branches.
- Added liaison peer pairing, trust/revoke, queued messages, ACK and idempotency-key support.
- Added confidence observations, Brier/ECE calibration and evidence-required supported claims.
- Added Conscio metabolic context advisory layer without granting it action authority.
- Added Conscio HTTP APIs and an active UI Control Console; every Conscio API method is directly reachable from UI.
- Extended the global UI wiring audit to include Letta and Conscio surfaces.
- Hardened global server-smoke with request-level timeout protection and revalidated SERVER_SMOKE=PASS.
- Hardened source-boundary classification so `input-archives` resolves to provenance-only before legacy matching.
- Preserved Conscio source and external-branch provenance under `legacy/input-archives/external-sources`.
- Verified runtime typecheck, WILL/Lumina/Hexis/Conscio integrations, persistence, restart, memory, concurrency and server smoke.

## FINAL4 — Conscio integration and release closure

- Added source archive registry with raw safe archives and sanitized Hexis provenance.
- Added Conscio integration contract and FINAL4 source coverage/release reports.
- Added Conscio UI controls for source boundaries, skill reject/promotion, peer revoke/ACK and claim/calibration operations.
- Hardened Conscio FTS5 query construction against malformed MATCH expressions.
- Hardened Conscio source classification so provenance paths cannot be mistaken for canonical/legacy paths.
- Hardened Conscio skill lifecycle and peer ACK/idempotency behavior.
- Hardened global server-smoke request timeouts to prevent an individual hanging endpoint from stalling the entire smoke suite.

## 2026-10-09 — Canonical HOTFIX_CHAT v20 integration workpass

- Used the supplied `Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_HOTFIX_CHAT_v20_2026-10-09.zip` as the base. Changes were ported selectively; older WorkPass trees were not overlaid wholesale.
- Integrated `AdaptiveMemoryStrategyReadout` with canonical MemoryOS retrieval and `PolicyAuthorityLedger` as an evidence-gated advisory signal (absolute action bias capped at 0.03); state and migration support are persisted in the canonical organism state.
- Added read-only `PortableSubjectFidelity` diagnostics over the existing portable-subject contract. The API explicitly does not assert behavioral equivalence.
- Added `ContextBudgetLedger` to both normal and proposal prompt builders, routed external user text through the budgeted user section, and exposed content-free omission receipts via the canonical runtime API.
- Added read-only `/api/organism/memory-strategy`, `/api/organism/subject-fidelity`, and `/api/organism/context-budget`; connected all three to the shared API client and Runtime Atlas. Corrected the sensorium API client/Atlas path to `/api/organism/sensorium/status`.
- Added portable output-path resolution to NeuroCore V143 benchmarks using `NK_NEUROCORE_V143_OUTPUT_DIR`, with project-local evidence as the default.
- Unified backup/restore wrappers around a shared SHA-256-verified helper; restore requires explicit confirmation and will not overwrite while the runtime lock is active.
- Added server-import and API/UI linkage audits, regression tests, root/runtime npm scripts, a server smoke covering the real chat path and new routes, and an updated task list.

### WorkPass 4 verification status

- Passed: integration workpass audit bundle, real HTTP server smoke, organism smoke, WILL integration/surface tests, Lumina, Hexis, Letta governance, Conscio adaptation/UI/server smoke, and NeuroCore portable-path tests.
- Not claimed: complete React/Vite production build, full root typecheck, browser E2E, clean-room upgrade/rollback, long-duration soak, or release-candidate sign-off. The root typecheck is currently blocked by missing `@types/node` and `vite/client` dependencies in this environment.



## 2026-10-09 — WorkPass 7: KnownEntityDossier + Memory retrieval benchmark

- Added `KnownEntityDossier` as a read-only, source-linked projection across the existing WILL bridge, canonical B288 social state, and MemoryOS2; no separate identity, social, or memory owner was introduced.
- Added conservative known-entity prompt context to normal and cognitive-proposal flows via `ContextBudgetLedger`, bounded by freshness/confidence/source-authority and marked as untrusted data rather than instructions.
- Added matched baseline-vs-MemoryOS2 retrieval benchmark with isolated snapshot clones, explicit train/holdout labels, retrieval quality/safety measures, dataset/corpus fingerprints and a non-automatic promotion gate.
- Added bounded `/api/organism/known-entities` and `/api/organism/memory-benchmark` surfaces, frontend client methods, Runtime Atlas linkage and regression tests.
- Verification: `audit:workpass7`, runtime typecheck, targeted regressions, server imports, UI/API linkage, HTTP server smoke and `audit:quick` PASS. The synthetic benchmark fixture validates the harness only; no production MemoryOS uplift or release readiness is claimed.


## WorkPass 11 — MemoryOS2 retrieval experiment reproducibility (2026-10-10)

- Fixed corpus fingerprint coverage: all canonical memory-row fields now affect the SHA-256 fingerprint; rank-affecting policy state has a separate retrieval-configuration fingerprint.
- Removed insertion-order bias at the 192-candidate cutoff: query-term inverse-document-frequency support and stable ID tie-breaks choose the bounded candidate pool; fallback and revision expansion are ordered deterministically. RRF tie-breaking is also stable by memory ID.
- Added corpus integrity checks for malformed rows, duplicate memory IDs and corpus truncation; ambiguous corpus state blocks independent-review eligibility.
- Extended benchmark safety metrics for future-valid, dormant and unsupported epistemic-status results, with fail-closed eligibility gates.
- Added a bounded offline experiment runner for up to 512 independently labelled JSONL examples and multiple paired-bootstrap seeds. It records confidence-bound sensitivity and requires stable retrieval metrics/fingerprints across runs.
- Added CLI regression tests, a reproducible command, and the dataset/provenance/labeling protocol. No real production corpus or uplift is claimed, and candidates are never auto-promoted.


## WorkPass 14 — UI regression isolation and browser baseline enforcement (2026-10-10)

- Isolated app PWA/share-card tests from the real workspace's `site.json` and `public/` assets; all 202 app script tests now pass.
- Browser smoke baseline comparison now detects new error signatures and increased repeated occurrences, even if the baseline already contained unrelated errors.
- Explicit baseline divergence now returns exit code 3; navigation failures (1) and runtime console/page errors (2) retain priority.
- Added root `test:app:scripts` and `audit:workpass14`; release metadata contract resolves current status/scorecard from the active WorkPass build lineage.
- UI dependency installation, React/Vite build, actual Playwright E2E and release recovery remain blocked/unverified in the current environment.

## WorkPass 15 — bounded evidence bus and fail-closed outcome verification (2026-10-10)

- Replaced random RuntimeEvidenceBus event suffixes with monotonic sequence-based IDs and persisted the sequence compatibly.
- Validated evidence kind/tick, normalized causal parent links, detached payloads from callers, and bounded payload depth, key count, array size, string length and total budget.
- Hardened snapshot restore against malformed rows, duplicate IDs, invalid counters and invalid confidence values. Lifetime counters now remain distinct from buffered-window counters in diagnostics.
- Hardened OutcomeVerificationService by giving registered verifiers an isolated immutable copy of action inputs/results, requiring a non-empty receipt ID for external verified observations, rejecting unsupported bases, bounding returned note/postcondition text and failing closed on exceptions/non-serializable context.
- Fixed server-smoke startup polling to use a bounded global deadline, 1s per-probe timeout, child-exit detection and bounded process cleanup; added deterministic poll unit tests.
- Added focused regression suites and root/runtime `audit:workpass15` commands; retained WorkPass 14 and prior historical evidence.
- Verification: runtime tsc, evidence-bus/outcome/reafference/agency/memory regressions, server import audit, static UI/API linkage and Live2D/sprite reference audit pass. Full React/Vite build and actual browser E2E remain blocked by unavailable UI dependencies/network.


- WorkPass 15 follow-up: server-smoke locates the runtime package from `import.meta.url` rather than assuming the shell starts inside the runtime directory; verified from the repository root.

## WorkPass 16 — browser release gate hardening (2026-10-10)

- Browser smoke now fails on required `BRAND WARNING:` items and actual dev/build auth divergence; utility `BRAND NOTE` remains advisory and indeterminate auth probes are explicitly recorded.
- Validates `BROWSER_SMOKE_TIMEOUT_MS` as an integer from 1000 to 180000 ms before launching Chromium.
- Publishes browser smoke JSON verdicts atomically using a private mode-0600 temporary file, fsync and same-directory rename; failed publish preserves the previous verdict and cleans up temporary files.
- Added browser gate/timeout/auth/atomic-write regression tests; app source-only script suite passes 212/212. The bounded `npm run audit:workpass16` gate passes; the independent offline memory experiment is exposed as `npm run audit:workpass16:memory-experiment` after intermittent stalls when nested in long chained invocation. The first over-broad chain exceeded the environment execution window and was narrowed to changed/critical gates.
- Release metadata validator: 34/34 checks PASS; release metadata fixtures: 6/6 PASS. Focused app/browser gate tests: 66/66 PASS; runtime typecheck PASS; memory benchmark PASS and remains not-promoted on synthetic data.
- Release inventory: 51 unique deliverables (34 DONE / 9 PARTIAL / 8 TODO); weighted implementation estimate 68.65%, not release readiness.
- Direct app typecheck fails with missing `@types/node` and `vite/client` (`TS2688`); `npm run build` fails with `spawn vite ENOENT`; `npm ci` did not finish in 120 seconds. React/Vite build and live browser E2E remain open.



## WorkPass 17 — project research and evidence-gated progress (2026-10-10)

- Replaced the project's nominal second observation with the canonical HTTPS research tool; requires external evidence and EvidenceFirewall promotion before the DAG can complete the repeat/consolidation steps.
- Added URL/network-policy/HTTPS/host-allowlist preflight before spending execution budget or retry attempts.
- External EvidenceFirewall promotion now requires at least two independent source identities and two distinct content hashes, preventing mirrored identical bytes from counting as corroboration.
- ProjectResearchSession derives diversity and promotion diagnostics from canonical firewall state after restore.
- Research ingestion now records evidence without directly advancing the active project step; only the executor can complete the planned step. Unrelated tool failures no longer consume the current step retry budget.
- Added real Core + firewall + research + planner regression tests. Focused workpass audit, runtime typecheck, project lifecycle/recovery/scheduler tests, server imports and UI/API linkage pass. External provider and browser UI release gates remain open.


## WorkPass 19 — provenance-bound research memory and publisher identity (2026-10-11)

- Integrated eligible external excerpts into the existing canonical `MemoryOS2` instead of adding a parallel memory owner. Single-source results remain in the bounded project-research session; diversified source/content results become capped-confidence `hypothesis` records, never facts.
- Conflicting/rejected source material moves previously recallable research notes back into quarantine. The Core regression covers one source → independent second source → conflicting repeat, plus persistence across a process restart.
- Publisher identity is now derived from the actual serving hostname and normalized across common multi-label suffixes and multi-tenant hosts. Caller-supplied independence labels are not trusted by the session gate; legacy restored source rows use the same normalization.
- Bounded source URL/title/snippet/content-type/hash/query/time provenance and explicit firewall status survive state migration. Runtime version is 35.41.0.
- `npm --prefix runtime/neuro-kurisu run typecheck` passes in TypeScript compiler mode; the focused research transport suite passes 14 scenarios and the project/Core suite passes, including persistence.
- This is not semantic claim verification: source diversity remains weaker than entailment. Live external provider execution, production UI build, browser/Live2D E2E, clean-room rollback and soak remain open.


## WorkPass 18 — DNS-pinned, query-bound external research (2026-10-10)

- Replaced unpinned global `fetch` with a bounded HTTPS transport that pins each request to a vetted DNS address, validates TLS against the original hostname, rechecks every redirect and enforces content-type/byte limits.
- Expanded public-address checks for IPv4 special-use ranges and non-global IPv6; mixed public/private DNS answers fail closed. DNS resolution has its own deadline.
- Required a specific research query (three or more distinct topic terms), added a deterministic query fingerprint and a lexical content-relevance gate. Query hash scopes the `ProjectResearchSession`/firewall claim; unrelated or low-relevance pages are not ingested as external evidence.
- Added 13 deterministic transport/relevance regressions and updated `audit:workpass18`. Runtime semantic TypeScript and project-research regression suites pass.
- Live outbound research was not validated in this environment: DNS resolution for `example.com` returned `dns-resolution-failed`. This pass does not claim production external-provider success or semantic entailment validation.


## WorkPass 23 — safe batched NLI + holdout evaluator (2026-10-11)

- Pin local `cross-encoder/nli-deberta-v3-xsmall` to immutable commit `a150876415327c80daeff35ca6f68f5ed8cf5c24`; refuse mutable revision aliases, disable `trust_remote_code`, require safetensors and validate exactly three expected labels.
- Add `/v1/nli/batch` (up to 24 pairs) and canonical `ResearchSemanticEntailment.evaluateBatch` integration, reducing per-document HTTP/tokenizer overhead while preserving single-pair backend compatibility.
- Bound NLI service worker concurrency, return retryable 503 under overload, and cap PyTorch thread count.
- Add `tools/evaluate_research_nli.py` for a labelled JSONL holdout: stable input hash, confusion matrix, accuracy/macro-F1, per-class precision/recall/F1, cross-entropy, Brier and ECE; private atomic report excludes source text and remote endpoints require opt-in.
- Deterministic integration coverage: 20 mocked semantic NLI cases; 9 NLI service tests; 4 evaluator CLI/metrics/privacy tests; runtime TypeScript check passes.
- Added conservative high-overlap token-trigram detection for near-identical train/holdout queries; tiny edits no longer bypass exact-query leakage checks. Aggregate diagnostics do not store query text, and the benchmark still refuses promotion without a genuine independent holdout.
- Preserved backward compatibility with older single-only NLI services: only HTTP 404/405 on `/batch` triggers bounded single-pair calls; 503, timeout and malformed responses remain fail-closed without request fan-out.
- Runtime is `35.46.0`; root version is `23.0.0-super-final10`. Runtime and root release gates pass. Real pretrained inference and UI build remain unconfirmed because registry DNS is unavailable; no model quality uplift or release readiness is claimed.


## WorkPass 24 — NLI readiness and provenance consistency (2026-10-11)

- Separate process liveness from model readiness with `/livez`, `/healthz` and `/readyz`; readiness remains 503 until the model is loaded.
- Add a sanitized cooldown after dependency/model-artifact load failures. With `--lazy-model-load`, the process can be supervised while loading happens in a bounded background attempt; default startup remains fail-fast.
- Persist model revision from the local NLI HTTP response into atom/quote/aggregate claim evidence. Refuse evidence assessment if the serving model identity changes mid-assessment.
- Validate persisted NLI model ID/revision consistency during research-session restore, rejecting mismatched semantic quotes while retaining compatibility for old snapshots without version metadata.
- New coverage: 23 semantic NLI cases, 10 Python service tests, 4 evaluator tests; research Core gate and memory benchmark pass. All model tests use controlled/mock inference. Real pretrained inference and UI build remain open due blocked DNS/dependency installation.


## WorkPass 28 — single-digit numeric retrieval correction (2026-10-13)

- MemoryOS2 now retains standalone single-digit numeric terms; status codes and one-digit measurements no longer disappear before candidate selection. Single-letter words remain excluded.
- The BM25 comparator uses the same numeric tokenization contract; retrieval configuration fingerprint explicitly captures the algorithm/tokenizer version.
- Added English/Russian numeric retrieval and temporal-expiry regressions. `typecheck`, candidate coverage, retrieval benchmark and multi-seed experiment pass.
- Corrected synthetic fixture is at Recall@5 parity with BM25 (1.00 vs 1.00; delta 0.00). WorkPass27's -0.25 result was confounded by omitted single-digit terms; no general uplift is claimed and promotion remains blocked pending an independent labelled temporal holdout.


## WorkPass 29 — глубокая интеграция Memo × MemoryOS2 × Hexis (2026-10-13)

- Исправлено восстановление canonical content indexes: после загрузки snapshot активная/последняя revision выбирается по временной валидности, статусу, revision sequence и observation time, а не по случайному порядку строк. Возврат к прежней формулировке больше не заставляет старую expired-строку перехватывать `contentIndex`.
- `reviseContent` стал lineage-aware: одинаковый текст — no-op без self-supersede; изменённый текст получает стабильный ID в контексте цепочки и revision sequence, даже если такая формулировка ранее встречалась. Коррекция, вызванная по historical ID, направляется на актуальный tip той же цепочки.
- Повторное наблюдение для content, существующего только в expired/historical состоянии, не перезаписывает historical ID и его validity boundary.
- Добавлены read-only `MemoryOS2.temporalAt()` / `temporalDiff()`. Hexis temporal lookup/diff теперь проецирует canonical MemoryOS2 timeline; собственные Hexis temporal rows остаются audit/export projection, не источником истины.
- Исправлены выборки Hexis: Memory Index отдаёт актуальные записи, синхронизация ограничивает и упорядочивает недавнюю историю, а default learning review берёт до 12 самых недавно затронутых live memories вместо старейшего хвоста newest-first списка. Explicit memory IDs остаются доступными для ревью истории.
- Починен dedup-index при вытеснении/forgetting: после удаления старой записи ключи повторно выбирают лучшую из оставшихся записей, а не стирают ссылку на актуальный дубль. Добавлен регрессионный сценарий заполненного корпуса на 1600 записей, где вытесняется истёкшая копия.
- Добавлен `tests/memory-source-integration-workpass29.mjs` с regressions для snapshot/restore, повторного использования старой формулировки, no-op revisions, переизвлечения expired content, безопасного индексирования после capacity eviction, canonical Hexis temporal delegation и отбора свежих элементов на ревью.
- **Проверки:** runtime typecheck, temporal inspector closure, candidate coverage, numeric retrieval, R15/R16 behavior и integration regression проходят. Внешний root audit и production browser/Live2D E2E проверяются отдельно; этот проход не утверждает release readiness или retrieval-quality uplift.
- **Открыто:** независимая labelled temporal holdout против BM25, React/Vite production build и browser E2E, real NLI inference, clean-room recovery/rollback, soak и release sign-off.


# WorkPass 33 — local semantic embeddings in canonical retrieval — 2026-10-13

Added an optional local embedding provider (Ollama and llama.cpp/OpenAI-compatible APIs), bounded model-keyed caching and progressive indexing, semantic candidate ranking in MemoryOS2, explicit Runtime Atlas toggle and fallback diagnostics. Canonical MemoryOS2 remains the only memory owner; provider failures fall back to deterministic BM25/fuzzy/graph search. Real local model inference and independent temporal holdout uplift remain open. Runtime version 35.56.0; root package 33.0.0-super-final19.

## WorkPass 34 — latency-bounded semantic retrieval in the cognitive cycle (2026-10-13)

- Connected the optional local embedding retrieval path to the ordinary `OrganismCore.observe` flow through `MemoryFabric`; semantic hits now feed the memory rows used by cognitive decisions when explicitly enabled with `NK_EMBEDDINGS_RUNTIME_ENABLED=1`.
- Kept BM25/fuzzy retrieval as the immediate canonical fallback. Foreground semantic wait defaults to 220 ms and is configurable between 50 and 1000 ms; indexing is capped at 12 document vectors per request.
- Added a single-flight guard so slow Ollama/llama.cpp requests do not pile up on successive turns. A timed-out foreground attempt falls back immediately while its one bounded indexing job can finish warming the derived index.
- Added total provider-batch deadlines so the configured timeout covers every chunk, not each chunk independently.
- Added WorkPass34 integration coverage for live semantic ordering, timeout fallback, provider failure and concurrency bounds. The fixture does not claim real model inference or retrieval-quality uplift.

## WorkPass 66 — reproducible dual-workspace installation and release contract (2026-10-19)

- Fixed `npm run install:all`: it now validates and runs lockfile-clean `npm ci` for both `app/` and `runtime/neuro-kurisu/`, rather than installing only the app. Registry retry/fetch and overall deadlines are bounded; the first workspace failure is explicit and fail-fast.
- Runtime typecheck now prefers the compiler installed under the canonical runtime/app lockfiles before falling back to global `tsc`; syntax-only fallback remains explicitly labelled.
- Fixed an existing release contract break found by rerunning the actual gate: WorkPass65 `VERSION.json` and runtime package said `35.85.0 / WorkPass65`, but `RELEASE_MANIFEST.json` and `RELEASE_ARCHIVE_MANIFEST.json` still said `35.84.0 / WorkPass64`. Bumped runtime to `35.86.0 / WorkPass66` and regenerated manifests.
- Added 4 install-orchestration tests plus pinned-compiler selection regression. App scripts remain 218/218 and browser-smoke comparator contract 51/51.
- Registry DNS cannot resolve `registry.npmjs.org` in the current environment. The locked app dependency install and production build remain blocked; no live provider/device or browser/Live2D E2E is claimed. Official weighted roadmap remains 80.1%; release gates remain open.

## WorkPass 68 — canonical TTS gateway and ambiguous outcome handling (2026-10-19)

- Routed `EmbodimentRuntime` Termux speech dispatch through `OrganismCore.executeTool` and the canonical ActionGateway; stable `speechEventId` is bound to a durable idempotency key.
- Added typed Termux outcomes: `completed`, `not-started`, and `unknown`. A post-start timeout, signal, or non-zero exit remains ambiguous because audio may already have begun; command completion is not reported as independently verified playback.
- Ambiguous speech is retained as unresolved evidence and does not increase embodiment failure streak/cooldown or produce false negative skill/reliability credit.
- Added fake-process tests and gateway-boundary/recovery tests. Runtime typecheck and the new tests pass; archived receipt recovery suites also pass when run individually. A long nested aggregate command timed out at the execution wrapper and is not recorded as a single PASS.
- Synchronized root integration manifest and runtime release owners at 35.88.0 / schema 225. App dependency installation remains blocked by npm registry DNS; live Android/audio and browser/Live2D E2E remain open. Memory retrieval candidate remains unpromoted at recallDelta=0; roadmap score stays 80.1%.


## WorkPass 80 — cold-memory retrieval invariants (2026-10-20)

- Added a deterministic regression with a 140-record corpus that forces an old, low-salience record into cold residency, then verifies it remains recallable by lexical retrieval without materializing a vector or silently changing residency.
- Added snapshot/restore coverage for cold records, candidate budget (192), and canonical memory index integrity.
- Wired the regression into runtime scripts and the WorkPass79 GitHub Actions workflow; test:workpass80 combines the new memory regression with the local-language reliability suite.
- **Evidence status:** PASS in GitHub Actions run [39371651412](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39371651412): corpus 140, tiers hot/warm/cold 16/64/60, materialized vectors unchanged at 80, target recall and restore recall true, candidate count 140, index integrity true. This is a residency/integrity invariant, not an independent RU/EN retrieval-quality benchmark. No Recall@k, MRR, transfer-learning, or overall readiness uplift is claimed.


## WorkPass 81 — caller cancellation for local inference (2026-10-20)

- Extended the existing `OpenAICompatibleLocalChatProvider` request contract with an optional caller-owned `AbortSignal`; provider timeout and caller cancellation are composed rather than one replacing the other.
- Added stable `llama.cpp-request-aborted` normalization for caller cancellation before dispatch, during transport, and while reading a bounded response; deadline failures normalize to `llama.cpp-timeout`.
- Extended the provider boundary regression for in-flight and pre-aborted requests. This proves the provider boundary honors a signal when its caller supplies one; it does not prove every upstream cognitive-cycle caller currently forwards cancellation.
- **Evidence status:** PASS in GitHub Actions run [39371651412](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39371651412): timeout abort and caller cancellation (in-flight and pre-aborted) passed alongside HTTP 503, malformed JSON, empty output, response-size limit and loopback-only checks. Real llama.cpp cancellation, upstream end-to-end signal forwarding, and process restart/recovery remain unverified.


### WorkPass81 follow-up — deterministic timeout test harness (2026-10-20)

- GitHub Actions exposed that Node's `AbortSignal.timeout()` timer is unreferenced: the test's unresolved top-level await could terminate with exit code 13 before the timeout fired. The focused test now holds the process open only for the expected timeout window and asserts the normalized `llama.cpp-timeout` outcome.
- Follow-up run [39371651412](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39371651412) passed the cold-memory regression, policy test, provider-boundary suite and server HTTP smoke.


## WorkPass 82 — end-to-end cancellation of in-flight language generation (2026-10-20)

- Propagated the request `AbortSignal` from `/api/organism/chat` through `OrganismRuntime.step`, `LanguageRequest`, `invokeLanguage`, and the local provider. The server aborts generation when the client disconnects and avoids writing a response to a destroyed socket.
- Local cancellation is no longer recorded as a normal llama.cpp provider failure and does not fan out into fallback generation. Kobold/Gemini fetches also compose the caller signal with their deadline, and provider iteration stops when the request has been cancelled.
- Added `tests/workpass82-server-language-cancellation.mjs`: starts a real NK1 server plus a controlled loopback chat-completions endpoint, disconnects the client during generation, and requires the upstream provider socket to close before the 12-second provider deadline.
- Wired the E2E cancellation test into the WorkPass79 Actions workflow. **PASS** in [Actions run 39372093088](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39372093088): the controlled provider received one request and observed one upstream disconnect after the chat client disconnected, well before the 12-second provider deadline. This controlled loopback test does not substitute for live llama.cpp or restart/soak testing.


## WorkPass84 — целостность npm scripts и локальных тестовых целей (2026-10-20)

- Добавлен `runtime/neuro-kurisu/tests/workpass84-script-integrity.mjs`: проверяет, что все `npm run <target>` из runtime `package.json` ссылаются на объявленные scripts, а все статические `tests/*.{mjs,cjs,js,ts,mts,cts}`-цели существуют внутри каталога тестов.
- Одноразовый аудит обнаружил три настоящие битые ссылки: пропущенный префикс `test:` у `long-horizon:operational:1000`, неверное имя `test:big-pass-317` вместо существующего `test:big-pass-317:reality`, и ссылку `test:p2852:neural-continuity` вместо существующего канонического `test:p2850:neural-continuity`. Исправлены все три; assertions не ослаблялись.
- Новый script подключён к WorkPass79 GitHub Actions workflow.
- Предварительная проверка обновлённого manifest: 1,655 scripts; 3,334 `npm run`-ссылки без отсутствующих targets; 1,286 статических ссылок на тестовые файлы. Это локальная проверка manifest-данных, не замена ожидаемому результату Actions.
- **PASS:** GitHub Actions run [39374168533](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39374168533) на кодовом HEAD `b95235b5696667ad96cc6f1d63c11f4b91a96ee8`: audit `WORKPASS84_SCRIPT_INTEGRITY=PASS` (1,655 scripts; 3,334 npm-run references; 1,286 static test-file references; zero missing targets/files), WorkPass80 residency, WorkPass83 benchmark truthfulness, WorkPass79 provider policy/boundary, WorkPass82 cancellation and server smoke all passed. Later commits in this PR only add research documentation; their exact-head Actions run is separate.
- Scope: ловит отсутствующие npm script targets и отсутствующие статические test files; не доказывает достижимость/качество каждого теста и не является полным аудитом динамических import/require.


## Research gate — long-term memory and continual learning (2026-10-20)

- Added `docs/RESEARCH_GATE_MEMORY_CONTINUAL_LEARNING_2026-10-20.md`, synthesizing LongMemEval (ICLR 2025), MemoryAgentBench (2025), MemBench (ACL Findings 2025), Memora/FAMA (ACL 2026), FOREVER (ACL 2026), modular-memory continual-learning work (ICML 2026), and Titans.
- The actionable changes are evaluation gates, not unverified architecture imports: separate retrieval from answer correctness; test temporal updates, abstention and stale-memory use; evaluate incremental learning and selective forgetting; track language-specific quality, resource cost and restart recovery; preserve independent holdout integrity.
- Paper and dataset/code links are recorded in the research note. No external dataset or implementation was copied into the runtime; licensing/schema compatibility must be checked before any direct import.
- **Evidence status:** research synthesis only. No NK1 quality improvement is claimed; WorkPass83 remains a synthetic harness test with zero observed uplift.


## Verification update — research-note branch HEAD (2026-10-20)

- **PASS:** [GitHub Actions run 39374347662](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39374347662) completed successfully on HEAD `b440066e49eca7cf098cbbe99267962a9eb564d6`, including WorkPass84 integrity audit, WorkPass80/83 memory tests, WorkPass79 provider tests, WorkPass82 cancellation and server smoke.
- The run includes the research-note and handover updates; those documents do not change runtime behavior. Continue to use exact-head Actions status as the gate for any future commits.


## WorkPass85 — abstention-aware retrieval evaluation (2026-10-20)

- Extended the offline MemoryOS2-vs-BM25 benchmark to label answerable and intentionally unanswerable queries explicitly. Unanswerable examples must have an empty relevance-label set; malformed combinations are rejected rather than silently scored.
- Recall/MRR/precision now use answerable queries only; the report separately records unanswerable-query count, unsupported retrieval rate, correct abstention rate, false-abstention count and rate. Promotion gates require the candidate's unsupported-retrieval rate not to regress against BM25.
- Expanded the fixed RU/EN synthetic harness from 8 to 10 holdout queries (8 answerable, 2 unanswerable). This tests metric integrity only; it is not an independent human-labelled dataset and cannot support a quality-uplift claim.
- Exact-head GitHub Actions validation is pending for this commit; do not mark WorkPass85 PASS until its run succeeds.


## WorkPass86 — bind benchmark provenance to the exact dataset (2026-10-20)

- Retrieval benchmark report schema advanced to v4 after adding abstention metrics.
- Promotion provenance now requires a license identifier (SPDX ID or explicit repository-scoped `LicenseRef`) and a SHA-256 matching the canonical labelled-example fingerprint. Missing, malformed or mismatched hashes block promotion; they are not silently accepted as metadata.
- Regression test derives the fixture hash from the benchmark's canonical fingerprint and verifies a deliberately wrong hash blocks promotion. The fixture's `LicenseRef` is internal test metadata, not a claim that the synthetic fixture is an externally licensed benchmark.
- GitHub Actions is the execution authority; update this receipt only after the exact new head finishes.


## WorkPass87 — suppress corrupt superseded memories in current retrieval (2026-10-20)

- Hardened the canonical `MemoryOS2.retrieve` path: if a memory has a supersession pointer but a missing validity-end timestamp, current/point-in-time retrieval now treats it as stale and increments the existing `staleRetrievalsAvoided` counter. Explicit archival mode remains able to inspect historical records.
- Aligned benchmark current-corpus eligibility and stale-result accounting with the same invariant.
- Added a process-level regression that creates a real revision, corrupts only the parent's validity-end metadata in a restored snapshot, and checks current retrieval suppression, observable diagnostics, and archive-mode visibility.
- WorkPass86 exact-head CI: [run 39376018280 — PASS](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39376018280) on `192a4858cc1bbcb2b6944128c14f0170cc4caf59`. WorkPass87 exact-head CI: [run 39376255921 — PASS](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39376255921) on `cd278c83002b1afcfb821836ff3ce7502fa4906e`. All steps passed, including the new superseded-memory recovery test.


## WorkPass88 verification receipt — 2026-10-20

- **PASS:** [GitHub Actions run 39378152687](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39378152687), exact head `7d56d67a9c8cec7617340f607d199be4bd5859f7`.
- The new WorkPass88 benchmark label-truncation guard passed, as did script integrity, cold-memory residency, WorkPass87 supersession recovery, WorkPass83/85/86 benchmark integrity/abstention/provenance, local provider policy/boundary, end-to-end caller cancellation, and controlled-provider server smoke.
- Evidence scope is regression integrity only. The run does not measure external retrieval quality, real llama.cpp latency, continual-learning gains, or consciousness.


## 2026-10-20 — WorkPass89: confidence-bounded abstention regression

- Extended the retrieval benchmark with a paired-query bootstrap interval for unsupported retrieval on explicitly unanswerable holdout queries.
- Candidate eligibility now requires the upper confidence bound of candidate-minus-baseline unsupported retrieval to remain within a configurable tolerance (default `0`), in addition to the existing point-estimate guard.
- Bumped the benchmark report schema to v6 and added focused assertions. This is a stricter evaluation gate, not evidence of improved retrieval quality; the current bilingual fixture remains synthetic.


## 2026-10-20 — WorkPass90: require adequate unanswerable holdout evidence

- Closed an evaluation gap: a benchmark with no or too few explicitly unanswerable holdout queries could otherwise report a zero-width abstention interval and appear to satisfy the confidence gate without meaningful abstention evidence.
- Added `minUnanswerableHoldoutQueries` (default 4; bounded to 2–32), a dedicated `sufficientUnanswerableEvidence` promotion gate, a surfaced threshold, and the fail-closed reason `insufficient-unanswerable-holdout`.
- The fixed synthetic fixture has only two unanswerable cases and now explicitly proves that promotion is blocked for insufficient abstention evidence. This is a conservative evaluation guard, not retrieval uplift.


## WorkPass90 — adequate abstention evidence gate (2026-10-20)

- **PASS:** exact-head GitHub Actions run [39379410664](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39379410664), branch head `f60a2c3ed314595fc4d8d8cc46b9a37c592d9628`; all workflow steps succeeded.
- Added `minUnanswerableHoldoutQueries` (default 4, bounded 2–32), `sufficientUnanswerableEvidence`, and the fail-closed reason `insufficient-unanswerable-holdout`.
- Regression test proves the current synthetic fixture's two unanswerable queries are insufficient to authorize an abstention promotion claim.
- Reviewed 2026 research on MemoryBench, Mem2ActBench, Memory-R1, AgeMem, MemFit and LeanMem; updated the research gate with a next-stage memory-to-action evaluation plan. These are design inputs, not reproduced NK1 results.
- Evidence scope: CI regression integrity only. No real local LLM run, independent human-labelled corpus, or measured cognitive-quality uplift is claimed.


## 2026-10-20 — WorkPass102: reservoir replay baseline

- Added a bounded, seeded Algorithm R reservoir sampler as an independent continual-learning replay baseline; production defaults are unchanged.
- Added deterministic regression tests and expanded the replay-selection benchmark across five reservoir seeds.
- Added a Node 24 GitHub Actions workflow. Report only replay composition and reproducibility until verifier-grounded task outcomes, retention, transfer and uncertainty intervals are measured.


## WorkPass106 — verifier-outcome promotion gate (2026-10-20)

- Added `VerifiedOutcomePromotionGate.ts`: explicit minimum paired sample and task-family thresholds, minimum aggregate pass-rate gain, optional strict positive 95% CI lower-bound requirement, and a per-family regression ceiling.
- Added `tests/p23-verified-outcome-promotion-gate.mjs` covering successful evidence, small samples, weak gain, uncertain intervals, missing family pairs, regressions, duplicate family names, invalid config, and an explicitly relaxed exploratory mode.
- Corrected `VerifiedOutcomeLedger.ts` so empty/whitespace method IDs are classified as `invalid-method`, not misreported as an invalid attempt; added regression coverage.
- Exposed `test:p23:verified-promotion` in the runtime package and added a Node 24 Actions workflow running the ledger regression, promotion-gate regression, and runtime typecheck.
- This is an eligibility calculation only: it does not automatically promote or alter production learning policy. Synthetic test fixtures validate gate behavior, not real task success.
- Research adaptation: SkillLearnBench's three-level evaluation chain and deterministic task verifiers, plus continual-learning benchmarks' emphasis on transfer/retention rather than memory accumulation. No upstream benchmark data or third-party code was copied into this change.
- Exact-head CI status must be read from Actions before this pass is marked validated.


## WorkPass116 — reproducible learning experiment protocol (2026-10-20)

- Added `LearningExperimentPlan.ts`: deterministic, manifest-bound matched P/C/R(k) run scheduling; stable per-run IDs; deterministic per-seed order randomization; exact matched task/seed/arm coverage; plan fingerprint validation; split isolation and prompt-leakage checks inherited from the canonical ledger.
- Added `recordPlannedLearningOutcome`: outcome metadata must match a scheduled run, ledger manifest identity must match, and duplicate task/method/seed outcomes are rejected before canonical ledger recording.
- Added `scripts/create-learning-experiment-plan.mjs` to generate a versioned plan from a task-manifest JSON file with atomic output replacement; added core and CLI regression tests.
- Added package scripts and expanded the WorkPass110 Actions workflow to run both experiment-plan tests plus reset-retention and continual-learning regressions.
- Research adaptation: retention-bench uses actual process-kill resets with only a designated survive-directory preserved; AgentMemoryBench adds online/replay/transfer/repair modes; MemoryAgentBench emphasizes incremental multi-turn interaction; SkillLearnBench evaluates verified skill-dependent tasks. NK1 adapts the protocol ideas, not external code or benchmark data, pending license and dataset review.
- Explicit boundary: the planner does not execute tasks, kill/restart the learner, authenticate external evidence, or prove learning uplift. Next implementation step is a process supervisor that launches real NK1 arms, enforces survive-directory boundaries, captures receipts, and records verifier-backed outcomes.

## WorkPass123 — authenticated evidence and controlled skill lifecycle (2026-10-21)

- Promotion proposals now require provenance receipts issued only after signed verifier artifacts pass signature, trusted-key, task-version, and manifest checks; opaque or forged `evidenceRef` values fail closed.
- Added a versioned candidate store for staged candidates, shadow runs, explicit approval, active-version compare-and-swap, approval audit retention, and rollback to the prior version.
- Added a durable JSON-file CAS adapter with exclusive lock, temp-file write, fsync, atomic rename, restart reconstruction and stale-revision regression coverage.
- Added a three-level holdout evaluation report for skill quality, execution trajectory, and verified task outcomes with explicit sample/task/seed and evidence coverage gates.
- Added regression coverage for forged evidence refs, authenticated outcomes, candidate lifecycle/rollback, and report completeness; wired tests into the WorkPass110 workflow.
- Boundaries: provenance receipts are process-local and must be re-established after restart; the lifecycle bridge is opt-in and application bootstrap does not yet configure the durable adapter by default; crash/kill contention tests remain open. Exact-head Actions validation is blocked before job steps start (GitHub reports runner_id=0 and no step logs); no learning uplift is claimed.


## WorkPass134 — manifest-bound outcome evidence (2026-10-21)

- Reject signed-outcome ingestion when the caller-supplied manifest is malformed or does not fingerprint-match the ledger manifest.
- Reject malformed manifest entries at runtime, including unsupported split labels and whitespace-only identity/stratum fields.
- Add regressions for manifest substitution, duplicate task IDs, unknown splits and invalid family labels.
- Validation remains unconfirmed: no exact-head test/typecheck/Actions pass is claimed.


## WorkPass135 — durable trusted shadow-run registry (2026-10-21)

- Added a durable versioned run/task registry for independently trusted shadow-execution context, with idempotent registration, conflict rejection, exclusive locking, fsync/atomic rename, and fail-closed handling of contention or corrupt state.
- Added a regression for restart recovery, signature/context binding, unknown-run rejection, lock contention and malformed persisted state; registered it in the existing continual-learning workflow.
- Verification remains unconfirmed until the owning test, typecheck and exact-head Actions produce actionable results. Production supervisor/key/approval wiring and complete activation-path audit remain open; no learning uplift is claimed.


## WorkPass236 — exact-payload promotion-chain integration (2026-10-21)

- Bind independent evaluation evidence to the exact staged candidate payload; reject cross-candidate receipt reuse.
- Add the canonical P23 promotion entry point that rechecks candidate payload/evaluation lineage, runs the existing fitness gate on the envelope's validation/holdout reports, and binds the candidate's persisted signed receipts before delegating to the existing authenticated approval and versioned-store path.
- Make canonical evidence serialization reject values that cannot be represented as JSON; catch malformed/cyclic envelope canonicalization and return a fail-closed binding result.
- Added focused candidate-payload mismatch and cyclic-envelope rejection regressions. Validation remains unverified until the targeted test, TypeScript typecheck, and exact-head Actions execute successfully; no promotion or learning uplift is claimed.

## WorkPass238 — recover provably stale trusted-run registry locks (2026-10-21)

- **DONE (code):** the durable shadow-run registry now writes lock ownership as PID + hostname + acquisition time and can recover a lock only when its owner is on the same host and the OS proves that PID no longer exists.
- **Safety boundary:** live, remote-host, malformed, legacy-format and otherwise ambiguous locks remain fail-closed; lock age alone is never used to steal a lock. The registry still uses exclusive creation, fsync, atomic replacement and directory fsync.
- **DONE (regression authored):** added a crash-recovery regression using a provably nonexistent same-host PID while preserving the existing live/ambiguous lock contention test.
- **DONE (integration):** included the registry regression in the canonical `audit:p23:cross-source-replay` chain; its dedicated continual-learning workflow step/path filters already exist.
- **PARTIAL (validation):** this pass did not execute the test or typecheck and does not claim exact-head Actions success.


## WorkPass239 — race-safer registry recovery and durable promotion end-to-end (2026-10-21)

- Hardened stale trusted-run lock recovery with a unique quarantine rename, exact-content and dead-owner recheck, exclusive reacquisition, and per-lock owner tokens so cleanup does not unlink a replacement lock.
- Added `tests/workpass239-durable-signed-promotion-e2e.mjs`: canonical signed paired outcomes → proposal → durable candidate staging → trusted run registration → three candidate-bound signed shadow receipts → process-style restart → replay rejection → detached Ed25519 approval → CAS activation → second restart and active-state re-authentication.
- Wired the regression into `test:workpass239:durable-signed-promotion-e2e`, `audit:p23:cross-source-replay`, and the WorkPass110 continual-learning workflow with an explicit path filter.
- Scope: this verifies the existing durable evidence/approval/activation seam with generated test keys. It does not prove production host sandbox isolation, independent verifier/scanner deployment, multi-process crash contention, or real learning uplift.
- Validation remains pending until the exact-head Actions job executes the new test and runtime typecheck successfully; no PASS is claimed.


## WorkPass240 — reject self-attesting evaluator authorities (2026-10-22)

- Hardened `IndependentSkillCandidateEvaluator` so executor, independent verifier and safety scanner must have distinct object identities and distinct method function identities; shared/self-attesting authorities fail closed before candidate execution.
- Extended `tests/workpass227-bounded-independent-evaluation.mjs` with same-object and shared-function regressions, reusing existing package and workflow wiring.
- This is a configuration-boundary hardening only: production host ownership, actual OS/container sandbox isolation and trusted verifier/scanner provisioning remain open.
- Validation is pending exact-head Actions for the targeted regression and runtime typecheck; no test pass is claimed.


### WorkPass240 follow-up — enforce the production gate at the evaluator itself

- Added a second enforcement point inside `createIndependentSkillCandidateEvaluator`: in production, direct evaluator construction fails closed without canonical experiment authority. This prevents bypassing the existing provider wrapper by calling the evaluator factory directly.
- Added regression coverage that temporarily sets `NODE_ENV=production`, asserts authority-free direct construction is rejected, and restores the prior environment in `finally`.
- Targeted regression and typecheck are still awaiting an actual successful runner execution; no validation pass is claimed.


## WorkPass241 — validate direct scheduler candidate fingerprints

- Tightened `P23TrustedShadowLearningScheduler` constructor validation to require the same 64-hex candidate fingerprint accepted by the production JSON parser; malformed direct runtime configuration now fails before any child process can launch.
- Added the regression to the existing `p23-runtime-trusted-shadow-scheduler.mjs` test, already wired into the learning workflow.
- Validation remains unconfirmed until the exact-head regression and typecheck execute successfully.


## WorkPass244 — bind host evaluation services to the canonical manifest

- Added the canonical dataset manifest fingerprint to the immutable candidate execution context, sourced from the existing `VerifiedOutcomeLedger` authority; it is explicitly distinct from the evaluator-plan fingerprint.
- Host-owned verifier and safety-scanner responses must now echo that exact manifest identity along with the existing payload, task-input, environment, plan, run, task, and seed bindings. A response bound only to the evaluator plan can no longer pass the host adapter's binding check.
- Process-supervisor receipts use the canonical manifest digest when available. In configurations without a canonical experiment authority, the plan digest remains process bookkeeping only and is not represented as a real manifest in the service request.
- Extended the WorkPass243 host-service fixture protocol to exercise a non-null manifest fingerprint.
- Validation caveat: the source and regression wiring are committed, but no local test/typecheck or successful exact-head CI execution is claimed. The configured executor must still be a real host-owned OS/container sandbox launcher; independent verifier/scanner programs and deployment configuration remain host responsibilities.


## WorkPass245 — bind canonical experiment plan and scheduled run in host attestations

- Tightened host-owned verifier and scanner response binding to require exact echoes of `experimentPlanFingerprint` and `plannedRunId` in addition to the canonical manifest, evaluator plan, payload, task input, environment, run, task and seed.
- Updated the existing host-process protocol fixture to echo the full scheduled experiment context. This keeps the trust boundary aligned with the immutable context produced by the canonical evaluator.
- Validation remains unverified: no local test/typecheck was run; latest GitHub Actions jobs are failing before exposing usable step details. Real OS/container isolation and production authority provisioning remain open.


## WorkPass248 — bind executor response to the supervised invocation (2026-10-22)

- The host-owned evaluation adapter now pins the executor response `runId` to the exact invocation ID recorded by the process supervisor; with canonical experiment authority, that is the scheduled run ID.
- Extended the existing host-service regression fixture with a detached-run-ID response and asserted fail-closed rejection.
- This closes a provenance-binding gap, not the outstanding deployment requirement for real OS/container isolation or independent verifier/scanner executables. Test/typecheck/CI remain unverified until the exact head actually executes successfully.


## NK1 Hexis H0 — assimilation architecture plan (2026-10-24)

- [DOCS] Added `docs/integration/hexis/ASSIMILATION_PLAN_RU.md`: compares the distinct QuixiAI, Bevel-Software, and hexis-framework repositories; maps transferable mechanisms to NK1; defines adapter contracts, phased implementation, provenance, learning promotion gates, benchmark requirements, and rollback constraints.
- [SCOPE] Documentation/design only. No Hexis runtime code, dependency, database migration, or behavioral change was integrated in this commit.
- [EVIDENCE] Plan anchors to the current source-branch checkpoint and its reported open production/retrieval validation gates. No retrieval uplift, learning score improvement, or production readiness is claimed.

## [NK1][WorkPass507] Add independent bilingual retrieval evaluation gate (2026-10-27)

- Added an offline RU/EN MemoryOS2 retrieval holdout runner with source/version/license/labeling provenance, explicit unanswerable queries, five paired bootstrap seeds, corpus/configuration fingerprints, and no automatic promotion.
- Fixed upstream double-escaped Unicode punctuation/whitespace normalization, canonical row separators and report newlines; extracted deterministic Unicode normalization and SHA-256 row canonicalization into a tested helper.
- Added regressions for NFKC, punctuation/symbols, whitespace normalization, order-independent fingerprints, changed-input sensitivity, and fail-closed missing-dataset behavior.
- Added a dedicated GitHub Actions workflow to run the contract and the existing independent-holdout safety regression without modifying the concurrently changing runtime package script chain.
- No synthetic dataset is claimed as independent evidence, no live memory is mutated, and no retrieval uplift or Release ZIP update is claimed.


## [NK1][WorkPass586] Apply cadence discounts to cognitive metabolism weights (2026-10-28)

- Fixed a reversed guard in `CognitiveExecutionPlanner.compile()`: `cadenceFactor = 1 / cadenceCycles` is in `(0, 1]`, so the previous `cadenceFactor > 1` condition could never scale a domain's metabolism weight.
- Long-cadence domains now receive proportionally lower budget shares while the planner preserves normalized total share. Added a direct regression comparing research cadence 1 vs 8 and a focused CI workflow for typecheck plus the cadence test.
- This changes resource allocation only; it does not assert improved organism behavior until the target tests pass. `main` and the Release ZIP remain untouched.


## [NK1][WorkPass587] Enforce aggregate cognitive execution budget (2026-10-28)

- Enforce the remaining compute budget across the full operation plan, even when high-demand or interrupt forcing raises execution priority. An operation is skipped with the explicit `budget-exhausted` reason if its cost would exceed the remaining aggregate budget.
- Allocate the budget in explicit critical/hot/warm/cold tier order, preserving the declared order within a tier. This prevents lower-priority cold research from consuming capacity before affordable warm project/shadow work.
- Add a low-budget/high-demand regression that verifies affordable hot-path work runs, expensive research is gated, and summed planned costs never exceed the budget.
- Extend the focused planner workflow to run both cadence-weighting and aggregate-budget regressions. This is a resource-allocation safety correction, not an end-to-end autonomy uplift claim; `main` and Release ZIP remain untouched.


## [NK1][WorkPass591] Verify budgeted planner integration through observation stage (2026-10-28)

- Added an integration regression for `compileObservationPlan()` that uses the real cognitive frame builder, resource-budget handoff, cognitive execution planner and plan-persistence callback with bounded fixture ports.
- The test verifies the effective budget passed to the planner, confirms warm project work is preserved ahead of cold research, checks aggregate planned cost, and ensures perception refresh and stored execution plan derive from the same result.
- Extended the scoped planner CI workflow to run the integrated observation-stage test after typecheck and the two direct planner regressions. This validates the planning seam, not the entire production cycle; no `main` or Release ZIP changes.


## [NK1][WorkPass592] Use one budget snapshot across an observation planning cycle (2026-10-28)

- `compileObservationPlan()` previously called `host.getBudget()` independently for the spine mode, spine budget, and execution planner budget, allowing a changing host budget to produce internally inconsistent decisions in one cycle.
- Capture the budget once at stage entry and reuse its mode/remaining amount for all planning decisions. The integrated regression now returns different values on subsequent calls and asserts that the stage reads the host exactly once and both planners see the same snapshot.
- Extended the targeted planner workflow path filter to include `ObservationPlanningStage.ts`. This closes a consistency seam; it does not claim full runtime or autonomy readiness.


## [NK1][WorkPass595] Use perception-specific value for cognitive camera capture (2026-10-28)

- `OrganismRuntime.captureCameraForCognition()` used the maximum expected value across every cognitive operation to decide whether a camera capture was useful. High-value research or project work could therefore trigger a camera capture despite low perception value.
- Restrict the camera demand signal to `plan.expectedValue01.perception`; explicit pending vision requests and the existing motion/resource checks remain separate trigger paths.
- Add a runtime regression proving a high research/project value does not trigger the camera, while a high perception value still dispatches through the canonical capture path. Extend the planner workflow to run this test and watch the runtime camera gate.


## [NK1][WorkPass596] Enforce the perception planner gate on EVC-driven camera capture (2026-10-28)

- The perception-specific EVC trigger now respects `plan.run.perception`; a high expected value alone cannot override an explicit planner decision to skip perception.
- Preserve explicit reactive exceptions: a concrete pending vision request or strong motion signal can still trigger camera capture, subject to the existing battery, thermal, RAM, awake, and idempotency safeguards.
- Extended the runtime regression with a high-perception-EVC/planner-off case and a pending-vision override case; added no new workflow dependency because both execute in the existing focused planner/camera CI job.


## [NK1][WorkPass597] Enable the Node 22.12 SQLite feature for runtime gate tests (2026-10-28)

- The new runtime camera-gate regression imports `OrganismRuntime`, which reaches the built-in `node:sqlite` module during initialization. The workflow pins Node 22.12.0, where SQLite is gated behind `--experimental-sqlite`; without the flag the test crashed before reaching its assertions.
- Add `--experimental-sqlite` to this test script only. The workflow still uses the repository's established Node 22.12.0 version, and the correction makes the test exercise the runtime gate instead of failing during module initialization.


## [NK1][WorkPass603] Enforce cognitive execution-plan gates in the runtime loop (2026-10-28)

- `stepInternal()` previously ignored the result of `cognitiveBudgetSpend('planning', ...)` and always executed the full four-step beam search. It also performed counterfactual rollout and the alternative-action shadow sweep without checking the matching `run` flags in `CognitiveExecutionPlan`.
- Use the plan snapshot once per runtime step: only run full `PlanEngine.build(..., 4, 4)` when `run.project` is enabled and the planning budget is accepted; otherwise use a pure one-step `buildBudgetFallback()` projection.
- Honor `run['slow-cognition']`, `run['world-rollout']`, and `run.shadow`: gated work is skipped without spending its associated planning/simulation budget, and alternative action projections are omitted when shadow evaluation is disabled. The single selected-action environment transition remains the base result needed by the runtime loop.
- Added a runtime execution-gate regression with a deterministic one-step fallback purity test and source-contract checks proving each expensive path is tied to its planner/budget decision. Extended the planner CI workflow to run it.