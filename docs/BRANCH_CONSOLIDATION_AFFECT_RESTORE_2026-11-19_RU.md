# Affect restore: branch consolidation report — 2026-11-19

## Scope and baseline

This pass consolidates only the `EmotionAppraisalEngine` restore-integrity family. It does not claim to inventory every repository branch.

- Repository: `ailtron1ss-rgb/NK1`
- Integration base at branch creation: `workpass70-source`
- Base SHA observed: `1fc8446d95e4e1d64547b853224250248c965a29`
- Release reference: tag `Neuro`, published 2026-10-19, asset `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`
- Release asset metadata: 135,290,615 bytes; SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`

The release metadata and digest were confirmed from GitHub. The binary ZIP itself was not materialized in this run, so ZIP member-level parity is **not claimed**.

## Branch-family inventory

All ahead/behind figures below are GitHub compare results against the observed `workpass70-source` head. These old branches are hundreds of commits behind the live integration source; their source code must not be merged wholesale.

| Branch | Head SHA | Ahead / behind | Findings and disposition |
|---|---|---:|---|
| `aspect/affect-restore-integrity-20261103` | `9a2b36a8004966e0c6be550eff9e0898f5bb2422` | 2 / 375 | Earlier two-file version of the same owner and BIG PASS 172 test. Superseded by later variants; preserve as history. |
| `aspect/affect-restore-integrity-20261103-v2` | `c4285f2c44739a03455fafe50bfa10e66862a7e0` | 6 / 369 | Three changed files: restore owner, BIG PASS 172, focused workflow. |
| `aspect/affect-restore-integrity-20261103-v3` | `ecaedf58569c07a79a262e019f891597420cf6b0` | 3 / 367 | **Exact duplicate file content** of v2 across all three changed files. |
| `aspect/affect-restore-integrity-rebased-20261103` | `7886bc265b492a0505808bf845159c515b418f76` | 3 / 364 | **Exact duplicate file content** of v2 and v3 across all three changed files. |
| `aspect/affect-state-restore-integrity-20261102` | `6a8f6527d308c662a09ad0d7bcb0820396d08355` | 7 / 375 | Earlier, broader four-file pass with a small Russian report and separate workflow. PR #667 is closed, not merged. Current source has since evolved the same restore owner and tests. |
| `aspect/emotion-restore-integrity` | `0b01f181668e87ed24e510383519eec9dd666b70` | 6 / 375 | PR #665, open and currently non-mergeable. Its old full restore implementation predates current source; retain only the still-useful explicit Proxy rejection and focused regression idea, not the whole old implementation. |

### Exact duplicate proof for v2 / v3 / rebased

The Git blob SHAs match across the three changed files:

- `EmotionAppraisalEngine.ts`: `49ed9407ea34ae839618aab1fca032bb0fc953db`
- `big-pass-172-emotion-interoceptive-mind.mjs`: `547263da5043c62e08dad4dfb4f51905e8be8c58`
- `nk1-emotion-restore-integrity.yml`: `1ae50d7c421b4491d0a316db0bb3e7b83112ed33`

So these three branch refs carry the same changed file contents; they are not three independent implementations.

## Current-source comparison

The live source already has a more recent strict restore implementation than the historical PR #665 patch:

- allow-listed own-data reconstruction instead of spreading an untrusted snapshot;
- validation of episode, feeling, appraisal, interoceptive and outcome fields;
- accessor/inherited/malformed record rejection;
- bounded histories and deduplication;
- hostile snapshot cases in the existing BIG PASS 172 test.

The current source helpers did not explicitly call Node's `types.isProxy` before inspecting objects/arrays. A transparent Proxy with no traps can still pass descriptor-based checks. Replacing the whole current implementation with the older PR #665 code would regress later source work, so this consolidation carries forward only the missing invariant.

## Consolidated successor branch

Branch: `aspect/affect-restore-integrity-consolidated-20261119`

Changes made on top of the observed live source:

1. Add `types.isProxy` rejection to both shared own-data record and own-data array snapshot gates.
2. Add a dedicated `emotion-appraisal-restore-integrity.mjs` regression suite covering transparent proxies at root, array, episode, nested appraisal, feeling, interoception and outcome-calibration boundaries, plus valid v2 round-trip.
3. Register the suite in `runtime/neuro-kurisu/package.json`.
4. Wire the focused suite and existing BIG PASS 172 into `.github/workflows/nk1-unified-organism-runtime.yml`.

The old PR #665 source implementation was **not** copied over the evolved live implementation.


## Source synchronization during this pass

While the aspect branch was being prepared, `workpass70-source` advanced by four commits from `1fc8446d95e4e1d64547b853224250248c965a29` to `c7473db869cc8bcf9a8045de898afe0d3168f20e`. The four-commit comparison showed changes only in the cognitive network bus and interoceptive estimator paths, plus their tests/workflows/docs; none overlapped the five files in this affect restore consolidation.

To avoid opening a stale PR, a two-parent merge commit `4078e4031a0df4d997fe88330f46b8822ccacee9` was created with the new source head as first parent and the original consolidation head as second parent. This preserves both histories and carries the five affect-specific paths on top of the latest source tree. No changes from the parallel source advance were dropped.

## Cleanup decision

No historical branch ref was deleted in this pass. The exact duplicate v2/v3/rebased group is now documented, but deleting Git refs is deferred until the full repository-wide branch/PR/commit dependency inventory is complete. PR #667 is already closed and unmerged. PR #665 remains open until the successor's exact-head CI is observed; no historical source or release artifact was rewritten.

## Verification status

- Changes were committed to the isolated aspect branch.
- GitHub Actions exact-head results are pending until the successor PR is opened.
- No claim is made yet for tests, typecheck, device soak, release ZIP parity, or production activation.
