# The Invention Loop — NK1 implementation

Status: first implementation slice, isolated on `aspect/the-invention-loop-20261117`.

## Purpose
Coordinate the complete idea-to-evidence lifecycle without confusing generated ideas, code changes, and verified improvements.

## Lifecycle
`proposed → designed → prototyped → tested → critiqued → replicated → accepted`
Any failed preregistered threshold or independent critique blocker ends in `rejected`.

## Evidence rules
- The protocol (question, hypothesis, success criteria, baseline, threshold and test fingerprint) is fixed before prototype testing.
- Only one primary outcome is admitted.
- Critique must be performed by a reviewer distinct from the primary verifier.
- Replication requires a different verifier and environment.
- A final holdout outcome is required before acceptance.
- Duplicate receipts, changed test fingerprints, invalid numeric values and out-of-order transitions are rejected.
- The coordinator records evidence and decisions; it does not execute arbitrary code, merge branches, publish releases or promote model weights.

## Integration boundary
This module is designed to coordinate existing NK1 research foundations such as `IntrinsicExperimentGenerator`, `ScientificMethodEngine`, `AutonomousScientificBrainSubstrate` and `P53DevelopmentalSelfModificationLab`. It intentionally does not duplicate their hypothesis generation, scientific state or candidate mutation logic. The coordinator is wired into `EvidenceResearchSubsystemRuntime` snapshot/restore and exported from the organism entry point. Automatic experiment execution and candidate promotion remain intentionally out of scope.

## Verification
Run from `runtime/neuro-kurisu`:
```sh
node --experimental-strip-types tests/the-invention-loop.mjs
```
