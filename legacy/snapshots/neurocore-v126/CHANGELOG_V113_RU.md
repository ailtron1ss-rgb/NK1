# NeuroCore V113 — BIG STACK

## Реальные изменения

- Per-sample modulatory gate в online plasticity; устранено batch-wide broadcast credit signal.
- Безопасный `fast_weight` snapshot перед autograd capture; устранён in-place tensor-version conflict на длинных sequence.
- Vectorized event-bank retrieval.
- Selective temporal-credit candidate.
- Causal state-carrying sequence execution и chunked TBPTT.
- TBPTT теперь отсоединяет также trunk-owned multiscale runtime states.
- Runtime checkpoint хранит multiscale state внутри одного canonical runtime owner, без дублирующего top-level state source.
- Удалён dead `memory_to_action` compatibility head из current trunk.
- Preconditioner trainability сохраняется после V112 fix.
- Добавлены capacity, temporal, interference, ablation и structural evidence.
- Синхронизированы version surfaces до `1.13.0 / v113-big-stack`.

## Evidence

- Current tests: 39 PASS.
- Full repository pytest: PASS.
- compileall: PASS.
- Current checkpoint round-trip: 105 tensors loaded, no missing/mismatch/unexpected.
- Long training probes: T=128 и T=256 проходят без autograd version errors.
- Event-bank isolation: на 2 seeds A/B cosine около 1.0 при существенно меньшем cross-leak, чем у общего fast weight.
- Full long-horizon quality remains a qualification gate.
