# Research synthesis — B2512–B2514

## 1. Почему разделять episodic и semantic memory

Свежие работы 2026 года показывают, что непрерывная консолидация может ухудшать memory utility; поэтому raw episodic evidence должен оставаться доступным, а consolidation — быть gated и provenance-aware.

Источники:
- Episodic-to-Semantic Consolidation Without Identity Drift, 2026: https://arxiv.org/abs/2607.01988
- Useful Memories Become Faulty When Continuously Updated by LLMs, 2026: https://arxiv.org/abs/2605.12978
- Adaptive compression as a unifying framework for episodic and semantic memory, Nature Reviews Psychology, 2025: https://www.nature.com/articles/s44159-025-00458-6

## 2. Replay and planning

World-model research продолжает связывать replay, imagined rollouts и policy improvement. В проекте B2513 поэтому не заменяет real outcomes imagined rollouts, а использует их как bounded pre-action computation и затем корректирует их verified outcome.

Источники:
- Mastering diverse control tasks through world models, Nature, 2025: https://www.nature.com/articles/s41586-025-08744-2
- A recurrent network model of planning explains hippocampal replay and human behavior, Nature Neuroscience: https://www.nature.com/articles/s41593-024-01675-7
- Constructing future behavior in the hippocampal formation through composition and replay, Nature Neuroscience, 2025: https://www.nature.com/articles/s41593-025-01908-3

## 3. Архитектурный вывод

Оптимальная для нашего проекта форма — не один огромный memory store, а:

raw episodic evidence → gated semantic abstraction → future-self simulation → verified outcome → selective replay/consolidation.

Это уменьшает риск memory corruption и позволяет измерять каждый переход независимо.
