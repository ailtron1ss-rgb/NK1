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

## Runtime compatibility follow-up (2026-10-24)

The latest CI on the pre-follow-up PR merge head proved the first fix effective: the app regression suite, app typecheck, and development build passed. Runtime typecheck then exposed incomplete handwritten Node.js declarations that hid the actual Node API shape, alongside type-contract errors. In addition, the continual-learning workflow hit an older test fixture that did not provide the observed action result now required to create grounded causal evidence.

Changes committed on `compat/avatar-storage-strict-types-20261024`:
- Resolve Node.js API types through the canonical `@types/node` dependency already installed by CI, and remove conflicting partial ambient declarations.
- Align `ReplaySelectionOptions` import ownership and `gapMs` property names; initialize a required compound-skill evidence counter.
- Handle optional query numbers safely and preserve the exact dataset schema literal types.
- Remove a duplicate cognitive-cycle verifier, retaining the more complete verifier with optional-stage and causal-edge checks.
- Repair the over-escaped Unicode control-character regex.
- Update the causal-stream test fixture to carry `lastAction` and `lastActionSuccess`; the runtime evidence gate was not relaxed.

**Status: implementation committed; CI verification pending.** Exact-head app and runtime checks must pass before this repair can be considered validated. The release ZIP was not rebuilt or changed.

## Third strict-compatibility batch

The latest exact-head CI run passed the app regression suite, app typecheck and app development build. Runtime typecheck then revealed additional strictness defects after the partial Node shims were removed:
- dynamic goal-need keys were typed as arbitrary strings;
- dream-association filters returned `string | false` instead of booleans;
- restored cognitive dependency counters were indexed through an untyped object;
- compound-repair clock IDs and registrar return types were missing from contracts;
- replay and skill-repair causal imports were nullable, so rejected/deduplicated imports could still be dereferenced in the unified-learning path;
- the bounded policy-vector guard did not narrow the optional vector type;
- Node Buffer accumulator inference was too narrow for stream chunks.

These are now corrected on the PR branch. The causal regression also had stale assertions that treated external imports as trusted outcomes. It now tests the actual current contract: imported rows are idempotently stored for later adjudication but do not count as trusted outcomes or replay-eligible evidence.

**Status remains IMPLEMENTED, CI pending.** No runtime or learning pass is claimed until a new exact-head run validates the third batch. The release artifact remains unchanged.
