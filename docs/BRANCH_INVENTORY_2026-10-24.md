# NK1 branch inventory — snapshot 2026-10-24

**Snapshot method:** GitHub branch search, all returned pages.  
**Initial snapshot:** 104 refs were returned by the first all-page branch query, including `workpass331-project-ordering-20261024`. A later all-page live refresh at approximately 2026-10-24 20:24 UTC returned **124 unique refs**; the 20 additional names and their selected live heads are recorded in §5.  
**Important limitation:** this is a dated name/head inventory, not a verdict that each branch is current, merged, tested, safe to delete, or part of the release. Refresh live state before any merge or retirement.

## 1. Branches by family

### Stable / integration / rebuild (3)
- `main`
- `integration`
- `rebuild`

### Functional feature branches (9)
- `feature/emotions`
- `feature/experiments`
- `feature/feedback`
- `feature/learning`
- `feature/memory`
- `feature/perception`
- `feature/personality`
- `feature/useful-functions`
- `feature/visual-embodiment`

### Named integration / governance / topical streams (5)
- `nk1-all-branches-merge-2026-10-23`
- `nk1-integration-workspace-2026-10-22`
- `nk1-skill-promotion-gate-20261024`
- `operation-omega-hexis-2026-10-24`
- `planning/master-audit-roadmap`

### Architecture and optimization streams (2)
- `architecture/dependency-contracts-2026-10-24`
- `optimization/deep-pass-2026-10-24`

### WorkPass implementation / evidence streams (85)
- `workpass70-source`
- `workpass71-learning-eval-paired-seeds`
- `workpass71-learning-integrity`
- `workpass73-audit-fixes`
- `workpass79-cognitive-rebuild`
- `workpass79-learning-input-integrity`
- `workpass86-prioritized-replay`
- `workpass87-cleanrl-eval-protocol`
- `workpass88-avalanche-forgetting-metrics`
- `workpass89-avalanche-transfer-metrics`
- `workpass90-river-adaptive-drift`
- `workpass91-river-page-hinkley`
- `workpass92-river-drift-benchmark`
- `workpass93-hermes-reflective-learning-gate`
- `workpass94-avatar-voice-live2d-audit`
- `workpass116-seed-clustered-learning-eval`
- `workpass117-verified-replay-admission`
- `workpass118-multi-source-learning-integration`
- `workpass119-skill-retrieval-feedback-curriculum`
- `workpass120-verified-skill-revision-gate`
- `workpass121-ledger-bound-promotion-proposals`
- `workpass122-promotion-gate-coverage-hardening`
- `workpass123-authenticated-skill-lifecycle`
- `workpass124-learning-evidence-hardening`
- `workpass135-durable-shadow-run-registry`
- `workpass150-hermes-adapter-verified-lifecycle`
- `workpass151-hermes-p23-learning-diagnostics`
- `workpass152-hermes-evidence-binding`
- `workpass153-hermes-binding-scope-hardening`
- `workpass154-hermes-promotion-gate`
- `workpass155-hermes-directed-skill-evolution`
- `workpass156-hermes-revision-to-candidate`
- `workpass157-hermes-revision-generator-wiring`
- `workpass158-hermes-repair-observation-to-variant`
- `workpass159-hermes-repair-deduplication`
- `workpass160-hermes-repair-ledger-dedup`
- `workpass161-hermes-holdout-promotion-isolation`
- `workpass162-hermes-verified-nonholdout-evidence`
- `workpass163-hermes-evidence-state-migration`
- `workpass164-hermes-promotion-api-gate`
- `workpass165-hermes-holdout-neutral-confidence`
- `workpass166-hermes-compound-holdout-isolation`
- `workpass167-hermes-compound-execution-path`
- `workpass168-hermes-runtime-compound-skill-bridge`
- `workpass168-hermes-runtime-compound-skill-bridge-test`
- `workpass169-hermes-runtime-repair-observation-bridge`
- `workpass170-hermes-repair-loop-runtime-correction`
- `workpass171-hermes-repair-evidence-p23-bridge`
- `workpass172-hermes-compound-revision-orchestrator`
- `workpass194-cross-source-verified-replay-consolidation`
- `workpass195-cross-source-affective-goal-replay`
- `workpass197-cross-source-skill-transfer-safety`
- `workpass198-cross-source-evidence-balanced-learning`
- `workpass199-production-affective-goal-replay`
- `workpass200-correct-replay-novelty-signal`
- `workpass201-continuous-outcome-salience`
- `workpass202-verified-replay-count-bridge`
- `workpass203-independent-candidate-evaluator`
- `workpass206-runtime-evaluator-wiring`
- `workpass286-multiscale-brain-system-plan`
- `workpass303-conflict-resolution-safe-additions`
- `workpass304-merge-cognitive-architecture-map`
- `workpass305-merge-microcycle-attribution`
- `workpass306-integrate-plan-contract-tests`
- `workpass307-integrate-regression-tests`
- `workpass308-integrate-organism-runtime-revision-loop`
- `workpass309-integrate-core-and-causal-evidence`
- `workpass310-integrate-p23-coordinator-learning-substrate`
- `workpass311-wire-regression-scripts`
- `workpass312-bound-reflective-candidate-payload`
- `workpass313-actions-history-audit`
- `workpass313-bind-decision-linked-outcomes`
- `workpass314-thread-decision-ticket-through-gateway`
- `workpass315-document-integrated-learning-passes`
- `workpass316-persist-source-evidence-fingerprint`
- `workpass317-expand-revision-coordinator-regressions`
- `workpass318-document-provenance-regressions`
- `workpass318-repair-evidence-lineage`
- `workpass326-ci-runtime-hardening`
- `workpass328-upstream-donor-gate`
- `workpass329-hexis-assimilation`
- `workpass330-cross-method-evidence-integrity`
- `workpass330-independent-evidence-receipts`
- `workpass331-project-ordering-20261024`
- `workpass331-unified-cognitive-kernel-2026-10-24`

## 2. Selected branch heads inspected

| Branch | Head SHA | Commit time (UTC) | Current interpretation |
|---|---|---|---|
| `main` | `84119539afca904a91d5617b86ae334917a9e578` | 2026-10-22 15:58 | Release/metadata-oriented root; not a proxy for newest runtime source |
| `integration` | `cb0872f77c63396799a81b8e9a469b4fa6ddc936` | 2026-10-24 11:43 | Integration workspace; diverges from newer source streams |
| `rebuild` | `82ea7a8b7c9b036e65c8b056acedd1176952dd8f` | 2026-10-23 06:14 | Dedicated rebuild/integration line; compare before importing |
| `operation-omega-hexis-2026-10-24` | `acbada2ff00092927070fce83d59871110dcd8a0` | 2026-10-24 14:03 | Hexis adaptation stream; basis of this documentation PR |
| `workpass331-unified-cognitive-kernel-2026-10-24` | `5f318ad801f30ddd82150ed6be56baafc1c567a9` | 2026-10-24 18:24 | Later unified-kernel stream; includes the operation branch ancestry plus additional changes |
| `architecture/dependency-contracts-2026-10-24` | `c00565694c96c1b4a721fbdcd6e286e0177d1a34` | 2026-10-24 19:27 | Separate dependency-contracts stream; small diverged change set |
| `optimization/deep-pass-2026-10-24` | `19f64b1ae985e579795b4ef054fd3fb58259a336` | 2026-10-24 19:26 | Separate optimization stream; small diverged change set |
| `workpass330-independent-evidence-receipts` | `1c380670469b7207e32a4dfc7bb613498621c410` | 2026-10-24 10:13 | Evidence work stream; branch name alone does not establish whether its changes reached other streams |

## 3. Comparisons that determine safe integration

- `integration` → `operation-omega-hexis-2026-10-24`: `diverged`; comparison returned 39 commits on the operation side and 17 on the integration side not shared by the other. Do not merge the full histories blindly.
- `operation-omega-hexis-2026-10-24` → `workpass331-unified-cognitive-kernel-2026-10-24`: `ahead`, 61 commits, 0 behind. The unified-kernel branch includes the operation branch ancestry and advances it.
- `integration` → `workpass331-unified-cognitive-kernel-2026-10-24`: `diverged`; comparison returned `ahead_by=100`, `behind_by=17`, and 135 changed paths. Treat this as a large reconciliation, not a safe fast-forward based on name or timestamp alone.
- `workpass331-unified-cognitive-kernel-2026-10-24` → `optimization/deep-pass-2026-10-24`: `diverged`; six commits are unique to the optimization stream and four paths differ in the comparison.
- `workpass331-unified-cognitive-kernel-2026-10-24` → `architecture/dependency-contracts-2026-10-24`: `diverged`; two commits are unique to the architecture stream and two paths differ in the comparison.

These compare summaries are snapshot evidence, not a complete content-level review of all branches. In particular, "ahead" does not mean tests passed or a PR was merged.

## 4. Safe use of this inventory

1. Before integrating a candidate, refresh its head SHA and live PR/Actions state.
2. Compare it with the exact chosen target; inspect each changed path, not only the commit count.
3. Identify overlapping contracts, runtime owners, migrations, tests and release files before cherry-picking or porting.
4. Preserve licenses, source manifests and historical branches until their unique content and downstream references are accounted for.
5. Update this inventory or replace it with a generated branch manifest after the next broad reconciliation.
6. Do not delete a branch solely because its name is old, its pass number is lower, or it appears behind another branch.

## 5. Additional refs found by live refresh (2026-10-24 ~20:24 UTC)

The subsequent all-page branch search returned 124 unique names, 20 more than the initial grouped snapshot in §1. These heads came from independent active streams, including work happening in parallel. A newer commit timestamp or a WorkPass label does not mean the change is present in the unified-kernel branch.

| Newly observed branch | Head SHA | Commit time (UTC) | Last commit summary |
|---|---|---|---|
| `architecture/unified-cognitive-cycle-closure-2026-10-24` | `20b7bd6962adbfd946cb20491e0eb4ba094dc70f` | 2026-10-24 19:35:32 | Documents fail-closed restoration rules |
| `compat/avatar-storage-strict-types-20261024` | `483f8cc546859f7eaaea447e9ac894110f613cb6` | 2026-10-24 20:11:55 | Guards rejected evidence and corrects causal test contracts |
| `feature/emotional-continuity-20261024` | `b3605ab5b2d06ea086855a919fc3e65c75fd3068` | 2026-10-24 20:19:52 | Records affect bridge contract test |
| `local-small-model-integration-2026-10-24` | `1810bb15d9762b071f6584f9b233fd3f86529db5` | 2026-10-24 20:20:24 | Aligns live emotion API smoke with uncertainty caveat |
| `mem0-integration-workpass1` | `91d7daf5db14794fd046ac173e23b4114ae0fe24` | 2026-10-24 20:04:48 | Fixes control-character regex in correlation IDs |
| `operation-omega-hexis-deep-pass-2026-10-24` | `2057cf6f3b2bc2794aeae5565d7f17bc17f105fe` | 2026-10-24 20:17:53 | Records P68 paused-goal and capacity repair |
| `optimization/process-supervision-20261024` | `c545712267608779f11d43cc68990a277aba093b` | 2026-10-24 20:22:46 | Records gateway partial-response safety |
| `typescript/runtime-typecheck-truth-2026-10-24` | `0c71f17dbf8e1bbe28efebeb37560d1d253d5376` | 2026-10-24 20:23:26 | Wires WorkPass292/293 evidence revision test scripts |
| `workpass319-internal-dialogue-2026-10-24` | `f1e018a92096b39e5ea0ab91aa59973c97c45f9a` | 2026-10-24 20:09:39 | Documents internal-dialogue calibration fixes |
| `workpass328-closed-loop-failure-closure-2026-10-24` | `ffc4a8306cb07f906e1f4238000a383c397f6cf4` | 2026-10-24 20:23:16 | Protects unsaturated endogenous-goal scoring |
| `workpass328-letta-memory-bridge` | `02c2ceb2bd6a8f3e36843f0d49ad87ac650b6858` | 2026-10-24 20:11:15 | Corrects provider-failure pattern boundaries |
| `workpass328-universal-interpreter` | `a7eddeae35d61e0fd9446a01bbca8534cfde1f03` | 2026-10-24 20:16:29 | Closes audio-migration and interpreter typing gaps |
| `workpass331-project-ordering-unified-20261024` | `2e0bf02870496ddfaed58afd3ea853090df7fd32` | 2026-10-24 20:23:50 | Refreshes inventory evidence pointer |
| `workpass332-live-runtime-kernel-2026-10-24` | `bcbcc6fe94eb923bf05b00f4dd578d0dfa30f089` | 2026-10-24 19:43:51 | Gates supported runtime versions and startup preflight |
| `workpass334-inner-imperative-homeostasis-2026-10-24` | `6bb8d55d5b9dcf8c541ec0995c63f0a3210f336f` | 2026-10-24 20:22:25 | Drives app and Live2D from canonical appraisal state |
| `workpass335-hermes-host-owned-evaluator-2026-10-24` | `6e27207cc033367946a04090a22397a8944edd05` | 2026-10-24 20:24:05 | Rebases Hermes/P23 integration onto WorkPass344 appraisal runtime |
| `workpass335-paired-seed-growth-2026-10-24` | `3b2c5e95fad90f39f44ea4fe7b093eed6fc52f3b` | 2026-10-24 20:21:49 | Records TypeScript compatibility fix |
| `workpass526-autobiographical-recall-intent` | `52d3410c6a126eb56fe30c368babb55726eea187` | 2026-10-24 19:47:59 | Documents conversation-backed recall ranking |
| `workpass526-personality-core-hardening-2026-10-24` | `7600bb9256209296055e97adf296c0437bcfd6ec` | 2026-10-24 19:57:28 | Records live personality feedback and B272 causal-gate result |
| `workpass528-bilingual-conversation-recall` | `9d85cbfff9a41f52405e4b0da6849758a129d574` | 2026-10-24 19:50:08 | Runs recall regression in P26 CI |

This refresh shows why the repository should not be organized by branch suffix alone: distinct streams are touching related areas such as affect, memory, runtime typing, Live2D and Hermes/P23. Before importing any one of them, compare its current head against the chosen base, inspect changed paths and conflicts, and record the target tests. None of these 20 streams is declared integrated merely because it appears in this inventory.

## 6. Compare the additional streams against the selected unified-kernel base

**Comparison base at observation time:** `workpass331-unified-cognitive-kernel-2026-10-24` at `5f318ad801f30ddd82150ed6be56baafc1c567a9`. The comparison below was queried live during this ordering pass after the branch-name refresh. Ahead/behind counts are ancestry evidence only; they do not certify CI, correctness, PR review or safe automatic merge.

| Branch | Compare status | Ahead | Behind | Changed paths in compare | Reconciliation guidance |
|---|---|---:|---:|---:|---|
| `architecture/unified-cognitive-cycle-closure-2026-10-24` | diverged | 30 | 100 | 14 | Selectively review initiative/cycle code and tests; preserve current kernel changes |
| `compat/avatar-storage-strict-types-20261024` | diverged | 11 | 100 | 22 | Review app storage tests and runtime type-shim overlaps before porting |
| `feature/emotional-continuity-20261024` | diverged | 61 | 100 | 22 | Review avatar/affect/runtime API contracts together; do not import the full branch history |
| `local-small-model-integration-2026-10-24` | diverged | 108 | 100 | 29 | Broad vision/runtime/loader stream; compare changed source files and runtime tests individually |
| `mem0-integration-workpass1` | diverged | 59 | 100 | 17 | Keep Mem0 adapter isolated; review memory ownership and package changes before porting |
| `operation-omega-hexis-deep-pass-2026-10-24` | diverged | 96 | 61 | 15 | Hexis/goals/memory stream; preserve its provenance and cherry-pick only isolated compatible work |
| `optimization/process-supervision-20261024` | ahead | 95 | 0 | 34 | Descends from the selected base, but still requires exact-head checks and overlapping-file review |
| `typescript/runtime-typecheck-truth-2026-10-24` | diverged | 53 | 100 | 29 | Review runtime typecheck and test-script wiring with package-lock/package.json changes |
| `workpass319-internal-dialogue-2026-10-24` | diverged | 26 | 100 | 8 | Review dialogue engine, language organ and tests as one unit; current branch history differs |
| `workpass328-closed-loop-failure-closure-2026-10-24` | diverged | 114 | 100 | 31 | Failure-closure/P23/runtime changes overlap core and learning; do not merge wholesale |
| `workpass328-letta-memory-bridge` | diverged | 71 | 100 | 14 | Review Letta adapter, memory runtime/fabric and provider policy as one contract |
| `workpass328-universal-interpreter` | diverged | 8 | 100 | 15 | Universal interpreter touches multimodal input and core; inspect import path and tests |
| `workpass331-project-ordering-unified-20261024` | ahead | 99 | 0 | 26 | This ordering branch descends from the selected base; its final current head will continue to advance during this PR |
| `workpass332-live-runtime-kernel-2026-10-24` | ahead | 19 | 0 | 15 | Descendant of the selected base; compare runtime orchestration/tests and verify exact-head checks |
| `workpass334-inner-imperative-homeostasis-2026-10-24` | ahead | 32 | 0 | 23 | Descendant of the selected base; review appraisal, controller and avatar/state wiring together |
| `workpass335-hermes-host-owned-evaluator-2026-10-24` | ahead | 36 | 0 | 35 | Descendant of the selected base; review evaluator authority, P23 promotion and tests as one lifecycle |
| `workpass335-paired-seed-growth-2026-10-24` | ahead | 58 | 0 | 27 | Descendant of the selected base; inspect benchmark/test changes before accepting any learning metric claim |
| `workpass526-autobiographical-recall-intent` | diverged | 148 | 100 | 54 | Recall/learning stream diverges substantially; extract candidate improvements, not the branch history |
| `workpass526-personality-core-hardening-2026-10-24` | diverged | 112 | 100 | 39 | Personality/motivation and restore behavior overlap core; compare tests and persisted schema effects |
| `workpass528-bilingual-conversation-recall` | diverged | 156 | 100 | 58 | Broad recall/learning branch with substantial divergence; isolate API/schema changes and rerun learning regressions |

At this snapshot, five of the additional streams were descendants of the selected base (`optimization/process-supervision`, the ordering branch, WorkPass332, WorkPass334, WorkPass335 Hermes and WorkPass335 paired-seed — six streams in total). The remaining additional streams reported divergent ancestry. This is a stronger integration signal than branch names alone, but even a clean `ahead / 0 behind` comparison is not a test result.

Before importing any stream:

1. Refresh its head SHA and compare against the current target again.
2. Inspect exact overlapping paths, particularly `CHANGELOG.md`, `runtime/neuro-kurisu/package.json`, core/runtime classes, shared workflow files and release manifests.
3. Check open PRs and exact-head Actions, then port narrowly scoped source/tests with provenance.
4. Re-run `npm run audit:ordering` plus the owning behavior/learning tests on the final proposed integration commit.

No branch in this table is marked integrated based only on its ancestry comparison.

