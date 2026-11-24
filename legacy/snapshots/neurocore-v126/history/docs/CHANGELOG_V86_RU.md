# Changelog V86

Дата: 2026-09-23

## Добавлено

- Label-free replay metadata в canonical `neural_memory_v61`.
- Coverage-aware selector с priority/age/reuse/diversity signals.
- Safety-floor против деградации legacy selector.
- Replay quality telemetry.
- Runtime state recovery из canonical replay.
- V86 checkpoint state.
- V86 tests и replay-information benchmark.

## Qualification

- 31/31 current V82–V86 tests PASS.
- V86: 7/7 PASS.
- A→B→C→A, 3 seeds: short external path non-regressive.
- Repeated equal-priority replay: 32/32 slots vs 6/32 legacy unique access.
- Runtime recovery cosine: 0.972.

## Не заявляется

No general continual-learning superiority claim.
