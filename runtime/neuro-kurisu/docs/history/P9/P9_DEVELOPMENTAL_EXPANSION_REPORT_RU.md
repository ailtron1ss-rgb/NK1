# Neuro-Kurisu Evolution 4.3.0 — P9 Developmental Expansion

Дата: 26 августа 2026
Основа: Architecture Report 2026-08-26 + P8 Genesis FINAL

## Цель шага

Перенести из архитектурного отчёта максимально большой объём S/A-идей и phone-safe часть B-идей в один связанный developmental layer, не возвращая проект к фазовому хаосу и не притворяясь, что handcrafted/statistical scaffolds являются полноценным learned neural model.

## Матрица реализации

### S — обязательно сейчас

| Идея | Статус | Реализация |
|---|---|---|
| Cognitive Field | ✅ | Существующий CognitiveField + давление/uncertainty/attention debt + P9 pressure aggregation |
| MemoryOS 2.0 | ✅ | MemoryOS2: sensory/working/episodic/identity-like traces, provenance, epistemic status, hybrid retrieval, reconsolidation, forgetting/dormant state |
| Learned World Model | ✅* | WorldModel2: статистическое обучение переходов, reward/surprise/confidence, causal hypotheses, residual + deterministic hybrid. Полноценный latent neural learner отложен как отдельная ML-фаза |
| Self-Prediction | ✅ | SelfModelV2 + longitudinal error |
| Contradiction Reservoir | ✅ | Existing reservoir + Cognitive Field pressure |
| Cognitive Immune | ✅ | provenance/quarantine/source monitoring |
| Procedural Memory | ✅ | ProceduralSkillLibrary + habit promotion/demotion |
| Future Simulator | ✅ | FutureSimulator поверх WorldModel2 multi-step rollout |
| Regret Engine | ✅ | Counterfactual alternative/outcome comparison + persistent regret records |
| Scientific Method Engine | ✅ | question → hypothesis → prediction → evidence → revision |
| Identity Trajectory | ✅ | Existing IdentityTrajectoryEngine + P9 developmental events |

### A — очень желательно

| Идея | Статус | Реализация |
|---|---|---|
| Attention Debt | ✅ | CognitiveField pressure decay/re-activation |
| Semantic Scars | ✅ | SemanticScarEngine: durable error-linked policy/attention bias |
| Value Provenance | ✅ | ValueProvenance: supporting/violating episodes + confidence/revision evidence |
| Commitment Repair | ✅ | acknowledge → diagnose → revise → compensate → rebuild protocol |
| Social Prediction | ✅ | Existing SocialWorldModel + P9 relationship integration |
| Model Switch Continuity | ✅ | persistent backend-switch record + continuity metric + test |
| Cognitive Budget | ✅ | body/thermal/RAM/CPU-aware depth choice |
| Micro-dreams | ✅ | short offline simulations integrated into cycle cadence |

### B — выполнена phone-safe версия

| Идея | Статус | Реализация |
|---|---|---|
| Developmental Forks | ✅ | persistent counterfactual developmental fork records |
| Relationship-specific Self | ✅ | RelationshipSelf per person: trust, warmth, guardedness, predictability, shared commitments |
| Dormant Memories | ✅ | MemoryOS dormant state + maintenance/re-activation policy |
| Multi-hypothesis Personality | ✅ | competing contextual trait hypotheses |
| Long-term Social Mind | ✅ | LongTermSocialMind aggregator around relationship/prediction history |

### C — сознательно НЕ внедрялось

- биологическая simulation на уровне клеток/биохимии;
- огромная LLM;
- постоянный on-device LLM polling;
- LoRA/fine-tuning каждого цикла;
- IIT/Φ как «датчик сознания»;
- тяжёлая robotics;
- 3D body ради визуального эффекта.

## Как новые компоненты связаны

Body/world → Cognitive Field → attention/pressure → MemoryOS + specialist network → WorldModel2/FutureSimulator → workspace/agency → ActionGateway → world outcome → prediction error → Regret/Value Provenance/Semantic Scars → Self/Identity → replay/sleep/micro-dream → следующий cycle.

SocialPrediction → RelationshipSelf → LongTermSocialMind → agency/relationship dynamics.

Language backend → ModelSwitchContinuity; модель остаётся заменяемым cognitive organ, а personal state живёт отдельно.

## Ограничения честной интерпретации

WorldModel2 на этом шаге является гибридом deterministic world + статистического residual/transition learning. Это переход к learned development, но ещё не полноценная нейросетевая latent dynamics model.

Самопредсказание, authorship, consciousness evidence и agency остаются operational metrics. Они не являются доказательством phenomenal consciousness или metaphysical free will.

## Следующий масштабный шаг

P10 — World Model 2.0 полноценнее:

1. latent state estimator;
2. probabilistic transition model;
3. causal graph learning;
4. uncertainty calibration;
5. counterfactual rollouts;
6. learned residuals от реального Android/environment feedback;
7. model-switch continuity при смене LLM/world-model backend;
8. external/blind longitudinal evaluation.

Ключевой переход: от «система знает правила тестового мира» к «система учится, как мир работает, и меняет свои будущие решения на основе этой модели».
