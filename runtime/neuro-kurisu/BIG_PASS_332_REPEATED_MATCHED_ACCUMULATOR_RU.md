# BIG PASS 332 — Repeated Matched-Trial Accumulator & B331 Recheck
Дата: 2026-09-14

## 1. Цель

B332 продолжает перепроверку B331 и устраняет конкретный runtime-разрыв: `matchedTrials` должен отражать повторные matched observations одного recovery episode, но не создавать дубликаты recovery episodes для одного boot.

## 2. Что перепроверено

B331 unit gates и `npm run typecheck` повторно PASS.

Обнаружено:
- `recordMatchedCounterfactual()` мог считать повторные trials отдельно только на уровне последнего runtime observation;
- `observeRecoveryOutcome()` раньше сразу блокировал повторный вызов того же `bootId`, поэтому накопленный trial count не доходил до существующего recovery episode;
- live runtime естественно меняет `contextKey` и `action`, поэтому нельзя объединять разные context/action в один causal cohort.

## 3. B332 implementation

Изменения:
- введён per-`contextKey + action` matched-trial accumulator в `OrganismCore` на время текущего process/boot;
- повторные вызовы `observeRecoveryOutcome()` для того же boot теперь обновляют существующий episode, если `contextKey + action` совпадают;
- duplicate boot не создаёт новый episode и не увеличивает `totalEpisodes`;
- episode может накопить `matchedTrials=1 -> 2 -> 3` без фальсификации количества boot-ов;
- при несовпадении context/action повторный вызов блокируется как другой cohort;
- full typecheck остаётся PASS.

## 4. B332 verification

Canonical policy:
- 1 boot;
- 3 repeated matched trials;
- totalEpisodes = 1;
- matchedTrials = 3;
- promotion = 0 до появления требуемых независимых boots.

Live Core safety:
- один реальный runtime boot;
- live matched projection остаётся evidence source;
- promotion = 0.

## 5. Важное ограничение

B332 НЕ заявляет, что live OrganismCore уже способен автоматически накопить три одинаковых matched trials при естественной смене состояния.

Реальный runtime может менять `contextKey` и выбранное action между циклами. Такие наблюдения намеренно НЕ объединяются, потому что это было бы скрытым смешиванием разных causal contexts.

Следовательно B332 закрывает механизм накопления и duplicate-episode semantics, но не закрывает ещё live repeated causal promotion.

## 6. Regression

PASS:
- B329 causal promotion gate;
- B330 matched-counterfactual gate;
- B331 causal calibration;
- B332 repeated matched accumulator;
- `npm run typecheck`.

## 7. Интерпретация

Достигнут более строгий контур:

`prediction -> action -> realized outcome -> matched projection -> calibration -> repeated-trial accumulator -> evidence gate -> promotion / block`

При этом `matched-simulated` по-прежнему НЕ считается реальным физическим intervention ON/OFF evidence.

## 8. Прогресс

Консервативная общая оценка сохраняется около 73%. B332 не добавляет процент только за новый механизм: он уменьшает verification gap и предотвращает ложное объединение разных causal contexts.

Следующий крупный этап: устойчивый live cohort/repeated intervention design с controlled context hold, чтобы несколько matched trials можно было честно получить внутри одного recovery episode без искусственного форсирования состояния.
