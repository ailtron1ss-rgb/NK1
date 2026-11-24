# WorkPass88 — continual forgetting metric (2026-10-21)

## Source selected
- Project: ContinualAI/Avalanche — https://github.com/ContinualAI/avalanche
- License: MIT (upstream license and provenance were already retained during WorkPass85).
- Inspected concept: Avalanche's task-keyed forgetting metric stores a best/initial reference score and compares it with the latest score; the public implementation describes per-key forgetting and supports continual-learning evaluation.
- Source references: https://github.com/ContinualAI/avalanche and https://avalanche-api.continualai.org/en/v0.4.0/_modules/avalanche/evaluation/metrics/forgetting_bwt.html

## Implementation
- Added `src/organism/learning/ContinualForgettingTracker.ts`.
- Tracks best held-out quality, latest held-out quality, observation count and forgetting gap per task.
- Reports mean and maximum forgetting plus sorted per-task values.
- Supports validated snapshot/restore and clear; it stores scalar evaluation results only and does not create a second replay memory or train the model.
- Added regression `tests/p26-continual-forgetting-tracker.mjs` and wired it into `.github/workflows/p26-learning-validation.yml`.

## Why it helps
Replay can preserve examples, but it does not by itself tell us whether learning a new task damages performance on older tasks. This metric gives the project a direct signal for that regression. It must be fed held-out evaluation scores for stable task-specific validation sets, not raw rewards or self-reported success.

## Evidence boundary
- Code and workflow edits were committed to branch `workpass88-avalanche-forgetting-metrics`.
- Test execution and typecheck are **not yet verified** in this report. Earlier P26 CI runs had unavailable logs; no passing status or quality improvement is claimed.
- This is an evaluation primitive, not an autonomous production feedback integration. Next step: connect it to the existing trusted task evaluator and compare sequential learning, balanced replay and prioritized replay using identical held-out tasks and multiple task orders/seeds.

## Approximate extraction progress
About **80% for this narrow metric adaptation**: the core state/update/report/restore behavior and regression are implemented. This does not mean 80% of Avalanche has been ported. Other Avalanche mechanisms still worth reviewing include backward transfer, forward transfer, task-wise accuracy matrices, experience-stream benchmark generators, and richer continual evaluation protocols.
