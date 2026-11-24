# P4 ChangeLog — Consciousness Lab

Дата: 2026-08-25
Версия: Clean Rebuild 2.0.0 / Organism Core 5.0.0-research / State schema 6

## Внесено

- Intrinsic Motivation Engine.
- Active Inference Engine.
- Identity Continuity Engine с persistent anchors.
- MetaCognitive Monitor.
- Workspace Ignition Metrics.
- Consciousness Evidence Ledger.
- Causal Experiment Engine.
- Perturbational Probe.
- Scientific Question Bank.
- Matched lesion experiment: baseline, self-model, workspace, intrinsic goals, active inference, value plasticity.
- 3 deterministic perturbation seeds для P4 lab.
- P4 research results JSON.
- P4 roadmap и research basis.
- Schema migration 5 → 6.
- Новые release scripts `research:p4` и `research:p4:questions`.
- `/api/organism/status` и `/api/metrics` включают P4 evidence state.

## Исправлено во время разработки P4

- Удалена зависимость canonical `core/types.ts` от research layer.
- Исправлена интеграция MetaCognitiveMonitor: update выполняется на engine, затем сохраняется snapshot.
- Persistence identity anchors после restart.
- Workspace и self-model получили реальное causal influence на следующий decision cycle.
- Self-model lesion больше не считается «идеальным self-prediction» — метрика отключённого компонента равна 0/неизмерима.

## Ограничения

P4 по-прежнему не доказывает субъективный опыт. Это лаборатория причинных функциональных индикаторов.
