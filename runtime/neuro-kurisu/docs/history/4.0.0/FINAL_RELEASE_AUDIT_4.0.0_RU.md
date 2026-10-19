# Neuro-Kurisu Evolution 4.0.0 — Final Release Audit

## Release

- Application: 4.0.0
- Organism Core: 7.0.0-evolution
- State schema: 8
- Canonical source: src/organism/
- Legacy snapshot: legacy-original/
- External npm runtime/build dependencies: 0

## Static and forensic audit

- Active files: 102 on the current release surface; the archive manifest hashes every release file except itself.
- Canonical files: 51.
- Source surface files: 74.
- Legacy snapshot entries: 1413.
- Empty active files: 0.
- Duplicate content groups: 0.
- Conflicting duplicate names: 0 (conventional index.ts barrel names are accepted by policy).
- Absolute build paths: 0.
- Stale version markers on active surface: 0.
- Missing relative imports: 0.
- Runtime import cycles: 0.
- Legacy leakage into canonical runtime: 0.
- Research leakage into canonical runtime: 0.
- JSON parse failures: 0.
- JS/MJS syntax failures: 0.
- Shell syntax failures: 0.
- Source hygiene warnings: 0.

## Runtime tests

- npm ci --offline: PASS
- typecheck: PASS
- organism smoke: PASS
- autonomy: PASS (78/80)
- restart persistence: PASS
- P6 organism: PASS
- P6 migration: PASS
- server smoke: PASS
- operational hardening: PASS
- P6 causal lab: PASS
- Project Doctor: PASS
- executable/JSON syntax audit: PASS
- full forensic audit: PASS

## Causal P6 baseline

- cycles: 42
- self-projects: 5
- agency records: 42
- value revisions: 13
- identity trajectory samples: 126
- authorship score: 0.5208189427524381

Matched lesions eliminate the expected dependent signal for self-projects, agency, value evolution and identity trajectory. This is functional causal evidence, not proof of phenomenal consciousness.

## Device limitation

Physical Android/Termux soak, Android process reclaim, real thermal/battery behavior and real KoboldCpp/GGUF inference must still be verified on the target device.
