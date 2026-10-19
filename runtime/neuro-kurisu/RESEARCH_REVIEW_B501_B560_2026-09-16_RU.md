# Internet Research Review — B501–B560 — 2026-09-16

## 1. H-MEM
H-MEM (EACL 2026) использует иерархическую память с routing по уровням и positional links между уровнями. Главный применённый принцип: не делать exhaustive retrieval по всей истории; сначала выбирается нужный уровень, затем subset.

## 2. TiMem
TiMem (Findings ACL 2026) делает temporal-hierarchical memory tree и complexity-aware recall. Это особенно релевантно для цели проекта, потому что autobiographical identity должна иметь временную непрерывность.

## 3. ReMe
ReMe (Findings ACL 2026) рассматривает procedural memory как lifecycle: distill success/failure → context-adaptive reuse → utility refinement/pruning. Мы перенесли эту идею в bounded developmental memory.

## 4. MCMA
MCMA (Findings ACL 2026) делает memory abstraction itself a learnable cognitive skill. Это аргумент в пользу будущего перехода от heuristic routing B501 к отдельной обучаемой meta-policy.

## 5. AMA / HiGMem / GAM
Свежие memory systems 2026 объединяют hierarchical routing, high-level anchors, consistency checking, conflict-aware refresh и decoupling of encoding/consolidation. Для Neuro-Kurisu полезнее bounded lightweight variants, а не multi-agent swarm из тяжёлых LLM.

## 6. Titans / test-time memory
Titans рассматривает отдельную long-term neural memory, которая обучается помнить исторический контекст во время inference. Это направление особенно интересно для будущей нейронной памяти проекта: memory update должен становиться частью neural substrate, а не только JS-state.

## 7. V-JEPA 2
V-JEPA 2 показывает полезность latent action-conditioned world modelling и planning в latent space. Для нашего проекта следующий шаг — усилить B261/B262/B293/B365 совместным latent state вместо ещё одного независимого world model.

## 8. ODAR
ODAR (2026) — adaptive routing, где difficulty/uncertainty определяют, сколько reasoning/computation требуется. В B501 реализована lightweight версия: minimal/normal/deep/research и strategy routing.

## Какие идеи наиболее перспективны

### Высокий приоритет
- temporal hierarchical memory;
- learned memory abstraction;
- adaptive compute routing;
- latent predictive world model;
- neural long-term memory;
- calibrated uncertainty;
- causal/OOD memory retrieval.

### Средний приоритет
- coordinated specialist ensemble;
- procedural memory lifecycle;
- active experiment selection;
- offline consolidation / sleep-like replay.

### Что не следует просто копировать

Тяжёлые LLM multi-agent swarms, огромные vector databases и full neural backprop on-device не соответствуют medium-phone/Termux constraints. Лучше брать архитектурные принципы и реализовывать bounded local variants.

## Потенциальный эффект объединения

Нельзя складывать reported benchmark gains из разных papers. Более реалистичная гипотеза:

`лучше память → лучше state estimate → лучше routing → меньше waste compute → лучше planning → лучше outcome → лучше memory`

То есть возможен feedback amplification, но его нужно доказывать на unseen composition / OOD / long-horizon / multi-lesion benchmarks.
