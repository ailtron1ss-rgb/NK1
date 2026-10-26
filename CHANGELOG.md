# WorkPass365 — live PostgreSQL migration apply, idempotence and rollback (2026-10-26)

- [TEST] Added `app/scripts/migrate-postgres.integration.mjs`, using the real app migrator and a PostgreSQL 17 service.
- [APPLY] A temporary SQL migration creates a uniquely named table and row; the test checks the table exists and exactly one `_migrations` row records the migration.
- [IDEMPOTENCE] The migrator runs a second time; existing data and the ledger entry must remain unchanged.
- [ROLLBACK] The test writes another temporary migration that creates a table, then runs invalid SQL. The actual migrator must fail; the created table must be gone, the failed migration must not be recorded, and the earlier successful table/migration must remain intact.
- [CLEANUP] All temporary migration files, ledger entries and test tables are removed. No product schema or dependency/lockfile was changed.
- [CI] Added a disposable PostgreSQL 17 service to `.github/workflows/workpass362-clean-app-build.yml` and a step-scoped `DATABASE_URL` for the migration integration test. Production UI build remains separate from live database verification.
- [VALIDATION] Workflow [#40293681029](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40293681029) passed on code/test SHA `53aa78d0a9c04c87db1cff63a0ec35ec9ebd716c`: service health, clean-checkout doctor, app/runtime locked installs, 232 app regressions, combined app/runtime `TYPECHECK=PASS`, production Vite client/SSR/Nitro build, `WORKPASS365_POSTGRES_MIGRATION=PASS apply=1 rerun=idempotent rollback=atomic`, UI/API linkage (`routes=131`, `runtimeAtlas=50`, `requiredSeams=5`), `SCHEMA_CHECK=PASS`, assets and container shutdown all passed. Later commits in the checkpoint block are documentation-only.

# WorkPass365 — live PostgreSQL migration apply/rerun/rollback test (2026-10-26)

- [TEST] Added `app/scripts/migrate-postgres.integration.mjs`, which runs the actual `app/scripts/migrate.mjs` against a disposable PostgreSQL service. It creates a temporary migration file and verifies the first apply creates a table and a single `_migrations` ledger row.
- [IDEMPOTENCY] The integration test reruns the migrator and asserts the successful migration is not applied twice: the table data and ledger remain unchanged.
- [ROLLBACK] It then injects a separate temporary migration whose SQL creates a table and fails later in the same transaction. The migrator must fail, the partially created table must not exist, no ledger row may be written, and the previously successful migration must remain intact.
- [CLEANUP] Temporary migration files, ledger rows and tables are removed in `finally`; no product schema or dependency/lockfile was changed.
- [CI] Expanded the clean app build workflow with a PostgreSQL 17 service and a dedicated integration step using a step-scoped `DATABASE_URL`. The production UI build still runs without fake DB credentials; the live DB contract runs only in the dedicated step.
- [VALIDATION] Workflow [#40293547992](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40293547992) is running on exact head `73eb50b60300f7a69532e3d0fc0f4b4bab4e04fd`; do not mark WP365 complete until the PostgreSQL service and the new integration step pass.
 
# WorkPass364 — keep typecheck dependencies installed in clean build CI (2026-10-26)

- [DIAGNOSTIC] WorkPass362 run [#40292700286](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40292700286) failed with `TS2688: Cannot find type definition file for 'pg'`. Root cause: job-level `NODE_ENV=production` made `npm ci` omit devDependencies, including the already-locked `@types/pg`.
- [FIX] Removed production `NODE_ENV` from the whole workflow job so app/runtime typecheck and tests install the complete locked toolchain. `NODE_ENV=production` is now set only for the production build step; no fake Postgres credentials are added.
- [VALIDATION] Clean-build run [#40292876890](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40292876890) passed on head `9020481492b447e719c30bdb678b42a4e3ab3d99`: doctor, locked app/runtime installs, app dependency/script contracts (232 tests), combined app/runtime `TYPECHECK=PASS`, production Vite client/SSR/Nitro build, UI/API linkage (`routes=131`, `runtimeAtlas=50`, `requiredSeams=5`), schema (`SCHEMA_CHECK=PASS`) and canonical asset audit all succeeded. The migration entry point truthfully skipped external Postgres because `DATABASE_URL` was absent; this is not a live DB migration result.

# WorkPass363 — fix clean app typecheck failures (2026-10-26)

- [DIAGNOSTIC] The first full-stack clean-checkout run [#40292398129](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40292398129) exposed app-layer errors not covered by runtime-only CI: implicit types and deletion of a required `globalThis.window` member in `safeLocalStorage.test.mjs`, plus TypeScript module resolution failing to expose the already-locked `@types/pg` package to `app/tsconfig.json`.
- [FIX] Typed the fake window and localStorage test callbacks, replaced illegal `delete globalThis.window` operations with `Reflect.deleteProperty`, and constrained the in-memory fixture to `Map<string, string>`.
- [FIX] Added `pg` to the explicit TypeScript `types` list; `@types/pg` was already a locked dev dependency, so no dependency/version or lockfile drift was introduced.
- [DIAGNOSTIC] [#40292593216](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40292593216) caught a second mistake: TypeScript type annotations were temporarily placed in an executable `.mjs` test. Replaced them with JSDoc types and a context-typed fake storage object; `.mjs` remains valid JavaScript.
- [VALIDATION] Run [#40292876890](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40292876890) passed the corrected `.mjs` type fixture and combined app/runtime typecheck. The app build then completed with all UI/API/schema/asset checks green; the remaining explicit limit is that the CI environment did not provide a real Postgres `DATABASE_URL`.
 
# WorkPass362 — clean production UI build + migration/schema contracts (2026-10-26)

- [CI] Added `.github/workflows/workpass362-clean-app-build.yml` on Node 24. It runs the clean-checkout doctor before package installation, installs the app and runtime from their own locked dependency trees, runs the app dependency/script contracts, performs the combined app/runtime typecheck, builds the production UI through the existing env/assets wrapper, and then runs UI→runtime API linkage, schema and asset consistency audits.
- [MIGRATION] The production build invokes the existing `app/scripts/migrate.mjs`; without `DATABASE_URL`, the migrator must explicitly report that it skipped external PostgreSQL migration (PGLite/local startup migrations are separately tested). No fake database credentials are supplied.
- [SCOPE] This is a real clean-checkout build gate, but it does not prove a deployed PostgreSQL migration against a production-like database or browser/Live2D/device E2E.
- [VALIDATION] WorkPass362 workflow [#40292876890](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40292876890) passed on the exact code head: combined app/runtime typecheck, production UI build, UI/API linkage, schema and canonical asset consistency all succeeded. Real external PostgreSQL migration and browser/device E2E remain separate gates.

# WorkPass361 — broad runtime smoke and persistence continuity validation (2026-10-26)

- [CI] Added a dedicated Node 24 workflow that runs runtime typecheck, standard organism smoke, legacy restart-persistence, canonical persistence/restore continuity, persistent-continuity organism integration, and verified autonomous-life restart regression on the same checkout.
- [PURPOSE] These checks cross the newly repaired Core action/goal attribution path with established startup, persistence and continuity coverage rather than relying only on the new targeted test.
- [VALIDATION] Workflow [#40291631075](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40291631075) passed on head `ee360dba4503011157fc2780f0f5b0fd7accb33c`: runtime `TYPECHECK=PASS`, `CLEAN_ORGANISM_SMOKE=PASS`, `CLEAN_RESTART_PERSISTENCE=PASS`, `PASS20_PERSISTENCE_RESTORE=PASS tick=2->3`, `PERSISTENT_CONTINUITY_ORGANISM_PASS`, and `BIG_PASS_155_RESTART=PASS cycles=1 decisions=1 digestRestored=true`.
- [LIMIT] CI tests do not replace a clean-machine Docker launch with configured production evaluator authorities, real browser/Live2D E2E, Android/Termux audio, long soak, independent held-out uplift or license review.

# WorkPass360 — bind whole-organism restart evidence to canonical MemoryOS2 (2026-10-26)

- [TEST HARDENING] The WorkPass358 restart test no longer searches recursively across arbitrary snapshot values. It reads only `OrganismCore.snapshot().facets.advanced.memoryOS.items`, the canonical persisted MemoryOS2 owner, and requires the same marker-bearing item/ID before and after process restart.
- [PURPOSE] Prevents unrelated journal, trace, compatibility projection, or diagnostic copies from satisfying the memory-continuity assertion by accident.
- [VALIDATION] Focused workflow [#40291427381](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40291427381) passed on head `638efa8ca5f3b95a4083b63018c5e2b199c75a81`: native provider 10/10, evaluator-config 16/16, MemoryOS restore boundary PASS, file-backed process recall PASS, strict canonical MemoryOS2 full-runtime restart PASS, runtime `TYPECHECK=PASS`.
- [LIMIT] This test validates persistence through the runtime-owned state files in a controlled fixture. It does not yet prove production-scale memory migrations, multi-store crash consistency, or memory retrieval quality uplift.

# WorkPass359 — preserve action/goal attribution under executive arbitration (2026-10-26)

- [RUNTIME BUG] A full `OrganismRuntime.step` could throw `RangeError: B272 outcome action must match the generated action` when the canonical decision/policy selected an action different from the endogenous B272 goal generator's proposed action.
- [FIX] The Core now credits the B272 goal generator only when the actual selected action matches its current generated action. B273 goal-lifecycle learning is independently gated by agreement with B273's current action. World-transition feedback applies the same checks. The action/outcome still flows through the broader organism learning path; the generated goal is simply not taught a consequence for an action it did not propose.
- [SAFETY] The B272 strict action validation remains unchanged; mismatched outcomes are not rewritten or forged to pass the gate. This prevents a genuine policy arbitration mismatch from crashing the organism while preserving causal credit boundaries.
- [REGRESSION] The new full-runtime writer/reader test (WorkPass358) drives a real `OrganismRuntime.step`, persists the canonical memory, stops the runtime in one process, and reopens it in a new process. The WorkPass349 CI workflow now watches `OrganismCore.ts` and runs the complete regression stack.
- [VALIDATION] Focused workflow [#40291145587](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40291145587) passed on workflow head `1ed262e350c41b4031680cb61fea70ae77a5b126` (Core fix commit `25c2363688be0cb76ca203d693df538c0cdc5456`): P23 10/10, evaluator-config 16/16, `WORKPASS356_MEMORYOS_RESTORE_BOUNDARY=PASS`, `WORKPASS357_FILE_BACKED_MEMORY_RESTART=PASS`, `WORKPASS358_FULL_ORGANISM_RESTART=PASS separate-process runtime + canonical memory`, and runtime `TYPECHECK=PASS`. WorkPass331 canonical kernel workflow also passed on the Core fix commit. No production-readiness or independent learning-uplift claim.
 
# WorkPass357 — cross-process durable memory recall regression (2026-10-26)

- [INTEGRATION] Added a file-backed MemoryOS lifecycle regression using two independent Node processes: writer normalizes and persists the canonical memory snapshot through `FileStateStore`; reader reopens the file, restores `MemoryOS2`, rebuilds indexes, retrieves the target causal/autobiographical memory, verifies the causal link, and runs the read-only memory doctor.
- [ASSERTION] The test checks exact memory identity and evidence-bearing content after process separation, rather than only comparing two objects in one process.
- [CI] Focused workflow [#40290445048](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40290445048) passed on head SHA `aba212a52e6f058ff834fa0e036e37c1b10e7497`: native P23 10/10, evaluator config 16/16, WorkPass356 restore boundary PASS, WorkPass357 separate-process memory recall PASS, runtime `TYPECHECK=PASS`.
- [LIMIT] This proves a bounded memory state can survive a file-backed process boundary in the regression fixture. It does not yet prove that the full running organism restores every memory owner consistently, that recall beats an independent baseline, or that production deployment is ready.

# WorkPass356 — safe restoration of canonical long-term memory (2026-10-26)

- [RESTORE GATE] `MemoryOS2.restore` now rejects non-plain top-level state and unsupported/future schema versions before touching the live memory graph. Versionless/older states remain eligible for the existing migration path.
- [IDENTITY] Malformed memory rows are discarded before index reconstruction. Any ID collision causes all rows for that ID to be dropped, avoiding a split state where the item array keeps duplicates while the ID index silently overwrites one.
- [INTEGRITY] Restore now recomputes content hashes instead of trusting persisted derived hashes; normalizes core score fields and epistemic status; bounds semantic vectors and links; rejects vectors containing non-finite values; and filters malformed entity/link data.
- [TEST] Added `tests/workpass356-memoryos-restore-boundary.mjs` covering fail-before-mutation on future schema/array state, legacy versionless migration, duplicate-ID removal, malformed-row filtering, derived-hash repair and scalar/vector/link sanitation.
- [VALIDATION] Focused workflow [#40290445048](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40290445048) passed on head `aba212a52e6f058ff834fa0e036e37c1b10e7497`: native provider 10/10, evaluator-config 16/16, `WORKPASS356_MEMORYOS_RESTORE_BOUNDARY=PASS`, separate-process `WORKPASS357_FILE_BACKED_MEMORY_RESTART=PASS`, and runtime `TYPECHECK=PASS`. The earlier run on `8ed2564` exposed a misplaced link-filter edit; that normalizer correction is covered by this green run.
- [LIMIT] This protects the canonical MemoryOS restore boundary; it does not yet prove end-to-end durable recall across a real process restart or independent retrieval uplift.

# WorkPass355 — centralize learner environment filtering (2026-10-26)

- [SECURITY] Exported one canonical `isForbiddenLearningEnvironmentKey` policy from `LearningProcessSupervisor.ts` and reused it from the host-owned evaluator adapter, removing duplicate deny-list logic.
- [SECURITY] The generic supervisor now rejects both inherited and explicitly supplied sensitive environment keys and runtime injection variables before storage allocation. This closes the bypass where direct callers could pass API keys or alter a child runtime via `NODE_OPTIONS`/loader environment.
- [INTEGRATION] Host-owned evaluator configuration applies the same policy to inherited and explicit child environment variables; error reporting remains specific to the owning authority.
- [TEST] Added direct-supervisor negative regressions for inherited `OPENAI_API_KEY` and explicit `OPENAI_API_KEY`, including proof that rejected requests create no run-root state.
- [VALIDATION] Focused workflow [#40289516633](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40289516633) passed on code/test SHA `295e11f3e9795375f81bbad1b493e2bac842317a`: native provider 10/10, evaluator-config suite 16/16, direct supervisor regression completed successfully, and runtime `TYPECHECK=PASS`. Later checkpoint commits are documentation-only. No dependency added; do not pass credentials to candidate execution as a substitute for host-owned authority isolation.

# WorkPass354 — enforce private, disjoint learning-process storage roots (2026-10-26)

- [SECURITY] The generic `LearningProcessSupervisor` now creates run/survive roots with owner-only permissions, validates existing directories instead of silently trusting their permissions, rejects final-component symlinks, and binds each inspected directory to its canonical filesystem identity.
- [BOUNDARY] Rejects equal/nested run and survive roots before filesystem allocation; after canonicalization it also rejects aliased roots sharing the same path or filesystem identity. The execution fingerprint now records canonical storage roots and their identities.
- [REPLACEMENT] On POSIX, a root's immediate parent must not be group/world writable unless the sticky bit protects directory entries. This prevents a private-looking child path from being trivially replaced by another account.
- [TEST] Added direct-supervisor regressions for writable run roots, overlapping storage roots and symlinked run roots. Invalid run-root setup is validated before the survive root is created.
- [VALIDATION] Focused workflow [#40289252511](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40289252511) passed on code/test SHA `959ced22f50267dd18d5c7f9403d2905e37dd716`: native P23 provider 10/10, supervisor regression process completed successfully, evaluator-config wiring 16/16, and runtime `TYPECHECK=PASS`. Later checkpoint commits are documentation-only. No dependency added; these path controls are not a sandbox or a production-readiness claim.

# WorkPass353 — canonicalize the mutable-state boundary for evaluator config (2026-10-26)

- [SECURITY] The independent evaluator-config loader now canonicalizes the configured mutable state directory before checking whether the executable host config lives inside it. A symlink alias can no longer make a file physically within mutable organism state appear external.
- [TEST] Added a POSIX regression for an evaluator module reached under the real state directory while the supplied state path is a symlink alias. The regression requires fail-closed rejection.
- [CI] Extended the focused WorkPass349 workflow to run `workpass330-production-revision-wiring.mjs` in addition to the signed-dataset, supervisor-cleanup and host-authority path suites, then runtime typecheck.
- [VALIDATION] Dedicated workflow run [#40289015403](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40289015403) passed on code SHA `6cd2776acc9094d73031c29a9f069687b97e05b9`: native P23 provider, supervisor cleanup, host-owned executable-path checks, evaluator-config identity/state-boundary suite, and runtime typecheck all succeeded. Later commits in the checkpoint block are documentation-only; no dependency added and no production-readiness or learning-uplift claim.

# WorkPass352 — protect host authority executable parent directories (2026-10-26)

- [SECURITY] Host-owned executor/verifier/safety-scanner configuration now checks the canonical executable's parent directory is a directory and not group/world writable on POSIX. A non-writable executable file alone is insufficient when the directory entry can be replaced.
- [SECURITY] The executable parent's filesystem identity (device/inode on POSIX, canonical path on Windows) is stored at preparation and revalidated immediately before each host authority dispatch. A replaced parent directory fails closed even if a new executable is placed at the old path.
- [TEST] Added regressions for a read-only executable inside a writable parent and for replacing the parent directory after service construction.
- [CI] WorkPass349 focused run #40285352614 passed on SHA `b9e0e90710e1380cac0ee57e1a0deaf74e214cf1`: native P23 provider suite 10/10, process-supervisor failure-cleanup regression, host-owned evaluator executable path/parent regressions, and runtime `TYPECHECK=PASS`.
- **Boundary:** host-owned path integrity is defense in depth, not an OS sandbox. Deployment must still provide genuinely isolated executor/verifier/scanner binaries.

