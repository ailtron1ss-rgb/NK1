# Research Review B901–B1100 — 16.09.2026

## Почему этот этап выбран
B900 показал, что архитектура уже имеет память, world model, adaptive compute, skill transfer и regime detection, но скрытый reversal оставался слабым. Новый этап поэтому направлен не на добавление ещё одного независимого cognitive module, а на causal developmental loop, который заставляет контекст, память, предсказание, контрфакты и plasticity совместно менять policy.

## Исследовательские ориентиры

### 1. WorldEvolver / self-evolving world models
Работа 2026 года описывает сочетание episodic memory, semantic memory и selective foresight: ошибки предсказания обновляют память и правила, а низкоуверенные rollouts фильтруются до передачи агенту. Это напрямую мотивирует наш selective-foresight gate и world-model feedback loop. См. https://arxiv.org/abs/2606.30639

### 2. Subgoal-driven long-horizon learning
MiRA/subgoal-driven framework связывает subgoal decomposition с milestone-based reward shaping. Для Neuro-Kurisu это мотивирует milestone/counterfactual branch, которая должна помогать распределять credit при длинных последовательностях, не превращая организм в единственного «скриптового planner». См. https://arxiv.org/abs/2603.19685

### 3. Replay + gradient alignment
Публикация 2026 года по continual pre-training показывает, что replay и gradient alignment могут стабилизировать последовательное обучение и уменьшать forgetting, при этом meta-experience replay можно делать с небольшими compute/memory overhead. Это перенесено как bounded replay scheduler + alignment gate, а не как тяжёлый gradient engine. См. https://proceedings.mlr.press/v330/abbes26a.html

### 4. Replay не всегда полезен
Работа PMLR 2026 показывает, что replay может даже усиливать forgetting в зависимости от состава replay samples и взаимосвязи задач. Поэтому B901 не использует «replay всегда». Приоритет опыта зависит от signal, surprise, verification, interference и task match. См. https://proceedings.mlr.press/v330/mahdaviyeh26a.html

### 5. Feature-level view на replay
AISTATS 2026 подчёркивает роль signal-to-noise и порядка задач при replay. Для Neuro-Kurisu это мотивирует order-aware replay pressure и отдельный task-context assignment. См. https://proceedings.mlr.press/v300/ding26b.html

### 6. World-model usage itself is a bottleneck
ACL 2026 показывает, что наличие world model ещё не гарантирует полезное foresight: агентам трудно решить, когда симулировать и как встроить результат в reasoning. Поэтому B901 содержит selective-foresight gate и отдельную confidence/verifier петлю. См. https://aclanthology.org/2026.acl-long.623/

### 7. Efficient episodic memory filtering
EMA 2026 показывает ценность selective episodic filtering для снижения лишнего контекста и latency. Это поддерживает дальнейшее развитие bounded episodic retrieval в проекте. См. https://aclanthology.org/2026.findings-acl.250/

## Что именно внедрено
- latent task/context inference;
- modular task-conditioned policy heads;
- priority-aware replay;
- gradient-alignment gate;
- consolidation/anchoring analogous to bounded EWC-like protection;
- counterfactual alternative credit assignment;
- selective foresight;
- empirical verifier;
- reversal/failure heat fast path;
- developmental curriculum pressure;
- 384D distributed neural plasticity;
- restart persistence and lesion interfaces.

## Ограничения переноса
Опубликованные проценты из этих работ не являются прогнозом прироста Neuro-Kurisu. Они используются только как архитектурные ориентиры. Собственные результаты проекта валидируются отдельными synthetic/holdout/lesion tests.
