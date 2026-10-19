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


## Additional architecture queue preserved from prior NeuroCore passes

These names were explicitly proposed for NeuroCore research. Where the exact upstream paper/repository is not unambiguously identified, the entry says so instead of inventing a URL or pretending the source was audited.

| Candidate | Canonical source / starting point | Mechanism to inspect | Integration boundary | Status / acceptance gate |
|---|---|---|---|---|
| Mamba-3 MIMO / SSD | https://github.com/state-spaces/mamba and https://github.com/fla-org/flash-linear-attention | MIMO state-space sequence mixing, SSD formulation, state/cache behavior | Model-side sequence layer or backend experiment; not a second memory owner | **RESEARCH-ONLY** — resolve exact upstream file/revision, license, supported hardware and parity tests |
| MoBA router | https://github.com/MoonshotAI/MoBA | Block routing and sparse attention allocation | Long-context model experiment | **RESEARCH-ONLY** — measure routing recall, latency and worst-case memory; no production port yet claimed |
| Preconditioned DeltaNet KKT / WY / triangular solve | https://github.com/fla-org/flash-linear-attention | Numerically stable fast-weight update, KKT/WY representation and `solve_tril` path | Isolated training/update kernel or offline experiment | **RESEARCH-ONLY** — inspect exact source and tests; verify conditioning, finite gradients and correlated-key behavior |
| Gated Oja | Canonical upstream not yet resolved; search literature and maintained implementations before import | Local Hebbian/online plasticity with bounded gating | Existing canonical learning/plasticity owner only | **UNRESOLVED** — establish source lineage and compare against no-learning / classic Oja / delta-rule controls |
| Test-Time Training (TTT) | https://arxiv.org/abs/2407.04620 | Test-time parameter updates and adaptation dynamics | Offline model candidate or bounded adapter; must not mutate identity/policy without verified outcome | **RESEARCH-ONLY** — assess task transfer, data leakage, compute and rollback |
| Gated Sparse Attention (GSA) | Canonical source/revision not yet resolved | Gating plus sparse attention allocation | Model-side candidate, separate from canonical memory retrieval | **UNRESOLVED** — first identify exact paper/repository; do not conflate similarly named methods |
| Native Sparse Attention (NSA) | https://arxiv.org/abs/2502.11089 | Hardware-aligned, trainable sparse attention | Long-context model candidate | **RESEARCH-ONLY** — inspect released code/license and compare quality/latency on equal context and hardware |
| LIRA uncertainty/write gating | Exact LIRA source/revision not yet resolved | Uncertainty-aware decision to write, revise, defer or abstain | Memory write policy / evidence-confidence gate | **UNRESOLVED** — resolve exact acronym/source; require calibration, false-write and missed-write tests |
| HiPPO credit / memory projection | https://arxiv.org/abs/2008.07669 | Online projection of history into compact state | Experimental temporal-credit or sequence-state path | **RESEARCH-ONLY** — compare to current temporal memory and recurrent baselines; no claim of drop-in compatibility |
| DPLR / IPLR gradient arbitration | Exact project-specific implementation/source to be identified | Structured state-space parameterization and arbitration among gradient/update channels | Offline learning candidate; not a new canonical policy store | **UNRESOLVED** — document mathematical definition and source before implementing |
| RWKV-7 / Goose | https://github.com/BlinkDL/RWKV-LM | Recurrent inference, state carry and memory/throughput tradeoffs | Alternative local model/backend tournament | **RESEARCH-ONLY** — exact Goose checkpoint/repository, license, quantization and VRAM needs must be verified |
| Fused loss / fused update kernels | Exact upstream kernel depends on chosen training stack; inspect FLA and framework implementations | Reduce memory traffic and kernel-launch overhead | Training/benchmark code only; no assumed benefit in Node runtime | **RESEARCH-ONLY** — benchmark end-to-end, not just kernel microbenchmarks |
| Context Parallelism | Exact implementation depends on selected model/training stack; inspect upstream framework docs/source | Split long-context processing across devices/ranks | Multi-GPU training/inference only when hardware supports it | **RESEARCH-ONLY** — likely not directly useful to single-GPU GTX 1650 inference without evidence |
| MEMO snapshot artifacts | Local historical artifact noted in prior work as `memo_0.3.0_darwin_arm64`; canonical upstream/license not yet established | Snapshot/replay or memory tooling behavior | Provenance and compatibility investigation; not a production dependency by filename alone | **UNRESOLVED** — locate source, inspect license, checksum, platform and actual invocation before reuse |
| `erase_control.py` | Existing project-specific candidate name; exact canonical source path/revision must be re-resolved in repository tree | Controlled forgetting/erasure semantics and audit trail | Canonical memory owner; must preserve required historical evidence where policy demands | **UNRESOLVED** — distinguish deletion, supersession, quarantine and retention; test all four |
| Learned anti-forgetting / memory interference | MemoryAgentBench and MINTEval above, plus maintained continual-learning baselines | Transfer, catastrophic forgetting, interference and reversal | Existing learning/memory owner with held-out tasks | **ADAPT** — no new module until a repeatable failure case and a baseline comparison exist |

These entries intentionally separate known source starting points from names whose exact upstream is unresolved. Before any code port, record the actual URL/revision, license, files inspected, behavior reproduced and decision in this ledger. The fact that a candidate appeared in an earlier plan is not proof it exists upstream in the assumed form.
