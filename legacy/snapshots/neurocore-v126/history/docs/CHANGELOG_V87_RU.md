# V87 Changelog

Дата: 2026-09-24

## Главное
V87 adds model-aware replay utility using a bounded detached forward probe and stratum-preserving selection. No new trainable parameters.

## Code
- `src/neurocore/v87/core.py`
- `tests/v87/test_v87.py`
- `benchmarks/v87/V87_MODEL_AWARE_REPLAY.py`
- `benchmarks/v87/V87_CONFLICT_STRESS.py`

## Key fixes during the pass
- removed use_count double increment introduced by the first V87 implementation;
- changed global selector to stratum-preserving utility re-ranking;
- separated probe cadence from individual slot staleness;
- fixed historical V86 frontier assertion to `>= 86`.

## Current evidence
- V82–V87 current tests: 38/38 PASS;
- compileall: PASS;
- root import/frontier: PASS;
- 3-seed matched smoke: V87 mean loss-reduction proxy 0.46971 vs 0.36461 for V86, with +14.3% wall overhead; not a superiority claim;
- controlled causal test: utility selection changed from `[0,3,6,7,9,11]` to `[1,3,5,7,9,11]` while hard-sample current error was ~1.22 vs ~0.001 for easy samples.
