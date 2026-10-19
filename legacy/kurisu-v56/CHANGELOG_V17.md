# Kurisu v17 — Evolution

## Major

- Added `CognitiveOrganism` integration layer.
- Added bounded `AttentionField` with workspace competition.
- Added persistent `GoalSystem`.
- Added `HypothesisLab` with evidence/confidence separation.
- Added `MetaCognition` calibration layer.
- Added `SelfEvolutionLab` with proposal-only code boundary.
- Added `AvatarLifeSystem` for cognition-driven micro-behavior.
- Added `GenesisMigration` to remove fabricated prototype relationship history.
- Added resilient `StateVault` persistence helper.
- Added Android RAM compatibility guard for local model loading.
- Expanded/cleaned local model registry; removed an unverified curated model entry.
- Added v17 Termux/Android instructions.
- Added self-programming architecture documentation.
- Added cognitive benchmark specification.

## Identity correction

A new Kurisu starts as a `Stranger`. The system does not pre-populate a family role, romance, friendship or fabricated shared history with the first user.

## Validation

Core cognitive TypeScript + BrainOrchestrator passed standalone `tsc --noEmit` validation with TypeScript 5.8.3. Full Vite production build was not claimed because dependency installation is environment/time limited.
