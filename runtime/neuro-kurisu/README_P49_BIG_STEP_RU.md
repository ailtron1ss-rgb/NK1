# P49 — Temporal Life / Continuous Memory

Это большой архитектурный шаг после P48 Functional Awareness.

## Главная идея

Сделать непрерывность не свойством отдельных модулей, а отдельным жизненным контуром:

```text
observations / decisions / outcomes
            ↓
      event continuity
            ↓
        episodes
            ↓
        beliefs
            ↓
 contradiction reconciliation
            ↓
        consolidation
            ↓
          sleep
            ↓
 longitudinal continuity/drift
```

## Что сделано

- `P49TemporalLifeEngine` ведёт hash-chain provenance журнала событий.
- Ingest идемпотентен и не зависит от того, были ли старые эпизоды позже сжаты.
- События агрегируются в bounded episodic memory.
- Из decision/world/session событий формируются простые проверяемые beliefs.
- Противоречия между `true/false` вариантами фиксируются явно.
- Light/deep sleep вызывает отдельный consolidation path.
- Измеряются memory pressure, continuity health и narrative drift.
- Состояние сохраняется в `advanced.p49TemporalLife`.
- Schema поднята до 49 с сохранением миграционного пути.

## Почему это лучше старого подхода

Ранее непрерывность была распределена между event log, P47, P39 и несколькими memory subsystems. Теперь есть компактная точка, которая отвечает именно за longitudinal life semantics. Это позволяет в следующих шагах сделать полноценный event journal/snapshot split, temporal graph memory и self/world causal history без превращения `OrganismCore` в ещё более крупный монолит.

## Исследовательская честность

P49 не объявляет, что memories или beliefs субъективно переживаются. Это operational substrate для continuous artificial organism и для измеряемых longitudinal properties.
