# NK1 Git branch census — 2026-11-24

Snapshot boundary: live paginated GitHub REST list captured during this session and finalized before PR creation at approximately **2026-11-24 11:09 UTC**. Exact per-request timestamps were not returned by the API. Repository: `ailtron1ss-rgb/NK1`.

## Exact census
- Live branch refs: **1124**; unique names: **1124**.
- Unique HEAD SHAs in this API snapshot: **1124**.
- Refs with currently open PR as head: **238**.
- Refs without currently open PR as head: **886**. This does not mean "no PR ever"; closed/merged lineage requires a separate all-state mapping.
- Duplicate HEAD groups: **0** in this captured result.
- Protected refs: **0**; unprotected: **1124**.
- The source-embedded provenance file says 1,106 refs; an earlier dated ledger records 1,124 refs / 1,106 unique heads; this fresh list returns 1124 refs and 1124 unique heads. The disagreement itself is a data-integrity issue; don't use any previous aggregate as current truth without regenerating it.
- Important limitation: the paginated branches endpoint supplied exact ref names and HEAD SHAs, but not commit dates/messages in this response. The JSONL records this field as unavailable rather than inventing it. Commit metadata is a second-stage query for selected candidates.

## Namespace counts
- `aspect`: 298
- `(unprefixed)`: 257
- `fix`: 183
- `work`: 159
- `consolidation`: 69
- `feature`: 44
- `docs`: 33
- `integrate`: 25
- `feat`: 18
- `audit`: 6
- `research`: 5
- `planning`: 4
- `cline`: 3
- `architecture`: 2
- `optimization`: 2
- `rebase`: 2
- `automation`: 1
- `ci`: 1
- `compat`: 1
- `experiment`: 1
- `governance`: 1
- `jules`: 1
- `maintenance`: 1
- `nk1`: 1
- `perf`: 1
- `prototype`: 1
- `salvage`: 1
- `test`: 1
- `typescript`: 1
- `verify`: 1

## Provisional family counts (name-only)
- `unclassified`: 349
- `cross-cutting-review`: 248
- `core-runtime`: 88
- `memory-retrieval`: 87
- `embodiment-avatar`: 86
- `persistence-reliability-security`: 67
- `governance-release`: 53
- `research-assimilation`: 43
- `speech-interaction`: 31
- `agency-autonomy`: 20
- `world-perception`: 18
- `self-affect-identity`: 16
- `learning-skills`: 16
- `release-main`: 1
- `canonical-source`: 1

Family tags are lexical triage only, not source inspection or merge authorization. `cross-cutting-review` / `unclassified` require manual content and commit inspection.

## Canonical refs and release
- Integration source at the snapshot boundary: `workpass70-source` @ `8328336c2156369875b21f0db06da71c3d83d6b9`.
- `main` is the public release/metadata line; do not advance it with bulk donor merges.
- Latest published Release metadata is `NeuroKurisu0.1` / tag `Neuro` (2026-10-19). This census does not prove ZIP/source parity.
- The branch retirement incident removed 29 refs on 2026-11-23. Do not recreate refs by guessed names/SHA.
- PR #1158 is a current-source Draft for disabling automatic ref deletion; it is not merged.

## Normalization strategy
Keep no more than 12 durable domain integration roots after contracts are agreed:
1. `track/core-runtime`
2. `track/memory-retrieval`
3. `track/agency-autonomy`
4. `track/learning-skills`
5. `track/world-perception`
6. `track/self-affect-identity`
7. `track/embodiment`
8. `track/speech-interaction`
9. `track/platform-device`
10. `track/persistence-reliability-security`
11. `track/governance-release`
12. `track/research-assimilation`

Existing feature branches cannot literally be nested beneath another Git branch: Git refs are flat names. The ledger is the hierarchy; integration roots are PR destinations. Preserve every existing ref during discovery. For each donor compare merge-base, unique commits, changed paths/hunks, PR lineage and tests; selectively port unique changes onto a fresh source head; re-run exact-head CI. No mass merge, rename, force-push or deletion by prefix/name/age. Ref retirement only after proven content transfer, PR closure, reachability receipt and separate explicit authorization.

Machine-readable rows: `docs/governance/branch-census-2026-11-24.jsonl`.
Each row includes exact ref name, HEAD SHA, protection, current open-PR head relationships and provisional name-family signals; commit dates/messages are explicitly marked unavailable from the census response.
