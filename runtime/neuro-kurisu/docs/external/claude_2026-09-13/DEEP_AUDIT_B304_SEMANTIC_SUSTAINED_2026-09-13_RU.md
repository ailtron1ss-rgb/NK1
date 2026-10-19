# Глубокий аудит B304 — Semantic Holdout + Sustained Resource-Aware Operation
Дата: 13.09.2026

## 1. Что перепроверялось
B304 строился после перепроверки B298, B299, B300, B301, B302 и B303. Главный вывод предыдущих аудитов сохраняется: проект уже имеет несколько нейронных, причинных, personality и consolidation контуров, поэтому добавление ещё одного learner было бы дублированием.

B304 состоит из двух связанных инженерных изменений:
1. `B304SemanticHoldoutLedger` — только evaluation/evidence ledger, без собственного обучения и без второй личности.
2. усиление `TemporalResolutionGovernor`, который теперь учитывает фактические battery/thermal/RAM/CPU сигналы устройства при выборе между full pulse и micro-cycle.

## 2. Почему это большой шаг
До B304 holdout в B303 в основном проверял новые числовые состояния/fingerprints. B304 меняет единицу проверки: организм не получает название task family, а evaluator независимо группирует задачи по семантическому типу.

Training families:
- evidence-verification
- exploratory-planning
- reflective-recovery

Holdout families:
- social-negotiation
- resource-tradeoff
- surprise-coordination

Holdout families отсутствуют в training set. Это не доказывает «понимание смысла» в человеческом смысле, но это существенно более строгая проверка переноса, чем простая смена числового fingerprint.

## 3. Реальное B304 evidence
- 128 operational ticks.
- 52 full cognitive pulses.
- 76 micro-cycles.
- 36 recorded training full-pulse outcomes.
- 16 recorded holdout full-pulse outcomes.
- 3 training semantic families.
- 3 holdout semantic families.
- novel holdout family rate: 1.0000.
- holdout coherence: 0.4671.
- family transfer score: 0.6610.
- resource budget compliance: 0.4161.
- evaluation readiness: 0.5164.
- B296 learning updates: 52.
- B296 synaptic updates: 8112.
- B302 verified causal outcomes: 4.
- B302 consolidation windows: 2.
- mean operational cycle: 71.81 ms in this container.
- p95 cycle: 251.25 ms in this container.
- peak RSS observed: ~470 MB in this container.

## 4. Что реально доказано
Доказано, что:
- evaluator умеет отделять training и unseen semantic families;
- все три holdout families действительно отсутствовали в training family set;
- уже существующее поведение остаётся достаточно coherent на unseen families;
- existing B296 neural plasticity продолжает работать в том же прогоне;
- B302 causal/consolidation chain продолжает работать;
- resource-aware governor переходит на micro mode под высокой device pressure;
- внешний сигнал всё равно принудительно поднимает full cognitive pulse.

## 5. Что не доказано
Не доказано:
- человеческое semantic understanding;
- сознание;
- субъективный опыт;
- open-ended general intelligence;
- устойчивые сотни/тысячи полноценных cognitive pulses на реальном среднем Android;
- физическая Android/Termux производительность на конкретном пользовательском устройстве.

## 6. Важный performance вывод
B301 mobile test в изолированном процессе проходит примерно за 23.35 s и использует около 428 MB RSS в контейнере. B304 semantic run занимает около 16.85 s и использует около 470 MB RSS. Поэтому мобильная готовность пока ограничена memory/serialization footprint, несмотря на наличие micro-cycle governor и state economy.

## 7. Verification debt
После B304:
- function-like declarations: 3847;
- verified functions: 38;
- verified rate: 0.0102;
- evidence coverage: 0.0671.

Это остаётся одним из крупнейших долгов проекта. B304 не должен использоваться для его сокрытия.

## 8. Итог
B304 — реальный evidence increment, а не новый дублирующий brain/personality subsystem. Главный прогресс — переход от holdout по числовым fingerprints к hidden semantic task families и привязка temporal governor к реальному устройственному давлению.
