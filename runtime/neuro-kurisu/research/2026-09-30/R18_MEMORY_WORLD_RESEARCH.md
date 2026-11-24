# Neuro-Kurisu R18 — Memory / World Research Integration

Date: 2026-09-30
Release: 35.32.0 / R18

## Purpose

R18 focuses on three failure modes that matter for a persistent cognitive organism:

1. stale information remaining behaviorally active after state revision;
2. memory retention policies becoming static heuristics instead of adapting from outcomes;
3. world-model confidence remaining global when prediction quality is context-dependent.

The implementation stays zero-dependency and keeps canonical state ownership inside the existing MemoryOS2 / WorldCausalCalibration / OrganismCore paths.

## External evidence considered

### All-Mem — Agentic Lifelong Memory via Dynamic Topology Evolution
https://arxiv.org/abs/2603.19595

Actionable ideas adopted:
- bounded visible memory surface;
- non-destructive consolidation;
- topology/revision as a maintenance operation;
- recovery to raw evidence instead of destructive overwrite.

Adaptation:
- R18 does not add a second graph database;
- implicit conflict adjudication reuses MemoryOS2 revision groups and contradiction links.

### STALE — State Consistency and Implicit Conflict
https://arxiv.org/abs/2605.06527

Actionable ideas adopted:
- detect implicit conflict even without explicit negation;
- propagate current state by invalidating stale validity intervals;
- keep the historical record recoverable.

Adaptation:
- bounded pair budget and semantic/entity/context gates are used for mobile execution.

### The Memory Trust Gap
https://arxiv.org/abs/2609.01852

Actionable implication:
- stored memory should not automatically outrank fresher/authoritative evidence;
- conflict resolution should happen before retrieval is allowed to dominate behavior.

R18 response:
- stale memories receive `validUntilAt` and are excluded from `current` retrieval;
- conflict statistics are persisted for later auditing.

### When Memory Updates but Behavior Does Not — StateAuditor
https://arxiv.org/abs/2608.01619

Actionable implication:
- testing the storage mutation alone is insufficient;
- downstream behavior must be checked.

R18 response:
- P2890 compares cold and matured world-calibration states inside the live OrganismCore candidate path;
- P2891 joins memory conflict resolution, learned retention and calibration in one closure test.

### Mem0 — current open-source memory implementation
https://github.com/mem0ai/mem0

Observed design ideas:
- temporal retrieval;
- entity linking;
- hybrid retrieval signals;
- persistent agent/session state.

R18 response:
- the project keeps its own dependency-free implementation and only imports the conceptual mechanisms needed for lifecycle/retrieval quality.

## Why R18 uses low-gain world calibration

The learned calibration modifies confidence and a bounded score residual only. It is not allowed to become a second action policy. This is intentional: confidence correction should improve uncertainty handling without allowing stale statistics to overpower the canonical action arbitration path.

## Experiments added

- P2887 — implicit stale-conflict closure
- P2888 — adaptive memory economy
- P2889 — contextual world calibration
- P2890 — live world-calibration coupling
- P2891 — cross-subsystem closure

## Results captured in release report

- P2887 resolved 1 implicit conflict and prevented 1 stale retrieval.
- P2888 completed 96 learning updates with non-zero weight drift.
- P2889 achieved context readiness ~0.893 and moved a raw confidence 0.30 to ~0.647.
- P2890 measured a live candidate confidence delta of ~+0.0656 between cold and matured calibration paths.
- P2891 passed memory/world/learning closure in one bounded test.

## Non-adopted research directions

Large Mamba/SSM stacks, external vector databases and cloud-only memory services were not imported into the canonical runtime. They remain experimental candidates because the current project must remain usable on a medium Android/Termux target.
