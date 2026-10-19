# Neuro Kurisu 35.19.0 / P2843 — REAL NEURALITY + MEMORY + CAUSAL EMBODIMENT

## Цель прохода

Сделан крупный переход от «нейронного readout + память как отдельные подсистемы» к более связному fast/slow neural-learning контуру. P2843 не заявляет биологическое сознание: он реализует проверяемые механизмы, которые можно экспериментально сравнивать с абляциями.

## Реальные изменения

1. **B296 neural substrate**
   - calcium-like activity traces;
   - intrinsic excitability/homeostatic regulation;
   - synaptic tagging;
   - fast synaptic weight + slow consolidated weight;
   - neuromodulated STDP-like local credit;
   - structural maintenance учитывает usage/tag/consolidated strength;
   - отдельная slow-plasticity и consolidation cadence;
   - persistence backward-compatible через нормализацию старого состояния.

2. **NeuralMemoryContinuityCore**
   - fast episodic traces;
   - associative vector retrieval;
   - slow semantic prototypes;
   - evidence-gated consolidation;
   - retention/interference metrics;
   - restart-safe persistence;
   - runtime retrieval реально влияет на B296 compute budget.

3. **ExternalPostconditionVerifier**
   - action-specific postcondition contracts;
   - independent evidence thresholds;
   - расширяемая action contract matrix.

4. **ActivePerceptionExecutor**
   - ranking кандидатов по expected information gain / cost / priority;
   - сохранён существующий observed-gain runtime loop.

5. **Mobile hotpath**
   - новая память ограничена 192 episodic + 24 semantic entries;
   - vector размерности <=24;
   - нет O(history²) операций в каждом runtime tick.

## Проверки

- typecheck: PASS
- P2843 neural/memory: PASS
- P2842 active perception runtime: PASS
- organism smoke: PASS
- mobile256 smoke: PASS
- release contract: должен быть PASS после обновления manifest

## Ограничение

256 MB V8 heap не равен физическому RSS. В текущем smoke peak RSS около 382 MB. Поэтому физическая RAM-сертификация среднего телефона ещё не закрыта.

## Следующая линия

P2844–P2850: long-horizon neural memory benchmarks, matched intervention matrix, 1h/6h/24h endurance, visual/egocentric memory, anti-forgetting ablations, developmental neural plasticity, and final neural-memory benchmark ladder.
