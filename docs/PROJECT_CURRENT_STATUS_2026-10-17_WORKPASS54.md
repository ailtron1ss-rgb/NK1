# Neuro-Kurisu — текущее состояние WorkPass 54

**Дата:** 2026-10-17  
**База:** WorkPass53  
**Runtime:** 35.75.0  
**Schema:** 225  
**Статус:** implementation-workpass; релизные ворота остаются открытыми.  
**Взвешенная готовность:** 78.0%; production browser E2E и реальные provider/device side effects всё ещё не подтверждены.

## Реальные изменения

- `app/src/neuro-kurisu/action-approval-broker.ts` держит in-tab continuation для конкретного approval ticket. Исходное тело запроса не сохраняется в localStorage/sessionStorage и не попадает в UI snapshot.
- `app/src/components/ActionApprovalCenter.tsx` добавляет постоянно доступную панель одобрения в корневой маршрут приложения. Показывается только превью, подготовленное каноническим ActionGateway.
- `app/src/neuro-kurisu/api.ts` обнаруживает структурированный `403 approvalRequired`, приостанавливает исходный POST, резолвит разрешение через канонический runtime и повторяет точный исходный JSON-запрос один раз. Отказ и ошибка разрешения не запускают повтор.
- `RuntimeAtlas.tsx` больше не предлагает конкурирующие кнопки resolve; он остался read-only очередью и историей, чтобы две панели не могли состязаться за один ticket.
- Добавлены сценарии broker lifecycle (5/5): публикация, продолжение один раз, отказ, дублирующий live ticket и истечение срока. API-контракт (3/3) также проверяет точный replay, отказ без replay и отбрасывание malformed/far-future expiry; неповторяемое тело не предлагается для автоматического продолжения.
- Применён fail-closed принцип из сохранённого Hexis источника `legacy/input-archives/hexis-main-2026-10-08/core/tools/policy.py` и `tests/core/test_approval_gate.py`; не переносилось implicit CHAT approval исключение.

## Сделано / осталось

- **DONE:** единая видимая очередь для API-операций, требующих разрешения; точный повтор исходного действия после одобрения; decline/expiry/replay semantics; один владелец durable permissions; Runtime Atlas не конкурирует за разрешение.
- **PARTIAL:** после перезагрузки вкладки sensitive request body не восстанавливается (намеренно). Повторная явная отправка того же действия может привязаться к ещё ожидающему серверному fingerprint; иначе ticket истекает в пределах пяти минут. Нужен более заметный orphan UX без сохранения тела операции.
- **TODO:** dependency-complete Vite production build и настоящий browser E2E; реальные provider/device receipts/reconnect/replay; точный audio-buffer/phoneme lip sync; независимое улучшение retrieval (`recallDelta` ранее был 0); clean-room rollback; полный nested-source licensing audit; многочасовой soak.

## Состав WorkPass54

- Все 9 212 файловых путей WorkPass53 сохранены; добавлено 9 файлов, изменено 16, удалено 0.
- ZIP CRC PASS; Unicode/UTF-8 имена проверены.

## Ограничения выполнения

В окружении нет установленных `app/node_modules`, поэтому настоящий браузерный прогон не заявляется. Проверки кода нужны как свидетельство работы новой логики, но не считаются самостоятельным улучшением проекта.
