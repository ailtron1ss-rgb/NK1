# NK1 WorkPass — motor-frame status reference integrity (2026-11-01)

The renderer-neutral motor-frame mapper now treats `reachedJointIds` and `blockedJointIds` as references into the exact `joints` snapshot carried by the same frame.

It rejects a reached or blocked joint ID absent from the frame, and rejects one joint simultaneously marked reached and blocked. Valid disjoint references remain accepted. Validation occurs before calibration and pose projection.

This prevents a status list from another skeleton revision or contradictory status from being accepted alongside otherwise valid numeric joint samples.

The existing `nk1-embodiment-switch` workflow watches both changed mapper/test paths and runs `test:embodiment-switch`, which includes `motor-frame-mapper.test.mjs`. New tests cover dangling reached IDs, dangling blocked IDs, reached/blocked contradiction, and a valid disjoint status pair.

This is a contract-integrity fix only. It does not establish renderer application, visual correctness, physical rig calibration, or browser/Android soak.
