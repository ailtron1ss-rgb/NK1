# NK1 Branch Integration Ledger — 2026-11-23

## Baseline and safety boundary

- Canonical repository: `ailtron1ss-rgb/NK1`.
- Canonical write target: `workpass70-source` at `0035eca4a6583ab42d6780ea1e5c9f3c8ecab393` before this batch.
- `main` and the published Release remain outside this integration pass.
- Live branch census: **1,091 refs** across 11 non-empty pages (100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 91); page 12 was empty. Prefix snapshot: 271 `aspect/*`, 267 root-name refs, 180 `fix/*`, 159 `work/*`, 62 `consolidation/*`, 44 `feature/*`, 30 `docs/*`, 27 `integrate/*`. These are refs, not unique implementations or a delete list.
- The latest-ordered open-PR page returned 100 results. This is a page, not a verified total; a full open-PR census remains pending.

## Integration 01 — cognitive resource interrupt routing

- Donor: PR #1096, `aspect/cognitive-resource-interrupt-routing-20261122`, head `39a68683322644ac5121562c346be9898755288b`.
- Donor exact-head CI before port: **54/54 SUCCESS**.
- Contribution: interrupt domain list and compact wake bitmask now use `dirtyDomains`, not only `domains`; focused regression covers safety-escalated governance wake routing.
- Files carried: `.github/workflows/workpass79-cognitive-regression.yml`, `runtime/neuro-kurisu/package.json`, `runtime/neuro-kurisu/src/organism/core/CognitiveFrame.ts`, `runtime/neuro-kurisu/tests/cognitive-frame-resource-routing-workpass330.mjs`.
- Three-way base: `e924f9a0721fad604d86adc60ed5d941e273aab2`. Workflow and CognitiveFrame had no concurrent source edits. `package.json` had independent source additions from the previous Memory/Android integrations. Resolution: retain every current source script and add only `test:cognitive-frame-resource-routing`; no existing script is replaced.
- Integration method: current source is first parent; donor head is an additional ancestry parent. Fresh combined exact-head CI is required before merge.

## Deferred repair queue — do not merge as-is

| PR | Area | Current evidence | Safe next action |
|---|---|---|---|
| #1093 | ActionGateway audit redaction | 12 exact-head checks: 11 success, 1 failure (`action-governance`) | Inspect failing governance assertion/log; repair fail-closed redaction behavior and rerun exact-head checks |
| #1098 | Active-information outcome attribution | 54 exact-head checks: 53 success, 1 failure (`unified-organism`) | Inspect runtime ownership/restore failure; preserve exact decision/outcome attribution while repairing contract mismatch |
| #1094 | Cooperative autonomous cycle batching | Changes `OrganismRuntime.ts`; overlaps other runtime composition candidates | Compare exact head against source and #1101/#1095/#1099 before integration |
| #1101 | Risk-aware recovery runtime wiring | Changes `OrganismRuntime.ts` and `UnifiedCognitiveCycle.ts` | Map autonomous step/outcome lifecycle and sidecar durability order before combining |
| #1095 | Cognitive health supervision | Prior candidate mergeability false; old PR snapshot used Node 22/v4 actions | Rebase to Node 24 action policy, dependency-invert health monitor and rerun checks |
| #1097 | P34 personhood lifecycle | Touches `MemoryFabric.ts`, shared eviction regression/workflows and `package.json` | Reconcile against already-merged memory eviction changes before porting; preserve current memory fix |
| #1099 | NMCN runtime advisor | Broad runtime/server/package/sidecar change | Keep opt-in and advisory; verify no duplicate state bus/memory/action authority. Device and sidecar recovery remain separate gates |

## Conflict-resolution rules for subsequent batches

1. Re-read the live source SHA immediately before every integration commit.
2. Compare each donor to the current source and its exact merge base; never trust a stale PR base.
3. Group donors only where canonical owners and changed-file surfaces are compatible.
4. Treat `package.json`, shared workflows, `OrganismRuntime.ts`, `MemoryFabric.ts` and canonical state schemas as high-collision paths. Merge semantic additions, not stale whole-file snapshots.
5. A failed or pending exact-head check blocks merge. Inspect the job log, fix the underlying contract or test expectation, then rerun.
6. Preserve donor branches and commit history. Close duplicate PRs only after proving byte identity or explicit supersession.
7. Record first parent, donor parents, changed paths, exact CI result, merge SHA and post-merge source SHA for every batch.
8. Source integration is not Release ZIP publication or product readiness.

## Current batch state

- This ledger accompanies PR #1102 and subsequent integration work.
- No branch deletion, force-push, `main` write or Release mutation is authorized by this ledger.


## Latest verified checkpoint — 2026-11-23

- Canonical source after the latest integration: `workpass70-source` @ `4972c2d5228141ef9673be94fca243614d28d9d6`.
- Current live branch census: **1,095 refs**, **1,077 unique tip SHAs**, **3 exact duplicate-head groups**, **18 excess refs**. This is a ref count, not a safe deletion list.
- Exact duplicate group A (17 refs, tip `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`): `nk1-all-branches-merge-2026-10-23`, `nk1-integration-workspace-2026-10-22`, `rebuild`, `workpass79-cognitive-rebuild`, `workpass116-seed-clustered-learning-eval`, `workpass117-verified-replay-admission`, `workpass118-multi-source-learning-integration`, `workpass119-skill-retrieval-feedback-curriculum`, `workpass120-verified-skill-revision-gate`, `workpass121-ledger-bound-promotion-proposals`, `workpass122-promotion-gate-coverage-hardening`, `workpass123-authenticated-skill-lifecycle`, `workpass124-learning-evidence-hardening`, `workpass135-durable-shadow-run-registry`, `workpass203-independent-candidate-evaluator`, `workpass206-runtime-evaluator-wiring`, `workpass313-actions-history-audit`.
- Exact duplicate group B (2 refs, tip `f9621bf3e4411ce17bc809922a5f90126001f4fd`): `aspect/consequence-ecology-20261117`, `integrate/consequence-calibration-lineage-followup-20261120`.
- Exact duplicate group C (2 refs, tip `68a03799ca0c9f18e4c6e19399ed8018e0215e60`): `aspect/world-forge-integrated-20261117`, `integrate/worldforge-to-sharedfuture-after-calibration-20261120`.
- **PR #1103** merged as `272b1dc8431121efc3d948e194b99b29afd2a275`: ActionGateway audit redaction, cooperative autonomous cycle batching, and cognitive resource wake routing.
- **PR #1104** merged as `4972c2d5228141ef9673be94fca243614d28d9d6`: P34 evidence lifecycle integrity, Active Information Gain exact outcome attribution, and HMX explicit-apply restart/idempotency coverage. Exact-head Actions: **14/14 successful** before squash merge. The merged head uses the tested `.45` information-need gate; the separate PR #1105 proposal for `.34` was closed unmerged and was not needed for the passing exact head.
- Donor PRs #1097, #1098 and #1085 are closed unmerged after their useful changes were selectively integrated by #1104. Their source branches remain preserved pending complete byte-level duplicate/unique-content and PR-reference audit.
- PR #1102's runtime routing implementation and regression are superseded by the merged #1103 integration. Its unique ledger, changelog entry and standalone test command are being transferred into this current-source documentation/maintenance branch. No donor branch is deleted.
- PR #1105 is closed unmerged; its one-file `.34` threshold patch was not applied because #1104's later `.45` implementation passed the exact integrated 900-cycle regression and the full 14-workflow exact-head check.
- No branch deletion or force-push has been performed. The three exact duplicate-head groups are the highest-confidence cleanup candidates, but their open-PR references and branch-protection implications must be checked before deleting any ref.
- `main` and the published Release ZIP remain unchanged. Source integration is not release publication or a product-readiness claim.

## Next verified integration queue

1. Inspect #1101 risk-aware recovery against current runtime composition; its previous base is stale and its mergeability was false. Do not merge until the exact current-source integration passes.
2. Inspect #1095 cognitive health supervision against current runtime provider ownership, persistence and workflow policy.
3. Inspect #1099 NMCN bridge separately; retain loopback-only opt-in, bounded advisory semantics and single canonical memory/action ownership. Target-device HTTP execution remains a separate verification gate.
4. Audit #1102's remaining branch-only changes after this ledger/command transfer; close as superseded only after verifying the current-source diff and preserve its branch until its complete tree has been accounted for.
5. Recompute unique-head groups and open-PR branch references before any deletion.