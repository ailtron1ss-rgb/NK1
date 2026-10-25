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

## Fourth follow-up — causal evidence fixtures and CI wiring (2026-10-25)

The newest Actions jobs confirmed the application typecheck and development bundle build passed and the main runtime typecheck advanced past its previous missing-Node-types blocker. The failures were then concentrated in regression setup and standalone workflow contracts:

- The causal replay fixtures used incomplete before/after snapshots and never supplied the action receipt required by `recordOutcome`. They now provide a matching pre-action tick and explicit resulting action/success signal.
- External imported rows are intentionally untrusted and excluded from grounded outcome totals. The aggregate restore test now checks counts derived from rows that actually meet the runtime-grounding contract.
- Exact re-ingestion of the same signed outcome artifact is intended to be idempotent. The test now verifies acceptance without duplicate ledger rows instead of expecting a rejection.
- Dedicated WorkPass291/293 workflows referenced npm scripts that did not exist. The aliases now point to the actual regression files and the intended P23 revision chain.
- WorkPass294 previously ran strict runtime typecheck without installing the canonical TypeScript/@types dependencies. Its workflow now installs from the app lockfile first.

**Status: code and workflow repairs committed; exact-head CI verification pending.** No end-to-end or production-readiness claim is made, and the published release ZIP was not rebuilt or replaced.

## Fifth follow-up — Node 24 strip-only and P26 evidence accounting

The latest exact-head Actions run showed that several previously unexecuted regressions import `VersionedSkillCandidateStore.ts` directly under Node 24 strip-only mode; its constructor used TypeScript parameter properties, syntax Node's strip-only loader rejects. The constructor now uses explicit class fields without changing lifecycle semantics.

The P26 holdout-provenance regression also exposed a gap between the test contract and the runtime: there was no distinct training-exposure metric or durable verified-holdout evidence list. P26 now tracks exposure separately from generalization, accepts only structurally bounded verified + independent evidence records, prevents duplicate evidence IDs from increasing maturity, and restores that evidence ledger across snapshots. A parameter update, a legacy holdout diagnostic, or an internal replay split does not count as independent generalization evidence. The causal restore test was adjusted to reject preserved external-only learning opportunity.

**Status remains implemented, awaiting CI.** These contracts are code changes, not evidence of actual generalization uplift. The release ZIP remains unchanged.

## Sixth follow-up — ensure verification runs when the owning contracts change

The P26 true-learning engine's new bounded evidence-ID validator now rejects actual Unicode control characters. The P26 Learning Validation workflow's path filters also explicitly include `P26TrueLearningEngine.ts` and `VersionedSkillCandidateStore.ts`, ensuring the holdout provenance and Node strip-only compatibility changes cannot silently bypass their intended checks.

The latest run on the previous commit still failed at the pre-fix Node 24 parameter-property parse and before the rolling-metric assertion had been updated on the runner. The next exact-head run is required to verify these fixes. No learning uplift or production-readiness claim is made.

## Seventh follow-up — runtime Live2D mirror and final CI aliases

The runtime-bundled Live2D viewer had drifted from the app's canonical viewer: it did not cache applied expressions and did not consistently update mouth-open/mouth-form targets from the current embodiment state. It now shares the important deduplication and lipsync mechanics while retaining the runtime bundle's current asset-loading model. Motion deduplication also uses the optional motion token rather than only group/index.

The latest WorkPass294 Actions run passed strict runtime typecheck, but then failed because the workflow invoked an npm alias that had no entry in `runtime/neuro-kurisu/package.json`; the alias now points to the existing focused test. WorkPass293 further uncovered a remaining TypeScript parameter property in the durable trusted-run registry; it now uses an explicit field/constructor assignment to work under Node 24 strip-only mode.

The previous WorkPass110 run passed causal evidence and avatar lifecycle tests before failing its Live2D integrity assertion against the stale runtime viewer. The new exact-head run must confirm the behavior and remaining integrations. The release archive is still unchanged.
