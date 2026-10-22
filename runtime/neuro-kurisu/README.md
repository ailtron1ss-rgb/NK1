# WorkPass318 — Read-only Memory Doctor CLI

`MemoryOS2.doctor()` is also exposed as a non-mutating CLI for inspecting the primary saved organism state. Run it from the repository root:

```bash
npm --prefix runtime/neuro-kurisu run memory:doctor -- /absolute/path/to/organism-state.json
```

For a state written using V8 serialization, set the same format selector used by the runtime:

```bash
NEURO_STATE_FORMAT=v8 npm --prefix runtime/neuro-kurisu run memory:doctor -- /absolute/path/to/organism-state.bin
```

The CLI reads only the specified file and audits `facets.advanced.memoryOS`. It deliberately does not repair records, write state, or silently switch to a `.bak` file. The JSON report includes bounded issue detail plus full counts; exit status is **0** when no error-severity integrity violations are present, **2** when such errors are found, **1** for read/parse/schema failures, and **64** for invalid usage. Warnings do not by themselves fail the audit.

The latest branch adds dedicated CLI regression coverage for JSON and V8 serialization, capped reports, non-mutation and failure exit semantics. GitHub Actions is currently not providing a runner for the latest branch, so those tests are committed but not yet execution-verified.

---

## WorkPass27 — MemoryOS2 retrieval candidate coverage + Okapi BM25 baseline

- Token posting lists retain complete matches within the existing 1600-memory corpus cap. Candidate sets remain capped at 192 per query and are ranked by IDF support, term coverage, exact phrase, temporal/revision validity, recency, salience and stable IDs.
- Hashed-vector cosine no longer assigns 0.5 similarity to orthogonal/negative pairs.
- `MemoryRetrievalBenchmark` uses actual corpus-scoped Okapi BM25 (`k1=1.2`, `b=0.75`) rather than binary token overlap and includes a baseline configuration SHA-256.
- The current synthetic 8-query fixture shows MemoryOS2 Recall@5 delta -0.25 versus BM25 (paired interval [-0.75, 0.25]); this is not production evidence but correctly keeps the candidate not-promoted.
- Runtime typecheck, candidate coverage, temporal inspector, R16 memory, benchmark, multi-seed experiment and HTTP server smoke are the targeted gates for this pass. Independent labelled temporal holdout and frontend/browser release gates remain open.

# Neuro-Kurisu — 35.50.0 / WorkPass27 — Memory Retrieval Candidate Coverage + BM25 Baseline

**Текущий canonical release:** `35.35.0` / `R21` — Anti-Decoration & Truth-Surface Closure; P2855 и предыдущие passes сохранены ниже как история. P2855 теперь проходит через единый canonical action-policy arbiter вместе с adaptive policy и parametric P26 signals; historical P2703/P269x notes ниже сохранены как история, а не как текущий release authority.

**Последний production pass:** `R7.3 — Runtime-Owned Neural Projection Deferral / Long-Horizon Allocation Stability` (2026-09-24), поверх R7.2. В R6/R7 сохранены constitutional self/agency authority, hard identity invariants, gated self-authored goals, evidence-gated plastic identity changes и evidence/holdout/rollback-gated self-modification proposal path; R7.1/R7.2/R7.3 уменьшают redundant snapshot/diagnostic allocation без удаления когнитивных или агентных причинных путей. Self-agency action influence остаётся отдельным causal/ablation surface; это архитектурный механизм агентности, а не заявление о сознании. Полный отчёт R6: `PASS_2855_R6_SELF_IDENTITY_AGENCY_2026-09-24.md`.
R7: оптимизированы checkpoint/serialization hot paths, mobile state-economy fast path и cadence bounded
world-model pruning. R7.1: удалены повторные `NeuralExperienceBranch` snapshots/diagnostic deep-clones и
повторные diagnostics в hot paths. R7.2: post-step snapshots B269/B270/B271 переиспользуются в течение
observe-цикла, developmental/worldline read-only snapshots кэшируются на своих семантических границах,
terminal cognitive-kernel snapshot делается один раз, а `FileStateStore` считает UTF-8 payload без второй
полной `Uint8Array`-аллокации; добавлены source guards и Unicode byte-accounting regression. R7.3:
`NeuralExperienceBranch` и B269 теперь проецируются в durable `persisted.system` один раз на checkpoint
вместо повторной detached-копии после каждой hot mutation; добавлены restart-proof, projection-deferral guard
и 80/120/160/200-cycle performance endurance tiers. Отчёты:
`PASS_2855_R7_PERFORMANCE_STABILITY_2026-09-24.md`, `PASS_2855_R7_1_SNAPSHOT_DEDUP_2026-09-24.md`,
`PASS_2855_R7_2_HOTPATH_ALLOCATION_2026-09-24.md`, `PASS_2855_R7_3_RUNTIME_PROJECTION_2026-09-24.md`. R7.3
подтверждает performance endurance до 200 cycles в контролируемом mobile workload; это не является
доказательством сознания, полной автономии или mobile-readiness, а 240-cycle tier остаётся незавершённым.


P2703 добавляет bounded convergence layer в `NeuralExperienceBranch`: neural state, memory, world/input, goals, self, persistent personality, causal, embodied, information-gain и developmental signals конкурируют за ограниченное рабочее пространство (capacity=4). Победившая coalition проходит через recurrent latent state, broadcast и bounded action influence; outcome/reward изменяет source weights и recurrent coupling. Это интеграционный слой поверх существующих `B282PredictiveGlobalWorkspace` и `GlobalWorkspaceSubstrateV2`, а не их дубликат и не заявление о сознании.

P2692 расширяет P2691 в contextual adaptive policy 2.0: политика теперь получает контекстные buckets, хранит policy-value по контексту и обучается по составной функции delayed outcome (quality, retention, transfer, interference, delayed value и compute cost). Базовый P2691 API сохранён. Поверх этого остаётся canonical memory retrieval с multi-signal fusion: semantic similarity, lexical/BM25-like token evidence, entity overlap, temporal intent, causal link support, recency, salience, identity/goal relevance, prediction error и memory temperature. Новый слой dependency-free и рассчитан на Termux/mobile.

В retrieval audit добавлены явные `touchedMemoryIds`, чтобы downstream causal/runtime evidence могло доказать, какие memory nodes реально участвовали в retrieval decision. Это вдохновлено audit-trail/TOUCHED-подходом из открытого Neo4j Agent Memory, но реализовано внутри существующего EventLog без внешней графовой БД.

Контролируемый P2690 holdout: multi-signal fusion `7/7` top-1, semantic-only `5/7` (+2 случая на этом synthetic controlled set). Это локальный ablation, а не внешний benchmark и не доказательство универсального превосходства.

P2689 mobile persistence слой также сохранён: 30/30 autonomous cycles выполняются под `--max-old-space-size=256` примерно за `31–33 с`, с peak RSS около `301 MB` в актуальном file-backed профиле. В harness после `stop()` active requests = `0`; внешний runner в текущем контейнере может удерживать stdio PipeWrap, поэтому orchestration timeout не трактуется как runtime failure.

Основной отчёт P2692: `P2692_CONTEXTUAL_ADAPTIVE_MEMORY_POLICY_RU.md`. Предыдущий отчёт: `P2690_MEMORY_SIGNAL_FUSION_OPEN_SOURCE_UPGRADE_RU.md`.
Исследовательский архив: `research/2026-09-19/`.
Progress: `P2690_PROGRESS.json`.


## BIG PASS 200–202
Central Subject Dynamics, Longitudinal Subject Transfer Battery, and Device Evidence Provenance are now integrated and evidence-gated. See BIG_PASS_200_202_GIANT_STEP_RU.md.


## B401–B420 Research Upgrade

Адаптивный ensemble из 7 research experts: memory, continuum, state-space, latent prediction, counterfactual, goal/value и distributed population-code.

Основные документы: `RESEARCH_UPGRADE_B401_B420_RU.md`, `INTERNET_RESEARCH_2026-09-16_AND_ALGORITHMS_RU.md`, `B401_B420_RESEARCH_OLYMPICS_RESULTS_RU.md`.

## 35.6.43 / B2503 — Actionable Neural Predictive Upgrade

This release adds B2502 E/I Neural Replay Field and B2503 Actionable Predictive Field. Both are wired into OrganismCore, persist state, learn from verified outcomes, and expose evaluation-only lesion paths. The neural layers remain bounded residual/bottleneck controllers; this release does not claim phenomenal consciousness.

## 35.6.52 / B2509-B2510 — Unified Neural Predictive Stack

This release adds B2504 Unified Self-World Predictive Field, B2505 Compositional Replay Composer, B2506 Neural Bottleneck Escalator, B2507 Consolidation Scheduler, and B2508 Adaptive Neural Compute Governor. The layers are wired through OrganismCore, persist state, learn from outcomes, and expose evaluation/diagnostic paths. The release is a computational neuro-inspired research stack and does not claim phenomenal consciousness.

## 35.6.52 — B2509/B2510 embodied-developmental stack

B2509 connects embodiment telemetry and homeostatic regulation to action-conditioned body prediction and verified outcome learning. B2510 adds multi-timescale developmental personality plasticity, evidence gating, identity anchoring and consolidation around the existing B299 personality loop. Both are persisted, causally testable and bounded in the final utility path.

## 35.6.53 / B2511 — Active Epistemic Experimentation

The newest release adds `B2511ActiveEpistemicExperimentController`, a bounded decision layer that explicitly trades immediate utility against expected information gain, uncertainty, risk, resource cost and internal-state pressure. Verified outcomes update action-specific information value so the organism can learn when it is better to investigate or verify before acting.

A hidden-rule holdout showed reward `774.0 -> 1116.8` (+44.289%) and correct decisions `600/1200 -> 1180/1200`, with only 20 verification actions. A separate ActivePerception learning holdout reached model MAE `0.0871` vs baseline `0.3200` after the recurrent credit-assignment fix in `ActivePerceptionNeuralSubstrate`.

These are controlled computational experiments, not claims of phenomenal consciousness or biological equivalence.

## 35.6.54 / B2512-B2514 — Memory, Self-Projection and Epistemic Consolidation

This release extends the active-epistemic layer into durable memory and future-self development. B2512 converts verified/high-salience epistemic events into provenance-aware semantic facts while retaining bounded raw episodes and protecting the identity-owner path. B2513 performs action-conditioned future-self projection with identity-continuity and goal-consistency checks. B2514 prioritizes which memories deserve access/retention from surprise, novelty, goal/identity relevance, prediction error and verification.

A noisy hidden-rule holdout reduced semantic-memory error from `0.43803` to `0.06600` (-84.93%) while retaining 192 raw episodes and identity firewall `1.0`. B2513 learned a verified-action utility margin of `0.04976` on its learning holdout. The release remains a computational neuro-inspired research system and does not claim phenomenal consciousness or biological equivalence.

## Optional local semantic memory search (WorkPass33)

The canonical MemoryOS2 store now supports opt-in embedding reranking in the Memory Inspector. Start a local Ollama server and install an embedding model (default: `embeddinggemma`), then check **“Семантический поиск (локальная модель)”** in Runtime Atlas. The endpoint is loopback-only by default; no cloud service or API key is required.

Configuration: `NK_EMBEDDINGS_ENABLED=0` disables the feature; `NK_EMBEDDINGS_PROVIDER=ollama` (default) uses `http://127.0.0.1:11434/api/embed`; `NK_EMBEDDINGS_MODEL=embeddinggemma` selects the model. For llama.cpp, use `NK_EMBEDDINGS_PROVIDER=openai-compatible`, `NK_EMBEDDINGS_BASE_URL=http://127.0.0.1:8080/v1`, and set `NK_EMBEDDINGS_MODEL` to the loaded embedding model alias. Non-loopback endpoints require explicit `NK_EMBEDDINGS_ALLOW_REMOTE=1` and HTTPS. Provider errors automatically fall back to the existing BM25/fuzzy/graph search. The embedding index is derived and bounded; it never becomes a second source of memory truth. For semantic retrieval inside the live cognitive cycle, explicitly set `NK_EMBEDDINGS_RUNTIME_ENABLED=1`; it defaults off. Its foreground budget is `NK_EMBEDDINGS_RUNTIME_BUDGET_MS=220` ms, and slow inference falls back immediately to lexical/fuzzy retrieval while at most one bounded index-warming job runs in the background.
