# WorkPass66 — code changes (2026-10-19)

## 1. Canonical installer covers both committed lockfiles

`tools/super-install.mjs` previously ran `npm ci` only in `app/` even though `runtime/neuro-kurisu/` also has its own package and lock manifests. It now resolves the repository root from the script location, validates both lockfile roots against package names/versions before mutating either workspace, and runs lockfile-clean install separately in `app/` and `runtime/neuro-kurisu/`. Network retries, fetch timeout and total step deadline are bounded; a failure stops the pass and produces an explicit workspace result and DNS/registry recovery instruction. It does not rewrite either lockfile.

Four Node-native tests cover app+runtime install invocation, fail-fast order, missing lockfile and package/lock version conflict. They use a deterministic fake npm executable; these tests validate orchestration, not the actual download of dependencies.

## 2. Runtime typecheck prefers pinned TypeScript

`runtime/neuro-kurisu/scripts/typecheck-runtime.mjs` now selects a workspace-local compiler first and then the TypeScript compiler installed under the app lockfile (`app/node_modules/typescript/bin/tsc`), before falling back to `tsc` on `PATH`. The canonical installer installs the app lock, so the production runtime typecheck can use the project's locked TypeScript instead of a machine-global compiler. Syntax-only fallback remains explicitly labelled if no semantic compiler exists.

A regression creates a temporary repo layout with a fake pinned app compiler and verifies that it wins over the global compiler path.

## 3. Release contract restored and advanced

Pre-change audit found a real mismatch: `runtime/neuro-kurisu/VERSION.json` and `package.json` declared 35.85.0 / WorkPass65, while `RELEASE_MANIFEST.json` and `RELEASE_ARCHIVE_MANIFEST.json` still described 35.84.0 / WorkPass64. `audit:contract` and `verify:release-source` failed on the input baseline. WorkPass66 advances runtime to 35.86.0 and regenerates the architecture, release and archive manifests from the canonical VERSION.json.

## Verification boundary

The installer contract and runtime compiler-selection tests pass. Runtime TypeScript typecheck and WorkPass65 receipt/archive regressions pass. The npm registry cannot currently be resolved from this execution environment (`Could not resolve host: registry.npmjs.org`), so locked app dependencies were not downloaded; app typecheck, Vite production build and real browser/Live2D E2E are still blocked. No test in this pass is represented as live remote-provider/device validation.
