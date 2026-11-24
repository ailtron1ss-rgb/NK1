# NK1 branch consolidation — live review checkpoint (2026-11-19)

## Scope and safety

This is an evidence checkpoint for the consolidation work. It does not authorize branch deletion, force-push, PR closure, or broad source merges. The canonical code line remains `workpass70-source`; `main` is not a substitute for that source line.

## Live repository snapshot

Direct paginated GitHub API inventory collected on 2026-11-19:

- Branch refs: **1,038**.
- Unique branch HEAD commits: **947**.
- Exact duplicate-HEAD groups: **12**.
- Extra branch names within those groups: **91**.
- Protected branch flags returned by this branch inventory: **0**.
- Current `workpass70-source`: `aa2b385153ddc316eadf61f87e2c0803d7d59d98`.
- Current `main`: `9a789ee1af8fdaa3826dbc734d18e2fc00cde5bf`.

Prefix counts: root/unprefixed 334; `aspect/` 229; `fix/` 179; `work/` 161; `feature/` 46; `docs/` 28; `feat/` 15; `integrate/` 10; `audit/` 6; `cline/` 5; `planning/` 4; `research/` 4; `architecture/` 2; `consolidation/` 2; `optimization/` 2; `rebase/` 2; and one each for `automation/`, `ci/`, `compat/`, `experiment/`, `jules/`, `nk1/`, `perf/`, `typescript/`, and `verify/`.

The exact branch inventory is recorded in `branch-inventory-2026-11-19.jsonl`; duplicate tips and their names are recorded in `duplicate-head-groups-2026-11-19.md`.

## PR-reference graph

The 2026-11-19 PR census JSON contains 942 PR records: 412 open, 313 merged, and 217 closed without merge.

Cross-referencing all 1,038 branch names against every recorded PR head and base ref gives:

- **932** branch names occur in at least one PR head/base reference.
- **106** branch names do not occur in the PR census's head/base fields.
- **87** distinct branches are bases of currently open PRs.
- **411** distinct branches are heads of currently open PRs.

The 106 names absent from PR head/base fields are *not* approved for deletion. They still require checks against downstream branch ancestry, tags, workflow triggers, repository documentation, release and deployment references, rulesets, and external references. Any branch currently used as the base of an open PR must be retained until its dependents are safely retargeted or closed with preserved rationale.

## Duplicate interpretation

Identical HEAD SHA proves the refs point to the same commit object and tree at their tips. It does not erase PR provenance, historical head/base use, workflow references, or branch ancestry.

The largest group contains 81 branch names pointing to `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`. The other 11 groups each contain two branch names. These are ref-alias candidates, not 91 independently different implementations. The 81-ref tip is an old ancestor of the canonical source according to the existing ancestry audit; it must not be confused with 81 independent patches.

Before any ref cleanup, finish an exhaustive per-ref dependency check and preserve the source SHA, selected canonical name, PR references, and evidence in an append-only disposition ledger.

## October 19 release baseline

The user-designated project baseline is the actual Release asset:

- Tag: `Neuro`
- Asset: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`
- Published size: **135,290,615 bytes**
- Published SHA-256 metadata: `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`
- Release URL: https://github.com/ailtron1ss-rgb/NK1/releases/tag/Neuro

The ZIP bytes could not be materialized through the connected GitHub/file tools in this pass. The asset hash therefore remains a published metadata value, not an independently recomputed checksum. No extraction manifest or byte-level parity claim is made.

Important tag/tree distinction: the `Neuro` tag points to commit `c2e8e4a78431734612f89318e79d3491643f24f3`, whose recursive Git tree contains only seven entries. The current source tree has 11,000 recursive entries. The tag commit is therefore not a substitute for the Release ZIP as the October 19 project snapshot. The ZIP must be obtained and checked independently: archive SHA-256, safe extraction manifest, per-path size/SHA-256, file modes, symlinks, LFS/submodule pointers, and binary asset comparison.

## Verified consolidation examples

### PR #951 — 3D skeletal kinematics

- Merged into `workpass70-source`; merge commit/current source result: `aa2b385153ddc316eadf61f87e2c0803d7d59d98`.
- Exact PR head: `0a289c1ddc4c19da4def7409b4e28ef85cb6854c`.
- Eight changed files were compared against the current source by Git blob SHA; **8/8 match exactly**.
- 44 PR-triggered workflow runs on the exact head completed successfully; core regression run `44462043694` passed.
- Disposition: already integrated. Do not transplant or re-merge this payload. Keep the source branch ref as provenance until branch-reference cleanup is independently cleared.
- Scope remains bounded 3D FK/IK math; runtime actuator/OrganismBus wiring and physical embodiment were explicitly not included.

### PR #953 — HMX / MemoryOS2 semantic projections

Current live state at review time:

- Open Draft; head `fbab11da4e07a09282b8cb043904a05a4f638663`.
- Base recorded by the PR: `workpass70-source` at `9742b5a82966e11ba9c913074615b2420736bcee`.
- Current source is two commits ahead of that base at `aa2b385153ddc316eadf61f87e2c0803d7d59d98`; compare reports 22 commits ahead / 2 behind, so this is a divergent branch that must be reconciled, not blindly merged.
- 22 changed files: **2,668 additions / 113 deletions**.
- 50/50 PR-triggered workflow runs associated with the exact head completed successfully. Dedicated evidence includes:
  - `44463425527` — memory projection/retrieval integrity; multi-timescale/semantic graph tests, explicit-forget projection tests, restore and retrieval tests, runtime typecheck all succeeded.
  - `44463425096` — semantic retrieval path evaluation; dependency install, runtime typecheck, isolated-snapshot benchmark and local-provider CLI contract all succeeded.
  - `44463425350` — canonical HMX memory bridge; typecheck, HMX staging/protection/idempotent apply and adaptation-contract tests all succeeded.
  - `44463425515` — bitemporal memory; temporal, restore/lifecycle/lineage, metadata/semantic/cross-lingual tests and typecheck all succeeded.
- The current diff is not test-only despite the PR body saying production implementation is not included. It changes runtime behavior in `MemoryOS2`, `MemoryFabric`, `MultiTimescaleMemory`, `SemanticMemoryGraph`, `P62MemoryFabric`, `MemorySubstrateCoordinator`, and `HexisHmxCanonicalMemoryBridge`, adds two workflows, four docs/scripts/benchmark artifacts, and new/updated tests.
- Blob comparison against current source found **12 existing changed files with different blob SHAs** and **10 branch-only new files**. These deltas are not duplicates of the source. The runtime files must be reconciled against the two newer source commits, preserving the current bitemporal MemoryOS2 implementation and the post-base package/source changes.
- Review notes: the intended design makes MemoryOS2 the canonical owner and SemanticMemoryGraph/MultiTimescaleMemory derived read models; HMX cluster import is bounded and writes through the canonical memory bridge; explicit forget removes derived projections and P62 recall frames. The passing workflows are meaningful evidence, but they do not replace source-head reconciliation or a semantic review of all 22 files.
- Disposition: retain as a high-value memory-domain integration candidate; keep Draft until rebase/reconciliation, line-level review and exact-head CI are repeated on the reconciled source. No merge is authorized by this checkpoint.

## Immediate consolidation order

1. Obtain the exact October 19 ZIP bytes and create an immutable archive/path/blob manifest.
2. Complete full PR head/base, tags, workflow, deployment, ruleset, and downstream-dependency joins for every branch ref.
3. Review each of the 12 duplicate-HEAD families and retain a canonical ref for every family; only propose alias cleanup after every reference has a documented disposition.
4. Review code-bearing branch clusters by complete patches, file/blob SHA, imports/call sites, DI/registration, environment variables, dependency/lockfile changes, workflows, documents, URLs and binary assets.
5. Consolidate into a small set of durable aspect branches aligned to the 13-domain taxonomy; use task branches only as short-lived reviewed inputs. Preserve old commits and source provenance.
6. For every integration, run the focused tests and relevant regression/holdout gates at the exact resulting HEAD. Update the status ledger to distinguish implemented, connected, tested, integrated and released.

## Changes made in this review

- No application/runtime file changed.
- No source branch or `main` history rewritten.
- No branch deleted or force-updated.
- No open PR merged or closed.
- This report is documentation-only and records the live evidence and review disposition above.

### Additional PR #953 code-review note

- File: `runtime/neuro-kurisu/src/organism/memory/MemorySemanticRetrievalBenchmark.ts:22`.
- `normalizeQuery` uses doubled regex escapes (`\\\\p` and `\\\\s` in the source literal), unlike the correct single-backslash Unicode property and whitespace escapes in `MemoryRetrievalBenchmark.ts:124`.
- Impact is limited to the optional query-evidence HMAC digest normalization; it does not change retrieval ranking or the benchmark result metrics. Query-equivalent strings with punctuation/spacing differences may receive different digests.
- A top-level review checkpoint was posted to PR #953 (comment ID `7000561568`) asking for the single-backslash regex form and a test.
- A separate concern that the 1,600-row corpus cap silently caused a false fingerprint was investigated and **not** retained as a finding: the underlying `runMemoryOS2RetrievalBenchmark` marks truncation as `corpusIntegrity.validForPromotion=false`, which makes `structurallyValid` false and rejects the semantic benchmark before either arm is run.

### PR #953 recheck after head advanced (2026-11-19)

A later recheck found that PR #953 advanced from `fbab11da4e07a09282b8cb043904a05a4f638663` to `aea2581db1323c447d1e2fa2fb495ce443552a34`, adding the graph-only orphan forget regression. The source remains `aa2b385153ddc316eadf61f87e2c0803d7d59d98`; compare is now 23 commits ahead / 2 behind from merge-base `9742b5a82966e11ba9c913074615b2420736bcee`.

The updated head's Actions query returned 50 completed runs: **49 success, 1 failure**. Failed run `44464420507` job `memory-projection-integrity` fails at the test step `Explicit forget and source-isolated projection integrity`; later steps are skipped. The new test fails because `MemoryFabric.applyLifecycleCommand()` calls `this.semanticMemory.removeCanonicalProjection(command.id)` but discards its boolean return. The `applied` predicate considers only canonical MemoryOS deletion, MultiTimescale projection deletion, and P62 recall-frame deletion. If the graph projection is the only remaining copy, it is removed but the command returns `false`. Fix by retaining that return value (e.g. `semanticProjectionRemoved`) and including it in the `applied` predicate; preserve the repeat-forget no-op assertion.

A second PR comment was posted with this exact finding (comment ID `7000580175`). The PR remains Draft and must not merge until the fix is committed and the focused workflow passes on the new exact head. The earlier 50/50-green CI evidence applies only to the previous head `fbab11d...`, not to this newer revision.

The PR body still says production implementation is not included, although the 22-file diff contains production runtime changes. Its scope description should be corrected before review/merge.

