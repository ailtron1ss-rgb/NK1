# Neuro-Kurisu SUPER — WorkPass 14 report

**Date:** 2026-10-10  
**Base:** WorkPass 13 / runtime 35.40.0 / schema 223  
**Status:** implementation workpass, not release-ready.

## Mini-report: real implementation

- Fixed test-environment contamination that caused 8 PWA/share-card tests to fail when they read the real checked-in `site.json` and public share image. Tests that assert host/document fallback now use an isolated empty workspace. Production app identity is unchanged.
- Changed browser baseline comparison from aggregate error-count comparison to per-signature occurrence-count comparison. New messages or increased repeats are detected even if old baseline errors exist.
- Wired explicit baseline divergence to exit code 3 so CI cannot report success for a page that differs from a supplied baseline. HTTP/navigation failures keep exit code 1; current console/page runtime errors keep exit code 2.
- Added root `test:app:scripts` and `audit:workpass14`. Release metadata validator now derives active status/scorecard filenames from `SUPER_VERSION.json` build lineage and has a fail-closed regression for missing current-pass evidence files.

## Verification

- `node --test 'app/scripts/**/*.test.mjs'`: **203/203 PASS**.
- `node --test app/scripts/browser-smoke-verdict.test.mjs`: **46/46 PASS**.
- `node --test tools/verify-release-metadata.test.mjs`: **6/6 PASS**.
- Changed ESM files pass `node --check`.

## Honest blockers

The full `npm --prefix app test` suite reaches the dependency-free script suite, then cannot load two TypeScript test files because `@tanstack/react-start` and `jose` are not installed. Registry access failed earlier with `EAI_AGAIN`; no install, React/Vite production build, semantic app typecheck or Playwright browser run is claimed. The comparator is tested but has not itself been driven against a live browser in this environment.

## Reconciled progress

The normalized inventory is 42 tasks: 25 DONE, 9 PARTIAL, 8 TODO. Weighted implementation score is **67.95%** (up from 67.80%, +0.15 percentage points), changing only workstream B from 92% to 93% based on the actual new test and baseline-regression behavior. Release readiness remains not passed.

## Next action

Install dependencies in a network-enabled clean environment, run root/app typecheck and React/Vite production build, and complete desktop/mobile Playwright E2E including chat, auth, Runtime Atlas, Live2D and sprite fallback. If dependency installation remains blocked, continue the capability-evidence graph without treating these release gates as done.
