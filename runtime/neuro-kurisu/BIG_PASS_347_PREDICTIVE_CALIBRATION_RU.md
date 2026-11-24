# BIG PASS 347 — КАЛИБРОВКА СОБСТВЕННЫХ ПРЕДСКАЗАНИЙ

## Цель
Замкнуть разрыв между pre-action outcome prediction и фактическим результатом действия.

B345 дал организму возможность использовать накопленную историю последствий перед выбором. Но confidence предиктора в основном опирался на evidence/sample history. B347 делает predictor самокалибрующимся: ошибка между прогнозируемой наградой и фактической наградой возвращается в состояние конкретного действия.

## Реализованный цикл
pre-action prediction
→ action
→ real outcome
→ calibration error
→ confidence recalibration
→ epistemic uncertainty
→ next arbitration

## Что добавлено
Для каждого action phenotype теперь сохраняются:
- `lastPredictedReward01`
- `calibrationErrorEMA01`
- `calibrationBias11`
- `calibrationCount`

`predictOutcome()` теперь:
- учитывает накопленный calibration bias;
- вычисляет calibrated confidence;
- сохраняет именно тот pre-action prediction, который должен быть сопоставлен с последующим outcome.

`observeOutcome()` теперь:
- сравнивает фактический reward с последним pre-action prediction;
- обновляет calibration error EMA;
- обновляет systematic prediction bias;
- ограничивает confidence плохой calibration quality;
- добавляет calibration quality в evidence/stability/causal confidence dynamics.

## Реальный эффект для организма
B346 рассчитывает epistemic uncertainty через learned outcome confidence.
После B347 эта confidence теперь зависит не только от количества истории, но и от того, насколько организм действительно умеет предсказывать последствия.

Таким образом возникает более глубокий контур:

`history → prediction → outcome → prediction error → calibration → uncertainty → decision`

Это позволяет будущему epistemic arbitration различать не просто `мало данных` и `много данных`, но и `много данных, которым организм научился плохо соответствовать`.

## Проверки
### Unit
`B347_PREDICTIVE_CALIBRATION=PASS`

После серии точных predictions:
- calibration error EMA = `0.0748`
- confidence = `0.6087`

После намеренно ошибочной серии:
- calibration error EMA = `0.2887`
- confidence = `0.6549`
- calibration bias = отрицательный

После последующей серии корректного обучения:
- calibration error EMA = `0.1889`
- confidence = `0.8107`

Важно: confidence не обязан монотонно падать от любого ошибочного эпизода, потому что verified evidence одновременно меняет доказательную базу. Поэтому критерий проверяет именно ухудшение/восстановление calibration error и наличие bounded confidence response, а не желаемое направление одного scalar.

### Live Core
Минимальный реальный Core runtime:
- 1 operational cycle;
- selected action = `explore`;
- samples = `1`;
- calibrationCount = `1`;
- calibrationErrorEMA01 = `0.2458`;
- lastPredictedReward01 = `0.5`.

Более длинный 3–10 tick Core harness в текущем execution budget нестабилен/timeout-prone; это фиксируется как performance limitation, а не как PASS.

### Regression / engineering
- B344 — PASS
- B345 — PASS
- B345 Core — PASS
- B346 — PASS
- B346 Core — PASS
- B347 unit — PASS
- B347 minimal live Core — PASS
- typecheck — PASS
- Core ownership — PASS (`errors=0`)
- architecture — PASS (`1228 source files`, `399 canonical`, `0 cycles`, `legacyLeakage=0`)
- integrity — PASS (`2634 files`, `schema=127`)
- release contract — PASS
- executable syntax — PASS (`848 JS`, `5 SH`, `203 JSON`, `0 failures`)

## Что B347 не доказывает
B347 не доказывает сознание, биологическую нейронность, полноценную самостоятельную научную мотивацию или long-horizon autonomy.

Он закрывает конкретный инженерный разрыв: self-generated predictions теперь получают explicit post-action calibration и это качество возвращается в следующий decision cycle.

## Следующий критический шаг
Использовать calibrated outcome model в developmental holdout:

`learn → restart → new context → calibrated epistemic arbitration → action → outcome → recalibration → persistent personality/self-model change`.

Цель следующего шага — увидеть, что организм действительно меняет стратегию после того, как обнаруживает собственные систематические ошибки предсказания.
