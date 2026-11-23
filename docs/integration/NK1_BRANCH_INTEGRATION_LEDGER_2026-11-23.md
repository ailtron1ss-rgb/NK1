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
