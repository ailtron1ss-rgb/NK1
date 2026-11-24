# Neuro-Kurisu 35.6.3 — Большой апдейт: Neural Residency & Real-Life Benchmark

## Что изменено

Главная цель релиза — не добавление очередного независимого neural-модуля, а усиление причинного пути уже существующего B349 Neural Developmental Spine.

Теперь B349 имеет два измеримых уровня влияния:

1. раннее neural influence через B297;
2. поздняя ограниченная **neural residency** перед конституционной арбитрацией.

Поздняя residency не обходит governance. Она применяется **до** P69 constitutional arbiter, поэтому safety/constitution сохраняют приоритет.

## Простыми словами

Раньше нейронная ветвь могла сделать полезное изменение в начале принятия решения, после чего более поздние слои могли почти полностью стереть его влияние.

Теперь обученный нейронный сигнал получает ограниченное право «дожить» до поздней стадии выбора.

Это не означает, что нейроны получают полный контроль. Это означает, что их причинный вклад становится наблюдаемым ближе к реальному выбору.

## Реальные проверки

### B349 standalone
- learning updates: 79
- verify bias: примерно 0.057 → 0.384
- verify weight: 1.0
- causal gain: ~0.719
- backward-compatible restore: PASS

### B349 Core integration
- 3 cognitive cycles: PASS
- persistence: PASS
- restore: PASS
- late residency updates: 3

### B350 long-horizon mobile benchmark
- 8 полноценных mobile cycles: PASS
- late residency updates: 8
- несколько действий реально выбирались: respond/rest/explore/verify
- restore после 20 циклов: PASS
- benchmark показал реальную стоимость: примерно 27 секунд и ~305 MB RSS на текущем host runtime

### Что НЕ объявлено доказанным

- 120-cycle full mobile holdout: NOT PASS; runtime превысил контрольное окно.
- В 20-cycle benchmark B349 learningUpdates=0, потому что outcome learning не успевает пройти в текущем cadence на таком коротком окне. Это не скрывается и не считается обучающим PASS.
- Финальная causal necessity всей neural branch ещё требует ablation, где один и тот же организм сравнивается с включённой и отключённой neural residency при одинаковом входном потоке.

## Дубли и объединение

Ветка B269/B289/B293/B294/B296/B349 остаётся одной brain branch. Нового параллельного нейросубстрата не добавлено.

Функции разделены так:
- B269: быстрые spiking/plastic dynamics;
- B289: neural organism integration;
- B293: self/world prediction;
- B294: causal event/credit layer;
- B296: neural personality/agency readout;
- B349: общая developmental spine + outcome learning + late neural residency.

Это уменьшает риск дальнейшего размножения однотипных neural layers.

## Следующий крупный шаг

1. A/B ablation B349 residency.
2. 60–120 циклов с delayed outcomes.
3. reversal learning.
4. developmental lesion.
5. profiling самых дорогих mobile stages.
6. уменьшение стоимости цикла без отключения ключевой brain functionality.
7. повторный full release audit.
