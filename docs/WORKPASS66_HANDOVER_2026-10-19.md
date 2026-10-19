# WorkPass66 handover — 2026-10-19

## Base and release identity

- Base: `Neuro_Kurisu_WORKPASS65_2026-10-19.zip`
- Canonical runtime: `35.86.0`
- Persisted schema: `225` (no state schema migration was needed)
- Root package: `35.0.0-super-workpass66`
- Release status: `implementation-workpass; release gates remain open`

## Completed in code

1. Canonical `npm run install:all` now covers both `app/` and `runtime/neuro-kurisu/`, validates each committed lockfile against its manifest before installation, uses bounded npm retries/deadlines and fails fast with workspace-specific diagnostics.
2. Runtime typecheck prefers its own local TypeScript compiler or the pinned compiler installed via the app lockfile, then uses PATH, and only finally uses the explicitly labelled Node strip-syntax fallback.
3. Restored consistency across runtime `VERSION.json`, package manifest/lockfile, `RELEASE_MANIFEST.json`, `RELEASE_ARCHIVE_MANIFEST.json`, and root `SUPER_VERSION.json`.
4. Added deterministic regressions for dual-workspace installation, fail-fast and malformed lock contract, and compiler selection.

## Results obtained in this environment

- `tools/super-install.test.mjs`: 4/4 pass.
- `runtime/neuro-kurisu/tests/typecheck-runtime-compiler-selection.mjs`: pass.
- Runtime typecheck: PASS using available PATH `tsc` 5.8.3. The pinned app compiler-selection path is verified by the focused regression; it could not be exercised with the real installed package because dependency installation is blocked.
- WorkPass65 archive revision/receipt regression group: PASS.
- Release metadata contract, app source-script suite 218/218 and browser-smoke comparator 51/51: PASS.
- Before the metadata regeneration, release contract audit failed because RELEASE_MANIFEST lagged behind VERSION.json. This mismatch is corrected in WorkPass66; post-change audits are in the packaged evidence.
- `npm run install:all` was actually retried: npm failed with `EAI_AGAIN` resolving `registry.npmjs.org/ajv`, without rewriting the lockfile. It also warned that `@hookform/resolvers@5.9.1` has an optional Ajv ^8 peer while app root lock currently resolves Ajv 6.15.0 (used in the ESLint chain); do not manually rewrite the lockfile without a network-enabled reproducible resolve. The real app install and production Vite build could not be completed. The real provider/device and browser/Live2D gates were not simulated or marked done.

## Next critical items

1. In a network-enabled target environment, run `npm run install:all`, root `npm run typecheck`, and `npm run build` from a clean checkout; preserve the full npm output and prove app TSC uses the locked TypeScript.
2. Run real desktop and mobile browser journeys including approval, changed-input, decline/expiry, reload/orphan, reconnect and error. Include the actual Live2D stage and audio cancellation.
3. Configure an actual external provider/device target and complete acceptance → lost ACK → process restart → read-only reconciliation → independent postcondition/read-after-write → duplicate replay, proving one external mutation only.
4. Keep retrieval vector candidate unpromoted until independent Russian/English labelled holdout demonstrates repeatable uplift over BM25/hybrid baseline.
5. Continue rollback, source/license/SBOM review and 24–72 h soak before any release sign-off.

## What this pass does not claim

A passing fake-npm harness is not a dependency install. Source-script and comparator tests are not browser E2E. Local filesystem recovery is not remote provider/device exactly-once evidence. The overall weighted roadmap remains 80.1% pending independent release evidence.
