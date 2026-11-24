# FINAL AUDIT — Neuro Kurisu 35.6.71 / P2612

Дата: 2026-09-18

## Release

- application: `35.6.71`
- organismCore: `82.0.0-hierarchical-adaptive-brain-p2612`
- stateSchema: `177`
- phase: `Stage-55/Hierarchical-Adaptive-Embodied-Brain/P2612`

## Primary implementation

### Hierarchical procedural layer

- `HierarchicalProceduralSkillEngine.ts` added and integrated into `NeuralExperienceBranch`.
- Meta-skills are induced from compatible lower-level procedures rather than declared from a single trace.
- Action search is compute-gated.
- Child assignment, abstraction gain, compression, transfer and recovery are explicit telemetry.

### Adaptive embodied world model

- `EmbodiedCausalWorldBridge` upgraded with bounded residual adapter.
- Online updates are small and clipped.
- Added calibration error, model drift, failure and recovery telemetry.
- Existing H1/H2/H4/H8/H16 horizon ladder remains active.

## Functional evidence

### P2599–P2612 hierarchical benchmark — PASS

- base skills: 7
- procedural variants: 28
- meta-skills: 16
- child assignments: 64
- compression ratio: 0.521739
- cross-context holdout: 160/160
- recovery routes: 33
- failed routes: 0

### P2599–P2612 online adaptation — PASS

- adaptation updates: 520
- onlineAdaptation01: 0.1322
- calibrationError01: 0.01145
- modelDrift01: 0.0993
- controlled failure events: 1
- recoveryGain01: 0.5159

The shift benchmark is not a frozen-baseline A/B test and therefore does not prove causal superiority of adaptation.

### Prior regression — PASS

- P2587–P2598 transfer: PASS
- P2587–P2598 neural integration: PASS
- P2587–P2598 horizon transfer: PASS
- P2587–P2598 performance: PASS
- B2522 neural branch/runtime: PASS
- B2521 runtime: PASS
- B269 spiking plasticity: PASS
- B365 unified neuro core: PASS
- P22 phone reliability: PASS

B2521 runtime currently reports model coverage around `0.419`, substantially above the pre-P2587 low-coverage regime, but this remains an engineered benchmark rather than proof of open-ended generalization.

## Static/release audits — PASS

- TYPECHECK: PASS
- CLEAN_ARCHITECTURE: PASS; sourceFiles=1459, canonicalFiles=448, missing=0, cycles=0, legacyLeakage=0
- SOURCE_HYGIENE: PASS; files=3227, errors=0, warnings=0
- FORENSICS: PASS; duplicateContent=0, duplicateNames=0, empty=0
- AUDIT_FULL: PASS; files=3227, canonical=448, legacySnapshotEntries=0
- AUDIT_BRAIN: PASS; organismFiles=448, links=9
- CLEAN_INTEGRITY: PASS; files=3231, release=35.6.71, core=82.0.0-hierarchical-adaptive-brain-p2612, schema=177
- RELEASE_CONTRACT: PASS
- RELEASE_SOURCE: PASS

## Mobile smoke

Direct clean smoke with V8 heap cap 256 MB:

- 30 autonomous steps
- elapsed: 26.16 s
- peak RSS: 352336 KB (~352 MB)
- PASS

This is a host-side memory-constrained smoke, not a measurement on the target Android device. Real thermal/RAM measurements on the user's phone are still outstanding.

## Performance trade-off

The transferable benchmark is about 58.8–62.7k cycles/s in this release versus about 60.2k cycles/s baseline runs in the previous release's identical benchmark. The hierarchy therefore introduces roughly a 2–6% host benchmark overhead depending on run variance. This is intentional and should remain gated by compute budget.

## Known limitations

1. Hierarchical holdout is synthetic and needs independent task-ID-free benchmark suites.
2. Online adaptation needs frozen-vs-adaptive A/B measurement.
3. Meta-skill pruning/consolidation needs long-running stability tests so useful skills are not collapsed.
4. External multimodal grounding is weaker than the internal neural/world-model substrate.
5. Android thermal profiling remains pending.
6. Personality coupling is functional but not yet the dominant controller over skill/world-model decisions.
7. No part of this release is evidence that the system is conscious.
