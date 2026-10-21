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

## WorkPass79 — continual-learning evaluation adaptation (2026-10-21)

| Candidate / source | URL | Mechanism to inspect | NeuroCore integration target | Current status / next evidence |
|---|---|---|---|---|
| AgentMemoryBench — *Benchmarking Continual Agent Memory for Online Learning, Transfer, and Forgetting* | https://github.com/solomoon313/AgentMemoryBench | Online learning curves, replay/retention, cross-task transfer, and repair after incorrect feedback | Existing `ParametricPolicyLearner`, `P30ContinualIntelligenceEngine`, and existing retrieval experiment; no new memory owner | **ADAPT — protocol only, not imported.** Add wrong-feedback/recovery, task reversal, replay retention, and paired no-learning controls to the evaluation plan. First hardening step: reject non-finite training values before they can poison weights. Review exact upstream revision, benchmark data provenance, dependencies and license before importing code or datasets. |

**WorkPass79 implementation note:** the policy learner now fails closed on invalid action identifiers, non-finite targets/rates/sample weights, and non-finite direct feature vectors. This is input-integrity hardening, not evidence of higher learning quality. The new regression is wired as `test:p26:learning-input-integrity`; execution and CI status must be recorded from a live run before marking it passed.



## WorkPass80 — восстановление безопасного состояния policy learner (2026-10-21)

| Изменение | Мотив | Тест / критерий | Статус |
|---|---|---|---|
| Санитизация весов и bias в `ParametricPolicyLearner.restore()` | Сохранённый snapshot может содержать NaN/Infinity и повторно загрязнить inference | После restore все веса и bias конечны; невалидные значения заменены нулём | Код и regression добавлены; исполнение не подтверждено |
| Санитизация diagnostics, update count и timestamp | Невалидные метрики могут исказить uncertainty/exploration или сломать наблюдаемость | Диагностики конечны и ограничены; отрицательный/небезопасный update count сбрасывается | Код и regression добавлены; исполнение не подтверждено |

Это дополнительная защита persisted state, а не оценка прироста обучения. Не считать тесты пройденными без живого запуска. Следующий обязательный шаг — выполнить `test:p26:learning-input-integrity`, `typecheck` и `test:p26:true-learning`, затем добавить измеримые тесты исправления ошибочной обратной связи, reversal, replay retention и no-learning baseline.


## WorkPass81 — атомарность входной проверки trainBatch (2026-10-21)

| Изменение | Риск | Критерий регрессии | Статус |
|---|---|---|---|
| Предварительная проверка всего пакета перед первым update | Поздний некорректный образец раньше мог оставить ранние обновления уже применёнными | Ошибка в более позднем элементе; snapshot остаётся идентичным до вызова | Код и тест добавлены; запуск не подтверждён |
| Проверка структуры state.needs в каждом образце | Некорректный state мог выбросить исключение в процессе последовательного обучения | Повреждённый второй элемент отклоняется до первого обновления | Код и тест добавлены; запуск не подтверждён |

Исследовательская опора для следующего этапа: AgentMemoryBench явно разделяет online, replay/retention, transfer и repair evaluation; MemoryAgentBench выделяет accurate retrieval, test-time learning, long-range understanding и conflict resolution. Источники: https://github.com/solomoon313/AgentMemoryBench и https://github.com/HUST-AI-HYZ/MemoryAgentBench. Внешние код/данные не импортированы; заимствована структура оценки. Требуется создать собственные лёгкие детерминированные сценарии, которые не требуют тяжёлых внешних сред или API.


## WorkPass82 — learning/reversal/retention benchmark (2026-10-21)

| Сценарий | Измерение | Контроль | Статус |
|---|---|---|---|
| Online learning | Начальное и конечное предсказание после согласованной обратной связи | Детерминированный probe | Код добавлен, запуск не подтверждён |
| Reversal / repair | Сдвиг после смены цели на противоположную | Сравнение с prediction после первой фазы | Код добавлен, запуск не подтверждён |
| No-learning | Неизменность prediction, весов, bias и updates при frozen=true | Замороженная модель | Код добавлен, запуск не подтверждён |
| Replay retention | Изменение старого шаблона при продолжении обучения на другом шаблоне | До/после на двух ортогональных признаках | Код добавлен; это диагностическая метрика, не доказательство отсутствия забывания |

Research protocol lineage: AgentMemoryBench (https://github.com/solomoon313/AgentMemoryBench) motivates online/replay/transfer/repair dimensions; MemoryAgentBench (https://github.com/HUST-AI-HYZ/MemoryAgentBench) motivates conflict and long-range task families. The new test is an original synthetic probe, not copied benchmark data or implementation. Before promotion to a release gate: execute on supported Node, run typecheck + existing P26 tests, add multiple task orders and held-out task variants, and report all metrics including negative retention deltas.


## WorkPass83 — curriculum order sensitivity and strict snapshot restore (2026-10-21)

| Source | Public protocol insight | Adaptation made | Import / license boundary |
|---|---|---|---|
| AgentMemoryBench — https://github.com/solomoon313/AgentMemoryBench | Separate online learning, replay retention, transfer and repair; inspect behavior across sequential task exposure rather than a single final score | Added a lightweight three-order curriculum matrix, per-task absolute error, mean error per order, order-sensitivity spread and a wrong-feedback repair phase | Protocol-inspired original test only. No upstream code, datasets, model weights or dependencies imported. The exact upstream revision/license must be reviewed before any code/data port. |
| MemoryAgentBench — https://github.com/HUST-AI-HYZ/MemoryAgentBench | Separate accurate retrieval, test-time learning, long-range understanding and conflict resolution; use distinct task families | Reinforces the decision to report this policy learner test as a narrow synthetic learning diagnostic, not a memory-agent benchmark score | Public repository describes an MIT license; no benchmark datasets or implementation copied in this pass. Dataset terms/provenance still require separate review before reuse. |

### WorkPass83 evidence and next gates

- Hardened restore semantics: persisted frozen now accepts only literal boolean true, avoiding accidental truthiness of strings such as "false".
- Added a regression for malformed persisted freeze state and wired test:p26:learning-continual-matrix.
- Matrix reports task-order sensitivity instead of hiding it behind one aggregate. It is deterministic but deliberately small and synthetic.
- **Execution status: FAILED / NOT VERIFIED.** GitHub Actions run 39551917147 completed with conclusion FAILURE, but the connector returned no step details and the job log endpoint returned BlobNotFound. Root cause is unresolved; no numeric outcome or quality improvement is claimed, and no test is marked passed.
- Required next gates: run supported Node typecheck and P26 tests; preserve raw metrics; add held-out patterns and additional task orders; compare standard sequential learning with explicit replay and frozen controls; reject promotion if repair or retention regresses beyond a predeclared tolerance.


## WorkPass84 — SkillLearnBench-compatible learning evaluation adapter (2026-10-21)

| Candidate / source | URL | Mechanism inspected | NeuroCore integration target | Current status / next evidence |
|---|---|---|---|---|
| SkillLearnBench (MIT) | https://github.com/cxcscmu/SkillLearnBench | Task pass rate, skill functional coverage/executability/safety, trajectory key-point recall/order/completeness; one-shot, self-feedback, teacher-feedback and skill-creator baselines | `runtime/neuro-kurisu/src/organism/learning/SkillLearnBenchAdapter.ts`; P26 validation workflow | **ADAPTED**: deterministic native evaluator and regressions added; upstream MIT LICENSE and baseline taxonomy preserved under `runtime/neuro-kurisu/research/vendor/SkillLearnBench/`. Not full benchmark parity. Next: connect trusted production task rubrics/verifiers and collect multi-seed task-level results. No external LLM or Docker execution is performed by this adapter. |
