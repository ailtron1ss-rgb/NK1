# Neuro Kurisu — cross-source learning integration roadmap

Latest implementation checkpoint: WorkPass227 (bounded independent-evaluation services); implementation and CI wiring are committed on the current draft PR branch, but execution results remain unverified.

Scope: continue integrating mechanisms into the existing P23 learning/revision lifecycle. This is an implementation queue, not a promise that upstream mechanisms are already integrated. Preserve the current branch/PR boundary; do not merge to the default branch without explicit approval.

## Completed in this branch (through WorkPass227 code; runtime verification pending)

- [x] Reuse SkillLearnBench-style task success, skill quality, trajectory quality and macro-averaged task metrics.
- [x] Bind evaluator runs to exact payload/task/environment/plan identity; require an independent verifier's explicit binding attestation.
- [x] Connect optional LearningExperimentPlan + VerifiedOutcomeLedger authority; require manifest, split, prompt fingerprint, method, seed and scheduled run identity.
- [x] Keep existing P23 revision staging/promotion authoritative; evaluator itself does not promote.
- [x] Snapshot caller-owned experiment plans and capture executor/verifier/scanner entry points.
- [x] Detach executor results before async verifier/safety I/O and snapshot repair evidence before provider calls.
- [x] Snapshot provider-owned proposal, baseline, and candidate-evaluation data before returning prepared revision inputs (WorkPass220); add a retained-reference mutation regression.
- [x] Freeze the evaluator's validated runtime/environment fingerprint at construction so later caller config mutation cannot relabel runs (WorkPass221); add regression coverage for post-construction config mutation.
- [x] Snapshot proposal, baseline, candidate-evaluation data, and options inside the coordinator itself before staging, even when a caller uses a provider without the independent-evaluation wrapper (WorkPass222); add a retained-reference mutation regression.
- [x] Add targeted evaluator/provider regression commands to the learning CI workflow.
- [x] WorkPass223: return the construction-time `environmentFingerprint` snapshot in evaluator provenance, not the mutable caller-owned config field. The existing WorkPass203 regression mutates the config after construction and asserts that provenance retains the original environment identity.
- [x] WorkPass224: fail startup in `NODE_ENV=production` when compound repair revision is enabled without a host-provided independent evaluation configuration factory; added a focused regression, package script, and learning workflow step.
- [x] WorkPass225: added `compareMatchedIndependentEvaluations`, which validates each result envelope digest and refuses baseline/candidate comparisons unless task-plan and environment fingerprints match, experiment authority matches except for distinct method labels, and every paired task/trial has the same seed/split with independently bound, verifier-passed, safety-clean execution evidence. It then delegates metric scoring to the existing SkillLearnBench candidate gate.
- [x] WorkPass225 follow-up: bind each provenance split to the actual validation/holdout report array before scoring; add a cross-split tampering regression.
- [x] WorkPass225 integration repair: register the regression command in `package.json` and include WorkPass224/225 in `audit:p23:cross-source-replay`.
- [x] WorkPass226 partial: production `withIndependentCandidateEvaluation` now rejects configs without canonical experiment authority (manifest, validation/holdout plans and verified-outcome ledger); the WorkPass224 regression now covers a factory that supplies interface-shaped services but omits this authority.
- [x] WorkPass225 follow-up: bind each provenance split to the actual validation/holdout report array before scoring; this prevents a caller from relabeling a verified validation trial as holdout (or vice versa) and recomputing the outer digest. Added a cross-split tampering regression.
- [x] WorkPass225 integration repair: registered the regression script in `package.json` and included WorkPass224/225 in the canonical `audit:p23:cross-source-replay` command. The CI workflow already invokes the targeted regression.

## Next implementation passes

### P0 — close the complete generation-to-promotion path
- Wire the production generator, sandbox executor, independent verifier and safety scanner through the existing runtime/coordinator, not a second learner.
- Ensure baseline and candidate are evaluated against the same immutable task/seed/environment plan; reject mismatched or provider-supplied unverifiable baseline evidence.
- Carry the independent evaluation envelope and digest into the existing P23 gate; do not record candidate-only outcomes as baseline evidence.
- Keep holdout inaccessible to generation, repair prompts, tuning and selection; only use it at the final comparison boundary.

### P1 — experiment integrity and decision quality
- Add matched-pair evaluation and per-task/seed joins so candidate-vs-baseline deltas cannot compare different trials.
- Add confidence intervals / bootstrap or Wilson bounds where their assumptions fit, and minimum sample/seed policy; never treat missing evidence as a zero-cost win.
- Add regression vetoes for safety, capability regressions, catastrophic task failures and distribution-shift indicators.
- Add a reproducible experiment manifest including model/tool/runtime versions, prompt/data fingerprints, seeds and resource budgets.

### P2 — source integrations with high leverage
- Hermes/Will: consolidate evidence binding, reflective reports, skill revision plans and promotion provenance in the existing lifecycle.
- SkillLearnBench: retain task-success, skill-quality and trajectory-quality dimensions, with macro-averaging to avoid task-rich families dominating.
- OpenHands/SWE-agent-style execution ideas: sandboxed tool execution, bounded retries, explicit action traces and recoverable execution failures; adapt only mechanisms that fit current runtime boundaries.
- DSPy/GEPA-style optimization: optimize prompts/policies only on training/validation evidence, with immutable experiment records and holdout untouched until final evaluation.
- AgentBench / WebArena-style task suites: use task families and environment-specific capability rubrics instead of one aggregate score.
- Research experimental alternatives (e.g. evolutionary search, verifier-guided repair, debate/critic ensembles) behind pluggable evaluators; keep them shadow-only until they beat a fixed baseline under matched evaluation and safety gates.
- Review licenses, dependency weight, local-model/VRAM cost and maintenance burden before importing upstream code; prefer narrow mechanism ports over vendoring entire projects.

### P3 — continual learning and memory integration
- Feed only verified, provenance-bound outcomes into the existing outcome ledger and replay/retention curriculum.
- Link skill-version provenance to source evidence, experiment IDs, rollback target and retention checks.
- Add forgetting/transfer tests across task families and capability-specific ablations; separate correlation from causal claims.
- Add bounded experiment scheduling driven by uncertainty/evidence debt, with explicit compute budgets and starvation protection.

### P4 — runtime deployment and operations
- Provide a concrete host adapter for real sandbox/verifier/scanner implementations and fail startup when production mode lacks them.
- Add cancellation, timeout, resource limits, retry/idempotency semantics and durable run identities.
- Run the targeted regression suite and typecheck in CI; investigate runner dispatch failures separately from code failures.
- Promote the PR from draft only after the complete path and checks are actually verified.

## Status discipline

- DONE means a code change exists on this branch; it does not imply CI passed.
- PARTIAL means the seam exists but a real production authority or end-to-end path is still absent.
- OPEN means no implementation claim is made yet.


## Cross-source integration matrix for the 120-direction plan

This matrix maps the broad integration catalogue to existing NK1 seams. It is intentionally a disposition map: a source name is a research target, not proof that its repository has been vendored or that the entire capability is production-complete.

| Direction family | Existing NK1 seam to reuse | Integration disposition |
|---|---|---|
| Agent loop, planning, tool execution | OrganismRuntime, PlanEngine, ActionGateway, embodied action executor | Reuse the canonical runtime and add bounded adapters; do not introduce a second action loop |
| Hermes/Will skill learning and reflection | P23LearningEngine, SkillRevisionPlan, HermesVerifiedEvidenceBinding, VersionedSkillCandidateStore | Port evidence binding, revision targets and skill-learning ideas into P23; keep promotion authority unchanged |
| Independent evaluation and benchmark suites | IndependentSkillCandidateEvaluator, SkillLearnBenchAdapter, LearningExperimentPlan, VerifiedOutcomeLedger | Preserve exact payload/task/environment binding, matched task/trial comparisons and untouched holdout |
| Persistent memory and consolidation | OfflineConsolidation, memory retrieval/consolidation subsystems, continuity and evidence ledgers | Connect memory records to provenance and task utility; avoid a parallel authoritative memory store |
| Replay, continual learning, forgetting/transfer | P23LearningEngine, ReplaySelectionPolicy, MultiSourceLearningMechanisms, evidence debt | Reuse bounded replay and seed-clustered evidence; add retention/transfer comparisons before changing defaults |
| Metacognition and uncertainty | OutcomeReflectionCurriculum, prediction calibration, evidence debt, causal trace ledger | Use measured prediction error and uncertainty to select verification work; do not treat self-reported confidence as proof |
| Emotional/motivational state | Organism needs/state, resource economy, goal pressure and social context | Integrate as functional control signals only when a measurable behavior change can be evaluated |
| Voice, vision and Live2D | LanguageOrgan, camera evidence processor, vision backend, embodiment and UI layers | Preserve existing perception/action interfaces; bind avatar state to real runtime state instead of animation-only imitation |
| Browser, coding and external tools | ActionGateway, tool schemas, postcondition verifier, operational journal | Require permissions, sandboxing, postconditions, cancellation and auditable action traces |
| Research, optimization, evolutionary search, critics | research bridge, candidate generation and P23 evaluator | Keep shadow-only; optimize on train/validation only; never grant experimental search direct promotion authority |
| Runtime reliability and resource limits | RuntimePerformanceGovernor, scheduler, checkpointing, file state store, recovery controller | Extend existing cancellation, budget and recovery boundaries rather than layering another supervisor |
| Security and provenance | RealityEvidenceLedger, verified outcome ledger, signed promotion approval, canonical fingerprints | Fail closed on missing identity, mismatched evidence, safety violations or unverified execution |

### WorkPass223 disposition

- **DONE (code):** corrected a provenance mismatch that allowed the returned evaluator report to read a later-mutated environment fingerprint despite the evaluator capturing the original fingerprint at construction.
- **DONE (code):** production runtime startup now rejects compound-repair revision wiring that lacks a separate independent-evaluation configuration factory; a targeted regression is registered in the learning workflow.
- **PARTIAL:** regression commands are registered, but this connector session did not execute them or run TypeScript checks. Latest visible Actions failures occur before any job step starts (`runner_id: 0`, `steps: []`), so they do not validate or identify code-level failures.
- **OPEN:** verify the full generation → sandbox → independent verification → safety → matched comparison → staging → shadow evidence → signed promotion path using real host-provided authorities. No fake production adapters should be added merely to make the path appear complete.


## Large-pass execution queue for the 120-direction integration catalogue

The queue below is ordered by dependency and risk, not by novelty. Existing NK1 modules remain the source of truth; external projects contribute mechanisms, not competing runtime architectures.

| Pass | Priority | Integration work | Upstream patterns to adapt | Acceptance evidence | Status |
|---|---|---|---|---|---|
| WorkPass225 | P0 | Bind baseline and candidate to the same immutable task/seed/environment; reject missing, duplicate, cross-split or mismatched run identities before scoring deltas | AgentBench/WebArena task identity; SkillLearnBench trial metrics | Matched-pair join keyed by manifest/task/seed/environment/method, report-array split binding, and negative tests | DONE (code; CI not yet verified) |
| WorkPass226 | P0 | Connect the real host sandbox, independent verifier and safety scanner; reject self-attested execution and missing postconditions | OpenHands/SWE-agent execution boundaries | Real host adapter contract, no fake production defaults, fail-start tests | PARTIAL: production now requires canonical experiment authority; actual trusted host sandbox/verifier/scanner wiring remains OPEN |
| WorkPass227 | P0 | Carry signed/digested evaluation evidence through the canonical P23 staging gate; keep holdout outside generation, repair, tuning and candidate selection | DSPy/GEPA experiment discipline | Holdout-access boundary tests and gate-level evidence digest checks | OPEN |
| WorkPass228 | P1 | Add confidence bounds, minimum sample policy and catastrophic-regression vetoes to promotion decisions | Benchmark statistics and conservative release gates | Small-sample, missing-data, regression and uncertainty tests | OPEN |
| WorkPass229 | P1 | Add a reproducible experiment manifest for model/tool/runtime versions, prompts, data fingerprints, seeds, budgets and retries | Reproducible research / experiment tracking | Identical manifest reproduces identical plan identity; any changed input changes digest | PARTIAL: plans/fingerprints exist; complete host manifest remains OPEN |
| WorkPass230 | P1 | Merge Hermes/Will-style skill evidence and reflective repair into existing P23 plans and versioned skill store | Hermes, Will, Voyager | A verified failure produces a versioned candidate with traceable source evidence; no second learner | PARTIAL: evidence/repair seams exist; full trusted loop remains OPEN |
| WorkPass231 | P1 | Connect episodic replay, goal/affect salience, memory consolidation and capability-specific retention tests | Letta/MemGPT, Voyager, cognitive replay | Replay records retain provenance; transfer/forgetting regressions cover multiple task families | PARTIAL: replay and salience mechanisms exist; causal retention evidence remains OPEN |
| WorkPass232 | P1 | Integrate uncertainty-driven metacognition: decide when to ask, search, retry, verify or stop using observed calibration | Reflection/critic patterns; uncertainty-aware agents | Calibration metrics and action-choice outcomes, not self-reported confidence alone | OPEN |
| WorkPass233 | P2 | Add task-family environment suites and realistic tool/browser/code tasks with postcondition verification | AgentBench, WebArena, SWE-agent | Separate per-family results, stable task versions, no aggregate-only promotion | OPEN |
| WorkPass234 | P2 | Connect multimodal perception, speech, UI and Live2D to runtime state and actual actions | Existing vision, language and embodiment seams | UI/avatar changes correspond to observable state transitions and trace IDs | PARTIAL: runtime perception/embodiment exists; complete UI-to-state binding requires audit |
| WorkPass235 | P2 | Add shadow-only prompt/policy optimization, verifier-guided repair and optional critic/evolutionary candidates | DSPy/GEPA and experimental search | Fixed baseline, validation-only optimization, bounded budgets, holdout isolation, no direct promotion | OPEN |
| WorkPass236 | P2 | Unify tool permissions, sandbox limits, cancellation, idempotency, checkpoints and recovery across external tools | OpenHands/SWE-agent operational patterns | Interrupted/duplicated actions recover without duplicate side effects | PARTIAL: individual controls exist; unified production adapter remains OPEN |
| WorkPass237 | P2 | Consolidate event/provenance contracts and deduplicate overlapping subsystem responsibilities | NK1 event bus, evidence ledgers, capability registry | One canonical authority per responsibility; compatibility migration and no premature deletion | OPEN |
| WorkPass238 | P3 | Add provenance-bound continual learning, skill rollback, transfer/forgetting checks and bounded experiment scheduling | Voyager lifelong skill library; memory consolidation research | Every promoted version links evidence, evaluation, rollback target and retention results | PARTIAL: components exist; end-to-end governance remains OPEN |
| WorkPass239 | P3 | Audit local model routing, VRAM/resource budgets, cache and queue behavior under mobile/low-memory profiles | Local-model serving patterns | Measured resource ceilings and graceful cancellation/fallback | OPEN |
| WorkPass240 | P3 | Source/license/dependency review for each upstream mechanism; port narrowly rather than vendor entire projects | Hermes, Will, OpenHands, SWE-agent, DSPy, GEPA, Letta, Voyager, AgentBench, WebArena, SkillLearnBench | Source URL/commit/license, adapted files, dependency/VRAM impact and retained attribution | OPEN |

### WorkPass224 follow-through

- **DONE (code):** evaluator provenance uses the captured environment fingerprint; production compound-repair revision fails closed if independent evaluation authority is not configured.
- **PARTIAL:** regression test and CI wiring are present, but successful execution has not been established in this session.
- **OPEN:** real trusted host adapters, matched baseline/candidate evidence and holdout-isolated final promotion remain the P0 implementation targets.

### Cross-source implementation rules

1. Never copy a source project's whole agent loop if NK1 already has an equivalent; port the mechanism behind the canonical interface.
2. No experimental optimizer, critic, debate, evolutionary search or self-modifying proposal may write to the trusted candidate store or promote itself.
3. Training and validation may drive generation/tuning; holdout is exposed only to the final independent comparison and cannot feed back into the same candidate decision.
4. Every claim of improvement must be supported by matched task/seed/environment evidence, sample policy, safety checks and a reproducible manifest.
5. A source integration is not DONE because a class, adapter, checklist or placeholder exists. DONE requires the capability to be connected to the canonical runtime and to produce attributable evidence.
6. Never delete overlapping code until callers, persistence formats, UI/Live2D links, licensing and migration paths have been checked.


### WorkPass225 implementation checkpoint

- **DONE (code):** added a canonical matched-evaluation boundary to `IndependentSkillCandidateEvaluator.ts`. It checks SHA-256 envelope integrity before trusting either evaluation, requires exact task-plan/environment identity, requires matching manifest/validation/holdout plan fingerprints and distinct baseline/candidate method labels when experiment authority is present, and joins trial bindings by task/trial while requiring equal seed/split, trusted run identity, verifier pass, and zero safety violations.
- **DONE (integration code):** reuses `evaluateSkillLearnBenchCandidate` for the actual paired multi-axis score and holdout gate; no parallel scoring or promotion engine was added.
- **DONE (regression code):** added `tests/workpass225-matched-independent-evaluation.mjs` covering successful pairing, environment mismatch, seed mismatch, unsafe evidence, and post-evaluation tampering. Registered `test:workpass225:matched-independent-evaluation` and wired it into the learning workflow path filters and job steps.
- **PARTIAL:** code and CI wiring are committed; this pass has not executed the test/typecheck locally. CI must actually dispatch before this is considered validated.
- **NEXT:** WorkPass226 — provide a concrete production host adapter contract for sandbox/verifier/scanner with bounded execution and independently verified postconditions; inspect the real runtime wiring and avoid dummy production implementations.


### WorkPass225 follow-up — split provenance and audit integration

- **DONE (code):** matched comparison now verifies the split recorded in every trial binding matches the array containing its report (`validation` or `holdout`) before calculating any gate metrics. This closes a data-labeling gap that could otherwise change which gate sees a report while preserving task/trial identifiers.
- **DONE (regression code):** added a regression that relabels a candidate trial's split and recomputes the evaluation digest; the comparison must still reject it.
- **DONE (wiring):** added the missing `test:workpass225:matched-independent-evaluation` npm script and included WorkPass224/225 in `audit:p23:cross-source-replay`. The workflow already includes the script in its job and path filters.
- **PARTIAL:** the source/test/wiring edits exist on the PR branch; no successful execution is claimed until Actions actually runs the steps.


### WorkPass226 — production authority boundary (partial)

- **DONE (code):** the independent-evaluation provider rejects a production configuration factory that returns sandbox/verifier/scanner-shaped interfaces without canonical `experimentAuthority`. The authority must be present before the evaluator can be constructed, and its existing evaluator validation binds manifest entries and validation/holdout plans.
- **DONE (regression code):** extended the production authority regression with interface-shaped but authority-free config; it must fail closed before the evaluator executes.
- **PARTIAL:** this closes the configuration-authority gap but does not prove that the injected executor, verifier, or safety scanner are real trusted host services. A provider can still supply function-shaped objects; production wiring must bind these to actual sandbox/postcondition/safety implementations and verify provenance of the authority provider.
- **NEXT:** WorkPass226 continuation: trace real runtime service ownership, construct an explicit trusted-host adapter using existing ActionGateway / ExternalPostconditionVerifier seams where contracts fit, add timeout/cancellation and run identity binding, then test fail-closed behavior end-to-end. Do not label the real host path DONE until this wiring is demonstrated.


### WorkPass227 — bounded independent evaluation service calls

- **DONE (code):** executor, verifier and safety scanner calls now use a configurable per-service deadline (serviceTimeoutMs, default 30 seconds, accepted range 10 ms–5 minutes). Each service receives an AbortSignal; deadline expiry aborts that signal and rejects the bounded call.
- **DONE (fail-closed behavior):** executor timeout is treated as non-executable evidence; verifier timeout cannot produce trusted binding or task success; safety-scanner timeout aborts the evaluation rather than treating missing safety results as clean.
- **DONE (regression code and wiring):** added tests/workpass227-bounded-independent-evaluation.mjs, registered test:workpass227:bounded-independent-evaluation, added the test to the continual-learning workflow's PR/push path filters and execution steps, and appended it to audit:p23:cross-source-replay.
- **IMPORTANT LIMIT:** AbortSignal is cooperative. A host executor/verifier/scanner must observe the signal and actually terminate its underlying process/request. The evaluator's deadline prevents waiting indefinitely for a response but cannot kill a non-cooperative remote process by itself. Real host adapter wiring remains OPEN.
- **Validation:** no local execution or successful GitHub Actions result is claimed in this pass; keep PR draft until the new regression and runtime typecheck actually execute successfully.
- **Next pass (WorkPass228):** integrate signal propagation into the actual host sandbox/process supervisor, guarantee process-tree termination and resource quotas, then bind cancellation/timeout receipts to run provenance and reject stale late results.


### WorkPass228 — connect cooperative cancellation to the existing process supervisor (partial)

- **DONE (code):** the existing LearningProcessSupervisor accepts an optional AbortSignal, rejects already-cancelled work before spawning, kills the supervised child on abort, and writes a distinct `cancelled` execution receipt. Receipt validation accepts the new terminal state.
- **DONE (regression code):** extended the existing process-supervisor regression to cover active cancellation and cancellation before spawn.
- **Reuse/integration:** this adapts the existing P23 process supervisor instead of introducing a competing subprocess runner. It also gives WorkPass227's evaluator deadlines a concrete host-side cancellation seam when an adapter passes the signal through.
- **OPEN:** current `child.kill('SIGKILL')` terminates the direct child only; process-tree containment and OS/container isolation remain the responsibility of a stronger host sandbox. The evaluator still needs a concrete trusted adapter that maps candidate payload/task inputs to an approved command; do not execute arbitrary generated payloads as shell commands.
- **Validation:** code and test wiring are committed; test/typecheck/CI success remains unverified in this pass.


### WorkPass229 — preserve terminal process state across cancellation races

- **DONE (code):** the existing `LearningProcessSupervisor` now records the child `close` event before resolving the run promise and ignores late abort notifications once the child has closed. This prevents an abort racing with process completion from relabeling a completed receipt as `cancelled`.
- **Reuse/integration:** this is a narrow correctness fix inside the existing P23 supervisor; no parallel runner or new authority was added.
- **PARTIAL:** the race guard is committed, but this pass has not run the targeted supervisor regression or TypeScript typecheck. A deterministic regression for close/abort ordering and actual process-tree containment remain open.
- **NEXT:** add a deterministic race regression and continue the trusted-host adapter path; process-tree/container isolation must remain explicit rather than inferred from direct-child SIGKILL.


### WorkPass230 — process-group cancellation for P23 learner runs

- **DONE (code):** on POSIX, the existing `LearningProcessSupervisor` starts each supervised command in its own process group and routes timeout, output-limit, and abort termination through group-level `SIGKILL`, so ordinary descendants in that group are terminated alongside the direct child.
- **DONE (race hardening):** timeout/abort handlers now ignore late notifications after the direct child has emitted `close`, preserving the terminal receipt state.
- **PARTIAL:** Windows still uses direct-child termination; descendants that deliberately detach or escape the process group are not contained. This is not a substitute for an OS/container sandbox. Targeted regression and runtime typecheck have not been executed in this pass.
- **NEXT:** add a descendant-process regression on POSIX, then wire the trusted host adapter to the existing ActionGateway/postcondition verifier without permitting arbitrary candidate payloads to become shell commands.


### WorkPass231 — descendant-process termination regression

- **DONE (code):** extended the existing `tests/p23-learning-process-supervisor.mjs` with a regression where a supervised parent launches a same-process-group descendant that would write a delayed marker. After the parent's bounded timeout, the test asserts the marker never appears, exercising the POSIX process-group termination path rather than only checking the direct child's signal.
- **Integration:** the existing `test:p23:learning-process-supervisor` command already includes this test file and is included in `audit:p23:cross-source-replay`; no parallel test harness or process manager was added.
- **PARTIAL:** the regression is committed but has not been executed here. Timing and process-group behavior still need confirmation in the CI runner; Windows uses direct-child semantics, and this is not a sandbox against detached/escaped descendants.
- **NEXT:** run the targeted supervisor regression and runtime typecheck, then wire the trusted host executor to ActionGateway/postcondition verification with explicit capability and path boundaries.


### WorkPass232 — snapshot command identity before asynchronous registration

- **DONE (code):** `runLearningProcess` now snapshots the scheduled-run record and command inputs (argument vector, environment entries, inherited-environment key list, and scalar command fields) before any asynchronous trusted-registration call. The command later spawned and fingerprinted can no longer be changed by mutating caller-owned objects during the registration await.
- **DONE (regression code):** added a gated registration test that mutates the original command's argument vector and executable while registration is pending; the run must execute the original snapshotted command and emit its expected output.
- **Compatibility fix:** the process-descendant regression is now POSIX-only, matching the implementation's process-group guarantee; Windows remains direct-child semantics rather than failing a test for a guarantee it does not provide.
- **PARTIAL:** source and regression are committed, but this session has not run the test or TypeScript typecheck. CI must execute the targeted supervisor test before this is considered validated.
- **NEXT:** inspect and bind the real trusted host command factory to approved capabilities and postcondition verification; continue the P23 → Hermes/Will integration through existing skill/evidence contracts, not a parallel learner.
