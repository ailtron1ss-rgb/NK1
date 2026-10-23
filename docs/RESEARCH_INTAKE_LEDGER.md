## Additional implementation follow-up — emotion calibration and CI runtime policy (2026-10-23)

- **Emotion regulation / evidence-bounded calibration:** source commit `23b66f101076b4d4680bb602550fb9da73a4cae4` (`feature/emotions`, PR [#81](https://github.com/ailtron1ss-rgb/NK1/pull/81)) validates outcome success, surprise, and regulation-cost values as finite numbers in [0,1] before changing the action-calibration row. NaN/string/out-of-range inputs no longer silently become training signals. Regression commit: `dc8b48479ebaed988564f4b5b7f2ae74fae367e8`.
- **Experiments / Node.js 24 compatibility guard:** source commit `0527d811e30657aed0a8323ef830144277d25c80` (`feature/experiments`, PR [#85](https://github.com/ailtron1ss-rgb/NK1/pull/85)) extends the existing policy audit to cover artifact upload/download actions as well as checkout/setup-node, so a v4 downgrade is caught. The current workflows inspected on this branch already use Node 24 and v7-compatible first-party Actions where applicable; this closes a validator gap rather than rewriting those workflows. Regression commit: `fd6340781cc02e9d49f07e58a841df78b7a9e488`.
- **Primary-source code inspection:** inspected Hermes' `evolution/skills/evolve_skill.py` (fetched blob SHA `2a79a670aaa632fe720b2fef0fc9ce62ee7d281f`) and `PLAN.md` (blob SHA `48f9ef147e5b47d3d24d712d5360f41d31340ce6`). Transferable mechanics are dataset splitting, baseline constraint validation, candidate evaluation and approval/revert. NK1 already has native holdout/approval gates; the additional size bounds and action-runtime audit are native adaptations, not a wholesale vendor import.
- No package dependency was added. Tests remain unexecuted on these exact heads; this is source-code progress, not verified uplift.

---

## Follow-up implementation pass — cross-category boundary and fault-tolerance work (2026-10-23)

This follow-up extends the existing category branches; it does not introduce a second memory owner, learner, planner, or action gateway.

- **Learning / Hermes-inspired evaluation guardrails:** source commit `350d06aa6b5242496f3316b98914149d4828a00e` (`feature/learning`, PR [#79](https://github.com/ailtron1ss-rgb/NK1/pull/79)). Trajectory-order matching now uses an index (linear worst-case rather than repeated suffix scans); skill/capability rubrics are bounded to 4,096 IDs with 256-character ID caps. This adapts the upstream emphasis on candidate size limits, evaluation and semantic-preservation gates without copying the external optimizer or adding dependencies. Primary source: https://github.com/NousResearch/hermes-agent-self-evolution.
- **Perception / live cognitive ingress:** source commit `4c7ed4d54c2178d51a68300bcb48f8c145bd78dc` (`feature/perception`, PR [#80](https://github.com/ailtron1ss-rgb/NK1/pull/80)). The unified cycle snapshots and allowlists input before reading it; unknown stages and hostile getters are rejected before state mutation.
- **Feedback / evidence restore:** source commit `807454005c260eab807bc38c7ca77c8f489e55d4` (`feature/feedback`, PR [#87](https://github.com/ailtron1ss-rgb/NK1/pull/87)). Ledger checkpoints are detached through the bounded plain-data boundary before schema reads, rejecting accessor-backed and cyclic restore payloads.
- **Memory / diagnostics isolation:** source commit `8553b9619a30e2b5af0dfabc0cf03b01343a6375` (`feature/memory`, PR [#82](https://github.com/ailtron1ss-rgb/NK1/pull/82)). A broken optional embedding-provider diagnostics hook no longer prevents valid semantic-index batches or makes the read-only diagnostics method throw. The canonical `MemoryOS2` store and lexical fallback remain the sole memory path.
- **Personality / atomic self-model updates:** source commit `ed53ca53040b04bfac55a0ad234cfc7364ab6b02` (`feature/personality`, PR [#83](https://github.com/ailtron1ss-rgb/NK1/pull/83)). Reward, causal-match and outcome-state fields are detached and validated before prediction mutates self-agency weights/counters.
- **Embodiment / action receipt integrity:** source commit `f21bcfab5dd94b93b57181961a095d26bf7b0e35` (`feature/visual-embodiment`, PR [#84](https://github.com/ailtron1ss-rgb/NK1/pull/84)). Required pre-action sensor failure blocks dispatch and returns an explicit failed receipt; a failed post-action sample withholds independent-verification credit without hiding an action result already produced.

### External mechanism intake verified on 2026-10-23

- [Hermes Agent Self-Evolution / GEPA](https://github.com/NousResearch/hermes-agent-self-evolution): the README describes trace-driven reflection, candidate generation/evaluation, size/test/semantic constraints and PR review. NK1 reused the guardrail principle, not the full upstream runtime.
- [Letta memory & dreaming](https://docs.letta.com/configuration/memory): the documentation describes git-backed memory and background consolidation/dreaming with review. NK1 keeps `MemoryOS2` as the canonical owner; no MemFS side store was added.
- [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices): task-specific evaluation data, retained logs, automation and human calibration support NK1's direction toward paired/held-out evidence rather than subjective “looks better” claims.
- No new package or runtime dependency was introduced in this follow-up. Research links and design transfer are provenance, not proof of measured performance gain.

### Truthful status after this pass

All seven intended category branches still have implementation commits and regression-source additions (7/7, 100%). Exact-head suite execution remains confirmed on 0/7 (0%); category PR merges remain 0/7; the release ZIP remains updated/hash-verified 0/1. Overall readiness therefore remains **46/100** rather than increasing based on code volume. Latest PR heads are refreshed in GitHub; PRs remain drafts against `integration`, which was not modified. Actions jobs still have the runner-provisioning blocker described below.

---

## WorkPass449 — verified upstream mechanisms and current implementation delta (2026-10-23)

### Hermes Agent Self-Evolution / GEPA — mechanism adapted, not vendored
- Primary source: https://github.com/NousResearch/hermes-agent-self-evolution (the repository README identifies the project as MIT-licensed and describes trace-driven reflective mutation, candidate evaluation, test/size/semantic constraints, and reviewable PR-based promotion).
- NK1 source donor inspected: https://github.com/ailtron1ss-rgb/NK1/tree/workpass328-upstream-donor-gate, especially `runtime/neuro-kurisu/src/organism/learning/SkillLearnBenchAdapter.ts` and `tests/p29-hermes-reflective-candidate-gate.mjs`.
- **Adapted in code:** WorkPass441/commit `780d774f4fb29963d99ad08bda51a84f5a39b263` ports independent holdout regression limits for task success, trajectory quality, and skill quality into `feature/learning`, preserving existing paired trials, family-level regression, safety gate, and approval boundary. This is a native NK1 adaptation; no external Python optimizer or new dependency was installed.
- **Still open:** trace-to-repair-to-candidate end-to-end provider wiring, exact-head evaluation, rollback proof, and matched real-task learning-uplift measurements. Unit fixtures are not measured uplift.

### Letta / MemFS — versioned memory as an architectural reference
- Primary sources: https://docs.letta.com/configuration/memory and https://github.com/letta-ai/letta-code. Their docs describe reviewable, git-backed memory files, cross-session continuity, and consolidation/dreaming.
- **NK1 decision:** keep `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts` as the sole canonical memory owner; do not add a parallel MemFS store. Preserve provenance, temporal validity, revision lineage, bounded restore/query behavior, and reviewable consolidation as the transferable properties.
- **Adapted in this pass:** WorkPass447/commit `14b12d738c35ba14891a2d474f8d23ccd6ecdfeb` hardens temporal retrieval-control ingestion; WorkPass450/commit `97d329bc208aa8c7e4097947070b32dd17718fd0` validates the background semantic-index maintenance options before provider inspection or work. Both preserve the canonical MemoryOS2 owner and add no dependency; neither is claimed as copied Letta code.

### Voyager — compositional skill reuse and feedback-guided revision
- Primary source: https://github.com/MineDojo/Voyager (MIT license; README describes automatic curriculum, an executable compositional skill library, checkpoint/resume, and iterative repair using environment feedback, errors, and self-verification).
- **Reusable lesson:** learned behavior must be versioned, retrievable by task/context, composed under dependency constraints, and improved against execution feedback; reuse must be demonstrated on unseen NK1 task families, not Minecraft-specific reward logic.
- **Disposition:** protocol/design reference only in this pass; no Voyager runtime/dependencies vendored, and no performance claim is made.

### Current NK1 commits in this follow-up
- `feature/learning` — `780d774f4fb29963d99ad08bda51a84f5a39b263`: candidate per-axis holdout regression gate.
- `feature/perception` — `8a38fd74c10f1863da995692e334238e15e4849e`: bounded snapshot on unified-cycle restore.
- `feature/feedback` — `45758ede29ee884cd2eaf3b24b5b7baf979fa923` and `4cacd0bb177dba5033f00d4b8d67fb972cfcd36d`: verified-outcome and manifest ingress guards.
- `feature/visual-embodiment` — `5e1fa2523b13f1e9596848e160fec89b5a3aace7`: persisted body-schema normalization before runtime start.
- `feature/personality` — `6d0cb1a2d6eb9fe9c36a1f0b5e572e0696260892`: live self-agency observation guard.
- `feature/memory` — `14b12d738c35ba14891a2d474f8d23ccd6ecdfeb` (temporal retrieval) and `97d329bc208aa8c7e4097947070b32dd17718fd0` (background semantic-index maintenance options).
- `feature/emotions` — `8c86aa1b315f1e73e44668d42a7e21585dec912e`: prototype-safe emotion action calibration.
- **License discipline:** code is adapted by mechanism rather than copied wholesale. Before adding upstream source files/dependencies, re-check the exact repository/license/revision and preserve provenance. Do not vendor AGPL Darwinian Evolver into NK1 by default.
- **Verification truth:** regression tests were added but exact-head execution is not verified; current Actions examples terminate before the first step with `runner_id=0` and zero steps. No learning or runtime-quality uplift is claimed.

---

## WorkPass266 — primary-source metadata check for memory and neuroscience candidates (2026-10-22)

- [AMA-Bench, ICML 2026](https://proceedings.mlr.press/v306/zhao26bs.html) — publisher record describes long-horizon memory over agent/environment trajectories (states, actions, observations and tool output). Use its protocol as a candidate for trajectory-grounded evaluation; code/data integration has not been performed.
- [Mem2ActBench, ACL 2026](https://aclanthology.org/2026.acl-long.370/) — the paper evaluates whether remembered preferences and task state ground later tool selection and parameters. This matches the planned memory-to-action task family. Upstream code/data and license still require review.
- [Memora / From Recall to Forgetting, ACL 2026 Findings](https://aclanthology.org/2026.findings-acl.1337/) — the publisher record identifies Forgetting-Aware Memory Accuracy (FAMA), which penalizes reliance on obsolete or invalidated memory. Add stale-fact use as a distinct failure metric; do not treat the metric as already implemented.
- [MemoryArena, ICML 2026](https://proceedings.mlr.press/v306/he26am.html) — interdependent multi-session agent/environment tasks provide a candidate for testing memory → action → feedback rather than passive recall alone.
- [A brain-wide map of neural activity during complex behaviour, Nature 2025](https://www.nature.com/articles/s41586-025-09235-0) — large-scale standardized recordings span 621,733 neurons, 699 probes, 139 mice, 12 laboratories and 279 brain areas. These are mouse decision-task data, not a complete map of the human brain.
- [Synaptic connectomics: status and prospects, Nature Reviews Neuroscience 2025](https://www.nature.com/articles/s41583-025-00957-8) — supports multiscale circuit research while emphasizing conceptual/technical constraints; connectome structure alone is not a working functional theory.

**Status:** publisher metadata/abstract reviewed on 2026-10-22; source-code, benchmark dataset, license and reproducibility review remain OPEN. These stay RESEARCH QUEUE / SCIENTIFIC REFERENCE, not accepted dependencies. No package installation or code vendoring is implied.

---

# NeuroCore — upstream research and source-intake ledger

## WorkPass265 — current memory/science benchmark intake (2026-10-22)

The following recent sources expand the evaluation design. Their presence here records a research candidate, not verified upstream integration. Before copying code or data, check the upstream revision, dataset/model license, provenance, installation footprint and privacy requirements.

| Source | Mechanism or evaluation idea | Proposed NK1 use | Status |
|---|---|---|---|
| [AMA-Bench, ICML 2026 / PMLR](https://proceedings.mlr.press/v306/zhao26bs.html) | Long-horizon memory over agent/environment trajectories, including states, actions, observations and tool outputs | Extend the current retrieval-only view with trajectory-linked recall and later task success; keep manifests and outcomes reproducible | RESEARCH QUEUE; protocol/data license review required |
| [Mem2ActBench, ACL 2026](https://aclanthology.org/2026.acl-long.370/) | Whether remembered preferences and task state correctly ground later tool choice and parameters | Add a memory-to-action task family to the independent RU/EN evaluation; measure success and parameter-grounding errors | RESEARCH QUEUE; code/data/license review required |
| [Memora, ACL 2026 Findings](https://aclanthology.org/2026.findings-acl.1337/) | Remembering, reasoning and recommending over evolving personal histories; Forgetting-Aware Memory Accuracy penalizes stale-memory reliance | Add tests for fact supersession, old preference expiry and confident use of invalidated facts | RESEARCH QUEUE; inspect metric definition and evaluation protocol first |
| [MemoryArena, ICML 2026 / PMLR](https://proceedings.mlr.press/v306/he26am.html) | Interdependent multi-session tasks in which earlier environment interactions should improve later actions | Evaluate the closed memory → action → verified outcome loop, not passive conversation QA alone | RESEARCH QUEUE; task/license/reproducibility review required |
| [International Brain Laboratory, Nature 2025](https://www.nature.com/articles/s41586-025-09235-0) | Standardized brain-wide recordings during a complex perceptual-decision-action task | Study interaction traces across sensation, prior expectation, feedback, choice and action; mouse data are not a human connectome | SCIENTIFIC REFERENCE; no direct architecture copy |
| [Synaptic connectomics: status and prospects, Nature Reviews Neuroscience 2025](https://www.nature.com/articles/s41583-025-00957-8) | Limits and prospects of multiscale circuit reconstruction | Use connectomics as a constrained hypothesis source; require behavioral predictions and ablations rather than region-name analogies | SCIENTIFIC REFERENCE; no direct architecture copy |

### Candidate acceptance rule

For each candidate, record the exact paper/version and code/data revision, license, task families, split rules, metric definitions, baseline, compute/storage budgets and known limitations. Run a small representative slice first. Keep the candidate only if it identifies a failure or yields reproducible behavior that the current baseline misses. Never tune on the final holdout or assume a benchmark's reported result transfers automatically to NeuroCore.


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

## Continual skill learning and evaluation (2026-10-20)

| Candidate / source | Evidence / license | NK1 adaptation | Decision |
|---|---|---|---|
| SkillLearnBench | https://github.com/cxcscmu/SkillLearnBench ; MIT license declared upstream. 20 verified tasks / 100 instances, with skill quality, execution trajectory and task outcome scored separately. | Use the three-stage diagnostic pattern for a future small NK1 task set: skill artifact validity, actual skill invocation/trajectory, and independently verified outcome. Do not import Docker/API-heavy runner into the dependency-light runtime without a separate harness review. | **ADAPT PROTOCOL; CODE NOT VENDORED** |
| ContinualSkillBench | https://arxiv.org/abs/2608.03874 ; five domains with sequential, cross-task skill reuse. Reports gains vary by model/domain; explicit skill libraries do not consistently outperform retained context/feedback. | Require order variation, context-only vs explicit-skill ablations, transfer tasks and per-domain reporting. A written/promoted skill is not evidence of a reusable abstraction. | **ADAPT EVALUATION DESIGN** |
| Berkeley Continual Learning Bench | https://sky.cs.berkeley.edu/project/continual-learning-bench/ ; expert-validated task sequences where tasks interact and the system may change during evaluation. | Prioritize versioned task streams and online update boundaries over isolated single-task fixtures; compare frozen and adaptive controls on identical sequences. | **RESEARCH-ONLY; TASK/VERIFIER LICENSE REVIEW REQUIRED** |

NK1 adaptation from this research in WorkPass116: add seed-clustered paired outcomes so task cells within a run do not inflate the independent sample count. This is a measurement-integrity improvement, not evidence that any learning strategy is better. The upstream benchmark datasets, task code and Docker/API integrations were not copied.

## Continual-learning evaluation refresh (2026-10-21)

| Candidate / source | Evidence / license | NK1 adaptation | Decision |
|---|---|---|---|
| retention-bench | https://github.com/symbolfarm/retention-bench ; public research workbench extending CL-Bench; repository describes a hard process reset with only an on-disk survive-directory preserved and distinguishes retained records from integrated capability. Verify the current upstream LICENSE and dependency pin before any code reuse. | NK1 already has a matched hard-reset retention evaluator (WorkPass115). Next integration is protocol-level: run real subprocess resets, separate intact-store from wiped-store arms, and report a gain curve over reset frequency; do not treat an in-process snapshot/restore test as equivalent to a hard reset. | **ADAPT PROTOCOL; NO CODE COPIED** |
| AgentMemoryBench | https://github.com/solomoon313/AgentMemoryBench ; upstream repository reports offline, online, replay, transfer and repair modes over code-, web-, embodied- and dialogue-grounded tasks; verify exact dataset provenance and task-level licenses before importing any instances. | Map NK1's existing outcome matrix onto explicit online gain, replay forgetting, cross-family transfer and repair-after-incorrect-feedback reports. Keep external task sets held out; never train on evaluator answers/verifiers. | **ADAPT EVALUATION MATRIX; DATA NOT COPIED** |

WorkPass133 code finding: the bootstrap stream identity previously included every observed seed ID, including incomplete seeds that were excluded from the estimate. That allowed irrelevant partial evidence to perturb the deterministic resampling stream even though the paired sample and point estimate were unchanged. The implementation now binds the stream identity to complete paired seeds only, and a regression compares the same complete sample with and without extra incomplete-seed rows. This is a reproducibility/evidence-isolation correction, not a learning gain.

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

## WorkPass131 — execution-attestation context binding (2026-10-21)

| Candidate / source | Mechanism observed | NK1 adaptation | Status |
|---|---|---|---|
| [in-toto Attestation Statement v1](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md) and [framework spec](https://github.com/in-toto/attestation/blob/main/spec/README.md) | An authenticated statement binds a claim to an explicit subject and typed predicate; consumers evaluate the binding, not just the existence of an envelope/signature. | Extended the existing signed shadow-evidence verifier so a receipt must match independently resolved run ID, task ID, seed, manifest fingerprint and runtime version, in addition to candidate/version/payload identity and Ed25519 signature. No upstream code or dependency was copied; this is a narrow contract adaptation. | **IMPLEMENTED; execution unverified** — regression covers each mismatched context field after durable-store reconstruction. Production resolver still must be wired to the trusted supervisor/run ledger. |
| [The Update Framework security model](https://theupdateframework.github.io/security.html) | Freshness and rollback protection require state/context beyond a valid signature. | Reinforces that cryptographic authenticity alone is insufficient; NK1 continues to require durable state and revalidation before promotion. No TUF client or metadata protocol was imported. | **DESIGN INPUT** — no claim of full TUF conformance. |

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


## Adjacent-science intake — cognitive systems, neuroscience and control (2026-10-20)

These references are starting points for translating functional hypotheses into testable software experiments. They do **not** prove that a biological mechanism can or should be copied into NeuroCore. Record the exact claim, competing interpretation, adaptation boundary and falsifiable test before implementation.

| Research / primary source | What it contributes as a hypothesis | Possible NeuroCore experiment | Caution / status |
|---|---|---|---|
| McClelland, McNaughton & O'Reilly (1995), *Why there are complementary learning systems in the hippocampus and neocortex* — https://doi.org/10.1037/0033-295X.102.3.419 | Complementary fast episodic learning and slower extraction of regularities can reduce interference in connectionist models. | Compare fast episodic store + slow consolidation against one-rate learning; measure transfer, interference, stale fact persistence and recovery. | **ADAPT** as a systems hypothesis, not a literal hippocampus/neocortex implementation. Must compare equal storage/compute budgets. |
| Rao & Ballard (1999), *Predictive coding in the visual cortex* — https://doi.org/10.1038/4580 | Hierarchical prediction and residual-error signals as one functional account of visual processing. | In a future multimodal path, compare prediction/error-guided attention with a plain input pipeline on labelled novelty and correction tasks. | **RESEARCH-ONLY** until a real sensory signal and meaningful error measure exist; text-generated “prediction error” is not sensory grounding. |
| Friston (2010), *The free-energy principle: a unified brain theory?* — https://doi.org/10.1038/nrn2787 | A broad framework connecting inference, action, learning and uncertainty through variational free energy. | If planning/perception needs a common uncertainty/cost formalism, compare a narrowly specified expected-cost policy with existing explicit risk/budget policy. | **RESEARCH-ONLY**. This is a broad and debated framework, not an automatically useful universal objective. See critical discussion such as https://doi.org/10.1038/nrn2787-c1. |
| Dehaene & Changeux (2011), *Experimental and theoretical approaches to conscious processing* — https://doi.org/10.1016/j.neuron.2011.03.018 | Reviews global neuronal workspace accounts and empirical approaches to conscious access. | Only use as a source of operationally testable hypotheses about availability/broadcast of information across subsystems and reportable access. | **RESEARCH-ONLY** for cognitive architecture; not a consciousness test. Passing software integration tests does not establish subjective experience. |
| MemoryAgentBench (2025; updated 2026) — https://arxiv.org/abs/2507.05257 | Benchmark task families for memory retrieval, test-time learning, long-range understanding and forgetting-related behavior. | Independent RU/EN held-out task suites with fact revision, multi-hop, interference, selective forgetting and calibrated abstention. | **ADAPT**; inspect current benchmark version, dataset license, split design and leakage risks before reuse. |
| Memora / FAMA (ACL 2026) — https://arxiv.org/abs/2604.20006 | Memory update/retrieval behavior under stale or invalidated evidence. | Pair fact A→fact B updates with queries before/after the validity boundary; measure false-current and false-historical answer rates. | **ADAPT** after verifying publication details and exact benchmark protocol. |
| MINTEval (2026) — https://arxiv.org/abs/2605.18565 | Multi-target interference and aggregation as memory evolves. | Shuffle insertion order, add distractors/conflicts, and compare per-target accuracy plus calibration. | **ADAPT**; do not tune against the final holdout. |
| AgeMem (ACL 2026) — https://aclanthology.org/2026.acl-long.981/ | Learned memory management and short/long-term allocation. | Compare existing deterministic residency/consolidation owner against a learned manager under equal RAM, latency and data budget. | **RESEARCH-ONLY** until deterministic baseline and safe rollback exist. |

### Additional research lanes to explore continuously

1. **Episodic and semantic memory:** event sourcing, temporal databases, provenance, knowledge graphs, contradiction resolution, source reliability, temporal query semantics, memory compaction and reversible summaries.
2. **Learning and forgetting:** complementary learning systems, replay scheduling, continual learning, meta-learning, test-time adaptation, selective erasure, stability/plasticity trade-offs and distribution shift.
3. **Uncertainty and decision theory:** calibration, selective prediction/abstention, Bayesian decision theory, conformal prediction, risk-sensitive planning, value of information and out-of-distribution detection.
4. **Causal reasoning:** interventions, counterfactuals, causal graphs, treatment of confounders, credit assignment and separation of correlation from verified action outcome.
5. **Control and robotics:** feedback control, model-predictive control, state estimation, partial observability, active perception, safety envelopes and system identification. Use only when a real action/sensor loop exists.
6. **Cognitive control:** working-memory limits, interference, task switching, inhibition, metacognition and error monitoring; operationalize each as a benchmark rather than naming a module after a brain region.
7. **Speech and interaction:** turn-taking, interruption handling, streaming latency, diarization where relevant, phoneme/viseme alignment, prosody, accessibility and perceptual quality evaluation.
8. **Distributed systems:** event sourcing, transactional outbox/inbox, sagas, idempotency, durable workflows, exactly-once illusions, crash consistency and reconciliation after ambiguous outcomes.
9. **Security and privacy:** threat modeling, least privilege, untrusted memory/tool output, secret redaction, data lifecycle, prompt injection, software supply-chain integrity and auditability.
10. **Evaluation science:** preregistration of hypotheses, blind test sets, paired comparisons, confidence intervals, effect sizes, negative controls, ablations, leakage detection and reproducibility.

### Translation gate from science to code

For each idea, answer before implementation:
- What concrete failure in the current canonical owner motivates it?
- What would falsify the hypothesis?
- Which baseline and same-budget candidate will be compared?
- Which data split is held out and who/what protects it from tuning?
- What adverse effects must be measured (latency, RAM/VRAM, forgetting, privacy, reliability)?
- What result causes rejection or rollback?
- Is the mechanism actually necessary, or can a simpler change solve the observed failure?

Do not count a reference as “used” until a source revision/paper protocol is inspected, a testable hypothesis is recorded, and an experiment or explicit rejection decision is linked.


## WorkPass132 — bootstrap sensitivity for seed-clustered skill learning (2026-10-21)

| Candidate / source | Mechanism observed | NK1 adaptation | Status |
|---|---|---|---|
| [SkillLearnBench (COLM 2026)](https://github.com/cxcscmu/SkillLearnBench) — MIT license declared upstream | Controlled comparisons of skill methods; separates artifact quality, execution trajectory and verified task outcome; reports gains vary by task/domain and self-feedback can drift. | Preserve NK1's separate evidence and outcome layers; do not use a single aggregate as proof that a skill generalizes. WorkPass132 adds a more conservative uncertainty requirement at the seed-cluster outcome layer. | **PROTOCOL ADAPTED; no benchmark tasks/code copied** |
| [SkillsBench v1.1](https://www.skillsbench.ai/) | Matched with-skill/without-skill evaluation over diverse tasks shows strong variation by domain and negative deltas on some tasks. | Keep baseline pairing, task-family breakdowns and explicit no-skill/control arms; never infer uplift from skill creation or invocation alone. | **DESIGN INPUT** |
| [Storage-aware replay evaluation protocol](https://www.mdpi.com/2504-4990/8/7/212) | Uses equal-byte budgets, strongest-baseline comparison, pre-specified non-inferiority and bootstrap confidence intervals with multiple-comparison correction. | Adapt only the bootstrap sensitivity idea to NK1's existing seed-clustered outcome deltas; no replay algorithm or external code copied. Equal-byte replay tournament and multiplicity correction remain future work. | **NARROW ADAPTATION IMPLEMENTED; not full protocol conformance** |

### Code and acceptance boundary

- `VerifiedOutcomeLedger.ts` now computes a deterministic 4,000-resample percentile interval over seed-level paired deltas. Its PRNG seed is derived from method/split/family identity and observed deltas so identical input yields identical output.
- The independent unit remains the seed aggregate; incomplete seeds are excluded as before. A single independent seed produces no bootstrap interval.
- `VerifiedSkillPromotion.ts` requires both the existing small-sample Student-t lower bound and the bootstrap lower bound to be above zero, as well as existing minimum-gain, evidence-authentication, task-coverage, seed-coverage and family-regression gates.
- Regression tests assert determinism, interval bracketing and no confidence interval for one seed, and require the positive bootstrap lower bound in the accepted promotion fixture.
- **Not proven:** bootstrap intervals do not fix tiny or biased samples, verifier bias, task leakage, multiple-comparison inflation, or poor benchmark representativeness. No live learning run has been measured by this change; it is a stricter admission/evaluation rule, not a performance gain.


## WorkPass134 — manifest-bound outcome ingestion (2026-10-21)

- Added a canonical fingerprint equality check between the caller-supplied task manifest and the `VerifiedOutcomeLedger` manifest before signed outcome ingestion. Malformed and substituted manifests fail closed before the ledger is mutated.
- Tightened runtime task-manifest validation: non-empty string identity fields, a supported `train|validation|holdout` split, and a SHA-256 prompt fingerprint are required. Unknown split labels can no longer silently disappear from expected evaluation coverage.
- Added regression cases for side-manifest substitution, duplicate task IDs, unknown split labels, and whitespace-only family names.
- Research relationship: manifest-bound, controlled evaluation and signed-provenance principles; protocol adaptation only, no upstream code or dataset copied.
- **Verification boundary:** code and tests committed; runtime execution, typecheck and exact-head Actions are still unverified. No learning uplift is claimed.
- Report: `docs/WORKPASS134_MANIFEST_BOUND_OUTCOME_EVIDENCE_2026-10-21.md`.
