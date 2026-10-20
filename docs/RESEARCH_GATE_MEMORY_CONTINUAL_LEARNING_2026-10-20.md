# Research gate: persistent memory and continual learning (2026-10-20)

**Repository:** `ailtron1ss-rgb/NK1`  
**Purpose:** convert recent memory/continual-learning research into falsifiable NK1 engineering gates. This is a research synthesis and test plan, not evidence that NK1 already meets the results of these papers.

## Findings that change the engineering plan

### 1. LongMemEval — interactive long-term memory
- Paper: [LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory, ICLR 2025](https://proceedings.iclr.cc/paper_files/paper/2025/hash/d813d324dbf0598bbdc9c8e79740ed01-Abstract-Conference.html)
- Relevant findings: a 500-question benchmark covers information extraction, multi-session reasoning, temporal reasoning, knowledge updates and abstention. Its design separates indexing, retrieval and reading, which helps identify where an answer failed.
- NK1 implication: report *retrieval failure* separately from *reasoning/answer failure*. Add update and abstention cases, not just “did the target item appear in top-k?”. Evaluate a memory snapshot after facts change and after process restart.

### 2. MemoryAgentBench — incremental multi-turn interaction
- Paper: [Evaluating Memory in LLM Agents via Incremental Multi-Turn Interactions, arXiv:2507.05257](https://arxiv.org/abs/2507.05257)
- Relevant findings: memory agents need accurate retrieval, test-time learning, long-range understanding and selective forgetting; static long-context QA alone misses incremental interaction.
- NK1 implication: build sequential episodes. The system must ingest a fact, use it later, revise it after counterevidence, and avoid leaking holdout queries into tuning. Keep separate retrieval, update-learning and forgetting reports.

### 3. MemBench — multi-dimensional memory evaluation
- Paper: [MemBench, Findings of ACL 2025](https://aclanthology.org/2025.findings-acl.989/)
- Relevant findings: evaluates factual and reflective memory across different interaction scenarios, including effectiveness, efficiency and capacity.
- NK1 implication: quality gates must include resource cost and capacity. Do not optimize Recall@k by silently materializing every cold vector or exceeding mobile budgets.

### 4. Memora / FAMA — obsolete facts must stop influencing answers
- Paper: [From Recall to Forgetting: Benchmarking Long-Term Memory for Personalized Agents, ACL 2026](https://aclanthology.org/2026.findings-acl.1337/)  
- Released implementation/data: [geniesinc/Memora](https://github.com/geniesinc/Memora)
- Relevant findings: long-running personalized agents must remember, reason and recommend over histories in which facts can become obsolete. Forgetting-Aware Memory Accuracy (FAMA) penalizes using invalidated memories.
- NK1 implication: add explicit supersession/deletion cases. Measure stale-fact answer rate separately from correct recall. A system that remembers every old fact but cannot respect updates is not a successful memory system.
- Integration constraint: review dataset/code licences and schemas before importing any assets; use the paper's protocol as inspiration until compatibility and licence are verified.

### 5. FOREVER — forgetting-aware replay scheduling
- Paper: [FOREVER: Forgetting Curve-Inspired Memory Replay for Language Model Continual Learning, ACL 2026](https://aclanthology.org/2026.acl-long.1144/)
- Relevant findings: the work combines forgetting-curve-based replay scheduling with intensity-aware regularization and reports experiments on continual-learning benchmarks for models from 0.6B to 13B parameters.
- NK1 implication: replay should be scheduled based on measured retention risk and importance, not an arbitrary fixed interval alone. This is a candidate for an offline experiment, not a claim that its training method can be copied directly into NK1's current runtime.

### 6. Modular memory for continual adaptation
- Paper: [Position: Modular Memory is the Key to Continual Learning Agents, PMLR 306 (ICML 2026)](https://proceedings.mlr.press/v306/dorovatas26a.html)
- Relevant distinction: in-context/external memory supports fast adaptation; in-weight learning changes model parameters but carries catastrophic-forgetting risk.
- NK1 implication: keep these mechanisms separate in the architecture and evaluation. Updating a memory record must not be described as changing model weights; any parameter-learning path needs its own reproducible training/evaluation and rollback.

### 7. Titans — test-time neural memory (exploratory)
- Paper: [Titans: Learning to Memorize at Test Time, Google Research](https://research.google/pubs/titans-learning-to-memorize-at-test-time/)
- Relevant idea: a learned neural long-term memory complements short-context attention.
- NK1 implication: keep Titans-style neural memory as a research candidate behind a benchmarked adapter/ablation. Do not add a second memory owner or ship it based on paper claims alone; measure actual device latency, RAM/VRAM, persistence and incremental-learning behavior first.

## Required evaluation design for NK1

### Dataset and split integrity
1. Use a versioned manifest with stable example IDs, language, scenario, relevant memory IDs, update/supersession relations, provenance, licence, labeler method and dataset hash.
2. Maintain independent train/tuning and holdout partitions. De-duplicate normalized queries and semantic near-duplicates across partitions; fail closed on detected leakage.
3. Include Russian and English, multilingual paraphrases, misspellings, temporal references, contradictory updates, deleted/invalidated facts, ambiguous requests and questions whose correct response is abstention.
4. Keep synthetic fixtures for unit tests, clearly labelled as synthetic. They cannot authorize a quality promotion.

### Baselines and metrics
- Compare the current MemoryOS2 path against Okapi BM25, a no-memory control and an oracle-evidence upper bound where feasible.
- Report Recall@1/3/5, MRR, evidence coverage, answer correctness, temporal-update correctness, abstention quality, stale-fact rate/FAMA-like score, latency and memory residency/cost.
- Report per-language and per-scenario results; aggregate scores must not hide a Russian/English regression or stale-memory failure.
- Use paired resampling/confidence intervals on the same held-out queries, fixed seeds and a recorded run configuration. Freeze the promotion threshold before examining the final holdout.
- Keep retrieval and downstream answer evaluation separate. Retrieval of the right record does not prove the model used it correctly.

### Sequential learning and persistence
- Run matched positive, negative, contradictory-update and resource-stress trajectories from identical initial state.
- Measure immediate acquisition, delayed retention, transfer to paraphrases/new tasks, recovery after restart, and interference with unrelated knowledge.
- Add explicit invalidation: after a fact is superseded or deleted, the old version must not win retrieval or be used as current truth; preserve provenance/history where auditability requires it.
- Compare replay strategies by ablation. Any learning claim needs a no-learning control and a matched baseline; a changing internal counter alone is not learning evidence.

### Promotion rules
- Keep WorkPass83's synthetic benchmark as a harness regression only.
- Do not promote retrieval/learning candidates from tiny fixtures, in-sample queries, a single aggregate score, or unverified model self-reports.
- Promote only after a versioned independent holdout, no split leakage, per-language results, uncertainty intervals, resource bounds, restart/recovery checks and explicit stale-memory/abstention gates pass.
- Record all outcomes as **PROVEN / IMPLEMENTED / FUNCTIONAL INDICATOR / OBSERVED / HYPOTHESIS / UNKNOWN / UNRESOLVED / FAILED** with the exact run/configuration and artefact hash.

## Immediate order of work

1. Preserve the WorkPass84 script-integrity guard and keep all checks green.
2. Extend the retrieval harness to consume a versioned external dataset manifest without mutating live memory.
3. Create a small independently labelled RU/EN holdout under a clear licence/provenance record; keep it separate from synthetic unit fixtures.
4. Add stale-memory, knowledge-update and abstention scoring before changing the retrieval algorithm.
5. Only then test candidate retrieval or replay changes, with paired comparisons and rollback criteria.
6. Separately run the actual local model on the Dell G3 and record model hash, quantization, llama.cpp build, GPU layers, context, cold/warm latency, peak RAM/VRAM, failures and restart recovery.

**Status:** research-informed test plan; no claim of a measured NK1 cognitive capability improvement.
