# Neuro-Kurisu B720 — Final Audit — 16.09.2026

## Статус

Релиз: 35.6.34
Core: 72.0.0-b621-b720-unified-adaptive-mind
Schema: 138

## Внедрение

B621–B720 добавляет:
- contextual meta-policy;
- regime-action contextual policy;
- hierarchical fast/slow/identity memory;
- complexity-aware recall;
- weighted nearest-neighbour world ensemble;
- bounded skill transfer;
- regime-shift detection;
- accelerated plasticity after shift;
- confidence calibration;
- information-gain pressure;
- 128D distributed identity code;
- eligibility-trace-like local plasticity;
- restart persistence;
- multi-lesion evaluation.

## Experimental results

Core benchmark:
- decisions: 1980
- updates: 1740
- consolidations: 6
- world updates: 1740
- skill updates: 973
- neural updates: 3720
- strategy switches: 342
- train accuracy: 48.87%
- hidden holdout: 45.00%
- reversal stream: 17.50%
- restart persistence: PASS

The reversal result is intentionally retained as a known limitation rather than hidden. The subsystem detects/updates under regime change, but current reversal generalization remains weak and is a primary target for the next phase.

Multi-lesion delta:
- meta-policy: 0.001429
- hierarchical-memory: 0.001582
- world-ensemble: 0.003514
- skill-transfer: 0.003076
- neural-identity: 0.000242
- experiment-selector: 0.001429
- compute-governor: 0.003191
- calibration: 0
- regime-detector: 0 in this isolated probe

Performance:
- 1000 decision cycles
- average: 0.0386 ms
- p95: 0.0996 ms
- p99: 0.2012 ms
- max: 1.3424 ms

OrganismCore integration:
- decisions: 8
- updates: 5
- world updates: 5
- neural updates: 13
- restart persistence: PASS

## Regression

B382: PASS — knockout delta 0.3665437, restart delta 0.
B383: PASS — context separation 0.4595287, history knockout 0.45999995, restart delta 0.
B384: PASS — 280 verified episodes, 2240 value revisions, 272 goal-value revisions, causal delta 0.0161921.
B621–B720: PASS — dedicated core, performance, and organism integration tests.

## Architecture

- core ownership: PASS
- architecture: PASS
- cycles: 0
- missing owners: 0
- legacy leakage: 0
- hygiene warnings: 0
- syntax: PASS
- forensics: PASS
- full audit: PASS
- release contract: PASS
- release source: PASS
- integrity: PASS
- lockfile: PASS
- server smoke: PASS

Final manifest after release regeneration: verify with `npm run manifest:archive` and `npm run audit:archive` immediately before packaging.

## Interpretation

B621–B720 is a real functional developmental layer. It is not evidence of phenomenal consciousness, human-equivalent brain activity, or biological realism. The strongest validated property is the integration of adaptive strategy routing, memory hierarchy, world prediction and distributed neural state under persistent state and causal lesion testing.

## Remaining hard problems

1. OOD performance is still weak.
2. Regime-shift reversal is weak.
3. Some lesions remain low-impact because multiple subsystems can substitute for each other.
4. The world model is still bounded/state-based rather than a high-capacity latent simulator.
5. The 128D neural identity code is still small relative to the project's long-term neural-organism goal.
6. Android/Termux physical validation requires the actual target device.
7. React/Vite cognitive observability remains low priority compared with core development.


## Финальная упаковка
- Archive manifest: 3214 файлов
- missing: 0
- hash mismatches: 0
- extra: 0
- release core: 72.0.0-b621-b720-unified-adaptive-mind
- release contract: PASS
