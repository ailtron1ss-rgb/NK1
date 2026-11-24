# B382 — Контекстная developmental plasticity

## Цель
Расширить B381 из глобального обучения «действие полезно» в контекстное развитие: одна и та же action может иметь разные learned values в разных состояниях организма/мира.

## Архитектурное решение
Новый decision owner не создаётся. B365 остаётся единственным canonical policy owner. B382 — дополнительное состояние developmental memory внутри B365.

## Новые механизмы
- 8-мерные context prototypes на action;
- retrieval по similarity;
- context-dependent action shaping;
- contradiction tracking при противоположном verified outcome в близком контексте;
- confidence/conflict gating;
- bounded 48 profiles / 96 history entries;
- независимая ablation contextual layer;
- automatic promotion B380 verified experience → B382 context memory.

## Causal path
`world/internal context → B380 experience → evidence gate → contextual developmental memory → contextual retrieval → B365 policy`

## Защита
Unverified experiences не проходят в developmental consolidation. B382 и старая B381 developmental memory могут быть независимо аблированы.

## Persistence
Контекстные profiles/history входят в canonical B365 snapshot и сохраняются после restart.
