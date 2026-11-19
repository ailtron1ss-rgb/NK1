# NK1 — affect restore: fingerprint and consolidation follow-up

**Audit date:** 2026-11-19  
**Repository:** `ailtron1ss-rgb/NK1`  
**Integration source:** `workpass70-source`  
**Source HEAD at audit:** `db24852b548cb66d8f0dc6caddeebb76d0c38d38`  
**Scope:** EmotionAppraisalEngine restore-integrity branch family and the mixed historical donor PR #619. This is not a full repository audit.

## Current source state

The current source implementation is at blob `df0fdb03a832391d5f3b2a45cb9d1bcb45c39e47` for `runtime/neuro-kurisu/src/organism/system/EmotionAppraisalEngine.ts` (23,037 bytes). It contains the later restore-integrity layers observed in the source:

- proxy rejection through `node:util.types.isProxy`;
- bounded own-key count (`MAX_SNAPSHOT_RECORD_KEYS`);
- history aggregation reconciliation from the newest validated row;
- unique episode/feeling identity handling;
- allow-listed action/outcome restoration and bounded record/array processing.

The active affect workflow is `.github/workflows/nk1-affect-state-restore-integrity.yml` (blob `a9791519673b9e2f6eb2c6c1d6e1914633d691ed`). It runs both the WorkPass172 interoception regression and the extended WorkPass610 restore-integrity contract.

## Verified merged integrations

These PRs were independently fetched from GitHub and report `merged=true`:

| PR | Merge commit | Scope |
|---|---|---|
| [#961](https://github.com/ailtron1ss-rgb/NK1/pull/961) | `b04945b0da485d92da0ec52d1264aeda6dc76b76` | Hostile-input restore regressions, dedicated workflow, historical handoff doc |
| [#965](https://github.com/ailtron1ss-rgb/NK1/pull/965) | `1fc8446d95e4e1d64547b853224250248c965a29` | Current-source deep restore test, allow-listed outcomes, duplicate-ID filtering, workflow wiring |
| [#970](https://github.com/ailtron1ss-rgb/NK1/pull/970) | `879a883f59439c8bdab3e4d7d9b171d6d4659780` | 256-key cap for persisted snapshot records and nested records |
| [#971](https://github.com/ailtron1ss-rgb/NK1/pull/971) | `9edf8c2c5297774acb93d24ca261675ffcefafad` | Explicit transparent/revoked Proxy rejection and regression tests |
| [#972](https://github.com/ailtron1ss-rgb/NK1/pull/972) | `7361fd0942a803ea58bc77dd7710759b2a1827df` | Reconcile aggregate episode fields against validated episode history |
| [#974](https://github.com/ailtron1ss-rgb/NK1/pull/974) | `e26a62504b5fa40568565dfb3483aad33cf92779` | Branch-family consolidation report |

The merge commits above are separate historical integrations; this addendum does not claim they were merged by this session.

## Exact duplicate fingerprints found

### 1. The deep-test donor pair

The following branches have identical Git blob SHAs for **all three changed files**:

- `consolidation/affect-restore-deep-tests-20261119`
- `consolidation/affect-restore-deep-tests-current-20261119`

| File | Identical blob SHA | Size |
|---|---|---:|
| `.github/workflows/nk1-affect-state-restore-integrity.yml` | `a9791519673b9e2f6eb2c6c1d6e1914633d691ed` | 1,497 bytes |
| `EmotionAppraisalEngine.ts` | `04bc0450c3c33490e4aa6d377c0f5af79be2a67b` | 22,602 bytes |
| `tests/workpass610-emotion-appraisal-restore-integrity.mjs` | `8b2a53b078f35e3b9ffbd6e079438c3caab04955` | 8,376 bytes |

The current-source variant was PR #965 and is merged. The older branch was PR #962, closed without merge. The identical changed-file blobs establish duplicate patch content, not identical complete Git trees or histories.

### 2. The November 3 legacy triplet

The following three branches have identical changed-file blobs according to the earlier full fingerprint table recorded in the branch-family report:

- `aspect/affect-restore-integrity-20261103-v2`
- `aspect/affect-restore-integrity-20261103-v3`
- `aspect/affect-restore-integrity-rebased-20261103`

For the implementation file, the repeated blob is `49ed9407ea34ae839618aab1fca032bb0fc953db` (22,113 bytes). A fresh source-vs-branch comparison confirms all three remain behind the current source implementation. The current source implementation has additional Proxy protection, a bounded record-key guard, history/aggregate reconciliation and identity deduplication. These legacy variants must not be replayed over current source.

The related branch `aspect/affect-restore-integrity-20261103` has a different implementation blob (`55ded8c858ff9a14c1502072986b04a7a30f8320`), but is also far behind the source and does not supersede the current implementation.

### 3. Older November 2 lines

- `aspect/affect-state-restore-integrity-20261102` is an older implementation snapshot (Engine blob `7a23fd2c54f1e5ee1914ac0de6df49c520953149`).
- `aspect/emotion-restore-integrity` is another older implementation snapshot (Engine blob `7a48ce3707a5b708d1fbed9127fb3a5ce1f39208`).
- PR #667 and #665 are closed without merge. Their old production implementation was not copied over current source; selected test/document value was preserved through later merged PRs.

## Mixed donor PR #619 — do not merge wholesale

PR [#619](https://github.com/ailtron1ss-rgb/NK1/pull/619) is closed without merge. Its head `351454a550a826f3e93ebdab9efb6637692494dc` contains 14 changed files (+608/-21), spanning affect restoration, cognitive planner restoration, world feedback, cognitive-spine budgeting, CI, changelog and research/status documents.

Five significant changed paths were compared against the current source and donor branch:

| Path | Source blob | Donor blob | Result |
|---|---|---|---|
| `CognitiveExecutionPlanner.ts` | `357ddf61b5d97a9e972bdb4c9739699cea46be81` | same | Exact blob match |
| `CognitiveSpineScheduler.ts` | `630774058535bfb5f84db34faa78da9fb67dda5d` | same | Exact blob match |
| `cognitive-execution-planner-restore-integrity-workpass611.mjs` | `409f903ab42845f87234fe18c297528d779e5036` | same | Exact blob match |
| `big-pass-39-reality-boundary.mjs` | `482c742de5726229ad8ef2da29a543b2b71883c9` | same | Exact blob match |
| `WorldSubsystemRuntime.ts` | `829072129d37d86ea93ea91cf2d4fe33b69e38c5` | `6aa0d705cc084d72d8096374db8870f16ed32a49` | Different; current source is newer |

The current `WorldSubsystemRuntime.ts` keeps the `invalid-world-transition` ingress guard but contains newer canonical prediction-frame/ticket linkage. Replacing it with the donor would discard later current-source logic. The PR's broad workflow/changelog/research/status edits were not accepted wholesale. This is a deliberate exclusion, not a claim that every one of its 14 files has been exhaustively byte-compared.

## PR status and branch cleanup limits

- #962: closed, not merged; its three changed file blobs are identical to the current-source branch content described above.
- #961, #965, #970, #971, #972, #974: merged as listed.
- #619, #665, #667: closed without merge; no wholesale replay.
- No branch was deleted or force-repointed in this pass. The currently connected GitHub action set exposes no branch/ref deletion operation. Equal patch blobs do not justify deleting a branch without full tree/history and open-PR/reference checks.

## Repository-wide branch count at this checkpoint

A complete paginated enumeration of `search_branches(query="")` returned 992 unique branch names (no repeated names in the returned pages). Prefix counts:

| Prefix | Count |
|---|---:|
| no prefix | 265 |
| `aspect/*` | 241 |
| `fix/*` | 176 |
| `work*` | 159 |
| `feature/*` | 44 |
| `consolidation/*` | 27 |
| `docs/*` | 24 |
| `feat/*` | 14 |
| `integrate/*` | 10 |
| `audit/*` | 6 |
| `planning/*` | 4 |
| `research/*` | 4 |
| all remaining prefixes combined | 18 |

This is a live repository-wide name count at the checkpoint, not a count of unique commit heads or proof that all branches were content-audited. The prior historical count of 1,038 differs by 46; that difference cannot be attributed to this single pass because concurrent work is active.

## Remaining limitations

1. Git branch deletion is not available through the currently connected GitHub actions; no refs were destroyed.
2. The 992 branches have not each been inspected file-by-file; this report covers one selected aspect and a bounded mixed donor review.
3. The October 19 Release ZIP checksum is known from GitHub release metadata, but the ZIP has not been downloaded and independently unpacked in this pass. Release/source byte parity remains unverified.
4. No claim is made that the repository has reached a few-dozen-branch state. The 992-name count is the current observed count.

