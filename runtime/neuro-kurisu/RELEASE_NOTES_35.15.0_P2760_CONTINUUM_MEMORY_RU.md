# Neuro-Kurisu 35.15.0 — P2760

## Основной апгрейд
P2760 превращает multi-timescale memory P2750 из трёх decay-band в resource-aware continuum memory scheduler.

### Production code
- fast / medium / slow memory получили разные update periods;
- slow update frequency автоматически снижается под memory/CPU pressure;
- fast→medium и medium→slow bridge-переносы;
- bridge strength зависит от verification, surprise и resource budget;
- memory consensus теперь учитывает bridge agreement;
- consolidation pressure входит в learning scale;
- replay utility учитывает отсутствие memory consensus;
- snapshot/restore сохраняет новые метрики через существующий P2750 state.

### Research
Использованы идеи Nested Learning / CMS, multi-short-term + long-term memory и multi-timescale replay. Полный research record: `RESEARCH/2026-09-20/P2760_CONTINUUM_MEMORY_SCHEDULING_RU.md`.

### Tests
`P2760_CONTINUUM_MEMORY=PASS`:
- normal resource fast/medium/slow writes `960/480/192`;
- high pressure slow writes `145`;
- medium/slow bridge `0.7004/0.7250`;
- memory consensus `0.8170`;
- learning scale `1.0079`.

`P2750`, P2742, P2734, P2726, P2720, P2716 и P2708 suites проходят отдельными процессами; длинные объединённые цепочки не используются как единственное доказательство из-за накопления Node heap.

## Известные долги
- organism smoke имеет высокий host RSS и требует физической Android/Termux телеметрии;
- current world model остаётся shallow и 8-D;
- causal graph пока dense low-dimensional, а не полноценный структурный causal model;
- forgetting improvements пока benchmark-dependent.
