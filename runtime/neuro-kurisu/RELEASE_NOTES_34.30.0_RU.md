# Neuro-Kurisu 34.30.0

## BIG PASS 59 — System Contract + Persistence Efficiency

This release continues the physical-organism architecture rather than adding another layer of isolated cognitive modules.

### Changes
- cached seven resolved runtime system contracts;
- reduced repeated hot-path contract allocations;
- reused one projection context per checkpoint;
- reused per-checkpoint snapshots across persistence phases;
- moved P29 capture and P37 sealing before projection to avoid duplicate serialization;
- added machine tests for contract caching and at-most-once provider snapshots;
- synchronized current release/source-of-truth documentation.

### Performance qualification
250 and 500-warm operational tests pass. 1000-cycle operational test passes separately. On the same host, the 34.28.0 control also passes the 1000-cycle test; therefore no unsupported regression claim is made.

### Known limitation
Real Android 24h/72h/7d/30d qualification is still pending. Host benchmarks cannot certify Android lifecycle/thermal/background behaviour.
