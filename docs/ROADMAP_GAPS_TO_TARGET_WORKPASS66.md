# Roadmap gaps to target — WorkPass66 (2026-10-19)

## Closed by this pass

- **Install orchestration:** canonical installer now governs both committed package lockfiles; tests cover success ordering, fail-fast, missing lock and manifest/lock identity drift.
- **Compiler selection:** runtime typecheck can use the exact compiler pinned by `app/package-lock.json` rather than a global PATH compiler.
- **Release metadata drift:** the baseline had a failing runtime contract (`VERSION.json` 35.85.0/WorkPass65 versus `RELEASE_MANIFEST.json` 35.84.0/WorkPass64). Canonical manifests are regenerated from the current `VERSION.json`.

## Still OPEN / blocked

- App dependency install and production build: `npm run install:all` ran, but npm failed with `EAI_AGAIN` while resolving `registry.npmjs.org/ajv`; lockfile remained unchanged. npm also warned about optional peer `@hookform/resolvers@5.9.1` (`ajv@^8.12.0`) versus root `ajv@6.15.0`. Resolve with a registry-enabled reproducible install before editing lockfiles; no app `node_modules` or successful Vite build is claimed.
- Browser/Live2D: source contract checks only; no real desktop/mobile browser journeys this pass.
- Remote provider/device acceptance/ACK gap, reconnect and independent postcondition: local filesystem fixture does not close this.
- Memory retrieval uplift: previous independent evidence remains `recallDelta=0`; vector candidate remains `not-promoted`.
- Full delayed receipt → causal projection → temporal credit → one-time memory/skill update under live provider restart.
- Live autonomous initiative soak, audio-clock/viseme lip-sync, self-improvement promotion/rollback, target-GPU profile, source/model licensing, SBOM and clean-room rollback.

## Release decision

Remain `implementation-workpass; release gates remain open`. Keep the official weighted roadmap at 80.1%; no percentage increase is attributed to adding orchestration/tests alone.
