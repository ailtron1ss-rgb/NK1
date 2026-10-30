# NK1 WorkPass — selective 2.5D / motor / executor integration (2026-10-30)

## Integration base

- Canonical source branch: `workpass70-source`
- Base SHA: `258cd9e703dc31d191b99664abafcc2c7c563258`
- Integration branch: `workpass-nk1-embodiment-motor-executor-2026-10-30`
- Release ZIP: unchanged; this work is source-only.

## 2.5D foundation ported

The 2.5D DepthRig implementation from PR #408 is copied selectively onto the current source base. The port includes the manifest and validator, renderer adapter, face bindings, GLB validator, reproducible Blender exporter, deterministic mannequin fixture, focused tests, documentation and a dedicated workflow.

Source PR #408 exact-head SHA: `a0d46195a043f2b7c873e991f809121c2eee1516`.

The focused source PR reported successful checks for depth-rig runtime, targeted/regression, typecheck/cadence, metrics, source-lineage and local-language resilience. Those results apply to that exact source PR head only; the integrated branch must pass its own checks.

## Boundaries retained

- A validated depth-rig manifest is opt-in; ordinary GLB/VRM stays on the regular 3D path.
- The generated mannequin is a pipeline fixture, not a finished Kurisu model.
- Finished character art, hidden-area geometry, production pivots, visual calibration, browser/Android E2E and Release packaging are not claimed.
- The depth-rig adapter consumes declared motor intent; the next integration commit ports the canonical motor substrate from PR #410.

## Acceptance still required

1. Exact-head integrated CI and app/runtime typecheck.
2. Browser visual tests using a production DepthRig asset, not only the mannequin.
3. Android visual/performance validation.
4. Verified body-state handoff and rollback with the shared 2D/2.5D/3D embodiment contract.
5. Rights-cleared production art and asset provenance.
6. Release ZIP rebuilt from the final validated source SHA, separately checksum-verified and clean-installed.

## Provenance

This pass preserves the upstream feature branches. It does not merge stale branches wholesale; only reviewed paths are transplanted.

## Cross-renderer body switching foundation added

A separate follow-up commit ports the versioned body-state snapshot, capability-aware handoff planner, transactional coordinator, MotorFrame mapper and Live2D partial-ACK channel from PR #415. The existing DepthRig-enabled `AvatarStage.tsx` is preserved and receives only the reviewed ACK-handler additions; it is not replaced by the older PR file. The new coordinator tests and focused workflow are included.

This is the software handoff foundation, not proof of a finished cross-renderer visual round-trip. Concrete production adapters, presented-frame confirmation, and desktop/Android visual E2E remain release gates.
