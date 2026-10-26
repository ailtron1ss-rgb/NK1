# NK1 WorkPass426 — целостность applicationAttempts в HMX lifecycle

**Дата:** 2026-10-26  
**Ветка:** workpass426-hmx-attempt-counter-integrity-v2  
**База:** PR #236 head `caf39751db4845d7977197490af33198ba200665` (`fix/outcome-projection-index-restore-2026-10-26`)  
**Статус:** код и regression committed; exact-head CI требуется. PASS не заявляется.

## Дефект

`applicationAttempts` не входит в HMX content digest, что корректно для lifecycle-поля, меняющегося при повторных попытках. Но validator не проверял его тип. `decideHmx(..., 'apply')` вычислял новое значение через `Math.floor(Number(value))`: строка вроде `bad` могла превратиться в NaN при обновлении retry state, хотя reviewed content digest оставался валидным.

## Изменения

- Общий `isValidHmxStageDigest` валидирует присутствующее `applicationAttempts` как non-negative safe integer; пропущенное поле для старых stages остаётся совместимым.
- `isValidHmxApplyReceipt` требует, чтобы `receipt.attempt` совпадал с lifecycle counter на stage, если counter присутствует.
- Добавлены regression cases на строковые, дробные, отрицательные, не finite и unsafe значения, а также mismatch receipt/counter. Проверяется отказ до canonical storage.

## Проверка и границы

- Новый exact-head runtime typecheck, Hexis canonical apply и WorkPass71 validation должны завершиться до объявления PASS.
- Предыдущие проверки PR #236 завершались failure до появления runner-step logs; это не доказательство прохождения или провала именно этих новых регрессий.
- `main` и опубликованный Release ZIP не менялись.
