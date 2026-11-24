# NΩ-Core 1.3.0 — Unified Adaptive Development Stack

## Purpose
Move NΩ toward a compact mobile-first neuro-symbolic generalist by strengthening the actual learning loop rather than only adding runtime wrappers.

## New components
- UnifiedLearningCycleV3: curriculum + runtime traces + controller training + skills + world model + multimodal alignment + mobile objective.
- WorldModelV3: small ensemble dynamics, rollout disagreement, uncertainty-aware action ranking.
- SkillTransferV3: verified skill atoms and compositional skill construction with provenance.
- MultimodalGroundingV3: tiny text/image/audio shared-space alignment objective.
- MobileOptimizerV5: latency/RAM/NPU-aware target selection plus uncertainty policy.
- ProjectAuditV3: dynamic evidence-backed readiness accounting.
- ReleaseEvaluatorV3: reproducible V4 holdout/adversarial and mobile evaluation.

## Safety of learning
Candidate checkpoints are stored separately. The stable runtime is not replaced automatically.

## Evidence interpretation
Synthetic and compositional task results measure bounded system capabilities only. They do not establish general intelligence, broad world understanding, or real-device latency.
