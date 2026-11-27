# NeuroCore master plan

## Phase A — Stable full-source application base
- [x] Pin the live source baseline and create a separate product branch.
- [x] Carry over the full tracked NK1 tree rather than producing a launcher-only archive.
- [x] Preserve source history and record exact tree provenance.
- [ ] Remove archived donor payloads only after reference/dependency mapping.
- [ ] Split oversized Core orchestration responsibilities where there is a proven owner boundary.

## Phase B — Product identity and application boundary
- [x] Set browser document title and main screen product name to NeuroCore.
- [x] Set runtime health service identifier to `neurocore` with a compatibility field.
- [x] Add `VITE_NEUROCORE_API_BASE` while preserving the old environment variable fallback.
- [ ] Migrate remaining user-facing old labels and internal API names incrementally.
- [ ] Add an app diagnostics screen showing actual runtime readiness and feature evidence, not simulated metrics.

## Phase C — Canonical organism integration
- [x] Preserve `OrganismRuntime → OrganismCore → OrganismSystemFabric`.
- [x] Preserve the single `MemoryOS2` authority through `MemoryFabric`.
- [x] Add a regression that asserts the injected store references are identical.
- [ ] Execute restore, idempotent write, retrieval and lifecycle tests on this branch.
- [ ] Verify that all memory writes pass through the canonical fabric/lifecycle authority.
- [ ] Verify all actions pass through `ActionGateway` and its approval/idempotency policy.
- [ ] Audit persistence, watchdog marker, checkpoint and shutdown ordering.

## Phase D — Embodiment as a controllable body, not a picture
- [x] Build a procedural humanoid Bone hierarchy and make it the default 3D body without requiring an external model.
- [x] Bind axial skeleton, clavicles, shoulders, elbows, wrists, hips, knees, ankles, feet, palms and 30 finger joints.
- [x] Apply per-joint limits and bilateral two-link arm/leg IK; tests assert wrist/ankle endpoint accuracy.
- [x] Connect the existing 18-particle / 17-constraint physics stream to absolute bone pivots and solved IK endpoints.
- [x] Connect body-channel motors, head/gaze, affect, speech mouth, eyelids and hand curl channels.
- [ ] Replace the segmented part volumes with a continuous skinned/deformable anatomical surface where appropriate.
- [ ] Add foot planting, balance, contact/collision handling, gait and richer muscle/soft-tissue actuation.
- [ ] Execute the new rig/IK regressions and all existing embodiment suites on this branch.
- [ ] Profile CPU/GPU/RAM and frame pacing on a mid-range Android device before raising body fidelity.

## Phase E — Learning, model and mobile resource policy
- [ ] Keep local LLM optional and expose real provider capability/timeout/fallback status.
- [ ] Run llama.cpp OpenAI-compatible handshake and structured-response checks.
- [ ] Keep memory, learning and action governance owned by the existing core.
- [ ] Ensure scheduled learning/consolidation yields under Android RAM/thermal/battery pressure.
- [ ] No fake metrics or score increases without measured holdout evidence.

## Phase F — Acceptance and release
- [ ] Run Node 24 + Python 3.11 source-pinned installation.
- [ ] Pass root/app/runtime typecheck.
- [ ] Pass focused memory, cognitive-cycle, persistence, action-gateway and embodiment suites.
- [ ] Pass browser end-to-end chat and runtime control flows.
- [ ] Pass restart/restore and interrupted-checkpoint recovery.
- [ ] Pass Android/Termux install, start, stop, restart and persistence acceptance.
- [ ] Produce a release ZIP materially containing the full application; publish SHA-256 and manifest.
- [ ] Only then mark the application ready for user launch.

## Execution rules
- One primary implementation path per subsystem, one owner per durable store.
- Branches/PRs are donors, not automatic merges.
- Before copying a module: map source, target owner, callers, persistence semantics, tests and rollback.
- Keep changes in the new product branch; don't commit to `main` or the pinned source branch.
- Use `[NK1][этап]` commit messages.
- Mark each claim PROVEN / IMPLEMENTED / INHERITED / TESTED / DEVICE-TESTED / HYPOTHESIS / UNKNOWN / FAILED.
