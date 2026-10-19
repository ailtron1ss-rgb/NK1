# Neuro-Kurisu — карта слияния P30–P82

## Цель

Не увеличивать количество P-уровней ради количества. P30–P82 рассматриваются как capability layers одного организма, а не как независимые «мозги».

| Домен | Каноническое направление | P-слои / системы | Правило интеграции |
|---|---|---|---|
| Memory | долговременная память и реконсолидация | P30, P47, P59, P70, P75 | один Memory authority; остальные дают capability/projection |
| Reality | world grounding и reality-first | P27, P44, P50, P51, P57, P79, P82 | live world state не дублировать deep snapshots без необходимости |
| Perception/Body | unified sensorium | P37, P40, P41, P42, P43 | raw/native signals → semantic world → experience |
| Identity/Self | непрерывность и развитие self | P31–P34, P49, P60, P63, P71, P76, P78, P80 | identity changes проходят evidence + governance |
| Agency | goals → deliberation → action | P56, P58, P73, P74 | один action ownership path |
| Development | learning, counterfactuals, forks | P52–P55, P61, P64 | forks/counterfactuals не считаются реальным опытом |
| Governance | safety, consent, rollback | P69, P70, P71, P72, P73 | governance не маскировать под cognition |
| Consciousness research | workspace, metacognition, causality | P48 + related evidence systems | только функциональные/экспериментальные claims |

## Горячий путь

`observe()` должен выполнять live computation, а deep projection — только когда:

- есть семантически значимое внешнее событие;
- достигнут bounded periodic refresh;
- выполняется full/forced checkpoint.

Телеметрия CPU/RAM/battery сама по себе не должна заставлять глубокие P-снимки.

## Правило переноса legacy

Legacy переносится только если он закрывает реальную capability-gap текущего организма, не создаёт второго владельца состояния и не возвращает старый runtime dependency graph.
