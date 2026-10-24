# NK1 compatibility repair — 2026-10-24

## Observed failure

The latest source-head run examined during this pass was [GitHub Actions run 40061272363](https://github.com/ailtron1ss-rgb/NK1/actions/runs/40061272363), on `workpass70-source` at `a4cf11141c0e8083e5f8a35bec8c6c2bebac640b`. The targeted app script regression step passed **232/232 tests**. The next step, `npm --prefix app run typecheck`, failed in `app/src/legacy/avatar/safeLocalStorage.test.mjs` with six TypeScript diagnostics:

- `setWindow(value)`: implicit `any`.
- Two direct deletes of the required `globalThis.window` property.
- `getItem(key)` and `setItem(key, value)`: implicit `any` parameters.

The workflow stopped at typecheck, so the app build, runtime typecheck and later organism regressions were skipped. This is a real compile failure, not a runner-allocation failure.

## Applied repair

- Added JSDoc type annotations for the helper argument and the map-backed fake storage values/keys.
- Replaced direct `delete globalThis.window` statements with `Reflect.deleteProperty(globalThis, "window")`, preserving the test's purpose without violating TypeScript's required-property delete rule.
- Kept `strict: true` and `checkJs: true`; no strict compiler checks were disabled and no runtime assertion was removed.
- Recorded the change in `CHANGELOG.md`.

## Verification state

**IMPLEMENTED — CI verification pending.** The patch is isolated on branch `compat/avatar-storage-strict-types-20261024`, based on the source branch head observed during this pass. The GitHub pull-request validation is the next verification gate. Do not treat this change as passed until a run for the exact patch head confirms the avatar storage test, app typecheck, app development build, runtime typecheck and the scheduled regression steps.

## Broader compatibility gates still open

This patch repairs one demonstrated compatibility blocker, not full compatibility. The repository's own release notes still flag production build with database migrations, real browser/Live2D E2E, actual Android/Termux audio synchronization, independent retrieval uplift, endurance/soak coverage, and license review as unresolved. Source-branch Actions history also contains repeated failures, so every new run must be classified from its actual job steps/logs rather than from the conclusion alone.

The published WorkPass70 archive remains a separately versioned release artifact. No release ZIP was rebuilt or replaced by this change.
