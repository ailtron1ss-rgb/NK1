# Neuro-Kurisu — Release Validation 34.1.0

## Release identity

- application: `34.1.0`
- organismCore: `69.0.0-portable-subject-boundary`
- state schema: `83`
- phase: `Stage-1.5-portable-subject-boundary`
- status: research-release

## Current release gate

PASS: TypeScript typecheck.

PASS: architecture audit — 168 canonical files, zero cycles, zero legacy leakage.

PASS: forensics — 456 active files, zero duplicate content, zero duplicate names, zero stale path markers.

PASS: source hygiene — zero errors and zero warnings.

PASS: release contract, source-truth and release-source synchronization.

PASS: API route uniqueness — 86 routes, 0 duplicates.

PASS: Subject boundary audit.

PASS: API security policy and real non-loopback server security smoke.

PASS: restart persistence, memory dedupe, identity lock, concurrency and replay.

PASS: portable-subject boundary test — fingerprint integrity, tamper rejection, identity mismatch rejection and explicit clean-host adoption.

PASS: server smoke.

PASS: archive manifest verification — 2018 files, missing 0, hash mismatches 0, extras 0.

PASS: current full-project audit — no errors and no warnings.

## Long-horizon

The 220-cycle regression is functionally `PASS`. Scaling is tracked separately and may be `WARNING` even while functional invariants pass. The current benchmark records first/last latency, p50/p95/p99 and heap-growth. Latest observed run: ratio about `2.52x`, p50 about `45 ms`, p95 about `163 ms`, p99 about `386 ms`, raw heap-growth about `3.29x`; therefore scaling remains a research/performance warning rather than evidence of a clean long-horizon subsystem.

An auxiliary `runtime-long-200` probe exceeded the external command runner timeout and produced no completed result. It is not counted as PASS or used to overwrite the successful 220-cycle functional regression.

## Historical-only legacy audit

`audit:legacy` still reports two inherited missing files expected by the old snapshot manifest: `.github/workflows/build-dist.yml` and `.gitignore`. Hash mismatches and extras are zero. This is recorded as historical provenance status, not as a current-runtime success claim.

## Scientific boundary

No result in this release is evidence of phenomenal consciousness, qualia or metaphysical personal identity. Internal scores, self-reports, fingerprints, simulations and consistency checks are engineering indicators only. Reality levels L1/L2/L3 remain unproven.
