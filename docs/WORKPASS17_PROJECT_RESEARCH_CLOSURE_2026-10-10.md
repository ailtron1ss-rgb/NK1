# WorkPass 17 — реализация проектного исследования с независимым подтверждением

Дата: 2026-10-10  
База: WorkPass 16 (`Neuro_Kurisu_SUPER_WILL_LUMINA_HEXIS_LETTA_CONSCIO_INTEGRATED_WORKPASS16_2026-10-10.zip`)  
Runtime: Neuro-Kurisu 35.40.0 / schema 223  
Тип прохода: функциональное изменение runtime, не release sign-off.

## Что изменено в продукте

1. Планировщик автономных проектов больше не использует повторное внутреннее чтение как эквивалент независимого внешнего подтверждения. Шаг `repeat` теперь назначен на `organism.project.research`, требует реальный внешний результат и не завершается до продвижения соответствующего claim в `EvidenceFirewall`.
2. Шаг `consolidate` требует ранее продвинутого research claim. Одной точечной confidence-оценки от инструмента недостаточно.
3. External research получил переиспользуемый `preflightUrl`: сетевой policy, пустой URL, HTTPS, запрещённые/private hosts и allowlist проверяются до вызова инструмента. Планировщик возвращает точную причину и не расходует retry budget на исправимую конфигурацию.
4. `EvidenceFirewall` теперь требует от внешних claims не только разных source identities, но и как минимум двух уникальных content hashes. Два домена, раздающих те же байты, больше не считаются независимым подтверждением.
5. `ProjectResearchSession` сохраняет и восстанавливает метрики разнообразия источников/содержимого, а также синхронизирует promotion state с canonical firewall после restore.
6. Удалена скрытая связь «запись evidence сама продвигает текущий шаг плана». Ingestion фиксирует свидетельства; только канонический executor завершает назначенный шаг после проверки его требований.
7. Ошибка постороннего инструмента больше не списывает retry attempts активного шага. `completeToolStep` сверяет ожидаемый инструмент и требуемые research gates.

## Регрессии

Добавлен `tests/big-pass-179-project-research-gates.mjs`. Он покрывает preflight-политику, одинаковые hashes из разных hosts, promotion при разнообразных источниках и содержимом, gating шагов repeat/consolidate, изоляцию retry budget от постороннего инструмента и реальный Core сценарий: отключённая сеть возвращается как явная причина без попытки исполнения и без расходования retry budget.

## Проверки, выполненные в этом проходе

- `npm run audit:workpass17` — PASS, exit code 0.
- Runtime TypeScript (`tsc`) — PASS.
- `test:project-research-gates` — PASS; включая новые проектные регрессии и прежние external-skill/firewall/persistence suites.
- `test:big-pass-175` — PASS; активный project, progress/linked-goal equality и restart persistence.
- `test:big-pass-175:recovery` — PASS.
- `test:big-pass-175:scheduler` — PASS.
- Server relative imports — 10 checked, 0 missing.
- Static UI/API linkage — 124 routes, 48 Runtime Atlas surfaces, 5 required seams, 0 missing.

## Границы результата

Внешний источник всё ещё требует настройки `NEURO_PROJECT_NETWORK_ENABLED=true`, `NEURO_PROJECT_NETWORK_ALLOWLIST` и предоставленного URL. Автоматическое исследование не выдумывает URL, не обходит allowlist и не помечает неразрешённый claim как подтверждённый. Проверки не включают живой внешний provider, полный React/Vite build или browser E2E. Это не release-ready заявление.

Общая взвешенная оценка roadmap не пересчитывалась в этом узком функциональном проходе; предыдущая оценка 68.65% остаётся историческим baseline WorkPass 16, не оценкой релизной готовности.
