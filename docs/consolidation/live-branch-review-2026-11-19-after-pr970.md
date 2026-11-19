# NK1 live branch review — 2026-11-19 (after PR #970 and HeXis archive salvage)

## Scope and canonical line

- Repository: `ailtron1ss-rgb/NK1`
- Canonical working source: `workpass70-source`; `main` remains release/report infrastructure.
- User baseline: stable release tag `Neuro`, asset `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, release-metadata SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- Separate later prerelease: `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip`, SHA-256 `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb`; it is not the same artifact as the stable baseline.

**Archive limitation:** only Release metadata and hashes were accessible in this execution. The ZIP bytes were not materialized, so there is no extraction manifest, per-file hash comparison, or verified source-to-release parity claim.

## Live repository census

A complete paginated GitHub branch read after the selective merge returned:

- **969 branch refs**
- **953 unique HEAD commits**
- **1 exact duplicate-HEAD group** (17 names pointing to SHA `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`)
- **16 excess branch names** beyond one name per unique HEAD
- **0 protected branches** in the returned branch metadata
- **370 open PRs** in the current paginated read
- Latest source commit at the end of the archive transfer: `7126b685d946efb1bdd6c84947848249c69a76e0`

### The remaining shared-HEAD group

All 17 names point to the same commit and tree; these are aliases, not 17 different code states:

`nk1-all-branches-merge-2026-10-23`, `nk1-integration-workspace-2026-10-22`, `rebuild`, `workpass79-cognitive-rebuild`, `workpass116-seed-clustered-learning-eval`, `workpass117-verified-replay-admission`, `workpass118-multi-source-learning-integration`, `workpass119-skill-retrieval-feedback-curriculum`, `workpass120-verified-skill-revision-gate`, `workpass121-ledger-bound-promotion-proposals`, `workpass122-promotion-gate-coverage-hardening`, `workpass123-authenticated-skill-lifecycle`, `workpass124-learning-evidence-hardening`, `workpass135-durable-shadow-run-registry`, `workpass203-independent-candidate-evaluator`, `workpass206-runtime-evaluator-wiring`, `workpass313-actions-history-audit`.

Four aliases remain bases of open PRs and cannot be retired while those PRs depend on them:
- #109 → `nk1-all-branches-merge-2026-10-23`
- #91 and #86 → `rebuild`
- #124 → `workpass206-runtime-evaluator-wiring`

The other 13 names are not bases/heads of currently open PRs in this snapshot, but still require historical PR, branch ancestry, tag, workflow, ruleset, deployment and documentation-reference checks. Equal HEAD is not by itself permission to delete a ref.

## Work actually completed in this execution

### 1. PR #970 — merged

- PR: https://github.com/ailtron1ss-rgb/NK1/pull/970
- Purpose: bound own-key count in persisted affect snapshots before descriptor copying.
- Files: `EmotionAppraisalEngine.ts` and `workpass610-emotion-appraisal-restore-integrity.mjs` only (2 files, +30/-4).
- Scope review: preserves the current strict restore implementation, adds a 256-own-key ceiling before descriptor traversal, and adds root/nested oversized-record regression coverage.
- Exact PR-head Actions: **9/9 success**.
- Result: squash merged; merge commit `879a883f59439c8bdab3e4d7d9b171d6d4659780`.
- The donor branch was not deleted; this merge did not reduce the branch-ref count.

### 2. Selective salvage from PR #91 — 74-file pinned HeXis archive

PR #91: https://github.com/ailtron1ss-rgb/NK1/pull/91

The old branch was not merged wholesale because it is based on an old common commit and mixes an upstream source archive with aged NK1 runtime edits.

Verified archive provenance:
- Upstream: `QuixiAI/Hexis`
- Pinned upstream commit: `9e718951dc2a50dfcdc6f22513a1916315840132`
- **73 of 73 upstream source/license/README blobs** match the pinned upstream Git blob SHA and byte size exactly.
- The 74th file is NK1's own `SOURCE_MANIFEST.md`, which records upstream file provenance.
- All 74 paths were absent from the source tree before transfer.

Transferred, without re-encoding or rewriting blobs:
- `legacy/input-archives/hexis-selected-2026-10-24/` — 74 files, including MIT `LICENSE`, upstream `README.md`, NK1 `SOURCE_MANIFEST.md`, selected Python modules and inactive SQL reference migrations.
- Source commit: `7126b685d946efb1bdd6c84947848249c69a76e0`.
- Parent: `879a883f59439c8bdab3e4d7d9b171d6d4659780`.
- GitHub compare: **74 added / 0 modified / 0 removed**.
- No runtime module, dependency, package manifest or workflow was changed by this transfer.

Safety boundary: this is a read-only reference archive. Its Python runtime and SQL migrations are not connected to NK1 and must not be executed against NK1's database without a separately reviewed port.

## Detailed dispositions of old donor PRs

### PR #91 — Operation Omega / HeXis

108 changed paths at its old head:
- 74 archive files, now preserved on current source as described above;
- 30 runtime paths: **2 exact blob matches, 21 different blobs, 7 absent paths**;
- 1 workflow absent from current source;
- integration doc absent;
- source archive index and changelog differ.

Correction to an earlier intermediate chat update: the accurate runtime breakdown is **2 / 21 / 7**, not 2 / 23 / 5. The complete tree comparison is the authoritative count.

The runtime side contains a potentially valuable separate human-review gate for skill promotion:
- durable review inbox and compare-and-swap persistence;
- content-addressed review packet tied to candidate version, proposal, artifact and shadow evidence;
- reviewer decision bound to the exact packet/decision;
- Ed25519 signature verification against separately configured trusted public keys;
- unsigned signing-request generation that never loads the private key into NK1.

Those paths are not present in current source. However, the existing P23 store, proposal, shadow evidence and promotion gates have evolved since the donor branch. Port these behaviors as a fresh current-source aspect, with updated interfaces and tests; do not restore the stale donor files wholesale. PR #91 remains open and unmerged.

### PR #86 — Hermes donor/evidence gate

- 33 changed paths.
- Current-source blob comparison: **0 exact, 22 different, 11 absent**.
- Most runtime paths are older variants of code now further evolved in source.
- The absent paths are donor research records, WorkPass328–331 docs and donor-registry tooling/tests.
- The PR body does not establish passing exact-head validation; the reported Actions execution had no completed test steps.
- Keep Draft and use as research/provenance only until each useful behavior is independently ported and validated.

### PR #124 — restore integrity / bounded plain-data validator

- 66 changed paths.
- Current-source comparison: **5 exact, 59 different, 2 absent**.
- Its standalone `BoundedPlainData.ts` helper is not in current source, but the current P23 path uses `LearningTrustBoundary.ts` and canonical `core/PlainDataSnapshot.ts` for bounded plain-data snapshots. This is a more evolved shared trust boundary; do not add the old helper as a second owner without a demonstrated missing contract.
- Keep Draft; selectively port only regressions or invariants missing from current tests.

### PR #221 — old HMX canonical apply

- 16 changed paths.
- Current-source comparison: **1 exact, 10 different, 5 absent**.
- Current source already contains `HexisHmxCanonicalMemoryBridge.ts`, its integration test and dedicated workflow, plus later MemoryOS2/HMX projection and bitemporal work. PR #221's old `HexisCanonicalMemoryProjector` and `Nk1HmxExportAdapter` are therefore not merged wholesale.
- Treat PR #221 as historical donor material. Compare any unique export/envelope behavior against the current HMX bridge before deciding whether anything remains to port.

### PR #969 — N.E.K.O. ASR current-source port

- 10 changed paths, 1 current-source adapter port, focused tests and workflow.
- At the queried exact PR head, many repository-wide workflows had completed with failures; only a subset succeeded. This is not a passing gate and must not be merged until the failures are triaged and the exact head is revalidated against the then-current source SHA.
- The older donor PR #811 remains separate; do not merge its 342-commit-old branch wholesale.

## Existing consolidation work from parallel sessions

The following work is recorded in prior consolidation logs and was not repeated here: selective integrations #112/#131/#138; HMX/MemoryOS2 #954; Inspect ACP #958; source-group holdout #960; affect restore regression #961/#965; spatial replay guards #963; locale-neutral MemoryOS2 normalization #964; 3D kinematics #951/#957; sprite asset preservation #950; N.E.K.O. plugin documentation #952; branch census and duplicate-PR reconciliation #949. Check their merge commits and exact test evidence in the referenced prior execution logs before making release claims.

Earlier exact duplicate master-plan PRs #845/#849, #850 and #851 were closed in favor of #857/#858/#859 after tree identity and open-PR dependencies had been checked. That reduced duplicated PR work, not branch refs.

## Target branch structure

Continue with the 13 aspect domains already defined in `branch-taxonomy-and-target-structure-2026-11-18.md`: core runtime; memory/retrieval; learning/neuroplasticity; motivation/autonomy/planning; affect/personality/UserModel; embodiment/avatar; voice/speech; tools/integrations; safety/trust/governance; evaluation/observability; client/mobile/UX; infrastructure/release/operations; research/assimilation.

Use a small number of long-lived aspect branches and short task branches. Do not create new permanent workpass-number branches. Keep `main` separate from `workpass70-source`.

## Hard blockers / remaining work

1. The connected GitHub operations do not expose branch-ref deletion. No branch ref was deleted or force-moved; the 969 count is not reduced. Do not emulate deletion by force-moving a ref.
2. The October 19 Release ZIP bytes were not accessible in this run. The metadata SHA is a target for later independent download and verification, not proof that the archive contents match source.
3. Full branch-by-branch commit/patch/blob/config/import/dependency/workflow/asset review is incomplete. The live census and donor PRs above are only a current focused pass.
4. Branch retirement still needs exhaustive open/merged/closed PR head/base references, tags/releases, workflow triggers, rulesets, deployment/environment refs and downstream ancestry.
5. Any new runtime port must be rebased to the current source, tested on its exact head, reviewed for dependencies and wiring, and only then merged.

## Honest result

- Completed: one small validated runtime hardening PR merged (#970); 74 exact upstream source/reference files selectively transferred from #91; live branch/PR census refreshed; duplicate-HEAD aliases and open dependencies rechecked; old HeXis, Hermes and HMX branches compared at path/blob level.
- Not completed: global reduction to a few dozen branch refs, full line-by-line review of every branch, full October 19 ZIP byte parity, and deletion/retirement of branch refs.
- No project runtime behavior was claimed from the archived Python/SQL references, and no old runtime implementation was blindly replaced.
