# Neuro-Kurisu — baseline первого полного аудита и фактический прогресс

Дата базового аудита: 2026-09-05
Текущий релиз: 34.10.0
State schema: 87

## Зачем этот документ

Этот документ фиксирует мой самый первый полный аудит проекта как исходную спецификацию. На каждом BIG PASS он должен использоваться для сверки: пункт считается закрытым только при наличии реальной реализации и/или проверяемого теста.

## 20 исходных крупных направлений первого аудита

| № | Исходное направление | Текущий статус |
|---:|---|---|
| 1 | Stabilization: P40, adaptive clocks, Android telemetry, Termux install | **закрыто в коде / device validation ещё нужна** |
| 2 | OrganismCore decomposition | **частично: facade есть, монолит ещё не разобран** |
| 3 | Evidence Bus | **закрыто на базовом runtime-уровне** |
| 4 | Prediction Ledger | **закрыто, расширено Debt/long-horizon** |
| 5 | True learning substrate | **частично: P30/P26/P27 сильные, общего substrate ещё нет** |
| 6 | Goal ecology | **существенно реализовано, но долгосрочный autonomous project loop ещё ограничен** |
| 7 | Autonomous projects | **частично закрыто: executor/milestones/tool bridge есть** |
| 8 | Reality research loop | **частично: proposal/trial/evidence есть, полноценной внешней науки ещё нет** |
| 9 | Reality boundary | **существенно закрыто для runtime/simulator separation** |
| 10 | Mobile cognitive OS / budget | **существенно реализовано** |
| 11 | Model ecology | **существенно усилено: health + failure memory + calibration** |
| 12 | Native Android host/lifecycle | **не закрыто** |
| 13 | Real perception / vision | **частично: signal/semantic interfaces есть, полноценный vision backend отсутствует** |
| 14 | Social cognition | **частично** |
| 15 | Predictive self-model | **частично усилено** |
| 16 | Autobiographical identity | **частично/существенно по symbolic layer** |
| 17 | Shadow organism | **реализовано как lightweight alternative evaluator; независимость ограничена** |
| 18 | Model Olympics | **реализовано и теперь влияет на дальнейшее прогнозирование** |
| 19 | Development/self-modification | **частично** |
| 20 | Consciousness research protocol | **исследовательский каркас есть; empirical evidence отсутствует** |

## Основной критерий прогресса

Не считать внутренний score доказательством свойства. Приоритет имеют:

1. внешне проверяемые исходы;
2. повторяемые prediction/error циклы;
3. изменение поведения после ошибки;
4. сохранение результата после restart;
5. улучшение на новых, а не только на тренировочных данных;
6. длительная автономная работа.

## Основной незакрытый разрыв

Проект уже имеет богатую когнитивную архитектуру, но ещё не полностью свёл её к одному причинно-обучающему циклу:

`наблюдение → гипотеза → прогноз → действие → внешний исход → ошибка → обновление модели → изменение следующего поведения`.

Следующие BIG PASS должны увеличивать именно длину и достоверность этого цикла, а не количество P-модулей.


## BIG PASS 41 — performance spine update

В 34.10.0 закрыта часть performance debt из исходного аудита: повторные P10/P26/P27/P30 вычисления и shared forecasts кэшируются внутри tick, perception processing получил adaptive cadence, а duplicate runtime-evidence snapshot устранён. Первый полный operational-250 benchmark после этих изменений завершён: warmedMedianRatio=1.694, heapGrowth=0.620. Короткий 40-cycle gate: ratio=1.297; adaptive perception реально пропускает cold ticks.


### BIG PASS 41 final correction

Короткий performance gate финального дерева: `tick=40`, `firstMedianMs=11.94`, `lastMedianMs=15.69`, `ratio=1.313`, `perceptionTick=11`, `spineSavings=0.600`.

Последний full restart run в итоговой серии вышел за timeout, поэтому restart reliability не повышается до 100% только на основании предыдущих успешных прогонов.

Strict weighted implementation of the original audit recommendations remains **≈74%**.
