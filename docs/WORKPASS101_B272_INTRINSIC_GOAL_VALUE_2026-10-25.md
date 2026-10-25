# WorkPass101 — preserve calibrated intrinsic drive in endogenous goal value
Date: 2026-10-25

## Defect found

The WorkPass287/288 integration workflow passed the cognitive-cycle and intrinsic-motivation contracts, then failed the B272 endogenous-goal test at the controlled comparison between `intrinsicDrive01=0` and `intrinsicDrive01=0.9`. The failing assertion was `drivenValue > baselineValue + 0.1`.

The cause was the goal-value composition in `B272EndogenousGoalGenesis.generateCandidate()`: an unnormalized 8-dimensional dot product (`.32 * dot(v, base)`) and a relatively large per-candidate `.08*k` term could put `predictedFutureValue01` at its clamp ceiling. Once saturated, the value stopped reflecting a trusted increase in intrinsic drive.

## Change

- Normalize goal alignment to the number of goal dimensions and clamp it to [-1, 1].
- Bound the base, alignment, conflict, candidate-novelty and learned-closure contributions so the maximum composite remains below 1.0.
- Preserve the trusted drive signal as `0.18 * intrinsic`, where `intrinsic` is already confidence weighted. The existing test also requires that the same drive with `intrinsicDriveConfidence01=0` has no effect.
- No additional selector was introduced; this only changes B272's candidate value composition.

The resulting formula has a maximum of 0.9932 under the stated bounds, so score saturation cannot erase the controlled drive comparison. For the test's intrinsic values 0.2 versus 0.9, the value delta is 0.126 before clamping; confidence-zero resolves back to 0.2.

## Verification status

- Source commit: `0091425f559498e9eb98206afc63b4e95a7d9b5e`.
- The prior run [40161306204](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40161306204) reached and passed the WorkPass287 unified-cycle contract after its expectation was updated, and passed the WorkPass288 intrinsic-motivation contract; it then exposed the B272 saturation failure.
- Exact source validation run [40161436055](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40161436055) is **queued** at report creation. The B272 test has not yet been reported as passing; the result is pending, not assumed.

The unrelated Live2D validation is green at [40161393918](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40161393918). This pass does not claim that the B272 cognitive-contract job is green until its own run completes.
