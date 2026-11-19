# NK1 live consolidation checkpoint — 2026-11-19 (after PR #952)

## Exact live repository counts

Fresh paginated GitHub reads:

- Branch refs: **1,037** (10 pages × 100 + 37 on page 11).
- Unique branch HEAD SHAs: **946**.
- Exact duplicate-HEAD groups: **12**.
- Excess refs within those duplicate groups: **91**.
- PR records: **941** (9 pages × 100 + 41 on page 10).
- Open PRs: **414**.
- Merged PRs: **310**.
- Closed without merge: **217**.

The 2026-11-18 census remains an immutable historical snapshot of 1,033 refs / 942 unique HEADs / 937 PR records. The prior same-day follow-up documented 1,036 refs; this checkpoint advances it without rewriting either earlier snapshot.

## Branch refs added since the 2026-11-18 census

The latest live branch read contains these four refs not in the original census JSON:

| Branch | Current HEAD | Notes |
|---|---|---|
| `aspect/kurisu-embodiment-assets-20261118` | `05148c16e53e4ff7e1d238164bebd4aa610dd36e` | Asset-only candidate, PR #950 |
| `aspect/embodiment-skeletal-3d-kinematics-20261119` | `0a289c1ddc4c19da4def7409b4e28ef85cb6854c` | Isolated skeletal-kinematics candidate, PR #951 |
| `aspect/tooling-neko-plugin-integrity-20261119` | `ab756cd7b84300205fa710e7e048cbc3729ffc7d` | Documentation-only policy preservation candidate, PR #952 |
| `consolidation/nk1-branch-census-20261118` | `b775c4fc474f3bad913f22b38456aebfc8b6f14a` | Audit branch; advanced with additional documentation |

No previously inventoried branch name disappeared. The 12 exact duplicate-HEAD groups / 91 excess refs are unchanged.

## Current source movement

- `workpass70-source`: `a7f1342b1ab129c83b5f84bb5acaddd4b7605d5d`.
- Previous inspected source: `7547f5287b84a7d9b7109c0e5fdbe20bf95c9e33`.
- The intervening commit `a7f1342...` is a ProductOS import and changes only `next-env.d.ts` and `tsconfig.json` (41 additions; no runtime source changes).
- `main` remains `9a789ee1af8fdaa3826dbc734d18e2fc00cde5bf`.

PR #949 still records its base at the previous source SHA `7547f528...`; a live compare now shows 16 commits ahead / 1 behind. The single behind commit is the two-file configuration import above. The audit PR remains mergeable, but should be rebased or otherwise synchronized before it is finalized. Its changed paths are documentation-only under `docs/consolidation/`.

## Current consolidation-related PR checks

| PR | Exact head | State | Latest queried Actions |
|---|---|---|---|
| #950 | `05148c16e53e4ff7e1d238164bebd4aa610dd36e` | Draft | 4 success / 0 failure |
| #951 | `0a289c1ddc4c19da4def7409b4e28ef85cb6854c` | Draft | 44 success / 0 failure |
| #952 | `ab756cd7b84300205fa710e7e048cbc3729ffc7d` | Draft | 3 success / 0 failure |
| #949 | `b775c4fc474f3bad913f22b38456aebfc8b6f14a` | Draft | Audit/docs branch; 16 ahead / 1 behind |

These are exact SHA-specific workflow query results at the time of this checkpoint. They do not establish that the whole repository test suite or every branch passes.

### PR #951 — renderer-neutral 3D kinematics

The first exact-head run failed on a singular fully extended multi-effector IK fixture. The latest head changed only the test fixture; the three implementation modules were not changed. The subsequent exact-head query returned 44 completed successes and no failures. The modules remain a bounded mathematical library, not production actuator/OrganismBus/renderer wiring. Keep Draft pending review of numerical behavior and integration boundaries.

### PR #952 — N.E.K.O. plugin policy documentation

This Draft PR adds two documentation files only. It preserves the unique manifest-policy contract from old PR #784 while keeping the current atomic restore implementation and shared CI workflow. It does not re-add the older adapter, registry or standalone workflow. Its three exact-head Actions runs completed successfully.

### PR #950 — embodiment assets

This Draft PR preserves 8 sprite PNGs and 4 render-evidence variants with blob provenance. Its 4 exact-head workflow runs completed successfully. It still needs visual review and an asset-rights/license decision before distribution or UI wiring.

## Branch reduction status

The exact duplicate HEAD census still has 91 excess refs, but branch refs have **not** been deleted. Identical HEAD is not sufficient authorization: PR head/base relationships, tags, workflow triggers, protections/rulesets, deployment references and external links must be checked per ref. The GitHub connector in this execution does not expose a branch-ref deletion operation.

N.E.K.O. branch-family review is now recorded in `neko-plugin-branch-reconciliation-2026-11-19.md`; it identifies older branches whose implementation has been superseded by merged/rebased PRs, plus one unique documentation contribution preserved in PR #952.

## October 19 Release baseline

The primary release asset remains `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, with release-metadata SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.

The binary asset was not materialized in this execution environment. Extraction, path inventory, per-file SHA-256, and byte-level comparison remain **not performed**. No archive parity claim is made.

## Next gates

1. Synchronize PR #949 to the current source SHA `a7f1342...` without altering its documentation-only scope.
2. Continue the branch-by-branch and PR-by-PR code/blob/patch audit, starting with the largest branch families that have branch-only commits, not just equal-tip aliases.
3. Preserve unique files/config/dependency/workflow/doc/assets with exact source blob provenance; do not restore weaker historical implementations over current source.
4. Obtain the October 19 ZIP bytes and perform a manifest-based byte comparison before making archive parity or release claims.
5. Do not close further PRs or delete further refs until their entire code and reference relationships have been checked.
