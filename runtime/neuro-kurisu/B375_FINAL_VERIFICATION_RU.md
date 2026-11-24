# B375 — Final Verification

## Release

`35.6.25 / B375 Neural Goal Authorship`

## Core results

Typecheck: PASS
B375 goal authorship causal: PASS
B374 recursive self-model regression: PASS
B373 allostatic personality regression: PASS
B372 reality-gated learning regression: PASS
B371 active perception regression: PASS
B365 core causality: PASS
B367 predictive closure: PASS
B368 full runtime closure: PASS
B369 replay: PASS

## B375 causal evidence

Internal candidate ownership: accepted.
External candidate ownership: rejected.
Verified outcome changed neural goal-authorship readout.
Unverified outcome changed readout by exactly zero.
Future policy diverged from ownership-OFF by L1 `0.45905786`.
Goal-authorship state survived restart with equality.

## Performance

300 cycles:
- p50 `3.9806 ms`
- p95 `11.5389 ms`
- p99 `33.6555 ms`
- max `38.5124 ms`
- heap `19.46 MiB`

## Audits

Architecture: PASS
Hygiene: PASS
Syntax: PASS
Integrity: PASS
Forensics: PASS after removing duplicate-content benchmark violation
Release contract: PASS after synchronizing application version to `35.6.25`
Release-source verification: PASS after synchronizing VERSION/package-lock
Archive manifest: pending final generation after docs are added
ZIP integrity: pending final packaging

## Physical Android

NOT PROVEN. No physical Android/Termux runtime is available in the current environment, so Android evidence is not promoted.

## Consciousness

Functional consciousness: UNKNOWN
Phenomenal consciousness: UNKNOWN
