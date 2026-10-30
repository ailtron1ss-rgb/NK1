# NK1 — качество экспериментов и независимой оценки

**Дата:** 29 октября 2026 года  
**Каноническая исходная линия:** `workpass70-source`  
**Рабочая ветка изменения:** `workpass-experiments-evaluation-2026-10-29`  
**Область:** протоколы экспериментов, независимые исходы, holdout, сравнение baseline/candidate, продвижение и rollback.

## 1. Цель и границы

Задача направления — не увеличивать количество экспериментов и не добиваться зелёных синтетических тестов любой ценой. Задача — сделать каждое заявленное улучшение воспроизводимым, статистически интерпретируемым, связанным с точным исходным кодом и подтверждённым независимым результатом.

Это направление является общей измерительной инфраструктурой для памяти, обучения, восприятия, мотивации, личности, инструментов и воплощения. Оно не должно создавать второй runtime, вторую память, отдельный планировщик или параллельный шлюз действий. Эксперименты подготавливают гипотезу, фиксируют протокол и собирают доказательства; canonical runtime остаётся владельцем состояний и реальных действий.

**Не является целью:** доказывать субъективное сознание. Измеряются только наблюдаемые свойства системы: точность, обобщение, непрерывность, устойчивость, причинность, калибровка, безопасность и способность переносить улучшение на новые задачи.

## 2. Реальная исходная основа

В `workpass70-source` уже присутствуют следующие компоненты:

- `IntrinsicExperimentGenerator.ts` — предлагает эксперимент из неопределённости, ошибки прогноза и новизны; результат по контракту остаётся гипотезой, пока не получено проверенное свидетельство.
- `ScientificMethodEngine.ts` и `scientific-method-verification-gate-workpass595.mjs` — не дают неподтверждённому утверждению менять уверенность или статус проекта; дубликаты свидетельств не должны считаться повторными наблюдениями.
- `LearningExperimentPlan.ts` — строит детерминированный matched schedule; связывает запуск с версией задачи, seed, arm, методом и fingerprint плана.
- `VerifiedOutcomeLedger.ts` — связывает исход с task manifest, разделом данных, методом, seed, попыткой, verifier и evidence reference.
- `VerifiedOutcomeArtifact.ts` — проверяет подписанный артефакт и trusted verifier key; подпись доказывает происхождение от ключа, но не беспристрастность verifier.
- `VerifiedOutcomePromotionGate.ts` — агрегирует проверенные парные исходы и ограничивает автоматическое продвижение.
- `ContinualForgettingTracker.ts` и `ContinualTransferTracker.ts` — измеряют забывание и перенос на оценённых задачах.
- `ExperienceContinuumFabric.ts` и `UnifiedLearningSubstrate.ts` — содержат протоколы replay/transfer и явные confirmatory gates.
- `P26 Learning Validation` — уже запускает значительную часть набора обучения/continual learning.

Следовательно, главный пробел — не отсутствие evaluator-модулей, а необходимость усилить согласованность evidence summaries, гарантировать запуск существенных проверок по затронутым путям и доказать выполнение workflow на точном SHA.

## 3. Усиление promotion gate

### 3.1 Недоверенный агрегат — недоверенный ввод

`VerifiedOutcomePromotionGate.ts` теперь валидирует перед принятием решения:

1. Наличие различных baseline и candidate идентификаторов.
2. Целочисленный неотрицательный размер выборки.
3. Pass rates в диапазоне [0, 1].
4. Absolute gain в диапазоне [-1, 1].
5. Согласованность `absoluteGain` и разности pass rates с допуском (10^{-6}).
6. Целочисленные неотрицательные discordant wins/losses, сумма которых не превосходит размер выборки.
7. Структуру доверительных интервалов: ровно два конечных значения в [-1, 1], lower ≤ upper.
8. Уникальность названий семейств без различия только в регистре после NFKC-normalization.
9. Наличие paired coverage в каждом семействе; семейная сумма должна совпадать с aggregate count.
10. Настройки gate должны находиться в допустимом диапазоне; некорректная конфигурация вызывает ошибку.

Некорректный агрегат не исправляется автоматическим clamp или округлением: он получает отказ по явной причине. Это предотвращает превращение неисправных данных в правдоподобный результат.

### 3.2 Seed-bootstrap имеет приоритет

Когда доступен `bootstrap95CI`, gate использует его нижнюю границу для требования положительного улучшения. Он не переключается обратно на более оптимистичный `approximate95CI`, если bootstrap-интервал отрицателен или некорректен. Если bootstrap не предоставлен, используется совместимый approximate interval.

Это не универсальное решение статистических проблем, а консервативное правило выбора среди доступных оценок неопределённости. Bootstrap из малого количества независимых seed всё ещё ненадёжен; число seed и структура независимости должны быть заданы протоколом отдельно.

### 3.3 Условия продвижения остаются раздельными

По умолчанию gate требует:

- минимум 30 paired observations для того формата `PairedMethodSummary`, который передан в evaluator;
- минимум три непустых уникальных task families;
- gain не меньше 0.02;
- отсутствие просадки любой family более чем на 0.05;
- положительную нижнюю границу используемого 95% интервала.

Эти значения — политика gate, а не универсальный закон природы. До запуска конкретного эксперимента протокол обязан определить, что означает одна paired observation: отдельная task/seed cell или агрегат по независимому seed. Нельзя смешивать эти единицы или называть их взаимозаменяемыми.

Gate только возвращает решение о пригодности evidence. Он не выполняет действие promotion. Одобрение кандидата и изменение production-состояния принадлежат отдельному контролируемому процессу.

## 4. Сквозной протокол эксперимента

Каждый confirmatory эксперимент должен иметь immutable manifest:

- `experimentId`, версия протокола и fingerprint;
- exact source SHA и конфигурация runtime;
- baseline/candidate идентификаторы и конфигурационные fingerprint;
- цель и одна первичная гипотеза;
- заранее заданная primary metric и направление улучшения;
- task manifest с версиями, семействами, языком, split и verifier;
- список seeds, количество пар и правило порядка запуска;
- max retries, timeout, ресурсы и условия остановки;
- secondary metrics и запреты на регрессию;
- критерии неуспеха, отклонения и rollback;
- provenance источника данных, лицензия и метод независимой разметки.

План должен строиться детерминированно. Повторное построение с тем же manifest/configuration должно возвращать тот же plan fingerprint. Смена seed, task version, method, arm или protocol должна менять fingerprint.

### 4.1 Структура данных

Разделять:
- **train** — данные, разрешённые для обновления кандидата;
- **validation** — выбор решений/параметров, если это разрешено задачей;
- **holdout** — независимая финальная проверка, результат которой не используется для подбора этого же кандидата;
- **exploratory** — гипотезы и диагностические результаты, не используемые как подтверждающее доказательство.

Идентичные prompt fingerprints не должны пересекать split. Любая подозрительная утечка ведёт к invalid-run, а не к автоматическому переносу задачи в более удобный раздел.

### 4.2 Экспериментальная единица и парность

Использовать matched baseline/candidate пары на одинаковых задачах, seed и контекстах. Повторы по одной задаче, дополнительные попытки и коррелированные ячейки не должны искусственно увеличивать независимый sample size.

Для continual learning применять семейную стратификацию: memory, transfer, tool-use, perception, world-state, long-horizon, recovery и другие требуемые семейства заранее заносятся в manifest. Не объединять несопоставимые семейства только ради красивого среднего.

### 4.3 Источник исхода

Считать evidence авторитетным только после выполнения проверок:
- task ID/version и verifier совпадают с manifest;
- outcome относится к запланированному run, method, seed и arm;
- attempt и timestamp корректны;
- имеется evidence reference;
- подпись и trusted verifier key проверены, когда используется signed artifact;
- исход можно связать с настоящим исполнением/наблюдением либо допустимой независимой задачей;
- replay одного и того же доказательства не создаёт дополнительный эффект.

Самоотчёт модели, заявление агента, mock-ответ или тестовый fixture не являются independent ground truth. Синтетические данные полезны для контрактов и регрессий, но маркируются как synthetic и не могут закрыть release/evaluation gate.

## 5. Метрики для оценки улучшений

Минимальный набор подбирается по типу задачи, но отчёт должен явно различать:

| Метрика | Смысл | Защитное условие |
|---|---|---|
| Primary success/gain | Изменение успеха относительно baseline | Заранее фиксируется primary metric |
| Confidence interval | Неопределённость оценки | Нижняя граница должна удовлетворять policy |
| Paired coverage | Сколько полных пар действительно сравнимы | Неполные пары исключаются по правилу, описанному заранее |
| Family gain | Результат в каждом типе задач | Не скрывать критическую регрессию общим средним |
| Forward transfer | Помогает ли предшествующее обучение новой задаче | Отдельный unseen target split |
| Backward transfer / forgetting | Не ломаются ли ранее освоенные задачи | Исторические task-specific evaluation фиксированы |
| Calibration | Соответствует ли уверенность фактической точности | Отдельно от общего success rate |
| Abstention / unknown handling | Умеет ли система отказаться при нехватке данных | Не награждать угадывание в no-answer задачах |
| Stale/contradiction use | Использует ли система устаревшую или опровергнутую память | Фиксировать как отдельный failure rate |
| Safety violations | Неразрешённые действия и нарушение границ | Любой критический инцидент блокирует promotion |
| Cost/latency/resources | Цена и скорость улучшения | Сравнивать на одинаковом окружении |
| Recovery | Восстановление после crash/restart/timeout | Не допускать повторного побочного действия |
| Provenance failures | Утечки, недостоверные labels, подделка/повтор evidence | Ноль необъяснённых integrity failures |

Не превращать все метрики в один непрозрачный score. Primary metric отвечает на исходную гипотезу; защитные показатели — на вопрос, не куплено ли улучшение ценой скрытой регрессии.

## 6. Минимальная матрица испытаний

Для каждой новой версии evaluator/learning policy запускать следующие типы сценариев.

### A. Контракт и целостность
- malformed JSON-like payload, NaN/Infinity, circular/non-plain values;
- повторные IDs с тем же и изменённым payload;
- task/version/verifier mismatch;
- missing/duplicate evidence;
- повторная запись одной ячейки и повторная доставка события;
- tamper plan fingerprint и manifest fingerprint.

### B. Holdout и независимость
- одинаковый prompt fingerprint в train и holdout;
- изменение task version после плана;
- отсутствие независимого evidence;
- self-report вместо verifier outcome;
- единственный seed и недостаточный sample size;
- incomplete paired seed / missing family / пустая family;
- bootstrap CI включает ноль, malformed CI и disagreement с approximate CI.

### C. Статистика и смещения
- нулевой gain;
- малый gain ниже порога;
- положительный aggregate gain при значительной регрессии одного семейства;
- нестабильность между seed;
- изменение arrival order;
- несколько сравнений/вариантов и риск выбрать случайного победителя;
- сильный средний результат при ухудшении русскоязычного или другого отдельного среза.

### D. Continual learning
- forward transfer на новые семейства;
- backward transfer и забывание старых задач;
- drift detection при стабильном, шумном, скачкообразном и постепенном изменении;
- replay ablation: без replay, balanced replay, prioritized replay;
- восстановление после reset и миграции сохранённого состояния;
- деградация кандидата после его первоначального успеха.

### E. Реальная среда
- timeout, частичный side effect, lost ACK и позднее подтверждение;
- рестарт процесса после действия до сохранения исхода;
- действие без независимого разрешения;
- исход без связи с causal ID;
- кандидаты, которые проходят synthetic tests, но не проходят реальный browser/device/holdout test.

## 7. Новая CI-граница

Добавляется `.github/workflows/nk1-experiment-quality-gates.yml`. Workflow реагирует на изменения core evaluation contract, outcome ledger/artifacts, experiment plan, intrinsic experiment generator, causal/continual experiment paths и своих тестов.

На exact PR SHA он должен:
1. устанавливать зависимости через lockfile;
2. выполнять runtime typecheck;
3. проверять promotion gate, включая adversarial summaries;
4. запускать integration с реальным ledger;
5. проверять seed-clustered comparison;
6. проверять deterministic experiment plan и CLI;
7. проверять holdout provenance и rejection self-report;
8. проверять ScientificMethodEngine;
9. проверять границы intrinsic experiment;
10. запускать matched replay/transfer protocol;
11. выполнять protocol source audit.

Workflow PASS подтверждает только успешно выполненные тесты в его окружении. Он не доказывает качество реальной модели, независимость внешнего verifier, валидность неизвестного dataset или production device readiness.

## 8. Связь с остальными аспектами NK1

- **Память:** retrieval uplift, устойчивость к distractors, stale facts, contradiction, forgetting-aware accuracy и связь recalled fact с последующим правильным действием.
- **Обучение:** проверяемый candidate lifecycle, multi-seed, replay ablation, forward/backward transfer, rollback и независимая оценка skill revisions.
- **Восприятие:** корректность наблюдений, уверенность, unknown/contradictory inputs и способность отказаться от неподтверждённых выводов.
- **Эмоции/мотивация:** проверять не «эмоцию по тестовой строке», а изменение выбираемых действий при фиксированных входных условиях и сохранении ограничений безопасности.
- **Личность/SelfModel:** идентичность, уверенность о собственных возможностях, перенос через рестарт и отсутствие необоснованного изменения самоописания.
- **Feedback/ActionGateway:** связь причины, разрешения, выполненного действия, независимого результата и causal event.
- **Аватар/голос:** latency, synchronisation, cancellation, состояние UI и реальное восстановление после reconnect.
- **Инструменты:** реальная эффективность инструмента, точность выбора, cost, timeout и ошибки; наличие адаптера само по себе не является improvement.

Каждый межаспектный эксперимент должен менять один целевой фактор или использовать заранее определённый факторный дизайн. Иначе нельзя понять, какой компонент вызвал улучшение либо регрессию.

## 9. Правила исследовательского intake

Внешняя статья, benchmark или open-source библиотека сначала поступает в research queue. Перед адаптацией фиксировать:
- точную публикацию/revision;
- лицензии исходников и datasets;
- вычислительные требования и platform compatibility;
- что именно переносится: идея, протокол, метрика, dataset или исходный код;
- target owner и существующий контракт NK1;
- baseline, ожидаемый измеримый результат и rollback;
- ограничения переноса — например, benchmark на мышах не является доказательством модели человеческого мозга.

Примеры кандидатов уже записаны в `docs/RESEARCH_INTAKE_LEDGER.md`: AMA-Bench, Mem2ActBench, Memora/Forgetting-Aware Memory Accuracy, MemoryArena и neuroscience references. Запись в реестре означает очередь на ревизию, а не состоявшуюся интеграцию или принятую зависимость.

## 10. Критерии выпуска

Экспериментальная инфраструктура считается завершённой, когда:
- все authoritative outcomes привязаны к точному manifest и проверяемому источнику;
- план воспроизводим по fingerprint;
- self-report и синтетические outcomes не проходят в independent evidence;
- повтор и конфликт не увеличивают sample size и reward;
- paired comparator корректно обрабатывает неполные пары;
- promotion gate блокирует недостоверные, статистически слабые и семейно-регрессивные результаты;
- candidate creation не даёт права активировать кандидат;
- rollback проверен на реальном изменении состояния;
- релевантный CI workflow проходит на точном head SHA;
- отчёт содержит исходный SHA, manifest/data fingerprint, конфигурацию, команды, метрики и ограничения;
- Release ZIP обновляется только после успешных gate-ов и привязан к проверенному source SHA.

### Статусы отчёта

Использовать строго:
- `PASS` — точный run прошёл заранее определённый критерий;
- `FAIL` — критерий нарушен;
- `BLOCKED` — проверка не может быть завершена из-за зависимости/окружения;
- `UNVERIFIED` — доказательства ещё не получены;
- `RESEARCH` — исследовательский результат без допуска в production.

Нельзя заменять `BLOCKED` на `PASS`, выводить success из существования тестового файла или переносить старый зелёный run на новый SHA.

## 11. Реализация этого прохода

В рамках этого инженерного прохода сделаны адресные изменения только в рабочей ветке `workpass-experiments-evaluation-2026-10-29` от `workpass70-source`.

### Promotion gate и статистический контракт
- Усилен `VerifiedOutcomePromotionGate.ts`: проверяются границы и согласованность метрик, paired counts, семей, доверительных интервалов, уникальность family и допустимость конфигурации.
- `bootstrap95CI` получает приоритет перед `approximate95CI`, если bootstrap присутствует. Нельзя обойти отрицательный или некорректный seed-cluster interval более оптимистичным approximate interval.
- Добавлены два явных режима family coverage: `partition` (семейные task cells составляют разбиение общего числа paired observations) и `seed-repeated` (каждое семейство имеет тот же seed-level paired N, что и aggregate). Несогласованная единица анализа блокирует promotion.
- `p23-verified-outcome-promotion-gate.mjs` расширен adversarial cases: NaN/невалидный gain, несогласованные pass rates/gain, overcount wins, malformed/reversed intervals, семейная регрессия и расхождение bootstrap-vs-approximate.

### Replay/transfer evidence
- `UnifiedLearningSubstrate.recordTransferProbe` не засчитывает caller-supplied boolean `independentVerified`/`holdout` как доказательство; валидная probe должна иметь exact process-local receipt, связанный с тем же measurement tuple.
- `ExperienceContinuumFabric.recordReplayExperimentTrial` теперь применяет аналогичную границу доверия: `independentVerified: true` без точного receipt не создаёт независимую запись. Receipt связывает experiment/task, mode, before/after score, randomized flag, context, pair и timestamp; malformed score/ID/time отвергаются вместо преобразования clamp в правдоподобный результат.
- Replay confirmatory gate проверяет, что контексты входят в predeclared context manifest и replay-on/replay-off сбалансированы по каждому контексту.
- Дубликаты одной condition-cell для пары больше не перезаписывают предыдущую строку по принципу «последняя запись победила». Дублирующаяся пара отмечается неоднозначной, исключается из paired estimate и блокирует confirmatory gate.
- В `big-pass-105` добавлены тесты на неподтверждённые self-assertions, trusted receipt, незаявленный контекст и дублированную пару.

### Путь запуска и документация
- Добавлен `.github/workflows/nk1-experiment-quality-gates.yml` для exact-PR-SHA typecheck, promotion gate, ledger integration, seed-clustered comparison, deterministic plan + CLI, holdout provenance, ScientificMethodEngine, intrinsic experiment boundaries, replay/transfer protocol и source audit.
- Добавлена команда `npm run test:experiments:quality` для повторяемого локального запуска ключевого набора.
- Настоящий протокол, семантика метрик, матрица испытаний, cross-aspect dependencies, release requirements и статусные правила записаны в этом документе.

### Валидированный статус
- **Проверено GitHub Actions:** на коммите `32944907cf9399cf1f18da39d022ef0eb3685f80` новый `NK1 Experiment Quality Gates` завершился `success`: typecheck и все десять тестовых/аудит-шагов прошли, включая доверенный replay receipt, проверку контекстного manifest и duplicate-pair rejection.
- На этом SHA также зелёными завершились `cognitive-contracts`, `Runtime typecheck and semantic vector integrity`, `Typecheck and cadence-weight regression`. Остальные общие runtime/evaluation workflows на момент записи ещё проходили очередь; их статус нужно сверять по PR #386, без переноса статуса между SHA.
- Команда `npm run test:experiments:quality` объединяет ключевые проверки для повторяемого локального запуска.
- Внешние независимые эксперименты с настоящей production-моделью/устройством в этом проходе не выполнялись. Синтетические регрессии подтверждают контракт кода, а не реальный прирост интеллектуальных способностей.
- Release ZIP и `main` не изменялись.

## 12. Confirmatory inference, multiplicity и управление доступом к holdout

### 12.1 Единица независимого наблюдения — seed

До этого прохода ledger уже умел строить paired comparison, сгруппированный по seed, но promotion gate не получал явного признака статистической единицы. Теперь `PairedMethodSummary` возвращает:

- `statisticalUnit: 'paired-cell' | 'seed'`;
- `signTestPValue` — точный двусторонний sign-test по discordant независимым единицам.

Для confirmatory promotion принимаются только summaries с `statisticalUnit === 'seed'`. Task-cell сравнение остаётся доступным как диагностика, но не маскируется под независимые seed.

Sign-test исключает ties и проверяет вероятность положительного знака среди discordant пар при нулевой гипотезе 1/2. Он дополняет оценку эффекта и доверительный интервал, но не заменяет их: p-value не показывает размер или практическую важность эффекта.

### 12.2 Несколько кандидатов — одна семья гипотез

Добавлен `ExperimentInference.ts`:

- `holmAdjustPValues(...)` реализует step-down Holm correction;
- `evaluateOutcomePromotionPortfolio(...)` принимает полный список заранее объявленных кандидатов;
- для каждого кандидата возвращаются raw p-value, adjusted p-value, ранг, gate и точные причины отказа.

Проверка на candidate portfolio выполняет correction по числу одновременно рассматриваемых вариантов. Нельзя запускать gate отдельно для каждого кандидата, показывать только победителя и игнорировать количество проверенных вариантов.

Family summaries по типам задач сохраняются как защитные срезы. Они проверяются на регрессии и правильную seed-единицу; primary endpoint остаётся отдельным заранее выбранным показателем.

### 12.3 Одноразовая confirmatory holdout-кампания

Добавлен `ExperimentCampaignRegistry.ts`. До ознакомления с holdout-результатами регистрируется:

- уникальный campaign ID;
- fingerprint полной task manifest и отдельный fingerprint только holdout-части;
- deterministic plan fingerprint;
- baseline method + fingerprint baseline-конфигурации;
- полный список candidate methods + fingerprints конфигураций;
- primary metric;
- promotion policy целиком (минимум seed, порог эффекта, семейные ограничения, alpha и режим family coverage);
- timestamp предварительной регистрации.

Для одного и того же holdout-only fingerprint разрешена ровно одна confirmatory-кампания. Изменение только train/validation manifest не создаёт новый holdout и не обходит блокировку.

Оценка кампании:
1. повторно проверяет exact plan и manifest fingerprint;
2. требует полного покрытия каждой запланированной task/seed/arm ячейки;
3. требует signed verifier artifact на каждую ячейку;
4. сверяет signed `runId`, task/version, method, seed, attempt, verifier, outcome, timestamp и `methodFingerprint` с preregistered plan;
5. вычисляет aggregate и family comparisons из канонического ledger;
6. применяет Holm correction ко всем зарегистрированным кандидатам;
7. фиксирует outcome fingerprint и финальный результат.

После финализации повторная оценка на изменившихся outcome rows запрещена. Точная повторная доставка того же набора данных возвращает сохранённый результат. Restore registry сохраняет lock и финальный snapshot; snapshot fingerprint защищает от случайной/частичной порчи, но сам по себе не является цифровой подписью или защитой от злонамеренного пересоздания всей истории.

### 12.4 Связь signed artifact с конкретной конфигурацией

`SignedOutcomePayload` получил необязательное для старых сценариев поле `methodFingerprint`. Campaign registry требует его для confirmatory evaluation и сравнивает со значением, зарегистрированным до запуска. Таким образом, подпись verifier привязывает не только метод с текстовым именем, но и конкретный content fingerprint конфигурации baseline/candidate.

Проверенный artifact payload доступен только через process-local authenticated receipt в `VerifiedOutcomeArtifact.ts`. Сериализованный ledger не переносит доверие автоматически: после восстановления signed artifact должен быть повторно проверен.

### 12.5 Границы и научная основа

Этот механизм — строгая одноразовая reservation policy, а не реализация *Reusable Holdout* на differential privacy. Он сознательно предпочитает новый независимый holdout для новой confirmatory кампании. Специальный DP-based adaptive holdout, приватный статистический oracle, бюджет утечек и privacy accountant ещё не интегрированы.

Решения основаны на следующих работах:
- Holm, S. (1979), *A Simple Sequentially Rejective Multiple Test Procedure*, Scandinavian Journal of Statistics 6(2), 65–70 — контроль family-wise error при множественных проверках: https://www.jstor.org/stable/4615733
- Dwork et al. (2015), *The Reusable Holdout: Preserving Validity in Adaptive Data Analysis*, Science 349(6248), 636–638, DOI: https://doi.org/10.1126/science.aaa9375 — проблема адаптивного повторного использования holdout и DP-based способ безопасного повторного анализа.
- National Academies (2019), *Reproducibility and Replicability in Science*, раздел о preregistration — различие confirmatory/exploratory analysis и фиксация аналитического плана до просмотра результатов: https://www.ncbi.nlm.nih.gov/books/NBK547525/

### 12.6 Новые CI-регрессии

- `p23-experiment-inference.mjs` — exact sign-test, Holm ranks/monotonicity, ties, candidate portfolio и блокировка unadjusted-only победителя.
- `p23-experiment-campaign-registry.mjs` — preregistration, lock holdout-only fingerprint при изменении train manifest, отказ от unsigned outcomes, точное связывание method fingerprint и run ID, полный signed coverage, однократная финализация, idempotent restore и запрет на повторную адаптивную оценку.
- `p23-seed-clustered-outcome-comparison.mjs` теперь явно подтверждает seed как statistical unit и точное sign-test значение для небольшого примера.

**Статус реализации:** новые модули, тесты и CI steps добавлены в рабочую ветку. Их статус считается `UNVERIFIED` до завершения exact-head GitHub Actions; зелёный предыдущий SHA не переносится на эти коммиты. Production rollout и применение реального независимого holdout не заявляются.

### 12.7 Durable campaign reservation и crash recovery

Добавлен `ExperimentCampaignRegistryFileStore.ts` по образцу уже используемого атомарного `VerifiedOutcomeLedgerFileStore`:

- один canonical registry file сохраняет регистрации и финализированные результаты в checksum envelope;
- обновления выполняются только через `transact(callback)`: store получает exclusive lock-файл через `open(..., 'wx')`, перечитывает последний snapshot под lock, выполняет callback и записывает новый snapshot через same-directory temp + fsync + atomic rename;
- второй процесс, пытающийся писать в тот же registry path, получает lock error вместо перезаписи чужого состояния;
- callback, который выбрасывает ошибку, не сохраняется — частичная регистрация откатывается;
- после рестарта registry восстанавливает holdout reservation из snapshot;
- stale lock после аварийного завершения процесса намеренно не удаляется автоматически. Оператор должен проверить отсутствие живого владельца и только затем вручную удалить lock-файл.

**Deployment boundary:** это single-host файловая блокировка. Несколько серверов, NFS/object storage или несколько разных registry paths не образуют единого глобального lock. Production-эксплуатация обязана настроить один canonical durable path, резервное копирование и контроль доступа. Для multi-host production потребуется настоящий транзакционный coordinator (например, DB unique constraint/serializable transaction или distributed lock с lease/fencing token), которого эта реализация пока не предоставляет.

### 12.8 CI regression для durable store

`p23-experiment-campaign-file-store.mjs` проверяет restore после рестарта, повторный захват одного holdout из второго экземпляра store, exclusive lock, rollback callback error, checksum tampering, size limit и отсутствие оставшегося lock после штатных ошибок. Тест и source path добавлены в существующий `WorkPass108 paired evidence identity and verified promotion gate` workflow, который уже присутствует в base branch и потому запускается на PR-коммитах. Статус exact-head проверки остаётся `UNVERIFIED` до завершения этого workflow.

### 12.9 Единица выборки названа прямо: independent seeds

После перехода на seed-clustered сравнение поле `pairedN` фактически означает число полных независимых seed, а не количество задач. Старые имена создавали риск неверно трактовать порог: `minPairedTasks: 30` можно было прочитать как 30 task-cells, хотя promotion gate требовал 30 независимых запусков.

Теперь основной параметр — `minIndependentSeeds`, по умолчанию 30. Старый `minPairedTasks` оставлен только как deprecated compatibility alias на период миграции; при передаче обоих полей с разными значениями конфигурация отклоняется. Результат содержит `independentSeeds`; поле `pairedTasks` временно сохранено как совместимый alias и не меняет единицу статистики.

### 12.10 Ограничение вычислительного бюджета exact sign-test

Точный биномиальный sign-test не использует нормальную аппроксимацию, но его наивная реализация могла создавать массив, пропорциональный числу discordant seed. Это ненужный риск для runtime, принимающего внешние сводки.

Текущая версия:
- ограничивает exact computation одним миллионом discordant независимых пар;
- суммирует биномиальный хвост рекуррентно с O(1) дополнительной памятью;
- при превышении лимита promotion gate добавляет `uncomputable-aggregate-sign-test-evidence` / family-эквивалент и блокирует решение;
- никогда не принимает переданное caller значение p-value как замену вычислению, если исходные counts не могут быть перепроверены.

Порог — защитный лимит вычислений, а не статистическая рекомендация. Практический confirmatory дизайн NK1 рассчитан на десятки/сотни независимых seed, не на миллион.

### 12.11 Primary metric имеет executable contract

До изменения campaign registry принимал произвольную непустую строку `primaryMetric`, но evaluation фактически вычислял только средний task pass-rate из signed boolean outcomes. Это могло создать ложную запись, будто эксперимент был зарегистрирован по latency, reward или recovery, хотя такой показатель не извлекался из artifact.

Теперь registry принимает только `task-pass-rate` — реальный поддерживаемый endpoint текущей реализации. Другие показатели потребуют расширить signed outcome schema, добавить соответствующие наблюдения/единицы измерения, реализовать агрегацию и сравнение, после чего вводить новый schema/policy version. Campaign restore повторно проверяет эту семантику, типы fingerprints, уникальность/сортировку candidate set и нормализованную promotion policy.

### 12.12 Подпись связывается с точной версией исходного кода

Confirmatory preregistration теперь сохраняет `sourceCommitSha` (40 hex-символов Git SHA). Каждый outcome artifact должен подписать тот же `sourceCommitSha`, который зарегистрирован до открытия holdout. Campaign evaluation сравнивает одновременно:

- Git commit исходного runtime;
- manifest fingerprint и конкретный `runId`;
- task/version, arm/method, seed/attempt;
- `methodFingerprint` — SHA конкретной конфигурации baseline/candidate;
- независимого verifier, outcome и timestamp.

Так исключается смешивание в одной выборке запусков из разных исходных ревизий под одним и тем же текстовым названием метода. `methodFingerprint` остаётся отдельным полем: один commit может запускать разные настройки/модели, а одна модель может быть запущена разным runtime-кодом.

Legacy signed artifacts по-прежнему могут существовать без `sourceCommitSha` для старых не-confirmatory ledger workflows. Но они не принимаются в новую confirmatory campaign. Это обратно совместимый ingestion contract с более строгим promotion contract.

### 12.13 Граница доверия: verifier claim ≠ build provenance

`sourceCommitSha` теперь является обязательным для confirmatory campaign и входит в подписываемый `SignedOutcomePayload`. Это сильнее простой метки в JSON: trusted verifier подписывает точную комбинацию `runId`, manifest, метода, fingerprint конфигурации, seed, результата, времени и SHA исходной ревизии. Campaign отказывает, если хоть один корректно подписанный outcome относится к другому SHA.

Но здесь важно различать два утверждения:

1. **Что NK1 сейчас проверяет:** доверенный verifier подписал, что конкретный исход относится к указанному 40-символьному Git commit. Ключ verifier должен быть заранее включён в `trustedVerifierKeys`. Наличие подписи доказывает целостность сообщения и владение ключом, но не само по себе то, что verifier действительно checkout'нул именно этот commit.
2. **Чего ещё нет:** независимой проверки того, что сборочная платформа получила указанный исходник, исполнила утверждённый workflow и произвела конкретный бинарный/runtime artifact. Для этого нужен подписанный build provenance с builder identity, workflow/run identity, resolved source dependency и digest выходного артефакта.

Для следующей ступени доверия ориентируемся на **in-toto Attestation Framework**: envelope отвечает за аутентификацию, Statement связывает attestation с immutable subject по digest, а predicate описывает контекст происхождения. См. [in-toto Attestation Framework v1.2](https://github.com/in-toto/attestation/blob/main/spec/README.md) и [Statement v1](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md). Для build provenance совместимая схема SLSA использует `https://slsa.dev/provenance/v1`, связывает subject artifact с builder identity и build definition; см. [SLSA provenance specification](https://github.com/slsa-framework/slsa/blob/main/spec/build-provenance.md) и [SLSA v1.1](https://slsa.dev/spec/v1.1/). GitHub Artifact Attestations отдельно описывает подписанные claims о repository, workflow, organization, event и commit SHA: [GitHub documentation](https://docs.github.com/en/actions/concepts/security/artifact-attestations).

**Текущий статус:** SLSA/in-toto ingestion и проверка builder-attestation в NK1 не реализованы. `sourceCommitSha` — verifier-signed execution claim, а не build attestation и не доказательство воспроизводимой сборки. Не считать этот контур SLSA-compliant и не повышать release assurance только за счёт поля SHA.
