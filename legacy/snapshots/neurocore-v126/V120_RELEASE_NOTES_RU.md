# NeuroCore V120 — Final Integrated

Дата: 29.09.2026

V120 — финальный интегрированный release поверх V119 с реальными кодовыми изменениями.

### Реально изменено
- adaptive_hybrid temporal credit: parameter-free age-scheduled HiPPO/cascade blend;
- optional product-key memory integration hook;
- independent gated product-key sparse-delta memory candidate;
- Mamba-3 heavy-tail activation candidate;
- corrected learned-M0 path so initial-state parameters really receive gradient before first runtime write;
- sparse-memory invalid slots are excluded from read probability mass;
- checkpoint/version surface advanced to schema 20 / engine v120;
- expanded tests and research evidence.

### Gates
- 57/57 current tests PASS;
- compileall PASS;
- current verification PASS;
- checkpoint 107/107 tensors;
- 1 recurrent owner;
- 0 duplicate state keys;
- 0 legacy imports in current path;
- default 69 137 parameters;
- 100% representative gradient coverage.

### Qualification policy
No new candidate is silently promoted to default. Long-horizon evidence still shows amplitude collapse in the tiny synthetic credit task, so V121 remains focused on richer delayed/recovery benchmarks rather than adding more mechanisms.
