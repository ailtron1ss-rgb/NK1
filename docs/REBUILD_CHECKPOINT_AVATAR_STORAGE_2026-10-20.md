# Rebuild checkpoint — legacy avatar storage hardening (2026-10-20)

## Scope

The legacy sprite deck persisted its selected outfit through direct `window.localStorage` access in both the React state initializer and an effect. Browsers, embedded webviews, or privacy settings can throw while resolving the storage object or reading/writing it; that could break the avatar component even though outfit persistence is optional.

## Implemented

- Added `safeLocalStorage.ts` with best-effort read/write helpers that catch access and operation errors.
- Wired `LegacySpriteDeck.tsx` to the helpers. When storage is unavailable, initial outfit falls back to `lab_coat`; persistence failure does not block the visual.
- Added three Node tests covering missing/throwing window access, throwing get/set operations, and successful persistence.
- Added `app/package.json` script `test:avatar-storage` and an exact CI step in the rebuild regression workflow.

## Verification

Run from repository root:

```sh
node --experimental-strip-types --test app/src/legacy/avatar/safeLocalStorage.test.mjs
```

Expected: 3 tests pass. Exact-head GitHub Actions result is tracked separately; this checkpoint does not claim a browser-level visual acceptance test.

## Commits

- `2f2c506bf3aa2f220a817f3d952109b5faf22151` — safe storage helper
- `650c45eeca3e50ff5c59df8381221cd2af5fb560` — regression tests
- `8dc7dd95ca1218f31a24091f6023cb5c27ec70eb` — production integration
- `60d792779b54b7e0e9a5a1488c52f20793c217f0` — package test script
- `9572fe61197aa3bcbfd2367b421e8619047a86c5` — CI step

## Remaining embodiment gates

- Verify actual browser render and asset hydration.
- Reconcile browser speech synthesis, backend voice routes and Android bridge under one explicit status/interrupt contract.
- Exercise microphone/STT permissions, interruption, unmount/visibility changes and target-device performance.
- Measure lip-sync against audio/phoneme timing; the current speaking indicator is not evidence of real lip synchronization.
