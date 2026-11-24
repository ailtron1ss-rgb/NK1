# NeuroCore — отчёт WorkPass64

**Дата:** 19 октября 2026 г.  
**Базовая версия:** WorkPass63.  
**Статус:** implementation-workpass; не production-релиз.

## Основные изменения

- Подключён ограниченный P29/P30 learning contribution к rawUtility, с проверкой допуска и provenance в PolicyAuthorityLedger.
- Вклад ограничен: governance ±0.035, transfer priors ±0.025, суммарно ±0.06.
- Добавлен флаг абляции, позволяющий отключить этот вклад.
- Удалены доказанно неиспользуемые импорты OrganismCore.ts.
- Ускорены и унифицированы fast verification runners.
- Исправлена очистка временного continuity-log в self-agency тесте.
- Подготовлен отдельный компактный runtime ZIP.

## Проверки, заявленные в отчёте рабочей сборки

- Fast checks: PASS 10/10 (~21–22 s).
- Runtime typecheck: PASS.
- Core ownership: PASS, 0 ошибок.
- Learning contribution: PASS 8 сценариев.
- Live A/B: сигнал присутствует при ON и равен нулю при OFF.
- Archive manifest: 4,257/4,257 SHA-256 записей совпали.
- App script tests: PASS 218/218.
- Browser-smoke verdict contracts: PASS 51/51; это не настоящий browser E2E.
- Autonomy regression: 79/80 по текущему тестовому критерию.
- Restart persistence и server smoke: PASS.

## Незакрытые проверки / ограничения

- Качество выбора действий на независимых задачах не доказано.
- Retrieval benchmark: recallDelta=0, promotion=not-promoted.
- Полный verify:deep не закрыт.
- Production UI build и настоящий browser/Live2D E2E не подтверждены.
- Не завершены независимый multi-seed holdout, длительный soak и полный license review.
- Тесты функциональных свойств не доказывают субъективное сознание.

## Следующий шаг: WorkPass65

Независимый paired-seed harness для baseline, governance-only, transfer-only и full integration. Заранее зафиксировать task success, regret, calibration, forgetting, catastrophic failures и resource cost. Не продвигать изменение без стабильного улучшения на независимом holdout.
