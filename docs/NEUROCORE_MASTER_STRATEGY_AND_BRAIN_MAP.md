# NeuroCore: master strategy, brain map, gaps and release plan
## Live engineering checkpoint — 2026-10-23 (WorkPass328–332)

This is a **working-state update**, not a new readiness claim. Five focused robustness changes have been committed to the existing category branches and proposed for `integration`; they are not merged yet.

| Category branch | Change | Draft pull request | Current boundary |
|---|---|---|---|
| `feature/learning` | Coalesce P23 repair attempts by canonical evidence digest; a newer evidence snapshot retries after the stale attempt fails closed; regression covers latest-digest staging | [#79](https://github.com/ailtron1ss-rgb/NK1/pull/79) | Runtime regression not executed yet |
| `feature/perception` | Validate the operational micro-cycle observation at the shared ingress boundary before host-context/state access | [#80](https://github.com/ailtron1ss-rgb/NK1/pull/80) | Runtime regression not executed yet |
| `feature/emotions` | Sanitize restored affect state and reject invalid ticks/timestamps; malformed episodes/calibration rows are filtered | [#81](https://github.com/ailtron1ss-rgb/NK1/pull/81) | Runtime regression not executed yet |
| `feature/memory` | Reject non-finite restored byte budgets/counters; invalid `maxBytes` cannot disable MemoryOS2 eviction | [#82](https://github.com/ailtron1ss-rgb/NK1/pull/82) | Runtime regression not executed yet |
| `feature/personality` | Normalize restored self-agency vectors/matrices and metadata; invalid learned weights cannot poison predictions after restart | [#83](https://github.com/ailtron1ss-rgb/NK1/pull/83) | Runtime regression not executed yet |

Each branch also has its matching behavioral-regression change and CHANGELOG record. Log entries were moved to the **end** of each branch's CHANGELOG so concurrent category PRs do not compete to insert at the top. The current GitHub API reports all five pull requests as mergeable; none has been merged by this pass.

### Progress accounting

- **Overall engineering-readiness baseline: 46/100 — unchanged.** The existing scorecard is an engineering triage estimate, not a scientific measure of consciousness or intelligence.
- **Branch coverage this pass: 5 of 9 named category branches touched (about 56%).** This is only a measure of category work touched, not percent completion of the organism.
- **Behavioral changes committed: 5**, with focused regression coverage added in the learning, perception, emotion, memory and self-agency owners.
- The global score is deliberately not raised until the new tests and full integration path execute. A commit or a test fixture alone is not evidence of end-to-end behavior.

### CI and release blockers

The new branch heads triggered GitHub Actions, but the latest affected jobs complete with **zero runner steps**. This does not demonstrate that the new code failed a test; it means no test result was produced. Runner/account configuration must be investigated before code-level validation can be trusted.

The newest large release asset found is `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip` (approximately 136 MB), tagged `workpass70-hotfix1-2026-10-19`. **It has not been refreshed by this pass.** The connected GitHub action set supports repository reads and text-file/commit operations, but it does not expose a binary release-asset upload/replace operation; direct retrieval also failed in this environment because `github.com` could not be resolved. Do not treat these category-branch commits or the PRs as changes already present in the release ZIP.

### External mechanism review and adaptation policy

- [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution) explores controlled evolutionary improvement of skills/prompts/code with DSPy + GEPA. NK1's P23 path adapts the closed-loop principle (observed failure → evidence-bound repair candidate → validation/holdout evaluation → separately gated staging/promotion); no source file was copied verbatim in WorkPass328.
- [Letta memory & dreaming](https://docs.letta.com/configuration/memory) documents persistent, versioned memory and sleep-time consolidation/review. NK1 keeps MemoryOS2 as one writable memory owner and focuses this pass on bounded, corruption-resistant restoration rather than adding a second store.
- [Generative Agents](https://arxiv.org/abs/2304.03442) reports ablation evidence that observation, planning and reflection each contribute to believable simulated behavior. This is a design reference for the integrated cycle, **not evidence of human-equivalent consciousness**.

Any future score increase must record commit, script, model/device/corpus, baseline, raw outcomes and uncertainty. The next sequence is: resolve runner availability; execute the added regressions; merge the five reviewed category PRs into `integration`; then rebuild/replace the large release asset using an environment with verified binary upload access and run the clean-install/E2E gates. Keep `main` unchanged unless the publication-branch design is deliberately reconciled.


**Status:** living engineering plan, not a claim that all listed capabilities exist.  
**Scope:** whole repository and runtime; branch `workpass70-source`.  
**Read alongside:** [persistent charter](../NEUROCORE_START_HERE.md), [working rules](../AGENTS.md), [research intake ledger](RESEARCH_INTAKE_LEDGER.md), [repository surface audit](WORKPASS76_REPO_SURFACE_AUDIT_2026-10-19.md), [latest handover](WORKPASS77_HANDOVER_2026-10-19.md).

## 0. Executive truth

NeuroCore's objective is one coherent, running, recoverable adaptive digital organism/personality, with Makise Kurisu as the intended identity direction. The product must combine a real language model, persistent autobiographical and semantic memory, revision-aware retrieval, measured learning, bounded goals/actions, independently checked outcomes, identity/behavior continuity, and an observable voice/UI/Live2D embodiment. A diagram, module count, personality prompt, test fixture or model self-report is not proof that these capabilities work together.

The immediate bottleneck is not a lack of novel architectures. It is closing the evidence gap between implemented pieces and a complete real-device, real-model, restart-safe end-to-end loop. Research should be broad; shipping should be selective. Every candidate competes against the current implementation under the same data, compute and test budget.

**Current evidence boundary at plan creation:** code-level regressions and a fake-provider HTTP integration exist; an opt-in live `llama.cpp` smoke exists. Actual inference on the Dell G3, independent memory uplift, learning transfer, full external-action proof across restarts, real browser/audio/Live2D E2E, prolonged soak, and consciousness remain unproven or unresolved. Consult the live branch and Actions rather than treating this paragraph as current CI status.

## 1. Product definition and release invariants

### 1.1 Product-level invariants

1. One runtime brain, one canonical owner per mutable capability, explicit APIs between subsystems.
2. Language answers report the actual backend/model used; provider failure is distinguishable from a deterministic fallback.
3. Memory has provenance, event time, valid-time interval, source confidence, conflict/revision lineage and deletion/forgetting semantics.
4. Retrieval does not silently mutate residency, training state, memory truth, or promotion policy.
5. Learning credit is attached only to independently verified outcomes, never to caller-supplied booleans or mere ACKs.
6. Every external side effect has an idempotency key, timeout/cancellation policy, receipt, independent postcondition and restart reconciliation strategy.
7. A restart cannot silently duplicate an action, erase confirmed identity state, or promote unverified evidence.
8. Uncertainty is represented explicitly; unknown is not silently converted to false, true, or confident prose.
9. User privacy and data minimization apply to local and remote providers, logs, benchmarks, telemetry and exports.
10. A degraded/offline mode is predictable, bounded and honest.
11. Resource use is measured on target hardware; laptop measurements do not stand in for Android performance.
12. Release claims map to reproducible evidence artifacts and an explicit gate.

### 1.2 Non-goals / anti-patterns

- Do not claim subjective consciousness or human-equivalent cognition based on behavior alone.
- Do not integrate every architecture candidate simply because it is fashionable or biologically named.
- Do not create parallel memory databases, planning systems, provider routers or personality owners.
- Do not use generated documentation, task count, benchmark seed count or unit-test count as a proxy for quality.
- Do not delete a file because it appears unused until dynamic imports, package scripts, CI, plugins, generated manifests, asset hydration, provenance and recovery paths are checked.
- Do not hide deterministic fallback output behind a “local model” label.
- Do not optimize benchmark data after looking at holdout results.

## 2. Provisional quality scorecard

Scores below are **engineering triage estimates**, not measured scientific scores. They summarize documented evidence and known gaps, and should be replaced with measured metrics when the required evidence exists. 100 means release-grade evidence, not maximal complexity.

| Dimension | Triage score /100 | Confidence | Why / gate to improve |
|---|---:|---|---|
| Core runtime integration | 68 | Medium-low | Many paths exist; whole-product real-model E2E not yet established |
| Local LLM wiring | 60 | Medium | Provider policy + HTTP fake-provider test; real Dell G3 inference and model quality still required |
| Memory persistence / temporal revision | 67 | Medium | Owner and regressions exist; real autobiographical corpus validation incomplete |
| Retrieval quality | 35 | High that evidence is insufficient | Prior recallDelta=0; independent labelled holdout uplift not established |
| Continual learning / transfer | 25 | High that evidence is insufficient | Must prove held-out transfer, controls, reversal/interference and forgetting |
| Outcome verification / action safety | 55 | Medium-low | Important provenance rules exist; full spoof/late-proof/restart matrix remains a gate |
| Identity/personality continuity | 48 | Low | Continuity must survive conflicts, model switches and restarts without self-report as proof |
| UI / browser / Live2D / voice | 45 | Medium-low | Shared timing protocol and tests exist; real renderer/acoustic/physical-device E2E incomplete |
| Test reachability / CI hygiene | 78 | Medium-high | Static audit and workflow integration exist; dynamic runner graph and unreferenced candidates need review |
| Repository provenance / licensing | 50 | Low | Ledger exists; exhaustive source/license/dependency/asset provenance audit incomplete |
| Security / privacy | 50 | Low | Some local/remote boundaries exist; threat-model and release penetration review incomplete |
| Observability / recovery | 52 | Medium-low | Several recovery tests exist; long soak and systematic failure injection remain |
| Performance / energy / thermal | 30 | High that evidence is insufficient | No verified target-device baseline set for full workload |
| Packaging / reproducible release | 42 | Medium-low | Release metadata/tests exist; production build, clean install, rollback and artifact signing gates remain |
| Scientific validity / claims | 62 | Medium | Evidence labels are defined; multiple central efficacy claims still lack independent experiments |
| **Overall readiness (not a weighted average)** | **46** | **Medium-low** | Not release-ready; prioritize closing evidence gaps, not raising the score by adding modules |

**Scoring protocol:** retain date, commit, device, model/hash/quantization, corpus version, script, raw per-case data, baseline, ablation, confidence interval and reviewer for every score change. A score may decrease when an audit discovers a hidden failure.

## 3. A functional architecture: one brain, explicit boundaries

Think in terms of a cognitive loop, not a pile of modules:

`Observe → Parse → Retrieve → Build state → Decide → Act/Respond → Verify → Learn → Consolidate → Observe again`

All stages must preserve correlation IDs, timestamps, provenance, cancellation, budgets and failure state. The loop is a design target; verify which links are live in the actual runtime before calling them implemented.

### 3.1 Proposed logical domains and canonical ownership

| Domain | Responsibility | Known canonical owner / starting point | Required contract |
|---|---|---|---|
| Runtime orchestration | Lifecycle, request correlation, cancellation, composition | `runtime/neuro-kurisu/src/server/server.mjs` and runtime composition | One request context, explicit deadlines, no hidden parallel owner |
| Language interface | Provider choice, model identity, streaming/error semantics | `src/server/local-language-backend-policy.mjs` and provider adapters | Actual backend/model, bounded timeout, safe fallback, request cancellation |
| Perception/input | Normalize text, UI, voice, events and user corrections | Inspect actual server/UI ingress before adding files | Preserve source modality, time and confidence |
| Working state | Current task/context, active constraints and temporary hypotheses | Inventory current owners; do not assume a new store is needed | Bounded TTL, session correlation, restart semantics declared |
| Episodic/autobiographical memory | What happened, when, source and outcome | `src/organism/developmental/MemoryOS2.ts` is canonical writable memory starting point | Event-time, valid-time, source, revisions and correction |
| Semantic knowledge | Stable facts/concepts and links | MemoryOS2 plus its current graph/concept mechanisms; verify exact ownership | Provenance and contradiction-aware updates |
| Retrieval/ranking | Candidate selection and ranking evaluation | `src/organism/memory/MemoryRetrievalBenchmark.ts`, `MemoryRetrievalExperiment.ts` | Pure evaluation; same corpus for baseline/candidate; holdout isolation |
| Learning and consolidation | Turn verified experience into generalizable behavior | Inspect existing learning/replay owners and exact call graph | Credit only verified outcomes; transfer/forgetting measured |
| Identity/self-model | Stable preferences, commitments, capabilities and limitations | Audit actual identity/policy owners before edits | Versioned facts, provenance, explicit uncertainty and revision |
| Goals/planning | Goal decomposition, priorities, stop conditions and resource budgets | Inspect current goal/action owners; avoid parallel planner | Bounded plan, preconditions, deadlines and cancellation |
| Tool/action execution | Authorized side effects, receipts and reconciliation | Existing canonical ActionGateway; verify exact path in source | Idempotency, permissions, ACK uncertainty, independent postcondition |
| Verification/evidence | Normalize and validate external outcomes | `OutcomeVerificationService` (verify exact path/imports) | Non-forgeable in-process evidence identity plus external postcondition |
| Affect/social state | Optional functional state signals for dialogue regulation | Research-only until current owner and behavioral benefit identified | Never claim biological emotion; measurable behavioral role |
| Embodiment | UI, browser, Live2D, TTS, speech timing and interruption | `app/` and runtime embodiment integration | One versioned event envelope and monotonic audio clock |
| Persistence/recovery | Durable state, migrations, crash recovery and replay | Inspect actual persistence adapters | Atomic writes, schema compatibility, recovery fixtures |
| Observability | Trace one interaction end-to-end without leaking secrets | Existing logs/metrics and test reports | Correlation IDs, redaction, bounded retention, provenance |
| Security/privacy | Threat model, permissions, secrets and data flow | Cross-cutting; inventory current boundaries | Least privilege, sanitized logs, local-first option, deletion/export |
| Resource scheduler | CPU/GPU/RAM/context/storage/battery/thermal budgets | Measure runtime before creating a scheduler | Admission control, backpressure, budget exhaustion behavior |
| Evaluation | Regression, benchmark, ablation, adversarial and soak harness | `runtime/neuro-kurisu/tests/`, workflows and research experiments | Reproducible baseline, independent holdout, raw outputs |
| Release/operations | Packaging, install, rollback, upgrades and support diagnostics | Current release scripts/manifests; inventory exact paths | Clean-room build, signed/hash-checked artifacts, rollback drill |

### 3.2 Data envelopes across boundaries

Every inter-domain message should carry the subset of these fields that actually applies: `schemaVersion`, `interactionId`, `eventId`, `causationId`, `occurredAt`, `receivedAt`, `source`, `sourceTrust`, `confidence`, `deadline`, `cancelToken`, `privacyClass`, `payload`, `resultStatus`, `evidenceRefs`. Avoid blindly adding unused fields; formalize and validate contracts at real boundaries.

Required state distinctions: `pending`, `confirmed`, `rejected`, `unknown`, `stale`, `conflicted`, `cancelled`, `timed_out`, `reconciled`. Do not compress these into a boolean.

### 3.3 Canonical end-to-end interaction trace

1. Receive user event and mint an interaction ID.
2. Validate input, permission and resource deadline.
3. Resolve language provider and capture the selected candidate.
4. Retrieve only eligible memories; log memory IDs and scores, not sensitive content by default.
5. Build bounded working context with provenance and contradiction markers.
6. Ask the model for a response/structured plan; treat model output as untrusted input.
7. Validate proposed actions against policy and user permissions.
8. Execute only authorized actions using idempotency keys and bounded retries.
9. Independently inspect the external postcondition; distinguish ACK from proof.
10. Commit confirmed event/revision to canonical memory.
11. Grant learning credit only to normalized verification evidence.
12. Emit response and trace; cancel audio/UI work on interruption.
13. On restart, reconcile pending actions before replaying side effects.
14. Produce an evaluation row that can be replayed offline without exposing private content.

## 4. Human-brain analogy map — explicitly approximate

This map is a **functional analogy**, not a claim that NeuroCore is a brain or that software components correspond one-to-one to anatomical structures. Human cognition is distributed, recurrent, embodied, developmentally shaped and not reducible to a list of isolated organs.

| Human system / concept | Broad real role | NeuroCore analogue / gap | Engineering implication |
|---|---|---|---|
| Sensory systems | Transform continuous noisy input into useful representations | Text/UI/voice input paths; multimodal reliability and calibrated confidence are incomplete | Preserve modality/source/time; add real audio/browser tests before claiming perception |
| Thalamic routing (simplified analogy) | Coordinates routing of many signals to cortical systems | Server/orchestrator/provider dispatch | Central routing must not become an unobservable bottleneck; trace routing decisions |
| Working memory / frontoparietal control | Maintain task-relevant information and regulate attention | Current prompt/context construction and goal state | Explicit bounded working state; test distractor resistance and context overflow |
| Hippocampal formation | Supports episodic encoding, relational binding and consolidation interactions | Episodic/autobiographical memory and replay mechanisms | Test temporal ordering, event relations, retrieval under interference and consolidation |
| Neocortical systems | Distributed representation and long-term knowledge/skills | LLM weights plus stored semantic/procedural knowledge | Keep parametric knowledge distinct from verified user-specific memory; avoid claiming equivalence |
| Prefrontal executive networks | Goal maintenance, planning, inhibition, monitoring | Planner/policy/action orchestration | Enforce budgets, stop conditions, tool permissions and outcome monitoring |
| Basal ganglia / action selection (broad analogy) | Action selection, gating and reinforcement-related loops | Goal priority, tool choice, policy/replay credit | Learn from verified outcomes; use no-learning and counterfactual controls |
| Cerebellum (broad analogy) | Predictive timing and error-driven calibration in many behaviors | Timing alignment, latency models, TTS/viseme timing and action prediction | Measure prediction error and calibrate from real signal, not guessed timestamps |
| Amygdala and salience networks (oversimplified) | Relevance/threat learning and modulation of processing | Salience/priority/uncertainty signals if shown to help | Avoid “emotion module” theatre; require a measurable behavioral function |
| Hypothalamus / homeostasis | Regulates physiological variables and drives | Resource/budget manager is only a functional analogy | Model battery, RAM, thermal and task urgency as explicit constraints, not biological drives |
| Autonomic regulation | Continuous body-state control | Process health, backpressure, timeouts, recovery | Build graceful degradation and self-monitoring without anthropomorphic claims |
| Default-mode / self-referential networks | Involved in internally oriented cognition, memory and self-related processing; interpretation is nuanced | Identity model, autobiographical reflection and background consolidation | Distinguish useful self-modeling from generated introspective text; test continuity and correction |
| Language networks | Distributed language comprehension/production | Local LLM provider and dialogue stack | Evaluate Russian/English accuracy, grounding, calibration, model-switch consistency |
| Sleep and offline consolidation | Multiple processes including memory consolidation and homeostatic regulation | Scheduled replay/indexing/consolidation jobs | Must be bounded, interruptible, durable and evaluated for interference/forgetting |
| Plasticity and neuromodulation | Many mechanisms at multiple scales; not one algorithm | Online learning/replay and adaptive policies | Separate fast state updates from durable learning; verify transfer and prevent reward hacking |
| Glia, vascular and metabolic support | Maintain conditions that enable neural function | No direct biological counterpart; infrastructure and resource scheduling are loose analogies | Measure compute, memory, thermal limits and operational reliability |
| Development and social learning | Long-term shaping through interaction and environment | User feedback, identity continuity and preference learning | Version sources and consent; detect preference changes and avoid overgeneralization |
| Body and sensorimotor loops | Ground action and perception in real consequences | UI/browser/voice/tool actions and postcondition verification | Close action-perception loops; simulated fixtures are necessary but not sufficient |

### 4.1 What is missing relative to the analogy?

The important gaps are not “missing brain regions.” They are functional evidence gaps: robust multimodal input; an explicit bounded working-state model; temporally grounded episodic memory; semantic retrieval that beats a fair baseline; transfer-capable learning; calibrated uncertainty; causal outcome verification; planning under constraints; interruption and recovery; embodied feedback; resource homeostasis; and a reproducible continuous-evaluation loop. The LLM is not equivalent to a neocortex, a database is not equivalent to a hippocampus, and a scheduler is not a hypothalamus.

## 5. Principal weaknesses and risk register

| ID | Weakness / risk | Impact | Evidence currently needed | Priority |
|---|---|---|---|---|
| G-01 | Live local model path not measured on Dell G3 | Critical | Exact server/model/hash/quantization, actual answer backend, cold/warm latency, failure/cancel | P0 |
| G-02 | Memory retrieval uplift not demonstrated (historical recallDelta=0) | Critical | Independent labelled RU/EN holdout, same-corpus baseline, confidence intervals | P0 |
| G-03 | Learning transfer not proven | Critical | Held-out tasks, no-learning control, reversal, interference, forgetting | P0 |
| G-04 | Action proof across lost ACK and restart incomplete as a matrix | Critical | Spoofed/late/duplicate proof, postcondition inspection and recovery tests | P0 |
| G-05 | Provider failure/fallback/cooldown HTTP path needs full failure tests | High | 503, timeout, malformed response, cancellation, cooldown, recovery and provenance | P0 |
| G-06 | Real browser/Live2D/TTS/audio E2E absent/incomplete | High | Real browser build, interrupted speech, stale callbacks, audio clock/viseme drift | P1 |
| G-07 | Test-shaped files not directly referenced (76 candidates in prior audit) | Medium | Script-to-script/dynamic-runner graph; inspect before classifying | P1 |
| G-08 | Source/license/asset provenance not exhaustive | High | File-level inventory, SPDX/license compatibility, hashes and origin | P1 |
| G-09 | Restart during in-flight request/action needs systematic coverage | High | Crash injection at each state transition and idempotent reconciliation | P0 |
| G-10 | Long-duration resource and reliability profile missing | High | 24–72h soak, memory/CPU/VRAM, leaks, thermal and restart recovery | P1 |
| G-11 | Cross-component contracts may be implicit | High | Import/call graph, schema inventory, event/owner map and contract tests | P1 |
| G-12 | Architecture candidate list can become scope creep | High | Benchmark-driven tournament and explicit rejection decisions | Always |
| G-13 | Human-like self-report can be mistaken for cognition | High | External behavioral criteria; honest UNKNOWN/UNRESOLVED status | Always |
| G-14 | Target-device constraints differ sharply | High | Dell G3 vs Android/Termux profiling and capability matrix | P1 |
| G-15 | Release packaging/upgrade rollback not fully proven | High | Clean-room build/install, migration, rollback, integrity checks | P1 |
| G-16 | Private user data may leak through logs or external model requests | Critical | Threat model, redaction tests, opt-in remote boundaries, deletion/export | P0/P1 |
| G-17 | Benchmark leakage / tuning to holdout | Critical | Split hashes, access discipline, shuffled order, independent corpus review | P0 |
| G-18 | Memory revision may preserve stale facts in the wrong contexts | High | Valid-time queries, provenance conflicts, current/historical contrast tests | P1 |
| G-19 | UI can drift from actual runtime state | Medium-high | API contract tests, reconnect/reload and state reconciliation | P1 |
| G-20 | Documentation may be mistaken for code completion | High | Status labels and evidence links for every gate | Always |

## 6. Strategic phases and release gates

### Phase A — Re-establish ground truth
- Verify live branch head, latest Actions, runtime entry points, package scripts, workflows, current handover and repository audit.
- Generate source-level import/call graph, canonical owner table, dependency inventory, test-runner graph and license/asset manifest.
- Classify every finding as confirmed defect, unverified risk, candidate, or accepted limitation.
- Exit gate: inventory reproducible, no undocumented source of truth or hidden release workflow.

### Phase B — Reliability and provider truth
- Add deterministic HTTP-level 503/timeout/malformed-response/cancellation/cooldown/fallback/recovery tests.
- Kill/restart runtime at every language request/action state transition.
- Verify backend attribution, request correlation, no duplicate side effects, bounded retries and sanitized logs.
- Run actual `llama.cpp` on Dell G3; record model SHA, quantization, context, GPU layers, server version, cold/warm latencies and output limits.
- Exit gate: real model answer through the real product path and deterministic failure/recovery behavior.

### Phase C — Memory correctness before “smarter” retrieval
- Freeze and hash independent Russian/English corpora with temporal revisions, paraphrases, contradictions, distractors, privacy classes and multi-hop cases.
- Compare BM25/lexical baseline to each candidate on exactly the same rows; no truncation or malformed-row asymmetry.
- Report per-case retrieval, MRR/Recall@k, false-current-fact rate, stale-memory use, latency, resident memory and confidence intervals.
- Add insertion-order/shuffle controls, duplicate/replay controls, cold-memory invariants and no-leakage audits.
- Exit gate: reproducible positive uplift on held-out data without privacy, residency, latency or temporal-correctness regression. If not, keep candidate unpromoted.

### Phase D — Learning and consolidation
- Define tasks where a single verified experience should improve a held-out later task.
- Run learning-enabled, no-learning, shuffled-feedback, wrong-feedback and replay-disabled controls.
- Test transfer, reversal, interference, selective forgetting, overgeneralization and recovery after restart.
- Track per-example credit source, uncertainty and effect on future behavior.
- Exit gate: measured transfer over baseline with bounded forgetting and no reward from spoofed/unverified outcomes.

### Phase E — Goal/action safety
- Formalize goal states, permissions, preconditions, deadlines, resource caps, cancellation and stop conditions.
- Inject timeout/lost ACK at every boundary; inspect external state independently; reconcile after process restart.
- Test duplicate delivery, spoofed evidence, late evidence, contradictory evidence and partially completed multi-step actions.
- Exit gate: at-most-once effect where possible; otherwise idempotent reconciliation and explicit ambiguous state, never silent success.

### Phase F — Identity and user continuity
- Define identity facts vs temporary state vs role-play vs model inference; version all user-correctable facts.
- Test model/provider switch, context truncation, memory compaction, data export/import, restart and conflicting corrections.
- Ensure stable preferences do not override fresh explicit user intent; support selective forgetting and source removal.
- Exit gate: continuity measured on blind conversation suites, with calibrated uncertainty and no unsupported claims of inner experience.

### Phase G — Embodiment
- Install dependencies reproducibly and run the actual production build.
- Browser tests: boot, reconnect, reload, permissions, API errors, offline mode and accessibility.
- Live2D/TTS: interruption during synthesis/playback, stale callbacks, audio clock monotonicity, viseme boundary behavior, focus and device routing.
- Record real acoustic timing error using actual PCM/phoneme references where available; mark Web Speech approximations accurately.
- Exit gate: reproducible E2E in target browsers plus physical device tests for advertised audio features.

### Phase H — Performance, security and soak
- Establish resource budgets per target: Dell G3 i5/GTX1650 and Poco M7 Pro 5G/8 GB; never infer one from the other.
- Measure cold/warm latency, throughput, peak RAM/VRAM, CPU/GPU, disk growth, cancellation response, thermal throttling and battery drain.
- Threat-model prompt injection, malicious tools, untrusted memories, path traversal, secret exposure, dependency compromise and log exfiltration.
- Run 24–72h soak with restart, provider failures, storage pressure and interrupted actions.
- Exit gate: declared service budgets and no unresolved critical security/recovery defect.

### Phase I — Release candidate and maintenance
- Clean-room checkout/build/test; verify lockfiles, license inventory, hashes, generated assets, migration and rollback.
- Produce versioned artifact, changelog, supported-platform matrix, known-limitations sheet, diagnostics bundle with redaction, backup/export and uninstall path.
- Run release regression suite and independent review; tag only a commit with attached evidence.
- Exit gate: every release claim traceable to a test or measurement; unresolved blockers visible.

## 7. Scientific and engineering research directions

These are research tracks, not pre-approved integrations. Use the source-intake ledger for exact revision/license/provenance and outcomes.

### Memory and cognition
- Episodic/semantic memory separation, temporal knowledge graphs, provenance-aware fact revision, retrieval calibration, memory-agent benchmark design, selective forgetting, hierarchical summarization, event sourcing and compaction.
- Retrieval research: BM25 and sparse lexical baselines, dense embeddings, hybrid fusion, rerankers, query rewriting, graph traversal, temporal filtering, contradiction-aware scoring and calibrated abstention.
- Candidate sources already listed in the ledger include MemoryAgentBench, Memora/FAMA, MINTEval, AgeMem, Hexis and the existing NeuroCore retrieval benchmark. Check paper dates, versions, licenses and benchmark protocol before citing results.

### Learning and plasticity
- Continual learning, replay, online adaptation, test-time training, fast weights, meta-learning, credit assignment, uncertainty-gated updates, elastic/regularized updates, selective erasure, reversal learning and interference.
- Candidate architecture families: Titans, Gated Oja, TTT, Preconditioned DeltaNet, Mamba/SSM, Mamba-3 MIMO/SSD, FLA, MoBA, GSA, NSA, LIRA, HiPPO, DPLR/IPLR, RWKV-7/Goose and MEMO. Exact sources that are ambiguous remain UNRESOLVED; do not invent a source or claim integration.
- Acceptance tests: held-out transfer, no-learning controls, wrong-label controls, replay ablations, forgetting curves, order/shuffle invariance, memory footprint and real hardware performance.

### Planning, causality and action
- Event sourcing, transactional outbox/inbox, idempotency, saga compensation, durable workflow recovery, model-based planning, causal inference, counterfactual evaluation, risk-sensitive control, verification and policy learning.
- Candidate action/tool source: mindot-ai/will retained under legacy input archive; inspect exact commit and license; test actual adapters rather than equating source presence with functionality.
- Tests: lost ACK, partial side effects, restart, stale state, spoofed proof, late proof, duplicate replay and adversarial tool output.

### Reliability and distributed systems
- State machines, schema evolution, crash consistency, write-ahead logs where justified, leases, circuit breakers, bounded retry/backoff, deadlines, cancellation propagation, deterministic replay, chaos/fault injection and observability.
- Keep one canonical owner for each mechanism; adopt an existing dependency only when its operational cost and license are acceptable.

### Human factors, social cognition and embodiment
- Grounded dialogue evaluation, user correction, calibrated confidence, preference change, social context, turn-taking, speech interruption, prosody/viseme timing, accessibility and privacy.
- Treat emotion and consciousness as separate research questions; functional regulation is not proof of subjective experience.

### Security and privacy
- Threat modeling, least privilege, secret scanning, software bill of materials, dependency pinning, provenance, prompt injection, untrusted tool results, data retention/deletion/export, log redaction and remote-provider minimization.
- Benchmark fixtures should use synthetic or consented data, not private production conversations without an explicit lawful process.

## 8. Source and file inventory: what is known vs what still must be enumerated

Known starting points (not a complete file listing):
- `NEUROCORE_START_HERE.md`: persistent charter and resume contract.
- `AGENTS.md`: repository work rules.
- `README.md`: current status and release gates.
- `docs/WORKPASS77_HANDOVER_2026-10-19.md`: previous handover; refresh against live branch.
- `docs/WORKPASS76_REPO_SURFACE_AUDIT_2026-10-19.md`: repository surface audit.
- `docs/WORKPASS75_REBUILD_AND_EVIDENCE_LEDGER_2026-10-19.md`: ownership/rebuild/evidence.
- `docs/RESEARCH_INTAKE_LEDGER.md`: research/source intake.
- `docs/LOCAL_LLM_SMOKE_GUIDE.md`: actual local inference procedure.
- `runtime/neuro-kurisu/src/server/server.mjs`: server/request path.
- `runtime/neuro-kurisu/src/server/local-language-backend-policy.mjs`: canonical local backend policy.
- `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts`: canonical writable memory owner.
- `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBenchmark.ts` and `MemoryRetrievalExperiment.ts`: retrieval evaluation.
- `runtime/neuro-kurisu/tests/server-language-http-fake-provider.mjs`: real HTTP path with loopback fake provider.
- `runtime/neuro-kurisu/tests/local-llm-live-smoke.mjs`: opt-in live model smoke.
- `runtime/neuro-kurisu/tests/`: runtime regression suite.
- `tools/audit-runtime-test-coverage.mjs`: static test reachability audit.
- `.github/workflows/`: CI/release wiring; exact inventory required.
- `app/`: UI/client shell; not a second brain or canonical memory owner.
- `research/`: isolated experiments.
- `legacy/`: historical source snapshots and provenance; not production ownership.
- `legacy/input-archives/will-main-2026-10-08/` and `legacy/input-archives/hexis-main-2026-10-08/`: retained research/source material; inspect license and exact call paths before reuse.

**Required generated inventories:** exact tracked path manifest; extension and size histogram; imports/calls graph; exported API graph; state-owner map; package-script/workflow/test-runner graph; dependency/SBOM/license report; source and asset provenance manifest; duplicate hash report; dynamic import/asset hydration map; generated-vs-canonical file map. Until generated from the live repository, no document should claim a complete list of every file.

## 9. Change protocol: how to make progress without endless redesign

For each work item:
1. State the observable defect or measurable hypothesis.
2. Identify canonical owner, caller/callee path and existing invariants.
3. Record baseline test/measurement before editing.
4. Make the smallest behavior-changing implementation; use an isolated adapter for uncertain experiments.
5. Add a regression that fails on the old behavior.
6. Run focused tests, typecheck/build, and relevant full workflow.
7. Inspect the diff for duplicate owners, dead code, security regressions and test gaming.
8. Record raw outcome, CI run, device/config, limitation and rollback.
9. Promote, defer or reject based on evidence.
10. Update the handover and choose the next highest-impact blocker.

No pass should be documentation-only if an actionable code defect is available and tools/environment permit fixing it. Documentation is essential for long-horizon continuity but must point to code/tests and not masquerade as implementation.

## 10. Definition of release-ready

Release-ready means:
- A fresh checkout builds reproducibly.
- The real configured local model generates through the real app/runtime path.
- Failure/cancel/fallback/restart paths are tested.
- Memory revisions and retrieval are validated on held-out labelled data.
- Learning transfer and forgetting have controlled experiments.
- Actions are permissioned, idempotent, verified and restart-safe.
- Identity/user correction and selective forgetting work across model switches/restarts.
- Browser/UI/Live2D/TTS advertised features pass real E2E on declared targets.
- Performance/resource budgets and soak tests pass.
- Security, privacy, dependency/license, asset provenance and backup/export are reviewed.
- Every claim is traceable to evidence; known limitations and unresolved scientific questions are disclosed.

A “consciousness” claim is not a release gate that can be checked off by ordinary software tests. Subjective experience remains UNKNOWN / UNRESOLVED; report concrete behavioral capacities instead.

## 11. Immediate next 12 tasks (order matters)

1. Refresh live branch head and latest Actions; record exact SHA and status.
2. Implement deterministic HTTP provider failure matrix: 503, timeout, malformed response, cancellation, fallback provenance, cooldown and recovery.
3. Add restart-in-flight request/action fault-injection tests and ensure no duplicate side effects.
4. Run the live local-model smoke on Dell G3; record model/server/config and cold/warm latency.
5. Generate exact repository path, import/call, workflow/script/test-runner and dependency/license inventories.
6. Review the 76 test-shaped unreferenced candidates without deleting any; extend the audit to dynamic/script-to-script runners.
7. Freeze independent RU/EN retrieval holdouts and add leakage checks.
8. Run retrieval baseline/candidate with per-case output, uncertainty intervals and insertion-order/shuffle controls.
9. Build transfer/reversal/interference/forgetting suite with no-learning and wrong-feedback controls.
10. Complete action proof matrix: lost ACK, restart, independent postcondition, spoofed/late proof and duplicate delivery.
11. Complete production build plus browser/Live2D/TTS interruption/reconnect E2E.
12. Start a 24–72h soak and target-device resource profile after core failure paths are stable.

**Next-chat command contract:** if the user says “работай над проектом”, “продолжай NeuroCore”, “@GitHub продолжай” or equivalent, read the current charter, rules, live handover, open-work register and research ledger; inspect live branch/Actions; continue from the highest-impact unresolved item; make real code/test changes where possible; commit and update evidence. Do not ask the user to repeat the goal.


### Follow-up update — WorkPass334 voice/STT recovery (2026-10-23)

A sixth existing category branch, `feature/visual-embodiment`, now has a draft integration PR: [#84](https://github.com/ailtron1ss-rgb/NK1/pull/84). `EmbodimentRuntime.listen()` releases the listening flag in a `finally` block when the STT adapter fails, emits a bounded failure diagnostic, and permits a later retry. The existing `npm run test:voice` entry point now contains a deterministic failure → cleanup → success scenario. Code commit: [bb9fbc7](https://github.com/ailtron1ss-rgb/NK1/commit/bb9fbc75ee3bd5e1e33b221a86da8621eef2a3f2); regression commit: [318e510](https://github.com/ailtron1ss-rgb/NK1/commit/318e5102ce3339b624bbc40c57bd50bfd4ff5b96); CHANGELOG commit: [0913725](https://github.com/ailtron1ss-rgb/NK1/commit/0913725a30510682b2805388c4f00cea09587134).

Category coverage is now **6 of 9 (about 67%)**: learning, perception, emotions, memory, personality, and visual embodiment. This percentage measures only the named category branches touched in this pass series; it is **not** the completion percentage of Neuro Kurisu. The readiness score remains **46/100** because no new regression has executed yet and the six draft PRs are not merged. The latest release ZIP remains unchanged. Continue with runner recovery, exact-head tests/typecheck, integration merge, and only then a rebuilt/verified release asset.

### CI + continual-learning update — WorkPass335–336 (2026-10-23)

- **CL evidence validity:** `ContinualLearningMetrics.evaluateContinualLearning` no longer silently assumes `referenceScore=0` when `preTrainingScore` is present. Forward-transfer output requires a measured fixed/random-policy reference. `ContinualOutcomeMatrix` now enforces the same contract when a pre-training method is selected.
- **CL data integrity:** sparse task/stage arrays and unsafe task IDs are rejected instead of silently skipping samples. New assertions are wired into the existing `test:p23:continual-metrics` script.
- **CI runtime consistency:** P26 learning validation is updated from Node.js 22.12 to Node.js 24, in line with root `.nvmrc` and the newer WorkPass110/P23 workflows. The workflow adds an explicit Node-major preflight check and retains its lockfile-based install/concurrency behavior. Proposed change: [PR #85](https://github.com/ailtron1ss-rgb/NK1/pull/85).
- **Learning branch PR:** [PR #79](https://github.com/ailtron1ss-rgb/NK1/pull/79) now includes both the earlier evidence-digest race fix and these CL metric integrity changes.
- **CI reality:** exact-head Actions runs for both branches continue to fail before any runner step, including the P26 workflow after its Node 24 update. Job metadata shows runner ID 0 and an empty step list. The available evidence does not identify the underlying cause, so do not label this as a source-code test failure or assume billing is the cause; investigate repository/account/hosted-runner availability in GitHub settings. No new runtime test is recorded as passed.
- **Release boundary:** the large GitHub Release ZIP is unchanged; these are proposed source-branch changes, not a refreshed release artifact.

Progress accounting: branch work added a strict baseline requirement and sparse-input rejection. The readiness estimate remains **46/100** pending executed tests, merged PRs, end-to-end integration, and a rebuilt/verified release ZIP. Metric-correctness changes deliberately do not inflate the project completion percentage.

### CI wiring and continual-learning update — WorkPass337–338 (2026-10-23)

- **Missing script references repaired:** the existing P26 regression files now have package aliases for learning-input integrity, recovery benchmark and continual matrix; P23 has a WorkPass293 coordinator alias; WorkPass291, WorkPass292 and WorkPass294 now have aliases matching their existing regression files. The changes exist on `feature/learning` and `feature/experiments` with identical runtime package-script additions.
- **CI audit now checks script resolution:** `tools/verify-ci-reliability.mjs` loads the root, app and runtime `package.json` files and compares workflow `npm run` references against the correct context. It accounts for per-step `working-directory`, shell `cd` and `npm --prefix`, and reports the workflow/context if the name is undefined. Unit tests cover valid context mapping and three representative missing-script cases.
- **Related PRs:** [#79](https://github.com/ailtron1ss-rgb/NK1/pull/79) combines the P23 evidence-snapshot race fix, strict CL metric baseline requirement, sparse-array input checks and runtime test aliases. [#85](https://github.com/ailtron1ss-rgb/NK1/pull/85) combines Node 24 alignment for P26, the aliases and the cross-package CI script audit.
- **Static inspection only:** the specific missing P26/P23/WP291/WP292/WP294 aliases were found and are now declared in the runtime package. The new cross-package audit code/test has not been executed, so do not claim it has passed across all workflows yet.
- **Hosted execution remains unresolved:** a retry of P26 was accepted but again completed in about three seconds with `runner_id=0` and an empty step list. That shows no npm install, typecheck or regression command executed; the actual hosted-runner cause remains unconfirmed.
- **CL quality boundary:** forward transfer now requires an explicit measured reference score whenever pre-training measurements are supplied; zero is no longer silently assumed. This improves experiment validity but does not show that NK1's learning improved empirically.
- **Release boundary:** the large release ZIP has not been rebuilt/replaced. The readiness estimate remains **46/100** until these tests actually execute, cross-branch integration is checked and the release artifact is rebuilt and verified.
