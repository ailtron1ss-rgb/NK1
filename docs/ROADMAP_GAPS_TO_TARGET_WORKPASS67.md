# Remaining gaps — WorkPass67 (2026-10-19)

## Closed in code

- Verified `@hookform/resolvers` has no active app import/call path, removed the unused direct dependency and its orphan `@standard-schema/utils` lock entry.
- Preserved `ajv@6.15.0` because ESLint 9 and `@eslint/eslintrc` require Ajv 6.
- Added a local dependency-contract regression covering manifest/lock alignment, stale lock entries, source imports and SBOM.
- Corrected the installer deadline: it terminates the full npm process group with escalation and emits an explicit timeout result. Five tests pass, including a synthetic child that stays alive unless group-killed.
- Regenerated SBOM/provenance and runtime release/architecture/archive manifests for `35.87.0`, schema `225`.

## Still open / blocked

- **P0 install/build:** `registry.npmjs.org` requests return `EAI_AGAIN`; the installer now reliably returns a timeout/fail-fast status and kills the npm process group, but `npm ci`, dependency-complete app typecheck and production Vite build remain unverified. Removing the unused resolver removes its optional Ajv 8 peer conflict, but cannot make unavailable registry packages downloadable.
- **P0 browser/Live2D:** complete real desktop and mobile approval/reload/orphan/reconnect/error journeys, including avatar and audio cancellation.
- **P0 provider/device:** real acceptance with lost ACK, restart, read-only reconciliation, independent postcondition and duplicate replay; local filesystem tests are not equivalent.
- **P0/P1 causal learning:** delayed receipt → independent observation → causal projection → one-time temporal credit/skill/memory update under restart.
- **P1 memory:** independent RU/EN labelled holdout; `recallDelta=0`, vector candidate remains unpromoted.
- **P1 personality/initiative/embodiment/toolmaker/local model:** live behavioural tests, target-device GPU/resource profile, controlled promotion/rollback, licensing/SBOM review and 24–72-hour soak.

## Release decision

Remain `implementation-workpass; release gates remain open`. Weighted engineering roadmap stays at `80.1%`; dependency cleanup is not treated as a new release-gate closure.
