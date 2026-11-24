# WorkPass39 tasks — 2026-10-14

## Completed in this pass
- [x] New SHA-256 evidence identities with legacy-ID continuity.
- [x] Confidence/resource-aware global workspace, duplicate signal normalization, restored broadcast validation.
- [x] Read-only map of 14 cognitive systems and 22 typed flows; live API and Runtime Atlas surface.
- [x] Emotion/body/interoception → affect specialist → global workspace → bounded action-candidate prior, with P69 retained as final arbiter.
- [x] Salience fusion preserves both source evidence streams; disabled network does not leak stale broadcast into scoring.
- [x] Immutable historical bytes and archive manifest references repaired after current code changed.
- [x] Exact-duplicate content-addressed blob and repeated report cleanup with canonical pointers.
- [x] Runtime/API/assets/UI linkage audits and metadata synchronized.
- [x] Reviewed 15 upstream repositories/documents and documented reuse/licensing/runtime decisions.

## Open P0/P1 — next passes
1. [ ] App `npm ci`, TypeScript/UI check and production Vite build in an environment with working registry access; current attempt blocked by `EAI_AGAIN registry.npmjs.org`.
2. [ ] Browser E2E on the actual interface including Live2D rendering, expressions, reload and UI-to-runtime control paths.
3. [ ] Real provider/device receipts for every external adapter; recovery/reconciliation after timeout, reconnect and unknown side-effect state.
4. [ ] Clean-room restore/upgrade/rollback from the compacted archive and archived source manifests.
5. [ ] Independent labelled temporal-memory dataset and measured retrieval uplift; current benchmark delta=0, candidate stays not-promoted.
6. [ ] Real local inference through provider boundary with VRAM/latency measurement on target hardware, model/runtime license inventory; do not bundle weights before the test.
7. [ ] Broader semantic function verification (not only syntax/liveness), prioritize action, memory, self-model, emotion, planning and tool paths; maintain evidence by feature.
8. [ ] Long-running soak/replay test with bounded memory/queues and crash/restart injection.
9. [ ] SBOM and per-source license/provenance inventory, including embedded third-party source archives; container DNS currently blocks direct Git clone/registry download.
10. [ ] Final release gate only after production build, real browser/device E2E, rollback and soak are green.

## Progress
- WorkPass39 implementation: **92/100** (changes made and independently verified in short bounded gates).
- Official weighted release roadmap: **76.0%**; deliberately not raised further by code volume alone.
- Do not add a new framework or memory owner unless a measured gap and target-platform proof justify it.
