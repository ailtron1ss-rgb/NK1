# Release 35.6.69 — P2575–P2586

Новый проход: Continual Dream Rehearsal + Causal Memory.

Главные изменения:
1. Model-time / forgetting-debt replay scheduler.
2. Graded dream rehearsal для action/policy retention.
3. Protected procedural skill state.
4. Conflict-aware causal rules и negative-transfer gate.
5. Planner state schema v2 и persistence.
6. Новые ablation/integration/performance tests.
7. Исследования сохранены в `research/2026-09-18/P2575_P2586/`.

Release contract:
- application: 35.6.69
- organismCore: 80.4.0-actionable-world-model-gate-p2586
- stateSchema: 175
- phase: Stage-53/Continual-Dream-Rehearsal-Causal-Memory/P2586

Честное ограничение: Dream rehearsal является внутренней репетицией и не должен трактоваться как внешнее обучение на реальном мире.
