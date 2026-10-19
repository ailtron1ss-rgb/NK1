# WorkPass71 handover — retrieval fairness and repository navigation

**Date:** 2026-10-19  
**Base:** WorkPass70 hotfix 1  
**Status:** focused implementation in validation; not production approval.

## Work completed

- The retrieval benchmark's BM25 baseline filtered malformed rows, while the MemoryOS2 candidate previously restored those malformed rows. A malformed high-ranking row could therefore occupy a top-k slot in only the candidate arm and depress its measured recall.
- Candidate retrieval now restores an isolated snapshot containing exactly the same validated corpus rows as the baseline.
- The integrity report still marks truncation as invalid for promotion. The fix does not make truncated corpora eligible; it makes diagnostic A/B measurements fair and prevents the candidate from seeing extra rows.
- Added two regression fixtures: (1) 1,601 rows with a uniquely relevant target after the cap, ensuring truncation is reported and neither arm retrieves beyond the cap; (2) a malformed top-ranked distractor, ensuring both arms filter to the same valid corpus while promotion remains blocked.
- No retrieval uplift is claimed. This is an evaluation-correctness fix, not an algorithm-quality result.

## Canonical project map

| Area | Canonical owner / entry point | Rule |
|---|---|---|
| Runtime brain, memory, actions | `runtime/neuro-kurisu/` | Only writable organism runtime; do not create a second memory or action owner |
| Memory retrieval algorithm | `runtime/neuro-kurisu/src/organism/developmental/MemoryOS2.ts` | Canonical retrieval implementation |
| Retrieval benchmark | `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalBenchmark.ts` | Offline A/B evaluation; candidate never auto-promotes |
| Multi-seed sensitivity experiment | `runtime/neuro-kurisu/src/organism/memory/MemoryRetrievalExperiment.ts` | Bootstrap seeds vary confidence intervals, not model training |
| Retrieval regression | `runtime/neuro-kurisu/tests/memory-retrieval-experiment.mjs` | Includes offline/CLI and corpus-cap parity checks |
| UI | `app/` | Projection/client shell; not a second organism |
| Research candidates | `research/` | Isolated candidates; no dual-write to canonical runtime |
| Historical snapshots | `legacy/` | Preserve for provenance; do not mix into active imports |
| Contracts and inventories | `contracts/`, `tools/` | Ownership, reproducibility, and source verification |
| Project map | `docs/PROJECT_FILE_MAP_WORKPASS42.md` | Useful historical map; verify versioned details against current README and handover |

## Validation

Run from repository root:

```bash
npm run test:memory-retrieval-experiment
npm --prefix runtime/neuro-kurisu run typecheck
npm run audit:release-metadata
npm run audit:quick
```

The combined `audit:quick` can be long and has previously timed out in this environment; report each command separately and never convert a timeout into a pass. GitHub Actions is being extended to run the retrieval regression as part of WorkPass71 validation.

## Cleanup rules for future passes

1. **Inventory before deleting.** Compare file hashes, import references, package scripts, workflows, manifests and historical-source contracts.
2. **Delete only proven duplicates.** A duplicate must be byte-identical or have a documented canonical replacement and a tested restoration route. Similar names are not proof.
3. **No mass renames or moves during functional fixes.** Separate structural changes from runtime behavior so regressions can be attributed.
4. **Keep one owner per capability.** Prefer adapter/compatibility aliases over copied implementations; check the architecture and core-ownership audits.
5. **Preserve evidence.** Keep source archives, license notices, provenance and historical manifests intact unless a verified restoration process explicitly covers them.
6. **No fake optimization metrics.** Measure latency, allocations, corpus size, recall/MRR and memory/CPU on fixed inputs. If measurements are unavailable, mark them unknown.
7. **Keep work navigable.** Update the current handover and changelog in each meaningful pass; do not generate one-off overview files that contradict the canonical README.

## Next work queue

1. Run the new corpus-parity regression in CI.
2. Inspect retrieval candidate ranking and candidate-vs-BM25 failure cases without tuning against holdout labels.
3. Establish a genuinely independent, temporally split, labelled corpus and record provenance.
4. Measure cold setup cost separately from query latency; report p50/p95 and resource use on the target machine.
5. Audit oversized scripts, stale workpass documentation and duplicate test coverage; propose a reversible cleanup manifest before deleting anything.
6. Keep production build, browser/Live2D E2E, Android TTS, independent retrieval uplift, full license review and soak as explicit open gates until observed evidence exists.
