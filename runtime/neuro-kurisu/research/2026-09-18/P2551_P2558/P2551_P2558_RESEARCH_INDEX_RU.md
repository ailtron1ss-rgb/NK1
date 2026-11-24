# Research Index — P2551–P2558 / 2026-09-18

## Назначение
Этот раздел сохраняет не просто ссылки, а связь между внешним исследованием и конкретными архитектурными решениями Neuro Kurisu.

## Источники и что из них взято

### 1. BrainTrace — linear-memory online learning in SNN
Источник: Nature Communications, 19 Jan 2026.
https://www.nature.com/articles/s41467-026-68453-w

Использование в проекте:
- reinforcement идеи linear-memory temporal credit;
- event/sparse-aware computation;
- не копируется вся реализация BrainTrace, а используется как архитектурное основание для компактного online credit assignment.

Статус: частично реализовано ранее в P2540; P2551–P2558 добавляет outcome-aware causal credit поверх него.

### 2. Memory-R1
Источник: ACL 2026.
https://aclanthology.org/2026.acl-long.583/

Использование:
- ADD / UPDATE / DELETE / NOOP / RETRIEVE как действия менеджера памяти;
- outcome-driven learning;
- память как часть agent policy, а не только storage.

Статус: P2545 уже дал базовый memory manager; P2551–P2558 добавляет delayed utility credit и causal memory usefulness.

### 3. Self-Evolving World Models / WorldEvolver
Источник: arXiv 2606.30639, v2 (01 Sep 2026).
https://arxiv.org/abs/2606.30639

Использование:
- episodic memory + semantic rules;
- selective foresight;
- коррекция world model по prediction-observation mismatch;
- отказ от слепого доверия к forecast.

Статус: реализовано в P2551–P2558 как semantic-world rules + selective foresight gate.

### 4. Active inference and artificial reasoning
Источник: Nature Communications, 08 Sep 2026.
https://www.nature.com/articles/s41467-026-77209-5

Использование:
- information gain как часть epistemic value;
- предпочтение действий, способных уменьшить неопределённость;
- Bayesian model reduction — как исследовательская идея; полная Bayesian реализация пока НЕ заявляется.

Статус: частично реализовано через bounded epistemic action residual и disagreement-driven foresight.

### 5. Survey of world models for physical AI
Источник: Discover Artificial Intelligence, 03 Sep 2026.
https://link.springer.com/article/10.1007/s44163-026-02122-1

Использование:
- оценивать world model не только по prediction loss, но по closed-loop usefulness, uncertainty и action consequence prediction.

Статус: принят как benchmark design principle.

## Ограничение переноса результатов
Проценты и улучшения из этих работ НЕ суммируются между собой. Архитектуры, среды и метрики различаются. В проекте каждая идея принимается только через локальные ablation/regression тесты.
