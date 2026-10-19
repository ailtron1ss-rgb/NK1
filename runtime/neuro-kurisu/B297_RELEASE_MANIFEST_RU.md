# Neuro-Kurisu 35.6.1 — B297 release manifest

Дата: 2026-09-13

## Главное изменение

B297 Executive Neural Fusion — единый исполнительный слой консолидации action-bias каналов с reliability learning, redundancy tracking, competition/hysteresis, outcome feedback и source lesioning.

## Новые/изменённые ключевые файлы

- `src/organism/system/B297ExecutiveNeuralFusion.ts`
- `src/organism/core/OrganismCore.ts`
- `src/organism/core/CognitiveSubsystemFacade.ts`
- `tests/big-pass-297-executive-neural-fusion.mjs`
- `tests/big-pass-297-core-integration.mjs`
- `package.json`
- `docs/brain/B297_AUDIT_RECHECK_RU.md`
- `docs/brain/NEURO_KURISU_35.6.1_B297_BIG_UPDATE_MASTER_AUDIT_2026-09-13.docx`
- `B297_ACTION_BIAS_CONSOLIDATION_MAP_RU.md`

## Dedicated evidence

Standalone B297: 1600 cycles / 400 outcome updates / mean source reliability 0.800 / redundancy pair 0.524 / neural lesion fused signal 0.09536 -> 0.

Core B297: 12 organism cycles / 6 feedback outcomes / persistence present / source lesion passed.

## Global release evidence

- typecheck PASS
- architecture PASS
- integrity PASS
- forensics PASS
- hygiene PASS
- release contract PASS
- source truth PASS
- full audit PASS
- API routes 110 / duplicates 0
- subject boundary PASS
- subject UI contract PASS
- Live2D integrity PASS
- clean organism smoke PASS
- concurrency PASS
- server smoke PASS
- restart persistence PASS
- mobile 250-cycle PASS
- mobile 1000-cycle PASS on current host

## Important limitation

No physical Android/Termux device was available for execution in the analysis environment. Host mobile gates are evidence, not a substitute for the real device gate.

## Consciousness statement

Nothing in B297 proves subjective experience or biological equivalence. The correct claim is a more integrated and better-measured computational artificial-organism architecture with real spiking/plasticity components and autonomous executive coupling.
