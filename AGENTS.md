# NeuroCore — repository working rules

> **Current continuation checkpoint — 2026-11-07:** begin with the 2026-11-07 daily engineering cycle, then refresh live `workpass70-source`, open PRs and exact-SHA Actions. Current source HEAD is `189643ede8f3904dd670f0109a28b7536e894c00`; it is a moving snapshot, not a baseline. `main` remains release/metadata; do not merge source work directly into `main`. The 2026-11-06 root entry points were stale and are being refreshed through the existing documentation PR #831 branch. Historical WorkPass records remain archival.

## Current checkpoint

- PR #830 was merged externally on 2026-11-07 05:02 UTC (merge commit `26e2c823284d4238199c80cd1eb8363c5d5c8456`); its world-history restore continuity work is now in `workpass70-source`. Do not attribute that merge to this cycle.
- Live source HEAD `189643ede8f3904dd670f0109a28b7536e894c00` adds bounded HTTPS VRM/GLB remote import. Exact-SHA push Actions: 7/7 success (runs 42341468790, 42341468836, 42341468820, 42341468833, 42341468783, 42341468784, 42341468785).
- PR #838 remains open/draft. Its existing memory optimization is being extended with a SharedArrayBuffer regression on head `cc27cd02a06d90d0578102306e0456f6e0ab743c`; exact-head Actions completed 5/5 successfully on exact head `cc27cd02a06d90d0578102306e0456f6e0ab743c`. Do not merge it.
- Latest published ZIP metadata remains the 2026-10-19 Hotfix prerelease (136,354,713 bytes; SHA-256 `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`); this run could not fetch the binary. No 2026-11-07 source parity or new Release is claimed.
- License review/redistribution approval remains pending. RU/EN independent holdout, phone soak, licensed 3D asset and real autonomy evidence remain open gates.

## Non-negotiable engineering workflow

1. Read the current README, handoff, owning implementation and narrowest relevant tests.
2. Reproduce the failure mode and make the smallest effective behavior change; avoid broad refactors that obscure attribution.
3. Add a regression that fails before the fix and passes after it. Prefer behavioral assertions.
4. Run owning tests, typecheck and exact-head GitHub Actions. Report the SHA and conclusions.
5. Inspect the final diff and update the handoff/changelog. Distinguish implemented, connected, tested and released.
6. Never claim recall uplift, device performance, autonomous initiative, production readiness, external grounding or release parity without the corresponding independent evidence.
7. Preserve useful branches and history. Do not delete branches as part of cleanup without explicit user direction.
8. Do not create external databases, paid services, secrets or schemas without an explicit architecture/credential decision.

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
- `engineering-os/aspects.v1.json`: canonical machine-readable registry of the 75 development aspects (10 domains, 6 waves) with owners, dependencies, verification gates and fail-closed status; `docs/NK1_75_ASPECTS_EXECUTION_BACKLOG_RU.md` is its human-readable projection; `npm run aspects:validate` / `npm run aspects:next` / `npm run aspects:report` operate it.
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

## NeuroK agent write-freshness gate

- Before an agent edits a claimed file, capture SHA-256 snapshots for every source/context file it relied on and include them in the coordinator claim read-set. The CLI accepts this manifest with `--readSetFile FILE`.
- Immediately before patch creation/application, run `npm run neurok-os:claims -- verify --task TASK_ID --agent AGENT_ID`. A stale, missing, or unverified read-set blocks the write; refresh context and reacquire/renew the claim.
- Claims without read-sets are not freshness-verified. The coordinator is advisory until the isolated patch executor enforces this gate; never bypass it on protected or shared files.

- Generate the dependency manifest with `npm run neurok-os:snapshot -- --paths src/a.ts,src/b.ts --out .neurok-os/read-set.json`; then include it in `npm run neurok-os:claims -- claim ... --readSetFile .neurok-os/read-set.json`. Re-run `verify` immediately before editing; a moved base SHA also invalidates the claim.
