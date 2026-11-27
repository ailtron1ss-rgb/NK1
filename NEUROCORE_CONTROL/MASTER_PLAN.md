# NeuroCore master plan

**Current source sync:** `workpass70-source@9de695dd4713ec909d7312b45966d30dfb76d5c2`  
**Latest product/source merge:** `53a5926f753c56b97599b1ee28a0e46d769662b2`  
**Exact product head:** `4dfc60c4d1079bc694f3bc0043bced6c59bad564`

## Phase A — Stable full-source application base
- [x] Pin the original source baseline and create a separate product branch.
- [x] Carry over the full tracked NK1 tree rather than producing a launcher-only archive.
- [x] Preserve source history and record exact tree provenance.
- [x] Synchronize the product branch with the current source head using a two-parent merge; preserve both histories.
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
- [x] Add memory restore/round-trip and capacity/lifecycle suites to the NeuroCore integration gate.
- [x] Add memory restore/round-trip and capacity/lifecycle suites to the canonical NeuroCore gate.
- [x] Selectively port crash-safe ContinuityLedger implementation and concurrency/torn-tail/rollback/retention tests.
- [x] Make shutdown durability receipt wait for Core, sidecars, world, ledger flush and ledger close; add fault-injection regressions.
- [ ] Pass these gates on the latest product head; verify idempotent canonical writes and real interrupted restart.
- [x] Integrate current-cycle Global Workspace before P61/P64 and decision-scoped outcome credit.
- [x] Integrate 27-dimensional metacognitive neural substrate with backward-compatible 24→27 restore migration and observation-aligned targets.
- [x] Integrate goal/world-bound planner lineage and fail-closed step preconditions/expected outcomes.
- [x] Integrate G3 signed host observation admission with consent and durable nonce replay prevention.
- [ ] Pass exact-head cognitive workspace, G3, planner and metacognitive regression suite.
- [ ] Verify that all memory writes pass through the canonical fabric/lifecycle authority.
- [ ] Verify all actions pass through `ActionGateway` and its approval/idempotency policy.
- [ ] Audit persistence, watchdog marker, checkpoint and shutdown ordering.

## Phase D — Embodiment as a controllable body, not a picture
- [x] Build a procedural humanoid Bone hierarchy and make it the default 3D body without requiring an external model.
- [x] Bind axial skeleton, clavicles, shoulders, elbows, wrists, hips, knees, ankles, feet, palms and 30 finger joints.
- [x] Apply per-joint limits and bilateral two-link arm/leg IK; tests assert wrist/ankle endpoint accuracy.
- [x] Connect the 22-particle / 21-segment physics stream to absolute bone pivots and solved IK endpoints.
- [x] Inherit heel/toe contacts, friction, swing take-off handling and 150-degree elbow/knee hinge limits from the current source.
- [x] Bound the physics/motion controller to 20 Hz and publish each solved anatomical snapshot; add scheduler regression.
- [x] Connect body-channel motors, head/gaze, affect, speech mouth, eyelids and hand curl channels.
- [ ] Replace the segmented part volumes with a continuous skinned/deformable anatomical surface where appropriate.
- [ ] Add balance, richer collision handling, full gait and muscle/soft-tissue actuation.
- [x] Add an actual 20 Hz RAF scheduler to the body loop and connect its test to production `AvatarStage`.
- [x] Integrate current-source 22-particle solver heel/toe contacts, friction and 150-degree hinge constraints.
- [ ] Pass the new rig/IK/scheduler regressions and all existing embodiment suites on the latest product head.
- [ ] Profile CPU/GPU/RAM and frame pacing on a mid-range Android device before raising body fidelity.

## Phase E — Learning, model and mobile resource policy
- [x] Keep local LLM behind the existing optional provider / P40 model ecology; do not create a duplicate model selector.
- [x] Add bounded JSON Schema-constrained output to the existing loopback-only llama.cpp provider, with schema validation, cancellation and bounded response parsing.
- [x] Extend the existing N.E.K.O. Markdown memory adapter to recognize OpenClaw `skills/<name>/SKILL.md` as quarantined external knowledge; explicit review is required before canonical MemoryFabric write, and imports never grant action authority.
- [ ] Pass the new OpenClaw and llama.cpp contracts on the latest NeuroCore product head; run a real local llama.cpp handshake with a configured model.
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
