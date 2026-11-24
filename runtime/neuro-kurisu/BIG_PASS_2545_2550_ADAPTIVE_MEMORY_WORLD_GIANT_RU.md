# BIG PASS P2545–P2550 — Adaptive Memory + World Continuity

## Архитектурная идея
Перевести память из пассивного контейнера в часть живого neural decision loop. Решение о сохранении/обновлении/извлечении/удалении опыта должно зависеть от novelty, uncertainty, prediction error, goals, identity relevance и будущей полезности. Одновременно world model должен учиться не только H1, но и H2/H4, иначе длинный горизонт остаётся рекурсивным накоплением локальных ошибок.

## Реализованные шаги
### P2545
- compact learned memory manager;
- bounded memory bank;
- utility/strength/protection/confidence/contradiction;
- policy updates from outcome.

### P2546
- protected identity/utility anchors;
- anti-forgetting drift detector;
- stability gate;
- consolidation debt.

### P2547
- bounded epistemic signal from horizon disagreement;
- explore/verify residual only;
- no second policy owner.

### P2548
- selective sleep consolidation;
- low-load scheduling;
- memory merges only for very similar low-protection traces.

### P2549
- multi-horizon latent transition learning H1/H2/H4;
- horizon-specific confidence;
- online SGD on observed transitions.

### P2550
- compute budget → replay/sleep/memory budgets;
- dynamic replay cadence in `OrganismCore`;
- restart-safe persistence;
- mobile endurance gate.

## Why this direction
BrainTrace supports the research direction of linear-memory online learning in SNNs. Memory-R1 and AgeMem show the value of making memory operations part of an agent policy. Recent continual-learning work supports stability/plasticity controls around memory-constrained replay. Multi-horizon latent world-model work supports directly training temporally extended dynamics rather than relying only on recursive one-step rollouts.

## Expected system-level effect
We do not add published gains arithmetically. The project measures local ablations. The intended combined effect is:
- less uncontrolled memory growth;
- better retention of high-value identity/goal traces;
- better long-horizon state prediction;
- less unnecessary replay under low uncertainty;
- more useful epistemic exploration under disagreement;
- better fit to mobile constraints.

## Next giant branch
P2551–P2558 should focus on learned memory operation training against external/embodied outcomes, causal transfer benchmarks, compressed world-model latent spaces, selective neural activation, and actual Android device profiling.
