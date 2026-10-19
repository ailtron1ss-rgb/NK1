# NeuroCore — upstream research and source-intake ledger

**Purpose:** keep research actionable across chats. This ledger is a queue of candidates, not a claim that all listed ideas are integrated or superior. Read [NEUROCORE_START_HERE.md](../NEUROCORE_START_HERE.md) and [AGENTS.md](../AGENTS.md) before adding candidates.

**Decision labels:** `INTEGRATED` = integrated into canonical owner and tested; `ADAPT` = candidate worth adapting; `RESEARCH-ONLY` = inspect in isolation; `REJECT` = evidence/constraints do not justify it; `UNRESOLVED` = not enough evidence. A repository being present under `legacy/` or `research/` is not proof of integration.

## Active priority: memory quality, revision and learning

| Candidate / source | URL | Mechanism to inspect | NeuroCore integration target | Current status / next evidence |
|---|---|---|---|---|
| MemoryAgentBench (2025; updated 2026) | https://arxiv.org/abs/2507.05257 | Accurate retrieval, test-time learning, long-range understanding, conflict resolution/selective forgetting | `MemoryOS2`, benchmark and promotion gates | **ADAPT** — convert task categories into held-out suites; require same corpus, leakage checks and per-case results |
| Memora / FAMA (ACL 2026) | https://arxiv.org/abs/2604.20006 | Penalize stale/invalidated memory use | `MemoryOS2` revision-aware retrieval | **ADAPT** — paired fact-A → fact-B revision; query current and historical timestamps separately |
| MINTEval (May 2026) | https://arxiv.org/abs/2605.18565 | Multi-target interference and aggregation across evolving evidence | Memory retrieval, learning credit, evidence fusion | **ADAPT** — test conflicting targets, order/shuffle invariance and selective forgetting |
| AgeMem (ACL 2026) | https://aclanthology.org/2026.acl-long.981/ | Learned short-/long-term memory management | Existing memory residency and consolidation owner | **RESEARCH-ONLY** — compare learned management with deterministic policy under equal budgets; do not add another memory store |
| Existing NeuroCore retrieval experiment | `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalExperiment.ts` | Paired bootstrap sensitivity across fixed seeds | Canonical `MemoryOS2` | **IMPLEMENTED** — seeds resample intervals; they do not train the retriever. Prior `recallDelta=0` remains a hard block on uplift claims |

## Language model and neural architecture candidates

| Candidate / source | URL | Mechanism to inspect | Target / adaptation boundary | Current status / next evidence |
|---|---|---|---|---|
| Mamba / state-space models | https://github.com/state-spaces/mamba | Selective state-space sequence modeling, recurrent inference and memory/latency tradeoffs | Local model integration and sequence-processing candidates; benchmark against current backend rather than assuming a second foundation model belongs in runtime | **RESEARCH-ONLY** — inspect upstream revision, license, GPU/CUDA requirements and real inference costs |
| Flash Linear Attention (FLA) | https://github.com/fla-org/flash-linear-attention | Linear-attention kernels and recurrent sequence layers | Candidate for offline/local research or compatible model backend; do not copy CUDA kernels into a Node runtime | **RESEARCH-ONLY** — test hardware and packaging compatibility first |
| RWKV-7 | https://github.com/BlinkDL/RWKV-LM | Recurrent language-model inference and long-context tradeoffs | Model/backend tournament, not a parallel identity or memory owner | **RESEARCH-ONLY** — compare model license, VRAM, throughput, quality and context retention |
| Titans: Learning to Memorize at Test Time | https://arxiv.org/abs/2501.00663 | Test-time learned memory and surprise-based updates | Research candidate for learning/memory ablations | **RESEARCH-ONLY** — specify a small controlled task; test transfer, forgetting and compute cost before integration |
| Preconditioned DeltaNet / gated fast-weight updates | https://github.com/fla-org/flash-linear-attention | Stable fast-weight updates, matrix conditioning and linear-attention variants | Experimental learning candidate only; must not bypass verified outcome pipeline | **RESEARCH-ONLY** — identify exact upstream module/commit, license, numerical tests and baseline before porting |
| MoBA (Mixture of Block Attention) | https://github.com/MoonshotAI/MoBA | Block-level sparse attention and routing | Candidate for model-side long-context experiments, not a new memory database | **RESEARCH-ONLY** — verify repository status, implementation compatibility, sparse-routing quality and latency |

## Existing source projects / integrations already represented in the repository

| Source | Repository / path | Intended use | Current status / next evidence |
|---|---|---|---|
| Will | https://github.com/mindot-ai/will; retained source under `legacy/input-archives/will-main-2026-10-08/` | Adapt useful action/runtime/tool protocol ideas through existing Will adapters | **IMPLEMENTED / VERIFY PER CAPABILITY** — source presence is not enough; test actual call path, error behavior, idempotency and permissions |
| Hexis | retained source under `legacy/input-archives/hexis-main-2026-10-08/` | Inspect memory ingestion, retrieval evaluation, embeddings and provenance patterns | **RESEARCH-ONLY / PARTIAL ADAPTATION** — audit license and exact source lineage; existing code comments identify deferred embedding-worker inspiration, but each port needs attribution and regression |
| NeuroCore v126 and earlier snapshots | `legacy/snapshots/neurocore-v126/` and `legacy/snapshots/neuro-kurisu-35.30/` | Preserve prior behavior, compare implementations and recover provenance | **REFERENCE ONLY** — do not make snapshots a second production owner |
| Existing local language backend | `runtime/neuro-kurisu/src/server/local-language-backend-policy.mjs` and provider adapters | Route configured local `llama.cpp` first with bounded cooldown and explicit fallback | **IMPLEMENTED; LIVE INFERENCE UNPROVEN** — run opt-in fake-provider HTTP smoke, then actual local model smoke on Dell G3 |
| MemoryOS2 canonical owner | `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts` | One writable memory store with lexical/fuzzy/concept/entity/graph/temporal ranking and explicit semantic-index maintenance | **IMPLEMENTED; UPLIFT UNPROVEN** — do not call legacy 48-dimensional hash vectors semantic embeddings |

## Required intake record for every new candidate

Create a row or linked detail page with all fields below before treating the candidate as actionable:

- **Identity:** name, canonical URL, repository owner, release/commit/revision, date checked.
- **Provenance:** license, license compatibility, attribution requirements, dependency chain, upstream source files and their hashes where practical.
- **Claim:** exact mechanism, what it is intended to improve, and what the upstream evidence actually measures.
- **Boundary:** canonical NeuroCore owner to change; API/data/state contracts; whether code is vendored, adapted, wrapped or used only as a benchmark.
- **Risks:** hardware/runtime assumptions, memory/latency/energy costs, numerical stability, privacy, security, interference, catastrophic forgetting, licensing and maintenance burden.
- **Experiment:** reproducible baseline, same data and budget, held-out cases, ablation/counterfactual, confidence interval, failure cases and rollback.
- **Decision:** integrate / adapt / research-only / reject, with measured result and rationale.

## Next research pass

1. Build a source-level call graph for the canonical runtime and identify one actual bottleneck from traces/tests before selecting a new architecture.
2. Audit all candidate upstream revisions and licenses before importing code; the URLs above are starting points, not completed license review.
3. Turn MemoryAgentBench/Memora/MINTEval/AgeMem into separate revision, interference, test-time-learning and forgetting tests without merging them into one score.
4. Build a fair local model/backend tournament on Dell G3 (i5 + GTX 1650): model/license, RAM/VRAM, cold/warm latency, output quality on held-out Russian/English tasks, cancellation and recovery.
5. Only then prototype the highest-value neural architecture candidate behind an adapter, with a measured ablation and a clean rejection path.

**Evidence boundary:** this ledger records what to investigate and why. It does not claim that all candidates have been fetched, license-audited, reproduced, integrated or shown to improve NeuroCore.
