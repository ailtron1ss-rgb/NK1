# BIG PASS 319 — Progress / Audit

## Status
PASS — crash injection / backup recovery matrix.

### Verified
- atomic temporary-file path survives injected crash;
- fsync-stage crash survives;
- backup-stage crash survives;
- pre-rename crash preserves previous durable generation;
- post-rename crash leaves a valid primary;
- corrupted primary recovers from backup;
- new `OrganismCore` can start from recovered state;
- typecheck PASS;
- B318 durable process restart regression PASS;
- B317 organism reality closure was separately verified PASS in the prior regression run; the combined aggregate was not used as evidence because it exceeded the execution budget.

### Architectural rule added
Durability claims must distinguish:
1. in-memory snapshot;
2. durable same-process store;
3. cross-process restart;
4. crash-injection recovery;
5. real-device power-loss evidence.

Only the first four are now covered by automated project evidence.
