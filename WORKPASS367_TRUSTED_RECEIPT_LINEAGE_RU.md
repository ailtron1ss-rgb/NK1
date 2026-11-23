# NK1 WorkPass367 — проверка причинной цепочки trusted receipt

**Дата:** 2026-10-26  
**Ветка:** workpass367-receipt-lineage-verification  
**База:** WorkPass366 exact head `3fdb5eba48664f9004d29c3858355862aea8f4ae`  
**Статус:** реализация и регрессии опубликованы; exact-head CI ожидает проверки.

## Дефект

`hasToolReceiptTrace()` ранее проверял по существу только наличие событий стадий `tool-action`, `tool-outcome`, `tool-evidence`. Одни типы стадий не доказывают, что записи относятся к одной операции и соединены нужными причинными рёбрами. Метод также нормализовал lookup ID через String/trim, а индексный fingerprint не сверялся с тремя event-bound hashes.

## Исправления

- Lookup ID принимается только в точной канонической форме; нестроковые/пробельные alias значения отклоняются.
- Проверяются одинаковые executionId/tool в action/outcome/evidence, `outcome.parentIds` содержит action, `evidence.parentIds` содержит outcome.
- Проверяются типы outcome/evidence flags и согласованность external flag.
- Если это WorkPass365+ запись, SHA-256 должен присутствовать на всех трёх событиях, совпадать между ними и с индексом; expected/observed postcondition hashes проверяются на корректный формат.
- Legacy traces без event-bound hash fields остаются допустимыми при сохранении базовой причинной целостности.

## Регрессии

- Валидная цепочка до и после restore.
- Подмена outcome/evidence на события тех же типов и execution ID, но без parent-связей, должна отклоняться.
- Неканонический lookup ID и изменённый index fingerprint должны возвращать false.

## Границы

- CHANGELOG и checkpoint записаны; `main` и опубликованный Release ZIP не менялись.
- Тестовый результат ожидает exact-head CI WorkPass331/WorkPass110. Локальный запуск/измеренный прирост обучения не заявляются.
