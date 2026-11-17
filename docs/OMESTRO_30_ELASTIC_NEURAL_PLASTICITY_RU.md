# OmeStro #30 — Elastic Neural Plasticity

## Решение

Добавлен опциональный разреженный путь адаптации для существующего P26 ParametricPolicyLearner. Он изменяет тот же канонический массив весов выбранного действия; отдельной модели или второго владельца параметров не создаётся. Обычные train() / trainFeatures() и прежний SGD-путь не менялись.

## Что реализовано

- Явный allowlist имён параметров; отсутствующий или пустой allowlist отклоняется.
- Жёстко защищены identityCoherence и actionCost; дополнительно можно задавать собственный список защищённых параметров.
- Обновление ограничено долей параметров, максимальным числом координат и L2-бюджетом изменения за один шаг.
- Перед commit строится неизменяющий веса staged proposal; он фиксируется только после P29 arbitration по trust, конфликтам и доступному learning budget.
- Повторно поданные training sample IDs блокируются; незавершённые proposals живут только в памяти процесса и не переживают restart.
- Для каждого принятого изменения сохраняется предыдущий vector/bias выбранного action. Одноразовый rollback проверяет, что текущие веса всё ещё совпадают с ожидаемым кандидатом; rollback snapshot входит в P26 policy persistence.
- Важность параметров оценивается абляцией по retention holdout: поочерёдно обнуляется координата и измеряется изменение ошибки сохранённой компетенции. Высокая важность уменьшает шаг через EWC-подобный штраф.
- Перед записью кандидата сравниваются MSE новой компетенции и MSE сохранённой компетенции на непересекающихся наборах holdout. Кандидат отклоняется, если не улучшает новую задачу или нарушает допустимый порог забывания.
- Маски, оценка важности, причины решений и счётчики проходят через существующий snapshot/restore ParametricPolicyLearner и, следовательно, P26.
- P26TrueLearningEngine.trainFeaturesElastic() предоставляет явную точку вызова. Локальные holdout-оценки не добавляются в счётчик независимо аутентифицированных evidence.

## Ограничения / статус

- Это контролируемый адаптер для малой параметрической policy-модели NK1, а не механизм fine-tuning произвольной LLM или изменения всех тензоров сети.
- Путь opt-in: существующий онлайн/replay SGD не переключён автоматически, поскольку для каждого кандидата нужны отдельные target и retention holdout. Без них безопасное решение — не менять веса.
- Runtime entry point `DevelopmentalNeuralRuntime.trainElasticNeuralPolicy()` направляет обновление через общий P29 governor; `rollbackElasticNeuralPolicy()` использует checkpoint P26. P26/P28/P29/P30 добавлены в hot-neural snapshot/restore projection.
- Regression-тест проверяет локальность обновления, защиту bias/других действий, gate удержания, раздельность train/holdout, anti-forgetting rejection, P29 arbitration/budget/provenance, sample replay rejection, rollback после restart и runtime snapshot wiring. На момент последней проверки CI ещё ожидал runner; выполнение этого теста и typecheck пока не подтверждены. Это также не доказывает общий uplift или отсутствие forgetting на реальных длительных задачах.
- Следующий этап: связать подачу кандидатов с доверенным результатом P23 / P29, прогнать paired-seed ablations и тесты interference/transfer на независимом корпусе; только после этого решать, включать ли режим в production cadence.

## Проверка и ограничения доказательств

- PR #923: `aspect/elastic-neural-plasticity-20261117`, base `workpass70-source`; implementation head at report time: `9cbce4a190917848b73d6ff25a83f1c156da435a`.
- P26 Learning Validation check for this head was queued (run `44106469511`) at the last poll. Do not read this as a passing test.
- Тестовый файл был добавлен первым коммитом, но до реализации фактический красный прогон не был зафиксирован: шаг запуска теста был подключён в коммите реализации. Поэтому red-green TDD доказательством это не считается.

## Rollback

Отключить использование trainFeaturesElastic() — стандартные методы обучения остаются прежними. Все новые счётчики и важность локальны полю elasticNeuralPlasticity в P26 policy snapshot; сброс этого поля возвращает нулевую оценку важности при сохранении обычных policy weights.
