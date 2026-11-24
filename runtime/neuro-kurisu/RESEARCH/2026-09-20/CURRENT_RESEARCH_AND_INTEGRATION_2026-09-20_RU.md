
## P2835 Hardening / 2026-09-20

После внедрения self-teacher + transfer-safety была обнаружена и исправлена contamination legacy benchmarks: выключение experimental path ранее не отключало P2774 model-time replay. Дополнительно исправлен stale-teacher tick bug в P2820 и persistence ordering в NeuralExperienceBranch. Каноническая release validation использует короткую current-release synergy battery и отдельные чистые runtime processes для тяжёлых legacy suites.

## P2835.1 hardening evidence

P2820 self-teacher persistence was corrected so stale detection uses the previous tick before state.tick is updated. NeuralExperienceBranch now snapshots P2820/P2835/P2774/P2805 after the complete outcome path. Legacy experimental toggling now truly disables model-time replay. P2835 interaction factorial (16 runs) shows neutral short-horizon reward but nonzero internal neural trajectory difference, so the new mechanisms are operational without a demonstrated immediate reward gain.
