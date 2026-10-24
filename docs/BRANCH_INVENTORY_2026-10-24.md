# NK1 branch inventory — snapshot 2026-10-24

**Snapshot method:** GitHub branch search, all returned pages.  
**Observed refs:** 104, including `workpass331-project-ordering-20261024`, created during this ordering pass.  
**Important limitation:** this is a **name inventory**, not a verdict that each branch is current, merged, tested, safe to delete, or part of the release. Only selected branch heads and comparisons below were inspected. Refresh live state before any merge or retirement.

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
