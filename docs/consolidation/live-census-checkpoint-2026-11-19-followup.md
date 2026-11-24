# NK1 live census checkpoint — 2026-11-19 (follow-up)

## Exact live snapshot

Repository: `ailtron1ss-rgb/NK1`.

A fresh paginated read of `GET /repos/ailtron1ss-rgb/NK1/branches?per_page=100` completed on 2026-11-19:

- Branch refs: **1,036** (10 pages × 100 + 36 on page 11).
- Unique branch HEAD SHAs: **945**.
- Exact duplicate-HEAD groups: **12**.
- Excess refs within those duplicate groups: **91**.
- Largest group: **81 refs** at `82ea7a8b7c9b036e65c8b056acedd1176952dd8f`.
- Prefix counts now: root 334; aspect 227; fix 179; work 161; feature 46; docs 28; feat 15; integrate 10; audit 6; cline 5; planning 4; research 4; architecture 2; consolidation 2; optimization 2; rebase 2; automation/ci/compat/experiment/jules/nk1/perf/typescript/verify one each.

The 2026-11-19 earlier delta recorded 1,035 refs / 944 unique HEADs. The additional live ref is consistent with the newer embodiment work opened after that snapshot; preserve the historical 1,035 count in the prior dated report rather than rewriting it.

## Current canonical refs

- `workpass70-source`: **a7f1342b1ab129c83b5f84bb5acaddd4b7605d5d**.
- `main`: **9a789ee1af8fdaa3826dbc734d18e2fc00cde5bf**.
- PR #949 remains Draft, head `297e5ec409e6cf1c320d081c53e888cb7baada73`, base `workpass70-source` at `7547f5287b84a7d9b7109c0e5fdbe20bf95c9e33`.

The source branch advanced one commit after PR #949's recorded base. That one commit (`a7f1342...`) adds only `next-env.d.ts` and `tsconfig.json` (41 lines total); it does not change the NK1 runtime tree. The audit PR is therefore one source commit behind, not a conflicting implementation branch. This drift should be reconciled before the audit PR is finalized.

## Duplicate-head disposition

The live count reconfirms the 12 duplicate-HEAD groups and 91 excess refs from the prior report. Equal commit SHA proves the refs point to the same commit/tree at their tips; it does not erase their PR head/base relationships, commit history, CI usage, or external links.

No deletion is authorized by this checkpoint. In particular:
- Keep every ref used as the head or base of an open PR.
- Preserve all branch/PR provenance even when exact duplicate tips are found.
- Treat aliases as cleanup candidates only after references, tags, Actions/workflow use, protection and downstream dependencies are checked.
- Do not collapse branches with different HEADs merely because their names or titles are similar.

## October 19 baseline

The primary release remains:
- Tag: `Neuro`
- Asset: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`
- Size: 135,290,615 bytes
- Published SHA-256 from release metadata: `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`
- Tag commit: `c2e8e4a78431734612f89318e79d3491643f24f3`

The ZIP bytes have not yet been materialized in this execution environment. Therefore extraction, per-path SHA-256 inventory, and byte-level comparison against source/branch candidates remain **not performed**. No archive parity claim is made.

## Next execution gate

1. Obtain the exact release asset bytes and independently verify the recorded SHA-256.
2. Extract to an immutable baseline and produce a path + size + SHA-256 manifest.
3. Compare every candidate branch's unique commits, changed paths, blobs, complete patches, dependencies, configuration, workflow references, documents and assets against both `workpass70-source` and the October 19 baseline.
4. Port only missing useful deltas into a small set of durable aspect branches; retain original SHAs and provenance.
5. Run targeted and broad regression checks at exact PR heads.
6. Only after the above, propose branch-ref cleanup with a per-ref evidence table.

## Safety

This checkpoint is documentation-only. No application source files, release assets, existing branch refs, or PR states were changed. No PR was merged or closed, and no branch was deleted or force-updated.
