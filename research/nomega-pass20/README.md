# NOMEGA

NOMEGA is an execution-grounded research platform for building a progressively more autonomous, self-developing software/cognitive organism. The repository combines program synthesis and execution, neural substrate experiments, memory and skill systems, evolutionary search, verification/evidence infrastructure, and governed source-level self-modification.

## Current status

Current governed development release: **1.36.0-dev (Pass20)**.

Pass18 adds a canonical V13 neural-program execution bridge: neural candidates can enter the same executable verification spine as deterministic candidates, with checkpoint lineage and measured training/evaluation artifacts. The release also retains the real source-level self-modification infrastructure from earlier passes: deterministic AST mutation proposals, isolated candidate execution, cryptographically bound promotion decisions, rollback, runtime/cache-independent source hashing, and explicit metaproductivity lineage. These mechanisms are research-only. Full autonomous self-improvement, general intelligence, and robust pure-neural coding uplift are **not claimed as solved**.

## Development protocol

All changes are governed by the **NOMEGA Master Development Protocol** at:

`docs/nomega/governance/NOMEGA_MASTER_DEVELOPMENT_PROTOCOL.md`

The protocol requires execution-grounded evidence, causal attribution, holdout/OOD checks, restart validation, resource measurement, multi-seed evaluation, explicit promotion/rejection, and rollback. Missing evidence is treated as unknown rather than as success.

## Architecture

The intended canonical direction is:

`cognitive state -> neural substrate -> skills/memory -> program generation/search -> real execution -> verification/evidence -> governed promotion/rollback -> replay/consolidation -> self-development`

Versioned and historical implementations remain available for research and regression purposes, but new work should extend the canonical implementation before introducing another generation.

## Evidence labels

- **FACT** — directly established from repository/runtime inspection.
- **MEASURED** — obtained from an executable test or benchmark.
- **ESTIMATED** — explicitly derived rather than device-measured.
- **HYPOTHESIS** — proposed mechanism or interpretation requiring experiment.
- **TODO** — unresolved work.

## Honest limits

The complete repository test suite may contain slow historical/legacy paths. A targeted green shard is not treated as a full-suite release claim. Neural mechanisms are computational abstractions, not claims of biological equivalence. Hybrid/search improvements are not reported as pure-neural learning.

## Quick start

```bash
python -m compileall -q core tests
PYTHONPATH=. pytest -q -p no:ddtrace
```

For the complete machine-checkable governance contract:

```bash
python tools/nomega_governance_check.py
```
