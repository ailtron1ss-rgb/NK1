# Neuro-Kurisu R24 — Causal Memory Control / Long-Horizon World / Matched Recurrent Ablation

## Цель

R24 продолжает R23 без повышения статуса экспериментальных веток до canonical proof. Основной фокус — превратить наблюдаемый memory-regret в matched causal A/B, проверить world-model rollout на горизонтах 5–8 и получить честное matched-ablation сравнение recurrent substrate с stateless control.

## Реально внедрено

### 1. Matched causal memory A/B

Добавлен `MemoryBudgetCausalHarness`.

Два независимых `MemoryOS2` получают один и тот же поток памяти и одинаковый поток запросов:
- retained control с неблокирующим byte budget;
- treatment с жёстким bounded byte budget.

Метрика `hitLoss01` считается относительно retained control, а не относительно собственной постфактум статистики treatment.

Тест `P2910`:
- items: 40;
- matched queries: 20;
- control hits: 20;
- budget hits: 18;
- hit loss: `0.10`;
- treatment evictions: 4;
- counterfactual witness regret: `0.00379`.

Это настоящий воспроизводимый matched A/B harness. Он не является доказательством того, что каждая онлайн-вытесненная запись была причинно вредной: causal claim ограничен контролируемым harness.

### 2. Длинный world-model horizon 5–8

`B261UnifiedWorldModel` уже поддерживает bounded rollout до 8 действий; R24 добавляет отдельную held-out батарею, где одновременно проверяются последовательности длиной 5, 6, 7 и 8.

`P2911`:
- held-out samples: 24;
- action hit rate: `0.9583`;
- model regret: `0.01237`;
- baseline regret: `0.00346`;
- horizons: `5/6/7/8`;
- все terminal states finite.

Результат важен именно тем, что не маскирует слабость: hit-rate высокий, но текущий bounded planner ещё не превосходит baseline по regret на этой поверхности. Следующий шаг — улучшать objective/value shaping и multi-step credit, а не снижать пороги.

### 3. Matched recurrent ablation

`P2912` сравнивает две ветки на одинаковом входном потоке:
- recurrent state substrate;
- stateless control.

Результат на этой synthetic temporal surface:
- recurrent accuracy: `0.3469`;
- stateless accuracy: `0.8031`;
- matched delta: `-0.4563`;
- choice change rate: `0.6938`;
- recurrent boundedness: `1`.

Это отрицательный, но полезный результат. Он показывает, что текущая bounded recurrent ветка не заслуживает promotion в canonical decision path. R24 намеренно сохраняет её только как ablation lane.

### 4. Endurance

Добавлен отдельный `R24 3000-cycle` endurance test для `OrganismCore` в mobile profile. Тест был реально запущен, но полный 3000-cycle прогон не уложился в доступное 600-секундное окно среды. Это не считается PASS и не маскируется под него.

Надёжный закрытый gate после R24 изменений: `r23-1000-cycle-endurance` — `1000/1000` циклов, tick `1000`, warm mean `25.364 ms`, tail mean `33.928 ms`, slowdown `1.338x`, operation evidence `256`.

Реальный физический Android/Termux soak по-прежнему не считается выполненным без запуска на целевом устройстве.

## Research alignment

R24 расширяет оценку world models в сторону долгих action sequences. Это соответствует направлению WorldPrediction, где проверяются правильный порядок действий и длинный planning horizon, и PlayWorld, где долгосрочные цели требуют устойчивого изменения состояния под действием агента. citeturn305759academia1turn305759academia0

Работа FF-JEPA дополнительно подчёркивает проблему flat long-horizon planning и необходимость разбиения длинной траектории на более управляемые подцели; это мотивирует будущий hierarchical planner вместо простого увеличения горизонта brute-force rollout. citeturn305759academia2

## Truth boundary

- Synthetic/controlled benchmarks остаются инженерными тестами.
- Recurrent substrate не считается частью canonical intelligence path.
- Causal memory score ограничен matched control harness.
- Android device endurance ещё не доказана этим архивом.
- Наличие этих механизмов не является доказательством сознания или субъективного опыта.

## Версии

Application: `35.38.0`
Core: `100.30.0-r24-causal-control-longhorizon`
State schema: `221`
Phase: `Stage-123/R24-Causal-Control-LongHorizon`
