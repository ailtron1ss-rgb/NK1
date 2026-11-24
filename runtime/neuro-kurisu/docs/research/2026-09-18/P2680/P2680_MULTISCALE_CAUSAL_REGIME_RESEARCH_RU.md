# P2680 — Multiscale Causal Regime Fabric: research notes

## Цель
Перевести world-model stack от набора локальных предсказателей к адаптивной структуре режимов: быстро меняющиеся transition patterns и более медленные абстракции должны обновляться с разными скоростями, а переходы между режимами должны иметь наблюдаемый causal/evidence trail.

## Свежие направления
1. **Active inference / artificial reasoning (Nature Communications, 08.09.2026).** Информационный выигрыш можно использовать для выбора исходов, наиболее различающих конкурирующие модели мира; это поддерживает связку P2675 → P2525 → P2526.
2. **World Models for Embodied Intelligence (arXiv, 15.09.2026).** Полезность world model предлагается оценивать через controllability/actionability: planning, action, learning, verification, recovery и data selection, а не только визуальную правдоподобность.
3. **MuSix (arXiv, 01.07.2026).** Multi-scale mixture of world models использует experiential distance для routing и разные скорости забывания/обновления на разных масштабах. P2680 вводит lightweight fast/slow regime learning как экспериментальную реализацию этой идеи.
4. **Policy-information-gain (Nature Communications, 27.06.2026).** Policy-IG связывает новое evidence с изменением выбора действия; это полезно как следующий критерий для экспериментального выбора действий.
5. **Fast/slow inference (Nature Communications, 23.06.2026).** Разделение быстрых и медленных процессов с дополнительным inference-time compute мотивирует отдельный fast/slow learning path.

## Внедрено
- B2526MultiscaleCausalRegimeGraph: discovery режимов, transition edges, fast/slow learning, uncertainty, shift detection, intervention pressure.
- B2527FactorialAblationHarness: реестр факторов, индивидуальный contribution и interaction gain для будущих factorial/lesion тестов.
- NeuralExperienceBranch теперь получает B2525 transition bias + B2526 regime bias до финального cross-layer fusion.
- Persistence, diagnostics и release schema обновлены.

## Ограничения
B2526 не является полноценной вероятностной causal graph inference системой; это компактный on-device прототип. B2527 пока является измерительным harness, а не доказательством причинного эффекта. Реальный Android sensor/action loop ещё не завершён.

## Следующий эксперимент
Сравнить factorially:
- baseline;
- +B2524;
- +B2525;
- +B2526;
- +B2524+B2525;
- +B2525+B2526;
- +B2524+B2525+B2526;
- +active-information;
- полный stack.

Основные метрики: holdout reward, transition prediction error, regime recovery, calibration, action coverage, information gain, energy/compute per useful update, long-duration retention.
