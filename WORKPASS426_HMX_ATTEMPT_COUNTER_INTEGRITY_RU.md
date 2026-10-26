# NK1 WorkPass426 — целостность applicationAttempts в HMX lifecycle

**Дата:** 2026-10-26  
**Ветка:** workpass426-hmx-attempt-counter-integrity  
**База:** PR #236 current head `c7c7398a1ff06d296ebac4f3fb0c398dde8eddbd` (`fix/outcome-projection-index-restore-2026-10-26`)  
**Статус:** код и regression committed; exact-head CI требуется. PASS не заявляется.

## Дефект

`applicationAttempts` не входит в HMX content digest, что корректно для lifecycle-поля, меняющегося при повторных попытках. Но validator не проверял его тип. `decideHmx(..., 'apply')` вычислял новое значение через `Math.floor(Number(value))`: строка вроде `bad` превращалась в NaN при обновлении retry state, ещё до canonical writer. Последующие повторы становились невозможными, хотя digest review payload оставался валидным.

## Изменения

- Общий `isValidHmxStageDigest` валидирует присутствующее `applicationAttempts` как non-negative safe integer; пропущенное поле для старых stages остаётся совместимым.
- `isValidHmxApplyReceipt` требует, чтобы receipt.attempt совпадал с lifecycle counter на stage, если counter присутствует.
- В projector-тест добавлены строки, дроби, отрицательное, NaN/Infinity и unsafe-integer значения, а также receipt/counter mismatch. Проверяется, что canonical storage не вызывается.

## Проверка

- Интеграционный PR #236 имеет историю CI failures без доступных step logs и содержит отметки о проблемах выделения runner; новые exact-head checks необходимы.
- Никаких заявлений об успешном runtime-тесте, приросте обучения или готовности релиза пока нет.
- `main` и опубликованный Release ZIP не менялись.
