# NeuroCore — repository working rules

## Latest durable checkpoint — WorkPass345 (2026-10-25)

- Parametric policy restoration sanitizes all scalar diagnostics, update count, timestamp and freeze state; non-finite learner control values are rejected before mutation.
- The P26 existing learning regression aligns with the atomic-rejection contract and complements the dedicated input-integrity test.
- P23 replay config regression now verifies its configured maximum as a hard cap while preserving adaptive batch sizing and the newest/history selection invariants.
- Added the missing npm entrypoint for the existing WorkPass293 autonomous P23 revision test; prior workflow failure was solely “Missing script”.
- WorkPass344 also fixed JSON-serialized payload budgeting, causal replay fixture identity/post-state grounding and the B272 candidate-order reward saturation. Exact-head CI must confirm the expanded regression set. Release ZIP unchanged.

---

## Latest durable checkpoint — WorkPass344 (2026-10-25)

- Parametric policy training rejects invalid inputs atomically: non-finite target/rate/sample weight, invalid action and non-finite feature vector.
- Payload-budget test measures canonical JSON bytes, including the quotes added around string values.
- Cause-linked replay fixtures now provide a matching pre-action tick and explicit attributed post-action/success fields, so records should satisfy the strict runtime grounding contract instead of being silently rejected.
- B272 goal value no longer adds a reward solely because a candidate was generated later in the enumeration order; calibrated intrinsic drive has more headroom to affect the bounded score.
- WorkPass343 fail-closed cycle restore, Node strip-only compatibility, and the corrected WorkPass294 static contract assertion remain in place. Exact-head CI is still required; Release ZIP unchanged.

---

## Latest durable checkpoint — WorkPass343 (2026-10-25)

- Cycle restore now verifies persisted aggregate counter coherence before trusting the last-cycle completion flag; inconsistent counters fail closed.
- The versioned skill candidate store no longer uses constructor parameter properties that Node 24's strip-only TypeScript runtime cannot execute.
- WorkPass294's source-contract assertion matches the current gateway syntax and still checks transmission of the execution ID plus optional decision ID.
- WorkPass342 added missing runtime test script aliases; WorkPass292 has passed on that head. WorkPass287/291/294 fixes need exact-head CI confirmation. Release ZIP unchanged.

---

## Latest durable checkpoint — WorkPass342 (2026-10-25)

- Added the npm scripts already referenced by P26 Learning Validation and WorkPass291/292/294 workflows, so they invoke the actual checked-in test files instead of failing with “Missing script”.
- Replay-diversity test fixtures now explicitly report `lastAction: 'explore'` and matching `lastActionSuccess`, matching the causal stream's trusted post-state grounding rule.
- WorkPass287 now expects fail-closed reconstruction of all required phases when a persisted missing-stage list is malformed.
- WorkPass341 strict typing fixes remain in place. The latest exact-head workflows still need to verify these changes; no green claim yet. Release ZIP unchanged.

---

## Latest durable checkpoint — WorkPass341 (2026-10-25)

- Runtime type declarations are pinned and installed through the runtime lockfile; the WorkPass294 workflow installs those dependencies before typecheck.
- Core's nullable external causal record is guarded without invalid control flow; learning-process buffers and optional skill-retrieval query numbers now use strict-compatible types; trusted registration is awaited explicitly.
- Imported external causal events remain ungrounded and do not increment the trusted outcome counter. Regression expectations encode that epistemic boundary.
- Latest WorkPass340 CI exposed these concrete failures. Exact-head rerun is required; runtime typecheck is not yet claimed green. Release ZIP unchanged.

---

## Latest durable checkpoint — WorkPass340 (2026-10-25)

- Runtime typecheck has a pinned, runtime-local `@types/node` package and matching lockfile, and no longer includes the incomplete ambient Node shims in the semantic program. Strict TypeScript checking remains enabled.
- Fixed several confirmed type errors in retention configuration, skill retrieval/context indexing, intrinsic experiment filters, compound-skill base-variant counters, cognitive dependency restore typing and runtime clock registration.
- Core skips learning ingestion when an external causal record is rejected (null), and the causal-learning regression fixture now meets the explicit post-action grounding contract.
- WorkPass336–339 fixes remain in place: correlation ID regex, duplicate cognitive-cycle verifier, replay option import, and a dedicated boundary regression wired into CI.
- Exact-head workflows must confirm these changes; runtime typecheck is not yet claimed green. Release ZIP unchanged.

---

## Latest durable checkpoint — WorkPass339 (2026-10-25)

- A focused correlation-ID regression is being added and wired to execute before broader typecheck steps. It checks that malformed IDs are dropped and valid execution identity survives.
- WorkPass336 fixed the actual broken regex and duplicate cycle verifier; WorkPass337 updated runtime Node.js type discovery; WorkPass338 hardened optional causal features and verified dataset literal schema types.
- Exact-head runtime typecheck still requires a completed run. Release ZIP unchanged.

---

## Latest durable checkpoint — WorkPass338 (2026-10-25)

- Hardened causal experience restore by guarding optional policy feature arrays before access.
- Preserved the declared literal schema for verified training datasets and holdout aggregates.
- WorkPass336 fixes the malformed correlation-ID regex, removes the duplicate cognitive-cycle verifier, and corrects the learning replay-options import.
- WorkPass337 changes runtime type discovery to load pinned Node.js ambient declarations while preserving strict mode; awaiting completed exact-head CI to establish the effect. Release ZIP unchanged.

---

## Latest durable checkpoint — WorkPass337 (2026-10-25)

- Fixed runtime type discovery: `tsconfig.clean.json` now explicitly loads the pinned Node.js ambient package from the runtime-local or installed app workspace type root, without loading unrelated React globals.
- This specifically targets the observed missing Node built-in module/global declarations; strict checking remains enabled, and remaining real type errors still need to be addressed rather than suppressed.
- WorkPass336 also fixed the malformed correlation-ID regex and duplicate cycle verifier; exact-head validation is pending. Release ZIP unchanged.

---

## Latest durable checkpoint — WorkPass336 (2026-10-25)

- Fixed a malformed correlation-ID control-character regex that prevented the memory-to-action regression from loading its imported verification module.
- Removed duplicate `verifyOperationalCycle` implementation; the retained implementation validates required lineage plus optional cognitive phases.
- Corrected the learning replay-options type import so it comes from `ReplaySelectionPolicy.ts`.
- Previous exact-head Actions confirmed the universal interpreter, app typecheck/build, and verified-outcome ledger were green; the broader runtime typecheck remained red with other type/declaration errors. New-head verification is pending. Release ZIP unchanged.

---

## Latest durable checkpoint — WorkPass335 (2026-10-24)

- Filled the new `audio` modality into both the situation-model reliability defaults and Core's initial persisted multimodal state.
- The universal interpreter now typechecks its embodiment fallback record explicitly. Cached P41 perception remains age-bounded and current semantic data take precedence.
- Situation-level confidence spread now increases uncertainty rather than falsely incrementing semantic conflict; only explicit conflict markers count as conflict.
- The independent-evaluator test's duplicate declaration is repaired; the focused interpreter regression covers audio migration and conflict semantics.
- Full runtime typecheck still reports older errors in unrelated modules; new-head targeted tests must verify this change. Release ZIP unchanged.

---

## Latest durable checkpoint — WorkPass334 (2026-10-24)

- The core CI workflow now runs the universal input interpreter regression directly before app typecheck, so its own result is visible even if a separate app check fails later.
- WorkPass333 addressed observed app typecheck errors and updated signed-artifact idempotency expectations; exact-head rerun is required to confirm both.
- Interpreter now consumes fresh P41 perception, marks epistemic provenance, persists fusion state, and avoids treating confidence spread alone as semantic contradiction.
- Release ZIP remains unchanged and PR stays draft until current-head gates are validated.

---

## Latest durable checkpoint — WorkPass333 (2026-10-24)

- Fixed the app TypeScript test errors reported by Actions: typed the storage fixture callbacks and used `Reflect.deleteProperty` for optional test setup/restore.
- Aligned signed-outcome test expectations with the implementation: exact signed artifact replay is idempotent; conflicting signed outcomes for the same attempt still fail closed.
- WorkPass328–332 interpreter changes remain: canonical fusion, persisted conflict evidence, epistemic source tags, and fresh P41 perception input with age-bounded cache.
- New-head CI must confirm the two fixed gates and run the interpreter regression. Release ZIP remains unchanged.

---

## Latest durable checkpoint — WorkPass332 (2026-10-24)

- The interpreter consumes recent cached P41 vision entities/relations and audio event labels only when evidence timestamps are within a 120-second age bound, allowing at most 30 seconds of future clock skew.
- A corrected presence gate excludes entity residues with `present01 <= 0.25`.
- Current semantic vision/audio data take precedence over cached records of the same modality to avoid duplicate evidence.
- Existing unresolved P41 vision/audio requests remain explicit; stale/malformed cached records are not promoted.
- The targeted test is expanded, but exact-head execution/typecheck remains unverified. Published release ZIP unchanged.

---

## Latest durable checkpoint — WorkPass330 (2026-10-24)

- Interpreted text, vision labels, audio event labels, caller goals and incoming world events now carry explicit machine-readable epistemic markers.
- These markers separate received claims/model output from independent verification and are carried through the canonical multimodal evidence records.
- WorkPass329 also persists post-fusion state and no longer counts confidence spread alone as semantic conflict.
- Exact-head tests/typecheck remain unverified; release asset unchanged.

---

## Latest durable checkpoint — WorkPass329 (2026-10-24)

- Fusion-state persistence is now explicit: `OrganismCore.fuseMultimodalObservations()` persists the owner snapshot after the canonical fuser updates its counters.
- Confidence dispersion is no longer misreported as a semantic contradiction. Conflict metrics require explicit source/interpreter conflict evidence.
- World objects explicitly marked conflicting preserve a `world-object-conflict` evidence marker into the fused record.
- Regressions now cover durable fusion wiring and the confidence-spread-vs-conflict distinction.
- Exact-head test/typecheck is still awaiting runnable Actions evidence; release ZIP remains unchanged.

---

## Current source-stack checkpoint — WorkPass328 (2026-10-24)

- The canonical runtime now builds a bounded interpretation digest across text, vision, audio, device telemetry, world context/events, goal/appraisal signals and unverified outcome claims.
- The existing multimodal owner receives normalized per-modality evidence and performs explicit per-tick fusion; audio is an additive modality with a default-state migration for older snapshots.
- Semantic limits are explicit: raw audio samples are not a transcript, low-level visual features are not semantic scene interpretation, and success/reward fields are not independently verified evidence.
- New regression command: `npm --prefix runtime/neuro-kurisu run test:universal-input-interpreter`; it is also included in the runtime rebuild-recovered suite.
- Exact-head CI/typecheck is not yet verified. Recent Actions runner-startup failures must not be treated as a code-test failure or a pass.
- Branch `workpass328-universal-interpreter` is a source-stack change, not a release archive. The published `Neuro` asset remains WorkPass70 until a refreshed ZIP can be built, hashed, and uploaded.

---

> **New-session entry point:** read [`NEUROCORE_START_HERE.md`](NEUROCORE_START_HERE.md) and [WorkPass126 skill-store integrity report](docs/WORKPASS126_SKILL_STORE_INTEGRITY_2026-10-21.md) and [WorkPass125 repository synchronization audit](docs/WORKPASS125_REPOSITORY_SYNC_AUDIT_2026-10-21.md), then refresh the live branch head, stacked PR state, exact-head Actions status and open-work register. The active learning stack is WorkPass124 on top of WorkPass123; PR #12 is draft and unmerged. WorkPass126 hardens durable skill-store schema and payload-integrity validation; its tests and exact-head CI remain unverified. The release/metadata `main` branch is not the direct merge target for the source stack. The mission is persistent across chats; do not ask the user to restate it.

## Latest checkpoint

Read [WorkPass127 proposal authenticity report](docs/WORKPASS127_PROMOTION_PROPOSAL_AUTHENTICITY_2026-10-21.md) first. The candidate store now rejects copied or fabricated proposal objects using a module-private same-process issuance registry; successful lifecycle fixtures use signed manifest-bound artifacts. Runtime test/typecheck/CI are not yet verified, and the broader activation call-graph audit remains open.


Read [WorkPass126 skill-store integrity report](docs/WORKPASS126_SKILL_STORE_INTEGRITY_2026-10-21.md), then [WorkPass125 repository synchronization audit](docs/WORKPASS125_REPOSITORY_SYNC_AUDIT_2026-10-21.md), before resuming. Inspect the exact-head CI and run the owning tests. Active learning work is `workpass124-learning-evidence-hardening` (PR #12, draft/unmerged), stacked on `workpass123-authenticated-skill-lifecycle` (PR #11). The full source stack is based on `workpass70-source`; `main` is a separate release/metadata branch with no common ancestor reported by GitHub compare. Do not merge directly to `main`.

## Project objective

Build **NeuroCore** as one cohesive, memory-rich, learning and adaptive system. The repository retains the historical `Neuro-Kurisu` name in paths and older documents; that name is implementation lineage, not a reason to fork the architecture.

Work code-first. Prefer observable, testable behavior over architectural labels. Do not add placeholder modules, duplicate sources of truth, fake metrics, unconnected components, empty stubs, or claims of consciousness/autonomy unsupported by external evidence. Keep research candidates separate until they pass integration and regression gates.

## Canonical navigation

- `README.md`: current repository status and release gates.
- `docs/WORKPASS93_CHECKPOINT_2026-10-20.md`: latest continuation snapshot, CI evidence and prioritized unresolved queue.
- `docs/REPOSITORY_CLEANUP_AUDIT_WORKPASS72.md` plus its JSON manifest: exact content-duplicate audit; candidates are not deletion instructions.
- `docs/WORKPASS76_REPO_SURFACE_AUDIT_2026-10-19.md`: repository inventory, audit findings and open-work register.
- `runtime/neuro-kurisu/`: canonical organism/runtime implementation.
- `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts`: canonical memory store and retrieval owner.
- `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBenchmark.ts`: offline BM25-vs-candidate evaluation; it must not mutate or promote live state.
- `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalExperiment.ts`: deterministic multi-seed bootstrap sensitivity check; seeds do not train the retriever.
- `runtime/neuro-kurisu/tests/`: runtime regression tests.
- `docs/RESEARCH_INTAKE_LEDGER.md`: persistent upstream research and integration queue; update it when candidates are evaluated.
- `app/`: client/UI shell; do not implement a second organism or canonical memory owner here.
- `research/`: isolated experiments; `legacy/`: preserved historical source and provenance.
- `docs/history/`: archived reports and source records. Old `WORKPASS*`, `ROADMAP*`, and numbered pass files are historical unless a current status page links to them.

## Required workflow for a meaningful change

1. Read the current README, current handover, owning implementation, and the narrowest relevant tests before editing.
2. State the failure mode in reproducible terms. Make the smallest effective behavioral fix; avoid refactors that obscure attribution.
3. Add a regression that fails for the original defect and passes for the intended behavior. Prefer behavioral assertions over checking source text.
4. Run the owning tests and runtime typecheck. Use GitHub Actions for cross-cutting changes; cite the exact run and conclusion.
5. Inspect the resulting diff and update the current handover/changelog. Report what ran, what passed, what remains unverified, and whether observed behavior changed.
6. Do not claim recall uplift, user-level learning, device performance, production readiness, or external grounding from a unit test alone.

## Architecture and memory constraints

- Keep one canonical owner per capability. Use existing adapters rather than duplicating memory stores, action gateways, or truth/evidence records.
- Retrieval ranking currently uses BM25/lexical coverage, fuzzy matching, concept aliases, entity signals, graph/temporal signals and intent-fit. The legacy 48-dimensional hash projection is **not** a real semantic embedding and must not be reported as semantic recall.
- Retrieval should not mutate residency policy merely to calculate a signal that is not used in ranking. Explicit access, consolidation, and residency planning own vector materialization.
- A benchmark candidate and baseline must receive the same validated corpus. Truncated, malformed, duplicate or leaked data must block promotion.
- Keep sensitive data out of embedding requests; local/offline operation and sanitized remote-provider boundaries need regression tests.

## Continuous upstream research and adaptation

- Read `NEUROCORE_START_HERE.md` for the full research-intake protocol. Research applies to the whole organism and to individual subsystems; it is not restricted to a fixed list of architectures or repositories.
- Inspect primary papers, benchmark protocols/results, source code, issue discussions, licenses, release/commit history and resource assumptions. Record provenance and distinguish reproduced evidence from author claims and hypotheses.
- Map each useful mechanism to the canonical owner, current failure mode, data contracts and target budgets before changing code. Adapt upstream work; do not blindly vendor or add disconnected modules.
- Preserve license/attribution, use isolated adapters for uncertain or incompatible candidates, and test with behavioral regressions plus ablations against the same baseline/corpus.
- Record candidate URL/revision, license, mechanism, expected benefit, downside, integration boundary, test, resource cost, result and decision in a source-intake ledger. Promote only on measured benefit with invariants preserved; record rejections to avoid repeating dead ends.
- Study cross-component interactions (memory/learning, language/evidence, planning/action verification, identity/revision, embodiment/timing, persistence/recovery), not only standalone module scores.

## Cleanup / evidence policy

- Inventory imports, package scripts, workflows, manifests, tests, licenses, provenance and restore paths before deleting or moving files.
- Similar filenames are not proof of duplication. Preserve licenses, research experiments, source snapshots, binary evidence and old handovers until references and reproducibility are checked.
- Prefer a reversible archive move with link updates and a manifest over deletion. Do not turn documentation volume, test count or a passing synthetic fixture into a quality score.
- Use evidence labels precisely: `PROVEN` (externally validated), `IMPLEMENTED` (code exists), `FUNCTIONAL INDICATOR` (proxy), `OBSERVED` (measured in a stated run), `HYPOTHESIS`, `UNKNOWN`, `UNRESOLVED`, or `FAILED`.


## Verification provenance rule

Never treat a caller-provided `independentVerified` boolean, tool ACK, or copied JSON object as independent evidence. Replay/policy learning must require the exact normalized object issued by `OutcomeVerificationService` for a matching external postcondition. Keep a regression for spoofed booleans, copied tokens, late proof, and idempotent duplicate delivery in the active CI workflow.


## Strategic work and broad research mandate (2026-10-20)

Before a substantial pass, read:
- [Master strategy / brain map / risk register / release gates](docs/NEUROCORE_MASTER_STRATEGY_AND_BRAIN_MAP.md)
- [1,000-work-unit planning backlog](docs/NEUROCORE_1000_WORK_UNIT_BACKLOG.md)
- [Research intake ledger](docs/RESEARCH_INTAKE_LEDGER.md)
- [Current handover](docs/WORKPASS78_HANDOVER_2026-10-20.md) and refresh it after work.

**Broad exploration, narrow promotion:** explore relevant science and source implementations across neural architectures, cognitive science, neuroscience, memory, continual learning, causal inference, planning, distributed systems, human-computer interaction, speech, reliability, security, mobile inference and systems engineering. Preserve speculative ideas as labeled hypotheses; test incompatible candidates in isolated, comparable experiments. Integrate only when a measured benefit beats a same-budget baseline and preserves correctness, safety, privacy, license and resource invariants.

**Every work session must move the software forward.** Check the live branch SHA and latest Actions; read unfinished work; trace the canonical owner and call path; choose the highest-risk/highest-value defect; implement a behavioral fix and regression; run the narrowest valid tests plus cross-cutting CI; inspect the diff; record evidence and limitations; commit; refresh the handover and next queue. If blocked by missing hardware, registry access or secrets, continue independent work and record the exact blocker—never invent a test result.

**No artificial scale:** the 1,000 work units are planning rows, not a target for creating 1,000 files, modules, issues or commits. Split tasks only along independently testable state transitions, failure modes, contracts or evidence requirements. Reject tasks that do not correspond to a demonstrated need. The master-plan scorecard is a triage estimate until tied to raw measured data.

**Exhaustive inventory rule:** do not claim “all files reviewed” until a live path manifest, import/call graph, dynamic test-runner graph, dependency/SBOM, license inventory, source provenance and asset-hash manifest have been generated from the current commit and inspected. Prior static test coverage numbers are not a complete dynamic reachability proof.

**Brain analogy rule:** human brain mappings are explanatory analogies only. A software memory store is not a hippocampus, a language model is not a neocortex, and a scheduler is not a hypothalamus. Evaluate functions and observable behaviors, not anthropomorphic labels. Subjective consciousness remains UNKNOWN / UNRESOLVED absent independent evidence.

**Release discipline:** the product is not release-ready until real local inference, memory quality on independent holdouts, learning transfer, action verification/restart recovery, real embodiment E2E, security/privacy, target-device performance, soak, clean-room packaging and rollback gates have evidence. Passing CI on synthetic fixtures is necessary but insufficient.
