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

## Граница интеграции с P25 и P36

- P25 Adaptive Synaptic Matrix остаётся отдельным владельцем маршрутизации host-owned LoRA/QLoRA-артефактов: матрица хранит manifests/receipts, а модельные веса остаются у host executor. P30 изменяет только ограниченный вектор весов канонического P26 ParametricPolicyLearner. Владельцы параметров не объединяются и не меняют тензоры друг друга.
- P29 арбитрирует trust/conflict/resource budget и фиксирует provenance, но не аутентифицирует caller-provided локальные holdout-массивы. Они служат только bounded preflight gate; не дают независимого generalization/retention evidence. Для такого утверждения нужен отдельный host-signed/P36 evidence flow.

## Ограничения / статус

- Это контролируемый адаптер для малой параметрической policy-модели NK1, а не механизм fine-tuning произвольной LLM или изменения всех тензоров сети.
- Путь opt-in: существующий онлайн/replay SGD не переключён автоматически, поскольку для каждого кандидата нужны отдельные target и retention holdout. Без них безопасное решение — не менять веса.
- Runtime entry point `DevelopmentalNeuralRuntime.trainElasticNeuralPolicy()` направляет обновление через общий P29 governor; `rollbackElasticNeuralPolicy()` использует checkpoint P26. P26/P28/P29/P30 добавлены в hot-neural snapshot/restore projection.
- Regression-тест проверяет локальность обновления, защиту bias/других действий, gate удержания, раздельность train/holdout, anti-forgetting rejection, P29 arbitration/budget/provenance, sample replay rejection, rollback после restart и runtime snapshot wiring. На момент последней проверки CI ещё ожидал runner; выполнение этого теста и typecheck пока не подтверждены. Это также не доказывает общий uplift или отсутствие forgetting на реальных длительных задачах.
- Следующий этап: связать подачу кандидатов с доверенным результатом P23 / P29, прогнать paired-seed ablations и тесты interference/transfer на независимом корпусе; только после этого решать, включать ли режим в production cadence.

## Проверка и ограничения доказательств

- Донорский PR #923 (`aspect/elastic-neural-plasticity-20261117`) имеет exact head `9c253b2031f0ce03a7f61a30b311fad0cab59ab3`; на этом HEAD завершились успешно **44/44 PR-triggered Actions runs**. Это подтверждает regression/contract coverage, но не доказывает общий uplift на независимом корпусе.
- Перед текущей выборочной интеграцией canonical `workpass70-source` уже содержал P30 controller, P26/P29 entry points, hot-neural persistence/rollback wiring, тест `tests/elastic-neural-plasticity.mjs` и npm script `test:elastic-neural-plasticity`. Основные runtime-файлы не копировались повторно из 800-коммитно-устаревшей ветки.
- Был обнаружен пробел: canonical workflow `.github/workflows/p26-learning-validation.yml` не запускал существующий P30 test и не имел path triggers для новых P30 owners. PR #1049 добавляет только этот CI wiring. На исходном точном PR #1049 HEAD `799d630fd5bc7a57072dd07c0eec90b8989ce134` P26 Learning Validation run `44789624744` завершился SUCCESS; сам шаг `Verify sparse elastic neural plasticity and anti-forgetting gate` — SUCCESS. Все 4 workflow runs PR #1049 на этом HEAD завершились SUCCESS.
- P26 local target/retention holdouts остаются bounded preflight, а не независимо аутентифицированным generalization/retention evidence. Для утверждений об улучшении требуются host-signed evidence и отдельные paired-seed holdout испытания.
- Исторический red-phase до реализации не был зафиксирован; этот feature нельзя называть доказанным red-green TDD циклом.
- Это не доказывает отсутствие forgetting на длительном реальном использовании, не разрешает автоматическую активацию в production cadence и не означает включение в опубликованный Release ZIP.

## Rollback

Отключить использование trainFeaturesElastic() — стандартные методы обучения остаются прежними. Все новые счётчики и важность локальны полю elasticNeuralPlasticity в P26 policy snapshot; сброс этого поля возвращает нулевую оценку важности при сохранении обычных policy weights.
