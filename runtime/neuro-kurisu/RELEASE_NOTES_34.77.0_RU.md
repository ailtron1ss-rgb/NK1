# Neuro-Kurisu 34.77.0 — BIG PASS 103

## Тема
**Memory → Replay → Causal Experience → Unified Learning → Transfer → Verification.**

### Что изменено
- `ExperienceContinuumFabric` получил replay provenance, `lastReplayedAt`, goal-conditioned selection, валидацию retention, interference/transfer metadata и ограниченный replay ON/OFF experiment harness.
- Replay больше не маскируется под подтверждённое усвоение: автоматический replay-сигнал помечен `stateGrounded=false` и передаётся в causal/unified learning как гипотеза.
- `CausalExperienceStream` теперь различает `runtime-outcome`, `experience-replay`, `skill-repair` и `external`, а также `stateGrounded` и provenance evidence.
- `UnifiedLearningSubstrate` получил независимую holdout-gated проверку cross-task transfer и отдельную метрику interference.
- Runtime Core связывает replay с causal/unified substrate и сохраняет active-goal context.
- Миграция состояния повышена с schema 111 до 112 без потери старых данных.
- Все новые журналы bounded для mobile-first работы.

## Что сознательно НЕ добавлено
- Нет второго планировщика.
- Нет второго хранилища канонической памяти.
- Нет автоматической записи replay как «успешного обучения» без независимого evidence.
- Нет доказательства сознания или субъективного опыта.
- Нет автономной генерации произвольного runtime-кода.

## Научная опора
Replay в нейронауке рассматривается как потенциальный механизм реактивации/консолидации и retrieval; при этом reconsolidation остаётся контекстно-зависимым и дискуссионным процессом. Поэтому в проекте replay моделируется как вычислительный механизм гипотезообразования и повторной активации, а не как эквивалент биологической консолидации.

Основные источники:
- Carr, Jadhav & Frank, *Hippocampal replay in the awake state: a potential substrate for memory consolidation and retrieval*, Nature Neuroscience, 2011 — https://www.nature.com/articles/nn.2732
- Klinzing, Niethard & Born, *Mechanisms of systems memory consolidation during sleep*, Nature Neuroscience, 2019 — https://www.nature.com/articles/s41593-019-0467-3
- Tronson & Taylor, *Molecular mechanisms of memory reconsolidation*, Nature Reviews Neuroscience, 2007 — https://www.nature.com/articles/nrn2090
- Karlsson & Frank, *Awake replay of remote experiences in the hippocampus*, Nature Neuroscience, 2009 — https://www.nature.com/articles/nn.2344

## Статус
- Typecheck: PASS
- BIG PASS 101 regression: PASS
- BIG PASS 102 regression: PASS
- BIG PASS 103 functional test: PASS
- BIG PASS 103 migration: PASS
- Audit PASS 103: PASS
- Полный долгий empirical confirmation of biological equivalence: **не выполнен и не заявляется**.
