# NeuroCore V120 — Final Release Summary

## Код
9 current Python files changed relative to V119; 216 added lines, 31 deleted, net +185 lines; 1 new current module; 1 new current test file.

## Gates
- 57/57 current tests PASS
- compileall PASS
- verify_current PASS
- checkpoint round-trip 107/107 tensors
- V119→V120 migration: 107 loaded, 0 missing, 0 shape mismatch, 0 unexpected; legacy flag true for a crafted V119 payload
- default parameters: 69,137 total / 69,137 trainable
- representative gradient coverage: 100%
- called current modules: 55/61 = 90.16%
- called leaf modules: 45/47 = 95.74%
- called trainable parameter fraction: 99.9769%
- recurrent owners: 1
- duplicate state keys: 0
- legacy imports in current path: 0

## Experimentally qualified but not promoted
adaptive_hybrid, product-key sparse memory, product-key sparse-delta, Mamba-3 heavy-tail activation, synergy feedback, event-bank, QED/address erase, EFLA integrator, optimizer update alignment.

## Main remaining weakness
Long-horizon synthetic delayed credit still shows strong direction preservation but amplitude collapse. The next decisive work is richer long-horizon training/recovery/interference rather than adding more mechanisms.
