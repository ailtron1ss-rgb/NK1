# WorkPass126 — skill-store integrity hardening

**Date:** 2026-10-21  
**Scope:** Stage 2 implementation: fail closed on malformed or tampered durable skill lifecycle snapshots.  
**Branch:** `workpass124-learning-evidence-hardening` (stacked draft PR #12; not merged).  
**Evidence discipline:** code committed is not equivalent to tests passing; CI/local execution remains unverified until a run returns actionable logs.

## Implemented

1. **Nested schema validation on restore.** `AtomicFileSkillStorePersistence` now validates active skill records, candidate lifecycle records, shadow observations, approval records, timestamps, versions, fingerprints, and JSON-serializable payloads. A snapshot with valid outer arrays but malformed nested entries is rejected instead of being passed into the skill store.
2. **Payload integrity checks.** The adapter recomputes the canonical SHA-256 payload fingerprint for active skills and candidates. Candidate IDs are recomputed from `[skillId, version, proposalId, payloadFingerprint]`; stale fingerprints or mismatched IDs fail closed.
3. **CAS write validation.** `compareAndSwap` rejects a malformed next snapshot before acquiring the lock or replacing durable state.
4. **Regression coverage.** `p23-skill-store-failure-boundaries.mjs` now covers malformed active entries, malformed candidates, stale payload fingerprints for both record types, invalid CAS input, lock collision/release, persisted revision recovery, corrupt top-level schema, and malformed JSON.

## Changed files and commits

- `runtime/neuro-kurisu/src/organism/learning/AtomicFileSkillStorePersistence.ts`
  - `1f715143725186dc0c997c4126a2231833f04868` — nested record validation and CAS guard.
  - `62c0d115f4575f745c5b1819dfd6c25bdc2e5aab` — recompute payload fingerprints and candidate identity on restore.
- `runtime/neuro-kurisu/tests/p23-skill-store-failure-boundaries.mjs`
  - `7351c578e951480c20981835e061798fec0c80ac` — malformed nested snapshot regressions.
  - `6d0ea3dc46df1057374fc8acb55cea1334233ba0` — payload-fingerprint tampering regressions.

## Safety / limitations

- No branch was merged and `main` was not rewritten.
- No runtime test or TypeScript typecheck was executed by this GitHub connector session.
- The commit-run lookup returned no pull-request workflow runs for the test commit. This is **UNKNOWN**, not PASS. The prior exact-head WorkPass105/108/110 runs failed without actionable job steps, so the CI execution issue remains open.
- This pass hardens the durable candidate store boundary. It does not prove improved learning/recall, automatic activation, or production readiness.

## Stage 2 exit criteria

- [x] Validate nested persisted records before restore.
- [x] Verify payload fingerprints and candidate identity.
- [x] Reject malformed CAS snapshots before durable replacement.
- [x] Add regression assertions for malformed records and payload tampering.
- [ ] Run `p23-skill-store-failure-boundaries.mjs` on the target Node runtime.
- [ ] Run runtime typecheck and owning learning tests.
- [ ] Obtain an actionable successful exact-head GitHub Actions run.
- [ ] Continue the promotion-path/call-graph audit after this persistence boundary is validated.

**Status:** implementation committed; verification gates remain open.
