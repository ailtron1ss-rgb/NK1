# WorkPass58 handover — 2026-10-17

## База и результирующая версия
- Base archive: `Neuro_Kurisu_WORKPASS57_2026-10-17.zip`
- Current candidate: `Neuro_Kurisu_WORKPASS58_2026-10-17.zip`
- Runtime `35.78.0`; persisted schema `225`.
- WorkPass58 scope: **8/8 deliverables = 100%**. Official weighted release roadmap: **78.0%, unchanged**.

## Code path already modified
- `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts` (`executeReusableSkill`, `executeProjectTool`): all-candidate preflight; no partial execution without durable parent key; stable child keys/decision IDs; project key validation before budget charge; normalized options passed through gateway and approval continuation.
- `runtime/neuro-kurisu/src/server/server.mjs`: external HTTP project routes do not trust client-supplied `autonomous=true`; surface preflight failures explicitly.
- `runtime/neuro-kurisu/src/server/idempotency-response.mjs`: shared 400-versus-428 mapping; its focused test verifies invalid versus missing key semantics.
- `runtime/neuro-kurisu/tests/workpass58-composite-idempotency-preflight.mjs`: real core integration regression.
- `runtime/neuro-kurisu/tests/memory-background-index-workpass56.mjs`: deterministic provider barrier replaces flaky arbitrary delay.

## Verification already run
- Runtime `npm run typecheck`: PASS (tsc).
- W58 focused integration: PASS (`blockedBeforeExecution=true`, 2 step receipts, keyed replay, project preflight/budget and decision propagation).
- `npm run test:workpass57` standalone: PASS; receipt integration 9/9; provider reconciliation five scenarios; crash/replay, memory background indexing and embedding privacy PASS.
- Current memory benchmark still returns `recallDelta=0` / `not-promoted`.

## Continue from these tasks, not from a fresh audit
1. Exhaustive side-effect caller matrix and route every external mutation through a single keyed execution/finalizer boundary.
2. Add durable project/skill restart checkpoint and reconciliation for ambiguous outcomes.
3. Add browser-level coverage for HTTP 400/428 mapping and verify the UI shows a recoverable missing-key state rather than a generic error banner.
4. Wire an actual provider/device postcondition observer and test timeout-after-submit/reconnect without duplicate effects.
5. Build frozen labelled memory holdout and show real uplift before promoting any semantic ranker.
6. Only afterwards close production browser/Live2D, target inference, rollback, license review and soak.

Do not increment 78.0% based only on this code pass. Keep separate percentage tracking for each pass from its explicit task inventory.
