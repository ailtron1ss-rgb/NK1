## [NK1][Aspect 10] Align focused CI with Node 24 and strict evidence typing (2026-10-30)

- Migrate the focused Aspect 10 workflow to the repository's Node 24 pin and supported Actions v7 tags; watch `.nvmrc` changes.
- Explicitly narrow optional world-revision evidence before integer and monotonicity checks, eliminating a strict TypeScript error.
- This does not alter the explicit hardware/renderer integration boundary.

## [NK1][Aspect 10] Evidence-gated grounded interaction hardening (2026-10-30)

- Fix metric arm reach, unique plan IDs and the exclusive plan-expiry boundary.
- Bind plans and postconditions to the exact target, canonical world entity, coordinate frame and grounded-world revision.
- Require trusted verification for short-lived contact/manipulation authorization; `safeToTouch` alone no longer authorizes contact.
- Require fresh independent target-bound evidence and a trusted postcondition verifier before completion; simulator outcomes are classified as simulated, not real-world success.
- Harden world joining against whitespace/Unicode mismatch, stale snapshots, malformed entities and ambiguous same-label objects.
- Reject malformed execution statuses, affordances, hand selections and invalid body reach.
- Add 53 deterministic assertions across planner and camera-to-world grounding (40 + 13). Physical camera/renderer actuation and hardware-backed contact verification remain pending.

## [NK1][Aspect 10] Fingerprint exact uploaded avatar model bytes (2026-10-30)

- Add browser Web Crypto SHA-256 content addressing for the exact VRM/GLB byte stream, without mutating the source buffer.
- Integrate fingerprint calculation into local avatar loading and retain the fingerprint only when the current load token remains active; gracefully report unavailable hashing as an empty fingerprint rather than inventing an identity.
- Add deterministic, distinct-input and immutability tests plus a focused CI step. This establishes model identity for future calibration; it does not yet create a coordinate-frame calibration or enable IK actuation.

## [NK1][Aspect 10] Add provenance-aware VRM calibration capture sessions (2026-10-30)

- Add immutable bilateral bind/reference capture sessions bound to the exact model fingerprint, coordinate frame and four resolved arm bones.
- Record fixture identity, capture timestamp and bounded operator note in a separate JSON provenance sidecar.
- Finalize profiles only after both arms pass the existing measured-angle, off-axis and joint-limit checks; revalidate against the currently loaded rig.
- Add focused regression coverage and CI execution. This is a capture-session API, not yet a visual calibration wizard; no live IK actuation is enabled.

## [NK1][Aspect 10] Derive VRM arm calibration from measured reference poses (2026-10-30)

- Add a deterministic per-arm calibration derivation from captured bind/reference Euler poses and independently known fixture angles.
- Reject weak reference motion, off-axis contamination, non-finite values, unsafe joint ranges and reference poses outside declared limits.
- Build a bilateral profile bound to the exact loaded model, coordinate frame and resolved bone names; keep live IK disabled until measurement provenance and runtime actuation are independently validated.

## [NK1][Aspect 10] Add model-bound VRM calibration JSON import/export (2026-10-30)

- Add bounded JSON parsing with safe malformed-input handling and mandatory validation against the currently loaded model fingerprint, coordinate frame and exact bilateral bone identities.
- Add deterministic JSON export that revalidates the profile and refuses export when it no longer matches the active rig.
- Add round-trip, malformed JSON, size-limit and model-mismatch regressions. This is a programmatic import/export boundary, not a calibration wizard or proof that imported measurements are physically accurate.

## [NK1][Aspect 10] Distinguish malformed VRM profiles from unsafe calibration values (2026-10-30)

- Split profile-shape/bone-identity validation from numerical calibration validation so the declared `invalid-calibration` result is reachable and meaningful.
- Reject blank bone names and calibration offsets/joint bounds outside ±2π radians; retain exact model, coordinate-frame and bilateral bone identity binding.
- Add regressions for reversed joint ranges, implausible offsets and malformed bone identity. This tightens the profile import boundary; it does not enable live IK or certify measured model calibration.

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