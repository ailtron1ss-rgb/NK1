# Release Notes 35.6.72 — P2613–P2626

## Main theme

Task-free generalization, risk-aware recovery, goal/identity-conditioned skill selection and phone-aware neural scheduling.

## New canonical components

- `src/organism/cognition/TaskAgnosticTransferRouter.ts`
- `src/organism/cognition/RiskAwareRecoveryController.ts`
- `src/organism/cognition/GoalIdentitySkillModulator.ts`
- `src/organism/cognition/DeviceAwareNeuralScheduler.ts`
- `tests/big-pass-2613-2626-taskfree-recovery-personality-device.mjs`

## State / contract

- application `35.6.72`
- organismCore `83.0.0-task-free-risk-aware-self-governed-p2626`
- stateSchema `181`
- release `P2626`

## Compatibility

Older `NeuralExperienceBranch` snapshots are restored through the existing normalized restore path; missing P2613–P2626 facets are initialized from conservative defaults.

## Verification

- typecheck: PASS
- functional P2613–P2626: PASS
- P2599–P2612 regressions: PASS
- P2587–P2598 regressions: PASS
- static architecture/forensics: PASS
- full/brain/integrity/contract audits: PASS

## Known caveats

No claim is made that the system is conscious. The new personality/identity layer is a functional behavior-conditioning substrate. Android scheduling is a runtime policy and not a device-firmware governor.
