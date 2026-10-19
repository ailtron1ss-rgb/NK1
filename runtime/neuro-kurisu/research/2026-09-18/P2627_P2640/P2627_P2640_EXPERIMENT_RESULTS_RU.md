# P2627–P2640 — Experiment Results

## Isolated controller

- memories: 96
- writes: 1358
- recalls: 1598
- consolidations: 242
- contradictions: 1
- strategies exercised: 7/7
- strategyLearning01: 0.95969
- liveRedirects: 262
- liveImprovement01: 0.59730
- retrievalQuality01: 0.70443
- identityWeightedRecall01: 0.72993
- retention01: 0.58429
- holdout01: 1.0

## Integrated NeuralExperienceBranch

- cycles: 1200
- memoryCount: 96
- writes: 889
- recalls: 1198
- consolidations: 311
- strategyLearning01: 0.90841
- liveRedirects: 186
- liveImprovement01: 0.58433
- retrievalQuality01: 0.64224
- holdout01: 0.87143
- snapshot/restore: PASS

## A/B ablation

Adaptive mean reward: 0.734079
Plain fixed strategy mean reward: 0.638779
Absolute reward gain: +0.095300
Relative uplift vs plain baseline: ~14.9%
Shock events: 368

Interpretation: the gain is meaningful inside this synthetic shock environment, but cannot be treated as a general real-world improvement until external task and device benchmarks are added.
