# V88 — Research Alignment

## Replay sample selection

Replay strategy is not only a storage problem: sample-selection criteria change efficiency and continual-learning behaviour. A dedicated benchmark study evaluates replay sampling strategies across datasets and domains.
Источник: https://arxiv.org/abs/2208.02660

## Model-aware retrieval

MIR selects memories according to their expected interference under a forthcoming update, demonstrating that retrieval can be tied to the current learner rather than only to write-time metadata. V87 adapted the narrower principle using detached current-model error; V88 caches that utility and refreshes it sparsely.
Источник: https://arxiv.org/abs/1908.04742

## Why V88 caches instead of probing constantly

Model-based selection has a direct compute cost: model-based data selection requires additional inference over candidate data, and filtering more data increases scoring cost. V88 therefore uses a bounded cache with stale-slot refresh, rather than paying a fresh forward probe for every replay request.
Источник: https://arxiv.org/pdf/2406.17711

## What V88 deliberately does not claim

- no claim that current loss is universally the correct utility signal;
- no claim of lower catastrophic forgetting;
- no claim of superiority over MIR, fixed replay or other external methods;
- no external architecture was copied into the current trunk.

## Design boundary

V88 is a systems/learning-control pass. The recurrent backbone stays frozen until a stronger matched continual-learning qualification justifies changing it.
