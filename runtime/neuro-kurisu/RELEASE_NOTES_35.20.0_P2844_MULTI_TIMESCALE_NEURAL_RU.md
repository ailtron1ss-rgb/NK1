# Neuro Kurisu 35.20.0 — P2844

## Крупный проход

P2844 объединяет сразу несколько следующих направлений:

1. multi-timescale neural benchmark;
2. anti-forgetting A→B→C→A;
3. реальный lesion/recovery для B296;
4. sequence memory + causal predecessor links;
5. evidence-gated false-memory rejection;
6. reconsolidation after retrieval;
7. controlled forgetting;
8. restart equivalence checks;
9. включение пластического обучения B280 при достаточном budget/grounding;
10. воспроизводимый benchmark suite в production-коде и тестах.

`100/100` здесь означает прохождение инженерных benchmark/ablation/restart/retention критериев, а не биологическую эквивалентность мозга и не доказательство сознания.

## Фактическая проверка P2844

- Typecheck: PASS.
- P2844 benchmark: PASS, overall01=0.9143.
- Multi-timescale ablation: learningUpdates 72/72 против 0/72.
- A→B→C→A semantic retention: 0.8115 против 0 без semantic consolidation в ablation.
- Sequence order: 1.0000, causal predecessor links: 8.
- Lesion: 50% синаптического повреждения; structuralDamage01=0.5000; recovery01=0.9860.
- False-memory gate: unverifiedPromoted=false.
- Restart equivalence: memory=1.0000, neural=1.0000.
- P2843 neural-memory regression: PASS.
- 30-second real runtime endurance: PASS.
- Clean smoke: PASS.
- Mobile 256MB V8 smoke: PASS; elapsed 18.83s; peak RSS ~407 MiB. Это не означает сертификацию конкретного Android-телефона: физический RAM-профиль устройства остаётся отдельным измерением.
- Architecture/hygiene/syntax/forensics/full/release/archive audits: PASS.
