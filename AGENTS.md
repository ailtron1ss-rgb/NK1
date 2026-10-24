# NeuroCore — repository working rules

> **New-session entry point (updated 2026-10-24):** Read [the project map and ordering policy](docs/PROJECT_MAP_AND_ORDERING.md) first, then [NEUROCORE_START_HERE.md](NEUROCORE_START_HERE.md) as a historical continuation ledger. Refresh the exact live branch SHA, diff, open PRs and Actions status before coding. Do not treat a WorkPass number, an old checkpoint, or a newer timestamp as proof of ancestry/completeness. The observed `integration` and `operation-omega-hexis-2026-10-24` tips diverged; compare and port deliberately rather than merging whole histories. The newest release asset observed on 2026-10-24 was still WorkPass70 dated 2026-10-19; branch commits do not refresh that ZIP.

## Latest checkpoint policy

The first checkpoint in a handover file is a navigation aid, not live GitHub state. Treat branch names, PR numbers, CI outcomes, integration claims and release status inside prior checkpoints as **unverified until refreshed against GitHub**. Work code-first, retain exact evidence, and record any blocker without inventing a test result.

## Project objective

Build **NeuroCore** as one cohesive, memory-rich, learning and adaptive system. The repository retains the historical `Neuro-Kurisu` name in paths and older documents; that name is implementation lineage, not a reason to fork the architecture.

Work code-first. Prefer observable, testable behavior over architectural labels. Do not add placeholder modules, duplicate sources of truth, fake metrics, unconnected components, empty stubs, or claims of consciousness/autonomy unsupported by external evidence. Keep research candidates separate until they pass integration and regression gates.

## Canonical navigation

- [`docs/PROJECT_MAP_AND_ORDERING.md`](docs/PROJECT_MAP_AND_ORDERING.md): current repository map, branch ancestry rules, release-artifact boundaries and safe documentation/archive order.
- `README.md`: top-level entry point; its continuation snapshots may be historical.
- `NEUROCORE_START_HERE.md`: accumulated handovers; refresh pointers and status live before relying on them.
- `docs/NEUROCORE_MASTER_STRATEGY_AND_BRAIN_MAP.md`: strategic direction and cognitive architecture.
- `docs/NEURO_KURISU_FULL_RELEASE_BACKLOG_CANONICAL.md`: long-term backlog; reconcile items with current code before executing.
- `docs/RESEARCH_INTAKE_LEDGER.md`: upstream research candidates and integration decisions.
- `docs/CROSS_BRANCH_INTEGRATION_INVENTORY.md` and `docs/INTEGRATION_WORKSPACE.md`: branch reconciliation inventory and historical integration constraints.
- `docs/BRANCH_INVENTORY_2026-10-24.md`: dated 104-ref branch-name snapshot and selected divergence evidence; refresh before ref cleanup.
- `docs/OPERATION_OMEGA_HEXIS_INTEGRATION_2026-10-24.md`: pinned Hexis source provenance and NK1 adaptation boundary.
- `runtime/neuro-kurisu/`: canonical organism/runtime implementation.
- `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts`: canonical memory store and retrieval owner.
- `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBenchmark.ts`: offline BM25-vs-candidate evaluation; it must not mutate or promote live state.
- `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalExperiment.ts`: deterministic multi-seed bootstrap sensitivity check; seeds do not train the retriever.
- `runtime/neuro-kurisu/tests/`: runtime regression tests.
- `app/`: UI and delivery shell; do not implement a second organism or canonical memory owner here.
- `contracts/`: ownership, contracts, schemas, source provenance and SBOM.
- `tools/` and `scripts/`: project audits, maintenance, verification and release automation.
- `tools/audit-markdown-links.mjs` plus its regression test: local Markdown/HTML link audit; use `npm run audit:canonical-links` as the strict navigation gate.
- `docs/architecture/module-dependency-contracts-ru.md`: target dependency directions and boundaries. Its tests establish only the rules they actually exercise; check exact-head Actions before calling the audit green.
- `research/`: isolated research candidates; `legacy/`: preserved historical source/provenance.
- `docs/history/` and `docs/reports/`: historical and detailed records; old pass reports are not current status unless explicitly linked from a current handover.

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
