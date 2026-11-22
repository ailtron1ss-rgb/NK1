# P34 evidence lifecycle integrity — 2026-11-22

## Scope

This aspect hardens the existing `P34CausalPersonhoodEngine` evidence lifecycle. It does not introduce a second evidence store, identity owner, memory owner, or new autonomy authority.

## Defects addressed

- Evidence IDs previously depended on a content hash and millisecond timestamp. Repeated events with identical content inside one millisecond could collide and collapse distinct provenance events.
- Restore previously accepted malformed evidence objects and duplicate IDs without reconciling the evidence graph.
- Claims, goals, and identity-change requests could retain references to evidence that was absent from the restored bounded ledger.
- New evidence could evict the oldest item from the 256-record ledger while leaving dangling references in dependent records.

## Implementation

- Evidence IDs now include a process-local monotonic sequence in addition to the content digest and timestamp.
- Restore normalizes evidence against the supported evidence-kind set, bounded field lengths, finite confidence and timestamp values, and unique IDs. The first canonical occurrence wins.
- Restore keeps the newest-first bounded evidence window and reconciles all claim, goal, and identity-change evidence references against it.
- Recording new evidence prunes references to records that leave the 256-entry window.
- Invalid evidence input is rejected without mutating the ledger.
- Duplicate references to one evidence ID are deduplicated before claim confidence, goal provenance, or identity-change provenance is calculated; one source cannot be counted multiple times by repeating its ID.
- The existing unified-organism Actions workflow now runs P34 personhood, migration, and OrganismCore integration contracts.

## Verification

- New regression coverage: 64 repeated evidence events must receive distinct IDs; malformed and duplicate restore entries are rejected; dangling references are removed; bounded eviction prunes dependent references; repeated references to one ID cannot inflate support or confidence.
- The new tests were added before the production change. The initial test-only PR head triggered GitHub Actions, but the focused unified-organism workflow remained queued while other repository workflows occupied runners. Therefore a red execution was **not observed** before implementation.
- Exact-head verification for the final PR head must complete before this change is considered tested. Do not infer success from the test code or from unrelated passing workflows.

## Integration and release boundary

- Branch: `aspect/p34-evidence-lifecycle-integrity-20261122`
- Base: `workpass70-source` (baseline `e924f9a0721fad604d86adc60ed5d941e273aab2`)
- PR: [#1097](https://github.com/ailtron1ss-rgb/NK1/pull/1097)
- `main` and the published Release ZIP are unchanged. This work is implemented on an aspect branch, not merged or released.
- This is evidence-accounting and persistence hardening, not proof of subjective personhood or consciousness.
