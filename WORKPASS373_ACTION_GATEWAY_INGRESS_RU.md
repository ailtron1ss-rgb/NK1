# NK1 WorkPass373 — безопасная граница ActionGateway перед побочными эффектами

**Дата:** 2026-10-26  
**Ветка:** workpass373-action-gateway-ingress  
**База:** WorkPass372 head `83645a237e47e95668c9bab44c6743b9e9411345`  
**Статус:** первый typecheck выявил один own-key narrowing и два вызова `result()` без обязательного notes; исправлено в bcb0ca32b3c6e0ed2c39d553ce0e72db6a75e99b. Новому exact-head требуется полный CI.

## Найденный пробел

`executeTool()` и `reconcileToolExecution()` напрямую читали поля caller-owned `input`/`options` перед `sha256Stable()` и async execution. Accessor мог исполниться ещё до проверки, строковое `autonomous:'false'` превращалось в `true`, а caller мог изменить вложенный input после вычисления request hash, но до фактического tool side effect.

## Исправления

- Own-data snapshot для options с явной проверкой `idempotencyKey`, `decisionId`, `autonomous`, `approvalId` и `expectedOutputKeys`.
- Bounded plain-JSON clone для всех tool input с отказом на accessors, циклах, прототипах, sparse/extended arrays, unsupported values, unsafe numbers, большой глубине и размере.
- Clone формируется до первого await, request fingerprint и tool executor работают с тем же detached payload.
- Reconciliation использует ту же входную границу до чтения ключа или обращения к хранилищу/провайдеру.

## Регрессии

- Getter верхнего уровня, nested getter и options getter не исполняются и не запускают executor.
- Строковое autonomous `false` отклоняется; нет coercion в true.
- Мутация caller-owned input/options сразу после вызова не меняет данные, которые получил executor.
- Ошибка ingress в reconciliation отклоняет запрос до provider/tool work.

## Границы

- CHANGELOG/checkpoint добавлены; `main` и published Release ZIP не менялись.
- Нужны exact-head WorkPass331, WorkPass110 и ActionGateway contract CI прежде чем считать проход PASS.
