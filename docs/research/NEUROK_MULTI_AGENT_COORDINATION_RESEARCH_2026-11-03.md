# Research intake: safe parallel engineering agents

**Date:** 2026-11-03  
**Scope:** task partitioning, shared-state consistency, agent adherence and repository-scale verification.  
**Decision:** adapt mechanisms into NeuroK Engineering OS; do not vendor external frameworks wholesale.

## Primary research reviewed

### STORM — Multi-agent Collaboration with State Management
- Paper: https://arxiv.org/abs/2605.20563
- Code: https://github.com/dreamyang-liu/STORM
- License reported by arXiv metadata: CC BY 4.0 for the paper; inspect repository license separately before code reuse.
- Mechanism: validate writes against the versions of the target file and the context dependencies read by the agent. If any dependency changed after the agent read it, reject the write and force a refresh/retry.
- Reported results in the paper: Commit0-Lite macro pass rate 82.5% vs 63.8% for a Git-worktree baseline and 66.4% single-agent; PaperBench 74.1 vs 72.7 / 68.7. These are author-reported benchmark results, not NK1 evidence.
- NK1 adaptation: every task claim must bind a base SHA and owned paths; before patch admission compare the actual base and read-set file hashes against current HEAD. A stale read-set blocks apply. Keep branch isolation for high-risk or long-running work; add optimistic write-time validation as an extra gate, not a replacement for Git.

### Co-Coder — When Parallelism Pays Off
- Paper: https://arxiv.org/abs/2606.00953
- Code: https://github.com/Flitternie/CoCoder
- Mechanism: model the repository as a directed weighted dependency graph; isolate structural hub files; partition cohesive communities; schedule tasks in dependency order. Optimize communication cost against critical-path work rather than maximizing agent count.
- Reported results: up to 14.0 percentage-point pass-rate gain, 2.10x wall-clock speedup and 35% lower API cost on the paper's evaluated tasks. These are author-reported results and must not be projected onto NK1.
- NK1 adaptation: TypeScript AST/TypeChecker graph should distinguish extracted imports/calls from inferred edges; use cohesion and hub centrality to partition work. Core registries, shared contracts, OrganismBus and package/workflow manifests are single-writer hotspots. Do not split tasks by arbitrary file count.

### CooperBench — Why Coding Agents Cannot be Your Teammates Yet
- Paper: https://arxiv.org/abs/2601.13295
- Mechanism: identifies expectation, commitment and communication failures. Reported symptoms include work overlap (33.2%), divergent architecture (29.7%), unverifiable claims (4.3%) and broken commitments (3.7%).
- NK1 adaptation: convert agent messages into checkable state: task ID, role, branch, base SHA, paths, dependency contract, tests, status, evidence URL and handoff. Require mutual acknowledgement of task split and sequential integration review.

### OpenCollab — A Multi-Agent Coding Framework with Programmable Collaboration and Controllable Runtime
- Paper: https://arxiv.org/abs/2609.38345
- Mechanism: structured role-attributed event streams, shared pre-call budget gates and an adherence measure comparing declared organization with executed behavior.
- NK1 adaptation: record every tool/action with actor, task, cost, result and policy decision. Measure orchestration adherence (claims honored, no unowned writes, actual role participation, budget gate adherence) separately from task success.

## Engineering decision

The strongest NK1 design is **hybrid coordination**:

1. Cohesion-aware planning using AST/TypeChecker dependency graph.
2. Single-writer file/contract claims with expiring leases.
3. Isolated branch/worktree for edit-heavy agents.
4. Read-set freshness check at patch admission (STORM-style optimistic consistency).
5. Structured event receipts and adherence metrics (OpenCollab-style observability).
6. Sequential integration with independent verifier, exact-SHA CI and rollback.

This is intentionally stricter than simply launching more agents. CooperBench's coordination gap means parallelism is not assumed to improve quality. Increase concurrency only when dependency cohesion, claim availability, budget and verification capacity support it.

## Limitations and gates

- The papers are preprints; results are author-reported and benchmark-specific.
- Static import graphs miss reflection, dynamic imports, runtime plugin loading and semantic coupling. Mark edge confidence and supplement with runtime traces/tests.
- A local lease store coordinates only agents that share the same state directory. Multi-device use requires an authenticated shared backend with transactional compare-and-swap, not copying a local JSON file.
- The first coordinator implementation is advisory and does not intercept arbitrary filesystem writes. Patch admission must enforce claims before it can be called a complete write-control system.
- Do not claim improved NK1 throughput until a paired task set measures quality, elapsed time, token/API cost, rework and adherence against a sequential baseline.
