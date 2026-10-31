# NeuroCore — repository working rules

> **New-session entry point:** read [`NEUROCORE_START_HERE.md`](NEUROCORE_START_HERE.md) and [WorkPass126 skill-store integrity report](docs/WORKPASS126_SKILL_STORE_INTEGRITY_2026-10-21.md) and [WorkPass125 repository synchronization audit](docs/WORKPASS125_REPOSITORY_SYNC_AUDIT_2026-10-21.md), then refresh the live branch head, stacked PR state, exact-head Actions status and open-work register. The active learning stack is WorkPass124 on top of WorkPass123; PR #12 is draft and unmerged. WorkPass126 hardens durable skill-store schema and payload-integrity validation; its tests and exact-head CI remain unverified. The release/metadata `main` branch is not the direct merge target for the source stack. The mission is persistent across chats; do not ask the user to restate it.

## Latest checkpoint

Read [the architecture import integrity fix](runtime/neuro-kurisu/scripts/lib/import-specifiers.mjs) first. The architecture audit no longer treats quoted import text as a real import: `scripts/audit-architecture.mjs` now uses the pure scanner `scripts/lib/import-specifiers.mjs`, so test fixtures that quote `import { X } from './X.ts'` no longer produce false "missing import" failures. Verified locally on `workpass70-source` @ `ad564d18`: `npm run audit:architecture` = PASS (2268 files, 634 canonical, 0 missing/cycles/leakage), `npm run test:architecture-import-scanner` = 16/16, `npm run test:world-perception-runtime-wiring` = PASS, runtime + app typecheck = PASS, app `test:scripts` = 254/254, and `tools/verify-final-release.mjs` = `ok: true` (was `ok: false`). A genuinely missing import still fails closed. Release ZIP, license gate and device/E2E gates remain open.

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
