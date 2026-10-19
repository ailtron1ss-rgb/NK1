# WorkPass40 — implementation report — 2026-10-14

## Goal
Continue from WorkPass39 without repeating its already-completed cognitive map and affect-attention wiring. Improve the quality of the canonical system by making recovery safe, accounting for source/dependency provenance, and connecting local language inference to the existing model selector rather than inventing another orchestrator.

## Implemented
1. `tools/lib/state-backup.mjs`: atomic runtime maintenance lock acquisition; backup manifest bounds; symlink rejection; staged copy hashing; exact supported state-file replacement; rollback staging on partial commit; `exactStateSet` and lock-during-commit result markers.
2. `tools/state-backup-workpass40.test.mjs`: exact restore removes state and `.bak` files not in the selected backup, corrupt/symlink/traversal inputs fail before mutation, and lock is released on completion. **7/7 state-backup tests passed.**
3. `tools/super-sbom.mjs`: CycloneDX 1.5 SBOM including locked npm package identifiers/declared licenses/integrity plus hashes/member counts for embedded source archives. `contracts/SOURCE_PROVENANCE_LICENSES_WORKPASS40.json` inventories repository and archive license evidence. Evidence is not a legal compliance opinion.
4. `OpenAICompatibleLocalChatProvider.ts`: bounded OpenAI-compatible POST chat surface for a local llama.cpp server, restricted to loopback HTTP, no remote endpoint credentials, bounded input/tokens/temperature/timeout, and no model state ownership. Integrated with existing P40 Model Ecology and server fallback.
5. `P40ModelEcology.restore`: new default provider profiles are merged into old persisted snapshots without replacing configured/extension profiles. Backend configuration and failure/cooldown telemetry use existing owner.
6. Release version metadata aligned to root pass WorkPass40, runtime 35.62.0 and schema 225.

## Evidence
- State backup regressions: 9/9.
- SBOM/provenance generator: 464 npm package components, 10 embedded source archives; test passes.
- Local provider mocked API/parser/security/model-profile migration test passes.
- Runtime package TypeScript typecheck passes. CapabilityRegistry separately labels a configured llama.cpp endpoint `configured-unverified`, not runtime-available, until request evidence proves reachability.

## Not claimed
No real llama.cpp model was run in this environment; no model weights are distributed. npm registry DNS was unavailable (`EAI_AGAIN`) when dependency installation was attempted, and the archive ships without `node_modules`; therefore Vite production build and browser Live2D E2E are still open. Source-archive license evidence does not replace nested-project/manual legal review. Synthetic MemoryOS2 recall uplift remains zero and the retrieval candidate stays not-promoted.

## Next P0
- Install locked app dependencies, run full app typecheck/Vite build and actual interactive browser/Live2D E2E.
- Run local inference on target hardware and measure model identity, latency, RAM/VRAM and cancellation.
- Test clean-room upgrade/restore/rollback with injected partial commit failure.
- Add real provider/device receipts with reconnect/replay tests; do not claim remote exactly-once without provider evidence.
- Independent labelled temporal holdout, soak, critical-function semantic coverage and license sign-off.

## Final gate split
The primary `npm run audit:workpass40` completes with exit code 0. The live server smoke is intentionally separate as `npm run audit:workpass40:server` because its Node process can keep a handle open when chained behind the full suite; when run separately it exits with `SERVER_SMOKE=PASS`. The broader `npm run test:workpass39-core` also passed as a separate command.
