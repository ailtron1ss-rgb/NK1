# Roadmap gaps after WorkPass62

## Closed in code this pass

- [x] Real subprocess SIGKILL after simulated provider acceptance but before ACK; durable pending receipt survives restore.
- [x] Second SIGKILL after evidence finalization but before completed-receipt state commit; next startup safely repeats read-only reconciliation.
- [x] Same side-effect key and execution identity retained; modified request remains subject to existing fingerprint guard.
- [x] Provider receipt replay and evidence-revision projection deduplicate; side-effect counter stays at one.
- [x] Redacted unresolved-action queue exposed by ActionGateway → OrganismCore → authorized runtime API → Runtime Atlas.
- [x] Tests and release metadata/scripts/status/scorecard synchronized.

## P0 — live transport evidence (still open)

- [ ] Execute one real provider/device side effect and capture its provider-native idempotency/receipt semantics.
- [ ] Force process termination in the real adapter's acceptance/ACK gap; restore the same durable store and reconcile through a read-only adapter call.
- [ ] Confirm independent read-after-write postcondition and no duplicate external effect after replay/reconnect.
- [ ] Walk every real bridge (voice, camera/device, outbound, browser/research, compound skill/project) through the same `decisionId`, `executionId`, ActionGateway receipt and finalizer.

## P1 — user-visible end-to-end function

- [ ] Install canonical app dependencies and run production Vite build plus browser/Live2D approve/continue/cancel/reconnect/error journeys.
- [ ] Ensure the recovery queue is included in real deployment origin/auth checks; UI remains read-only until the full original request can be safely reconstructed.
- [ ] Independent Russian/English temporal-memory holdout with hard negatives; broad retrieval uplift is still `recallDelta=0`, candidate not promoted.
- [ ] End-to-end interest/initiative updates only from confirmed, idempotent events; voice/viseme/gesture timeline remains open.

## P2 — portability / release durability

- [ ] Local-model performance and quality measurements on the target GTX 1650 4 GB machine.
- [ ] Clean-room restore/rollback and migrations from multiple prior schemas.
- [ ] Manual source license/provenance review for still-useful nested upstream files.
- [ ] Endurance soak with recovery, duplicate side effects, latency, disk and RAM metrics.

## Progress

- WorkPass62: **8/8 scoped code deliverables = 100%**.
- Official weighted roadmap: **80.1%** (up from 79.3%, +0.8 p.p.).
- Normalized inventory: **86 tasks — 68 DONE / 10 PARTIAL / 8 TODO**.
- Release: **not approved**; simulated provider + real process-kill tests are strong local evidence but do not replace live provider/device E2E.
