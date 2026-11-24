# Neuro-Kurisu current project status — WorkPass 52

**Дата:** 2026-10-16  
**База:** WorkPass51  
**Runtime:** 35.73.0  
**Schema:** 225  
**Статус:** implementation-workpass; релизные ворота остаются открытыми.  
**Взвешенная готовность:** 78.0% (оставлена без повышения: production build/E2E и реальные провайдерные/устройственные контуры не подтверждены).

## Реальные изменения

- `AutonomousProjectExecutor` не принимает сам факт `verified` как достаточное условие завершения проектного шага.
- Для promotion требуется нужное количество **квалифицированных** попыток; только попытки с достаточным evidence count towards `minAttemptsBeforePromotion`.
- Неподходящие project/tool/step/research-gate исходы не расходуют outcome ID до успешного сопоставления.
- Слабое свидетельство запускает ограниченный backoff; не увеличивает fitness или готовность продвижения навыка.
- `/api/organism/projects/active` и Runtime Atlas показывают реальный прогресс плана и причины ожидания/блокировки.

## Сводка статусов

- DONE: 22
- PARTIAL: 8
- TODO: 5

## Открыто

- Production React/Vite build и интерактивный browser/Live2D E2E.
- Длительная сессия с реальным language provider и физическим устройством.
- Точная lipsync по аудиобуферу/фонемам.
- Независимый benchmark MemoryOS2: общий recall uplift по-прежнему не доказан.
- Clean-room restore/rollback, полный nested-source license sign-off и soak.
