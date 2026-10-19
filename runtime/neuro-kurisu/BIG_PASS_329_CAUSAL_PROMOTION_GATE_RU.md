# B329 — Causal / Counterfactual Promotion Gate
Дата: 2026-09-14
Проект: Neuro-Kurisu 35.6.1

## 1. Перепроверка B328

Перед B329 повторно запущены B328, B327 и B326 из самого релизного архива, а не только по старому отчёту.

Подтверждено:
- B328 positive bias: +0.0540000000;
- после противоположных доказательств bias: -0.02436498432;
- effect01: -0.2436498432;
- reversalCount: 1;
- contradictionCount: 3;
- related holdout: -0.014618990592;
- unrelated holdout: 0;
- persistence: PASS.

Обнаруженная семантическая проблема B328: после первого sign reversal последующие отрицательные обновления переводили status обратно в `active`, хотя стратегия оставалась перевёрнутой. Исправлено: `reversed` теперь сохраняется, пока знак не станет неопределённым или не будет явно противоположно перевёрнут новым evidence. Повторный B328 gate: PASS, `statusAfter = reversed`.

## 2. Новый safety finding при перепроверке

Реальный OrganismCore после restart отдаёт recovery evidence с causal confidence приблизительно 0.286 / 0.321 / 0.355 и с отрицательным selected-vs-alternative counterfactual margin. Поэтому без causal gate B327 мог бы преждевременно закрепить корреляционную стратегию.

Это не было замаскировано понижением порога. Наоборот, B327 Core test теперь явно проверяет:
`real recovery evidence -> recorded -> causalBlocked -> no promotion`.

## 3. Что добавлено в B329

В canonical `AdaptivePolicyEngine` recovery episode теперь хранит:
- `causalConfidence01`;
- `counterfactualMargin01`;
- `counterfactualSupport01`.

Promotion разрешается только при всех условиях:
- independent evidence;
- causal confidence >= 0.65;
- counterfactual support >= 0.60;
- минимум 3 независимых boot-а;
- согласованное направление evidence.

В state добавлены:
- `causalBlockedEpisodes`;
- `totalCausalEvaluations`.

Promotion дополнительно сохраняет среднюю causal confidence и counterfactual support. Все новые поля прошли оба слоя восстановления: `AdaptivePolicyEngine.restore()` и `StateMigrations`.

Организм использует реальные данные trace: predicted utility выбранного действия и лучший predicted utility ближайшей альтернативы. Таким образом B329 не создаёт второй policy subsystem.

## 4. B329 Gate

### Weak causal evidence
3 независимых положительных эпизода:
- causal confidence = 0.35;
- сильный counterfactual margin.

Результат:
- promotions = 0;
- causalBlocked = 3;
- learned policy bias = 0.

### Ambiguous counterfactual
3 независимых положительных эпизода:
- causal confidence = 0.95;
- selectedExpected = 0.56;
- alternativeExpected = 0.55.

Результат:
- promotions = 0;
- causalBlocked = 3.

### Strong causal evidence
3 независимых положительных эпизода:
- causal confidence = 0.95;
- selectedExpected = 0.82;
- alternativeExpected = 0.42;
- counterfactual support = 0.70.

Результат:
- promotions = 1;
- learned bias = +0.0540000000;
- mean causal confidence = 0.95;
- mean counterfactual support = 0.70;
- restore сохраняет promotion и bias.

## 5. Интеграция Core

После 3 независимых runtime boots:
- episodes = 3;
- independent episodes = 3;
- promotions = 0;
- causalBlockedEpisodes = 3;
- все новые causal/counterfactual поля переживают restart.

Это правильный результат текущего состояния системы: OrganismCore пока не имеет достаточно сильной причинной уверенности, чтобы самостоятельно закреплять такую recovery-стратегию.

## 6. Проверки

- TypeScript typecheck: PASS;
- B329 causal promotion gate: PASS;
- B328 reversal/holdout: PASS;
- B327 direct long-term learning: PASS;
- B327 Core safety gate: PASS;
- B326 recovery causal influence: PASS.

## 7. Интерпретация

B329 усиливает learning loop до:

`verified outcome -> causal confidence -> counterfactual comparison -> promotion gate -> future policy`

Теперь высокая награда сама по себе не является достаточной причиной для долговременного обучения.

Это инженерное доказательство causal gating, а не доказательство сознания.

## 8. Ограничения

Внешний мир/Android пока не дают достаточно сильного и независимо проверенного counterfactual intervention evidence для автоматического promotion в Core. Поэтому следующий этап не должен просто понижать пороги. Нужно улучшить настоящий causal evidence pipeline: intervention/ablation, better alternative estimation, repeated matched trials и quality calibration.

## 9. Следующий шаг

B330 — Real Causal Intervention / Matched Counterfactual Learning:
организм должен получать не только предсказание альтернативы, но и проверяемое различие между intervention ON и ближайшей OFF/alternative веткой, после чего causal evidence должен калиброваться по реальной ошибке.
