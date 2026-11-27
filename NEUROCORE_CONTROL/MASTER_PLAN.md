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
- [ ] Treat the 3D body as a hierarchy of articulated rigid/deformable parts with a real humanoid skeleton.
- [ ] Bind neck, spine, shoulders, elbows, wrists, pelvis, hips, knees, ankles, feet, hands and fingers.
- [ ] Use IK for hands/feet and constraints for joint limits; no arbitrary bone teleportation.
- [ ] Add muscle/soft-tissue control as a separate actuator/deformation layer above the skeleton.
- [ ] Connect intent, emotion and attention to a motor planner; the render loop only executes approved pose/motion targets.
- [ ] Keep VRM/GLB as import/export assets, but do not require a downloaded character file for the canonical fallback.
- [ ] Add anatomy/range-of-motion tests, collision/pose tests, action-to-animation mapping and frame-budget tests.
- [ ] Profile CPU/GPU/RAM on a mid-range Android device before raising body fidelity.

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
