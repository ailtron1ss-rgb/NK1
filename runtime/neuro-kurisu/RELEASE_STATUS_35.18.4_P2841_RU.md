# Release Status — 35.18.4 / P2841

Статус: research-release / reality-postcondition hardening

## Verified

- typecheck: PASS
- P2841 postcondition unit: PASS
- P2841 runtime external grounding: PASS
- P2841 schema migration 209 -> 210: PASS
- P2841 persistence of grounded-world evidence across restart: PASS
- P2835 current-release synergy: PASS
- P2835 interaction factorial: PASS
- P2836 reality-first: PASS
- P2836 neural ablation-fast: PASS
- server smoke: PASS
- mobile-256 V8-cap smoke: PASS
- P2840 shadow: PASS
- P2840 learning gate: PASS
- P2840 boundary: PASS
- P2835 hotpath: PASS
- P2835 persistence/restart: PASS
- organism smoke: PASS
- architecture audit: PASS
- forensics: PASS
- source hygiene: PASS
- executable syntax: PASS
- release contract: PASS
- integrity: PASS
- release source: PASS

## Core changes

1. External postcondition is independently classified before long-lived promotion.
2. Canonical grounded world can receive an externally evidenced consequence directly.
3. Shadow divergence remains diagnostic rather than a hidden world mutation.
4. Active perception demand rises when independent verification coverage is weak.
5. Long-horizon causal holdout readiness attenuates first-seen identity/memory promotion.
6. State schema is 210 with backward-compatible migration from 209.

## Работа прохода

Сравнение с P2840: 13 новых файлов, 12 изменённых, 0 удалённых. Общий textual diff: +1550 / -55 строк. Production/test/release code/config scope: +1636 / -18 строк.

## Hardware-only limitation

Independent physical effect verification for TTS, camera actuation and other device effects still requires a real Android/Termux device run.
