# P2842 — Algorithm matrix

| Mechanism | Existing source | P2842 change | Phone suitability | Purpose |
|---|---|---|---|---|
| Exact prediction ticketing | PredictionLedger + WorldSubsystem | Track pre-action reward prediction in WorldCausalCalibration | High | Prevent outcome from being matched to a later prediction |
| Evidence-weighted causal calibration | WorldCausalCalibration | Verification/independence/evidence metadata + repeated-trial readiness | High | Restrict learning to verified repeated evidence |
| Contextual holdout | RealityGroundingController | Action + coarse location/goal/energy context key | High | Avoid mixing incompatible situations |
| Active perception | B365 + ActivePerceptionExecutor | Record measured gain after outcome | High | Learn which sensing requests are useful |
| Actionable world model principle | Research-guided | Use calibration/verification as downstream evaluation | High | Optimize for behavior, not prediction aesthetics |
| Query-conditioned world-model principle | Research-guided | Preserve action-specific context and intervention provenance | High | Make world prediction auditable |
