# NeuroCore V115 — текущая архитектура

## 1. Current surface
`src/neurocore/current/` содержит только активную current-архитектуру. Исторический `core_v106_legacy.py` вынесен в `history/current_legacy/`.

## 2. Канонический trunk
`CausalTrunk` — самостоятельный current model без импорта VXX engine. `CausalTrunkConfig` является единственным источником model-owned configuration.

Основные вычислительные части:

- encoder;
- `UnifiedAssociativeSpine`;
- predictor/world/self projections;
- memory decoder;
- fast/medium/slow runtime projections;
- canonical confidence head (отдельный calibration head удалён после абляции).

## 3. Ассоциативный spine
Spine реализует фиксированное по размеру рекуррентное associative state. Он сочетает channel-wise decay, независимые erase/write gates, sparse state editing, diagonal online preconditioning и опциональные parameter-free online mechanisms.

Это направление согласуется с Gated DeltaNet-2, где erase/write становятся независимыми channel-wise механизмами, и с Preconditioned DeltaNet, где delta recurrence интерпретируется как online-regression update с curvature-aware preconditioning. citeturn983296view1turn267721academia61

## 4. Temporal credit
`ThreeFactorFastWeight` владеет bounded fast state. Режимы включают single/immediate/dual/adaptive/cascade/event_bank. `cascade` является последовательным state-space каскадом, а `event_bank` разделяет bounded fast state по найденным events.

## 5. Uncertainty-aware write
`UncertaintyAwareWrite` — parameter-free candidate, использующий residual variance как proxy для channel reliability. Это исследовательская адаптация идеи KDN, где memory update использует uncertainty-aware gain. citeturn267721academia60

## 6. EFLA candidate
`DeltaIntegratorConfig(mode="efla_exact")` применяет exact scalar step для rank-1 delta dynamics. Формула взята как source-backed математическая идея из официального EFLA repository; это не копия их модели. Official code explicitly contrasts EFLA with standard DeltaNet through the exact exponential step factor. citeturn769373view0

## 7. Ownership
Persistent parameters, recurrent associative state, fast plastic state, runtime multiscale state и training controllers разделены. Batch-dependent runtime state не регистрируется как persistent checkpoint tensor.

## 8. Главный нерешённый вопрос
Архитектурная компактность теперь доказана лучше, но objective synergy ещё не доказана. В V108 loss-gradient pairwise cosine в одном untrained probe близок к нулю, а половина пар отрицательна; это описательная диагностика, а не основание удалять heads.
