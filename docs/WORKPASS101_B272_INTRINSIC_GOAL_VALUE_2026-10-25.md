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

## Validation

- Exact source commit: `0091425f559498e9eb98206afc63b4e95a7d9b5e`.
- GitHub Actions run [40161436055](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40161436055) **passed** the entire WorkPass287/288 cognitive-contract job, including the previously failing motivation-to-goal integration test.
- Confirmed harness output: `pass=true`, 360 generated goals, 360 learning updates, 360 accepted goals, `goalEntropy01≈1.0`, `prototypeDiversity01≈0.5515`, `actionDiversity01≈0.7143`, and `agency01≈0.8679`. These describe the deterministic regression harness, not a live deployed runtime or a production autonomy guarantee.
- The controlled comparison now passes: trusted intrinsic drive changes endogenous goal value, while confidence-zero leaves the drive contribution disabled.
- Live2D validation independently passed at [40161393918](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40161393918).

The value path is now covered by both the source-level bounded formula and the executable controlled regression. Longer-horizon external/device behavior remains outside this contract.
