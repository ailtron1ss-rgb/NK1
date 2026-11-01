# NK1 WorkPass — motor-frame status reference integrity (2026-11-01)

## Change

The renderer-neutral motor-frame mapper now treats `reachedJointIds` and `blockedJointIds` as references into the exact `joints` snapshot carried by the same frame.

It rejects a reached or blocked joint ID absent from the frame, and rejects one joint simultaneously marked reached and blocked. Valid disjoint references remain accepted. Validation occurs before calibration and pose projection.

## Why this matters

Motor frames are time-indexed snapshots. A status list from another skeleton revision or a contradictory state can otherwise pass the mapper even though the numeric joint samples look valid. Binding status references to the current frame preserves snapshot integrity across the organism-to-renderer boundary.

## Validation scope

The existing `nk1-embodiment-switch` workflow watches both changed mapper/test paths and runs `test:embodiment-switch`, which includes `motor-frame-mapper.test.mjs`.

New tests cover dangling reached IDs, dangling blocked IDs, reached/blocked contradiction, and a valid disjoint status pair.

## Explicit non-claims

This is a contract-integrity fix only. It does not establish that a renderer applied the pose, that the pose is visually correct, that the rig is physically calibrated, or that browser/Android soak has passed.
