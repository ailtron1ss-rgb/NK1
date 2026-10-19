# WorkPass38 report — 2026-10-14

## Implemented

- Added `runtime/neuro-kurisu/src/organism/persistence/FileActionExecutionLedgerArchive.ts`: checksummed append-only JSONL; fsync before archive acknowledgement; offset index holds hashes/offsets rather than receipt payloads; archived receipts are read only on lookup.
- Wired sidecar archive to file-backed `OrganismCore`. It is opened and verified before loading persisted action receipts. Sidecar path is derived from `FileStateStore.siblingPath()` with strict suffix validation. MemoryStateStore remains usable in tests/embedded scenarios, with bounded hot-ledger protection.
- `ActionGateway` now refuses keyed executions without a durable persister before tool execution; same-key inflight reservation happens before async archive lookup; admission is serialized across distinct keys.
- Removed silent completed-key eviction and snapshot slicing. Capacity can be reclaimed only after archive append and main state checkpoint. Conflicting rows with the same key hash fail closed.
- Added tests for 40-operation archive spill, restart replay without repeated side effects, missing-persistence refusal, torn-tail recovery, archive checksum corruption, plus existing gateway/OrganismCore regressions.
- Runtime bumped to 35.60.0; schema remains 225.

## Results

Focused test invocation: `node --experimental-strip-types --test tests/action-ledger-archive-workpass38.mjs tests/action-gateway-idempotency-workpass37.mjs` — **17/17 passed**. The archive stress case spilled 24 of 40 completed receipts; all 40 old keys replayed after restart and executor count remained 40.

Additional gates are run independently to avoid a single long all-project script masking where a timeout occurs. This report only labels individually completed gates as PASS.

## Additional gates completed

- Runtime TypeScript typecheck: PASS.
- Release metadata validation: 34/34; contract tests: 6/6.
- Browser-smoke verdict contract: 51/51.
- App script tests: 212/212 (separate bounded run).
- Server smoke: PASS; `/api/health` exposes only safe ledger counters.
- UI/API linkage: 124 client routes, 48 Runtime Atlas surfaces, 5 required integration seams; no failed proxies or unhandled client routes.
- Assets: PASS; server imports: 10 checked, none missing.
- Architecture: 1,868 source files / 579 canonical files; zero missing links, cycles or Legacy leakage.
- Source hygiene: 3,988 files, zero errors/warnings. Syntax: 1,310 JS, 6 shell, 247 JSON files parsed successfully.
- Memory compatibility, shared action-cost policy, stable serialization, outcome verification, and Lumina/Hexis/Letta/Conscio/WILL integration tests: PASS.
- Retrieval benchmark ran with matched temporal semantics; recall delta is zero, candidate remains not promoted.
- UI production build attempted; blocked because `app/node_modules` is absent (`spawn vite ENOENT`), not reported as passing.

## Remaining gates

Production-installed Vite build and browser Live2D E2E, real provider/device receipt reconciliation, labeled independent temporal retrieval holdout, clean-room restore/rollback and soak remain open. The retrieval candidate remains not-promoted with zero synthetic uplift.
