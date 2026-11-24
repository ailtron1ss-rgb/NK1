# Neuro-Kurisu 35.6.59 — B2518–B2520 Большой апдейт

## Цель
Усилить единый persistent self/world контур: долговременная модель переходов, long-horizon counterfactual planning и sensorimotor imagination.

## Реализовано
- B2518 Persistent Self/World Model: verified transition memory, confidence, continuity/world stability, bounded persistent model, causal lesion.
- B2519 Long-Horizon Counterfactual Planner: adaptive horizon 2–7, action-conditioned rollouts, uncertainty/goal/compute-aware planning, verified outcome updates.
- B2520 Sensorimotor Imagination: body/thermal/energy/sensory-aware imagined action consequences, planning coupling, verified learning and causal lesion.
- Все три слоя встроены в OrganismCore, persistence и final utility path.

## Focused result
B2518/B2519/B2520 direct test: PASS.
- B2518 learning updates: 180; transitions: 180.
- B2519 rollouts: 6300; learning updates: 180; horizon: 5.
- B2520 imagined actions: 1260; learning updates: 180.
- causal effects: B2518 0.00181, B2519 0.30903, B2520 0.06020.

## Ограничение
Это computational research architecture, не биологический мозг и не доказательство феноменального сознания.


## Release gates
- typecheck PASS
- focused B2518-B2520 PASS
- runtime B2518-B2520 PASS
- core ownership PASS
- architecture PASS (1422 source / 439 canonical / 0 cycles)
- hygiene PASS (0 errors, 0 warnings)
- forensics PASS (0 duplicates)
- integrity PASS
- contract PASS
