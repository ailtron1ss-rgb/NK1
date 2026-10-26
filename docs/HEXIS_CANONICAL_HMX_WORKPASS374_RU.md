# NK1 WorkPass374 — Hexis canonical memory / HMX bridge (2026-10-26)

## Scope

Port the existing Hexis adapter into the newer WorkPass373 cognitive-runtime line without replacing that line's event fabric, cross-ledger transaction coordinator, learning gates, progress ledger or release checks.

## Code integration

- OrganismCore.hexisExportHmx() now sends native NK1 state through normalizeNk1HmxExport() and emits a normalized HMX 1.7 envelope.
- HexisCanonicalMemoryProjector applies only an accepted port + additive stage. It validates the full memory section before the first canonical write, uses MemoryFabric as the canonical write path, namespaces imported semantic nodes by source provenance and projects relationships only when both endpoints are in the imported set.
- The persisted application receipt supports defensive, no-write replay; failed application uses snapshots/rollback for canonical memory, semantic graph and optional temporal state.
- OrganismSystemFabric binds the projector to the existing memory subsystem and Hexis adapter. The HTTP decision endpoint accepts only accept, reject or apply and returns explicit 400/404/409 failure statuses.
- Imported HMX goals now have an explicit proposal-only path: prepareGoalProposals creates pending review items; the API can list and approve/reject them, while canonical goal materialization/activation remains a separate explicit operation. An additional explicitly confirmed materialization route maps approved proposals to canonical goal candidates, projects relationships to imported memory nodes, records a typed event/receipt, and replays idempotently; it does not set the goal active.
- The HMX exporter and projector are exposed through .mjs modules plus declaration files. The runtime Node floor remains Node 24.
- The target branch already contained the newer causal-outcome restore guard; it was preserved rather than overwritten with the older branch's copy.

## Focused validation

The branch registers npm run test:hexis-canonical-apply to cover:
1. Hexis adaptation and HMX input bounds;
2. canonical-memory projection, source provenance, relationships and re-import behaviour;
3. HTTP server accept/apply/replay and invalid-decision rejection;
4. idempotent receipt replay with zero reads/writes on the replay path;
5. HMX goals become idempotent pending proposals, with list/approve/reject endpoints, explicit confirmation for canonical materialization, candidate-state assertion, semantic-edge projection and materialization replay.

A branch-specific GitHub Actions workflow runs the runtime typecheck and focused tests. The latest exact-head Actions jobs are reported as failed, but the connector returns no step summaries and the log endpoint responds BlobNotFound; this is an observability blocker, not evidence that the tests passed or a diagnosis of a code failure. Local execution was not available through the GitHub connector. Keep the PR draft until reproducible validation is obtained.

## Current status

- Implementation: staged on hexis-integration-workpass373-20261026.
- Draft integration PR: #235, targeting work/nk1-big-pass-373-cross-ledger-rollback-2026-10-26. Keep draft while exact-head validation is blocked.
- main and the published Release ZIP remain unchanged.
- No production-readiness, autonomous-learning uplift, or recallDelta improvement is claimed.
- Existing external gates remain: production build + DB migration, browser/Live2D and real Android/Termux audio E2E, multi-seed independent retrieval uplift, long soak, license review, and reproducible refreshed Release ZIP.

## Completion condition

Run the focused Hexis workflow and the unified cognitive integration/typecheck on the exact final commit. Resolve any CI-discovered runtime/contract failures before promoting this adapter from the isolated integration branch to the full source branch; update Release ZIP only after validation and artifact hash verification.
