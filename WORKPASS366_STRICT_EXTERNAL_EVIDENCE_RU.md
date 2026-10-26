# NK1 WorkPass366 — строгий контракт provider receipts и внешнего evidence

**Дата:** 2026-10-26  
**Ветка:** workpass366-trusted-evidence-ingress  
**База:** WorkPass365 branch `workpass365-atomic-receipt-projection` на `158bf892cbb50f6fcc83a25bbc2aaa6981436e5c`  
**Статус:** код/регрессии опубликованы; exact-head CI ожидает проверки.

## Найденные проблемы

- Provider revision и external observation принимали значения через String/Boolean coercion и confidence clamp, что позволяло строке `false` стать положительным флагом.
- Идентификаторы усекались до максимальной длины, создавая возможность коллизии ключей.
- Revision number не ограничивался безопасным положительным integer и мог повторяться/идти назад относительно сохранённой истории.
- Optional timestamps с неправильным типом заменялись текущим временем; malformed postconditions/reasons могли попадать в projection fingerprint после coercion/truncation.

## Исправления

- Snapshot own data fields без запуска getters; malformed input возвращает fail-closed result без изменения событий.
- Строгие типы для tick, timestamp, IDs, tool, статус, boolean flags, confidence и SHA-256 hex digests.
- Хранение/восстановление `revisionNumber` в bounded replay index с проверкой порядка и согласованности с событием.
- Append revision/observation и соответствующее изменение index выполняются под atomic ledger mutation.
- Postcondition text ограничен по размеру, нормализуется NFKC + locale-independent lowercase и сохраняется только как hash.

## Регрессии

- Нормальный provider revision и external observation, replay, restart restore и повторный replay.
- Отказ без мутации при невалидных ticks/IDs/hash/boolean/status/confidence/at/reason/postconditions.
- Getter accessors не исполняются; revision sequence не принимает повтор номера.

## Границы

- Новый checkpoint и CHANGELOG; `main` и опубликованный Release ZIP не менялись.
- WorkPass365 и WorkPass366 требуют отдельных exact-head GitHub Actions. Локальный тестовый запуск, learning uplift или релизная готовность не заявляются.
