# Текущий статус Neuro-Kurisu SUPER — WorkPass 17

**Дата:** 10 октября 2026 года  
**База:** WorkPass 16  
**Runtime:** Neuro-Kurisu 35.40.0 / schema 223  
**Состояние:** implementation-workpass; НЕ release-ready.

## Что реально улучшено

- Повторное наблюдение в проектном DAG теперь идёт через внешний HTTPS research adapter, а не через второй внутренний context/evidence read.
- Completion research step требует реальный external result и `EvidenceFirewall` promotion; consolidation требует уже promoted claim.
- URL, network enabled state, HTTPS, private hosts и allowlist проверяются до расходования cognitive budget и retry attempts.
- External claim нельзя продвинуть только за счёт двух доменов, если они выдают одинаковый content hash.
- Research ingestion перестал самостоятельно продвигать произвольный текущий шаг плана; completion принадлежит canonical executor. Ошибка другого инструмента не тратит retry budget текущего шага.

## Актуальная нормализованная задача-сводка

- Всего: 56 уникальных deliverables.
- DONE: 38; PARTIAL: 9; TODO: 9.
- Взвешенная оценка реализации: **69.05%** (+0.40 п.п. относительно baseline WorkPass 16). Это не оценка релизной готовности.

## Проверки в этом проходе

- `npm run audit:workpass17` — PASS, exit code 0.
- `npm run test:big-pass-175` — PASS, в том числе progress/persistence/restart.
- `npm run test:big-pass-175:recovery` — PASS.
- `npm run test:big-pass-175:scheduler` — PASS.
- Runtime TypeScript (`tsc`) — PASS.
- Server relative import audit — 10 checked, 0 missing.
- Static UI/API linkage — 124 routes, 48 Runtime Atlas surfaces, 5 required seams, 0 missing.

## Честные ограничения

Реальный внешний provider run не проводился: сеть намеренно выключена по умолчанию и requires explicit `NEURO_PROJECT_NETWORK_ENABLED`, `NEURO_PROJECT_NETWORK_ALLOWLIST` и URLs. Поэтому live corroboration/promotion в производственной сети пока не считается доказанным. React/Vite production build, настоящий браузерный E2E/Live2D, clean-room restore/upgrade/rollback, soak и финальные SBOM/provenance также остаются открытыми.
