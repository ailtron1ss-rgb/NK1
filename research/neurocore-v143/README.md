# NeuroCore V143

Research release focused on integrating and qualifying the useful parts of a supplied NeuroCore V3 / DeepSeek-style prototype.

## Current
Canonical architecture remains one recurrent trunk + one canonical sparse memory owner.

## New research surface
- `neurocore.research.fwpkm_candidate.FastWeightProductKeyMemoryCandidate`
- `neurocore.research.fwpkm_language_bridge.FwPKMLanguageBridge`

FwPKM is **research-only**. It has isolated capacity/revision evidence but has not yet demonstrated real language E2E gains.

## Verification
```bash
PYTHONPATH=src python tests/test_v143.py
PYTHONPATH=src python benchmark_v143.py
PYTHONPATH=src python benchmark_v143_memory.py
```
