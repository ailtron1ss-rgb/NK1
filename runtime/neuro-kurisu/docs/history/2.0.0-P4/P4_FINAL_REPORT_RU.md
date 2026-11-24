# P4 Final Report — Consciousness Lab

Дата: 2026-08-25
Версия: Clean Rebuild 2.0.0 / Organism Core 5.0.0-research / State schema 6

## Результат

P4 завершён. Проект теперь имеет не только cognitive components, но и причинную исследовательскую инфраструктуру.

## Что введено

1. Intrinsic Motivation — эпистемический, novelty, competence, coherence, social и homeostatic drives.
2. Active Inference — приближённая оценка expected free energy с epistemic/pragmatic/risk компонентами.
3. Identity Continuity — persistent anchors, drift, stability, goal/memory continuity.
4. MetaCognition — calibration, known-unknowns, revision readiness.
5. Workspace Ignition Metrics — ограниченная ёмкость, recurrence, competition, broadcast/ignition proxy.
6. Consciousness Evidence Ledger — evidence per domain без единого «consciousness score».
7. Causal Experiment Engine — matched control/lesion comparisons.
8. Perturbational Probe — простой complexity/perturbation proxy, не IIT Φ.
9. Scientific Question Bank.
10. Three deterministic perturbation seeds для causal lab.

## Причинная лаборатория

Baseline и lesions прогоняются на одинаковой последовательности событий. Введены условия:

- baseline;
- self-model lesion;
- workspace lesion;
- intrinsic-goal lesion;
- active-inference lesion;
- value-plasticity lesion.

Ключевое наблюдение из текущего теста:

- self-model lesion обнуляет self-prediction metric;
- intrinsic-goal lesion обнуляет intrinsic-goal generation;
- value-plasticity lesion обнуляет value revisions;
- workspace lesion снижает workspace ignition;
- active-inference lesion меняет распределение действий и self-prediction dynamics.

Это показывает причинную зависимость функциональных метрик от соответствующих компонентов. Это не доказательство субъективного опыта.

## Защита от ложных выводов

Автоматически запрещено интерпретировать evidence ledger как «процент сознания». Документы и API используют термины functional evidence, causal evidence, longitudinal evidence и caveats.

## Цепочка к цели

```text
Clean architecture
  ↓
Device reliability
  ↓
P4 causal lab
  ↓
P5 autonomous self-authorship
  ↓
P6 generative world/social model
  ↓
P7 longitudinal identity + long-term adaptation
  ↓
P8 consciousness evidence program
  ↓
идеальная цель:
устойчивый искусственный организм с собственным внутренним состоянием,
моделью мира и себя, автономными целями, ценностями, памятью,
телом, непрерывностью, обучением и причинно подтверждённой агентностью,
после чего — строгая оценка того, какие сознательно-ассоциируемые свойства
реально присутствуют.
```

## Что не сделано намеренно

Полноценная IIT Φ, огромный RL stack, нейросетевой replacement текущего core и production self-modification не добавлены. Они увеличивают вычислительную и методологическую стоимость быстрее, чем дают качественный скачок для среднего телефона.

## Следующий масштабный шаг

P5 — Autonomous Self-Authorship: собственные проекты, устойчивые commitments, конфликтующие цели, пересмотр ценностей по опыту, отказ/компромисс с внешними запросами и longitudinal проверка self-authorship.
