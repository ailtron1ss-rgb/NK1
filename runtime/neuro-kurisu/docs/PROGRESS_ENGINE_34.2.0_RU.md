# Neuro-Kurisu — Progress Engine 34.2.0

## Назначение

Этот документ переводит Master Prompt из общего руководства в конкретный механизм прогресса.

Каждый release обязан иметь минимум один активный goal с численным metric или проверяемым invariant.

## Goal schema

```json
{
  "goalId": "Gx",
  "parentGoalId": null,
  "domain": "architecture|memory|identity|world|cognition|agency|development|embodiment|portability|reality|security|performance|research",
  "stage": "1|1.5|2|3|4|5",
  "status": "PROPOSED|ACTIVE|VALIDATING|PASSED|BLOCKED|FAILED|REGRESSED|REWORK",
  "baseline": "measured current state",
  "target": "measurable desired state",
  "metric": "measurement definition",
  "minimumEvidence": "IMPLEMENTED|FUNCTIONAL INDICATOR|OBSERVED|PROVEN",
  "currentEvidence": "...",
  "dependencies": [],
  "blockedBy": [],
  "regressionGuard": "existing tests/threshold",
  "nextAction": "one executable action",
  "exitCriteria": ["..."],
  "owner": "canonical module or process"
}
```

## Current goals

### G1 — OrganismCore decomposition
Reduce architectural bottleneck without parallel semantic owners.

### G2 — Long-horizon scaling
Reduce latency/heap growth and establish 1k/10k cycle gates.

### G3 — Portable Subject v2
Add model/embodiment/degraded-host transfer scenarios.

### G4 — Native Android host
Progress from Termux research host to lifecycle-aware native host engineering.

### G5 — Semantic sensorium
Replace placeholder perception with measurable grounded learning.

### G6 — Autonomous research
Automated experiment generation, execution, analysis and evidence updates.

### G7 — Longitudinal development
24h/72h/168h/30-day development and continuity gates.

## Release progression rule

A release is considered progressive only when at least one goal moves from baseline toward exit criteria and no critical regression is hidden.

Housekeeping-only changes must be labeled explicitly.
