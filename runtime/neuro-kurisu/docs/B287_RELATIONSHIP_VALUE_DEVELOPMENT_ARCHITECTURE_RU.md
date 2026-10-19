# B287 — Relationship Value Development Core

## Назначение
B287 закрывает конкретный разрыв между социальным моделированием и личностью: знание о другом человеке должно становиться частью собственных, нейронно обучаемых предпочтений Курису.

## Канонический поток
`social observation → relation context → recurrent relation state → person-specific value formation → action/goal bias → outcome → local plasticity → personality evidence → long-term identity`

## Нейронное состояние
- 32-dimensional recurrent relationship latent на каждую связь.
- Person-specific recurrent weights.
- Value-specific neural subspaces для 8 черт/ценностей.
- Eligibility traces.
- Action projection.
- Context projection от self/world/goal/future-self/personality/social-state.
- Outcome/prediction-error modulation.

## Представление отношения
Каждая связь имеет собственные оценки:
- trust;
- attachment;
- reciprocity;
- predictability;
- boundary;
- commitment;
- conflict;
- repair readiness;
- revision pressure.

## Связь с личностью
Только достаточно сильные, повторяемые и контекстно привязанные сигналы B287 передаются в `MultiHypothesisPersonality`. Это предотвращает превращение одного социального события в немедленную перепись характера.

## Связь с поведением
Relationship-specific action bias и goal bias являются вспомогательными сигналами к общей policy, а не заменяют world model или causal policy.

## Persistence
B287 полностью снапшотится и восстанавливается через `StateMigrations`.
