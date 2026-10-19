# Integration matrix — WorkPass38

| Boundary | Canonical owner | WorkPass38 action | Status/limit |
|---|---|---|---|
| Tool idempotency and receipt replay | `ActionGateway` | Require durable persister; archive completed keys before hot-ledger eviction; restore archived responses by key hash | Focused tests pass; external exactly-once is not claimed |
| Durable file storage | `FileStateStore` | Expose validated sibling-sidecar path; `OrganismCore` loads sidecar before state ledger restore | File-backed runtime wired; embedded memory store uses bounded state path |
| Archive integrity | `FileActionExecutionLedgerArchive` | Append-only JSONL, per-record SHA-256, fsync, offset index, tear truncation, corruption fail-closed | Implemented; restart/spill tests pass |
| Composite skills / project APIs | Existing `OrganismCore` finalizer and receipt path | Continue use of same keyed gateway contract | Prior WorkPass37 tests remain green |
| WILL / ExternalObserverFabric / temporal credit | Existing canonical adapters | Not forked or replaced; existing finalizer preserved | Real external receipts still open |
| MemoryOS2 | Sole writable long-term memory owner | No second memory owner added; archived action receipts stay outside memory graph | Preserved |
| Legacy and source history | SHA-256 content-addressed source manifests | Not deleted or rewritten by this pass | WorkPass38 SHA-256 changed-file manifest is included; every WorkPass37 path remains present |
| UI / Live2D | Existing app and asset tree | No UI files removed; build/E2E remains a release task | Not claimed built in this pass |


## Independent gate results (2026-10-14)

- Runtime typecheck, ActionGateway/archive (17/17), server smoke, release metadata (34/34), metadata contract (6/6), and browser-smoke verdict (51/51): PASS.
- UI/API linkage (124 routes, 48 Runtime Atlas surfaces, 5 required seams), asset audit, server relative imports (10 checked), architecture audit (1,868 source files / 579 canonical files / no missing links, cycles or Legacy leakage), source hygiene (3,988 files, zero warnings/errors) and executable syntax (1,310 JS, 6 shell, 247 JSON): PASS.
- Memory compatibility, action-cost unification, stable serialization, outcome-verification, and WILL/Lumina/Hexis/Letta/Conscio focused integrations: PASS.
- Retrieval benchmark remains not-promoted: corrected temporal semantics, measured recall uplift 0.
- React/Vite production build remains OPEN because `app/node_modules` is not installed (`spawn vite ENOENT`); browser E2E with real Live2D and real provider/device receipts remain OPEN.

Changed-file map: `docs/WORKPASS38_CHANGED_FILES_2026-10-14.json`.
