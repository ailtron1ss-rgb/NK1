# NK1 WorkPass406 — оценка прогресса ветки обучения

Дата снимка: 23 октября 2026 года. Рабочая ветка: `feature/learning`.

## Текущая оценка

| Область | Оценка реализации | Что входит / почему не 100% |
|---|---:|---|
| Сбор опыта, replay и continual learning | 80% | Есть приоритизированный/стратифицированный replay, forgetting/transfer/drift-системы; полный независимый live-benchmark по реальным задачам пока не подтверждён |
| Жизненный цикл навыка и promotion gate | 90% | Есть staged candidates, независимая оценка, разделение validation/holdout, signed evidence, authenticated approval и rollback; реальное внешнее исполнение sandbox/verifier/scanner остаётся отдельным gate |
| Целостность оценки и происхождение evidence | 88% | Есть точные fingerprints, canonical task/seed/split joins, trust boundary и hash-chained fitness journal; независимое развёртывание evaluator authority пока не подтверждено |
| Метрики качества и наблюдаемость | 82% | Есть P23 family confidence bounds, журнал fitness-решений и WorkPass406 task-balanced IQM/paired improvement; требуется исторический прогон на данных реальных циклов и валидация калибровки |
| Воспроизводимость production-проверок | 40% | Регрессионные контракты и workflow подключены, но Actions на точном текущем HEAD сообщают failure без доступных steps/logs; полный независимый multi-seed uplift не доказан |

**Сводная инженерная оценка полноты реализации категории: 77%.** Расчёт — взвешенное экспертное резюме по приведённым направлениям, а не автоматически измеренная метрика и не оценка интеллекта.

**Подтверждённая production-готовность категории: около 45%.** Этот показатель ниже, потому что он учитывает реальное исполнение проверок на точном HEAD, развёртывание независимых evaluator authorities, подтверждённые gains и длительные интеграционные прогоны. Пока CI не предоставляет запускаемые шаги и логи, высокий процент реализованного кода нельзя считать подтверждённой готовностью.

## WorkPass406 — что сделано в этом проходе

- Добавлен `LearningRobustMetrics.ts`: task-balanced interquartile mean (IQM), delta IQM и paired probability of improvement отдельно для task success, skill quality и trajectory quality.
- Метрики вычисляются для validation и holdout из уже matched и проверенных evaluator envelopes. Усреднение сначала выполняется внутри задачи и только затем между задачами, так что задачи с большим числом seed не получают автоматически больший вес.
- Публичный `P23LearningEngine.approveIndependentlyEvaluatedSkillCandidate` теперь сохраняет типизированную форму диагностик в возвращаемом `fitness`.
- Новая регрессия включена в `test:p23:learning` и в P26 Learning Validation workflow; workflow path filters включают модуль и тест.
- Добавлена документация и checkpoint. Изменения внесены в `feature/learning`; `main` и release ZIP не изменялись.

## Доказательность и ограничения

Локальный изолированный тест метрик выполнился успешно, а строгий TypeScript check нового модуля вместе с локальной заглушкой trust boundary прошёл. Это **не** полная проверка рабочего дерева NK1 и не замена CI.

На проверенном commit P26 Learning Validation завершился со статусом `failure`, но API возвращает для job пустой список шагов, `logs_url=null`, а загрузка логов — `BlobNotFound`. Поэтому причину нельзя честно приписать этому коду или runner, и результат нельзя считать PASS.

WorkPass406 не демонстрирует фактического улучшения навыков сам по себе: метрики описательные и явно помечены `diagnosticOnly: true`. Они не меняют `eligible`, не обходят paired-seed confidence, safety, provenance, signed-evidence и approval gates.

## Конечная цель ветки обучения

Условие готовности — не наличие новых файлов. Категория считается завершённой после того, как полный цикл «реальный исход/ошибка → разбор траектории → план ремонта → кандидат → выполнение в изолированном окружении → независимая оценка на фиксированных validation и нетронутом holdout → подтверждённое решение → наблюдаемый результат/rollback» выполняется воспроизводимо; точные тесты и typecheck зелёные на одном HEAD; устойчивый выигрыш подтверждён заранее зарегистрированными независимыми seed/task families без недопустимого регресса; длинный soak, privacy/license review и production evaluator isolation закрыты.

## Следующие приоритеты

1. Восстановить actionable CI: получить исполнимые jobs/step logs для текущего HEAD и не подавлять ошибки setup/runner.
2. Запустить новую метрику через полную P23 ветку на независимом labelled benchmark; проверить task families, missing pairs, per-split data isolation и стоимость.
3. Встроить диагностический summary в dashboard/longitudinal snapshot только через allowlisted агрегаты, сохраняя privacy и diagnostic-only семантику.
4. Подтвердить внешний sandbox, independent verifier/scanner и signed remote checkpoints для журнала; затем выполнить multi-seed/long-soak валидацию.
