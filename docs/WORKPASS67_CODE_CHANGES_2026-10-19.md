# WorkPass67 — code changes (2026-10-19)

## 1. Remove an unused peer-heavy application dependency

An active-source search found no imports or calls from `@hookform/resolvers`, `zodResolver` or `ajvResolver` anywhere under `app/src` and `app/scripts`. The package was a direct app dependency solely in package metadata. Its v5.9.1 lock entry declared a set of optional peers, including `ajv@^8.12.0`; the app lock also carries `ajv@6.15.0` as a genuine ESLint 9 dependency. The resolver functionality was not part of an active call path, so the dependency was removed instead of unnecessarily adding another Ajv major line.

The unused direct dependency is removed from `app/package.json` and `app/package-lock.json`. Its only-owned `node_modules/@standard-schema/utils` lock entry is also removed after checking incoming dependency edges. The Ajv 6 entry and ESLint dependency edges remain intact.

## 2. Regression and provenance

`tools/app-dependency-contract.test.mjs` validates app manifest/lock-root alignment, checks the resolver and orphan utility do not remain as stale lock entries or incoming dependency edges, scans active app source paths for imports, and verifies the regenerated SBOM does not retain the removed components. `contracts/SBOM.final.json` and `SOURCE_PROVENANCE_LICENSES_WORKPASS67.json` are generated from the updated lockfile and source tree. The embedded `src/organism/system/ReleaseContract.ts` and integration manifest are aligned with the package metadata; the strict release-contract regression caught and confirmed correction of the old 35.86.0 constant. Runtime release, architecture and archive manifests are regenerated for `35.87.0 / WorkPass67`; persisted schema remains `225`.

## 3. Install deadline actually terminates the full process group

WorkPass66's installer used `spawnSync` with a timeout. An actual install attempt exposed that timeouts were not a reliable end-to-end bound when npm lifecycle descendants kept inherited streams open. The installer now launches npm with a dedicated POSIX process group, sends `SIGTERM` at deadline and escalates to `SIGKILL` after 750 ms, then returns explicit `SUPER_INSTALL=TIMEOUT` / `SUPER_INSTALL=FAIL` status. It remains fail-fast and does not proceed to runtime install after app failure. A regression spawns a fake npm process plus a 30-second child, verifies return within six seconds for a one-second deadline, and confirms the descendant is gone. The timeout process-group regression passed alongside the four existing installer contract tests (5/5).

## 4. Verification boundary

The dependency contract itself uses Node built-ins and requires no installed app dependencies. It does not constitute a successful `npm ci`. The registry is still unreachable from this environment; the full dependency installation, production Vite build, app TypeScript check, browser/Live2D E2E and real provider/device acceptance remain open. Removing the optional peer-heavy unused package fixes that dependency inconsistency, not the external DNS/network outage.
