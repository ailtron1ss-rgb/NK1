# WorkPass335 — подключение Hermes/P23 к host-owned независимой оценке

**Дата:** 2026-10-24  
**Ветка:** workpass335-hermes-host-owned-evaluator-2026-10-24  
**Основа:** workpass334-inner-imperative-homeostasis-2026-10-24

## Что исправлено

В ветке NK1 уже существовали генератор ревизий навыков, P23 lifecycle, связывание доказательств, независимый evaluator и проверка promotion. Однако серверная композиция не передавала конфигурацию host-owned executor/verifier/safety-scanner в runtime. Это оставляло production-цепочку недособранной: строгая проверка runtime ожидала отдельную authority-конфигурацию, а bootstrap её не создавал.

WorkPass335 соединяет эти существующие компоненты, не создавая второе хранилище навыков или альтернативный движок обучения:

- server.mjs загружает отдельный evaluator config по NEURO_COMPOUND_REPAIR_EVALUATION_CONFIG_MODULE и передаёт результат в canonical OrganismRuntime composition.
- compound-repair-revision-host-config.mjs проверяет путь и права файла, отделение от изменяемого state directory, непересечение модуля генератора и evaluator config, наличие трёх сервисных команд, host-owned experiment authority и раздельных labels baseline/source/revision.
- Добавлена явная настройка фонового цикла NEURO_COMPOUND_REPAIR_BACKGROUND_REVISION_JSON. Если параметр отсутствует, фоновая генерация остаётся выключенной; некорректная настройка отклоняется.
- Контрактные тесты проверяют блокировку неполной и самостоятельно подтверждаемой конфигурации, а также реальную передачу evaluator из server в runtime.
- Добавлены отдельный workflow и команда npm --prefix runtime/neuro-kurisu run test:workpass335:hermes-host-evaluator; workflow запускает контрактные тесты и TypeScript typecheck на версии Node из .nvmrc (Node 24).

## Граница безопасности

Код генератора может подготовить предложение и новую версию навыка, но не получает полномочия независимо подтвердить свой успех, одобрить себя или активировать себя. В production evaluator должен использовать три отдельно управляемых host-owned процесса: исполнитель, verifier и safety scanner. Задачи, validation/holdout планы, manifest, environment и run identities должны быть привязаны к одному эксперименту. Решение об активации по-прежнему принадлежит существующему подписанному shadow-evidence и авторизованному promotion lifecycle.

## Что ещё не завершено

Этот PR закрывает конфигурационный шов, а не объявляет «полный Hermes» или production readiness.

- Deployment всё ещё должен предоставить отдельный host evaluator config с реальными абсолютными путями к исполняемым файлам, изолированными каталогами запуска/сохранения, фиксированным task manifest и validation/holdout plans.
- Тест/typecheck и Actions должны реально завершиться успешно на точном commit; наличие workflow или исходников не считается успешной проверкой.
- Требуются свежие independent paired-seed validation/holdout прогоны с реальными task outcomes, safety/regression метриками и cost; прирост качества обучения пока не заявляется.
- Полный upstream Hermes scope шире skill revision: tool-description/system-prompt/code evolution и долговременный непрерывный цикл не считаются автоматически интегрированными только этой работой.

## Проверки

После запуска в ветке выполнить:

```sh
npm --prefix runtime/neuro-kurisu run test:workpass335:hermes-host-evaluator
npm --prefix runtime/neuro-kurisu run typecheck
```

До получения результата точного запуска статус проверок остаётся **ожидает подтверждения**.


## First exact-head CI findings and repairs

The first run exposed two concrete integration defects, now fixed on the branch:

- The contract file used Node's `test()` API without importing it. It now imports `test` from `node:test`, so the cases can actually execute.
- The existing `InnerImperativeController` defensive normalization caused TypeScript to infer empty objects and reject resource-field access. Explicit partial input types retain runtime normalization while compiling the field reads.

The rerun is authoritative. Until both the contract test and runtime typecheck succeed on the same head, the test status remains unverified.


## WorkPass336 — повторная оценка baseline/source и сохранение подлинности proposal

Следующий проход усиливает не только конфигурацию сервера, но и сам жизненный цикл ревизии:

- Proposal создаётся через проверенный P23 issuer. Когда coordinator/provider создаёт detached snapshot, helper сначала проверяет подлинность исходного объекта и только потом переносит digest на копию. Нельзя «запечатать» произвольный объект; любое изменение уже скопированного proposal делает его недостоверным.
- Production provider получает baseline payload и source-candidate payload из canonical versioned store NK1. Провайдеру не доверяются его собственные baseline/source report objects: оба payload повторно исполняются host-owned независимым evaluator-ом по фиксированным задачам validation/holdout.
- Сравнение связывает payload, manifest, план эксперимента, окружение, task/trial/seed/split и run binding. Перед возвратом evidence сверяются версии активного baseline и исходного кандидата. Если активная версия или источник изменились во время асинхронного evaluation, данные не допускаются к staging.
- Последняя проверка lineage также передаётся дальше в P23 engine и выполняется синхронно непосредственно перед staging. Это закрывает короткий промежуток между окончанием независимого evaluation и сохранением кандидата: при смене active/source version операция прерывается, а не переиспользует устаревшее сравнение.
- Добавлен regression `workpass331-canonical-revision-baseline.mjs`, где provider намеренно передаёт ложные отчёты, а resolver отдаёт payload из canonical store. Тест проверяет, что запускаются новые независимые оценки, подложные отчёты не проходят, и изменение версии во время оценки отклоняется.

Ограничение: реальные deployment-owned executables, замороженный task manifest/validation/holdout plan, подписанное shadow evidence и авторизованное одобрение по-прежнему обязательны. Даже успешно пройденные синтетические контракты не являются измеренным приростом обучения.


## WorkPass346 — встроенный provider без отдельного plugin-модуля

NK1 теперь содержит штатный `P23CompoundRepairRevisionProvider.ts`. Для его явного включения достаточно задать:

- `NEURO_COMPOUND_REPAIR_VERIFIED_PROPOSAL_DATASET_PATH` — путь к внешнему JSON-файлу подписанных исходов;
- `NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON` — доверенный keyring публичных Ed25519-ключей верификаторов;
- `NEURO_COMPOUND_REPAIR_EVALUATION_CONFIG_MODULE` — отдельный host-owned evaluator config с реальными executor, verifier, safety scanner и фиксированным experiment authority.

Схема dataset: `schemaVersion: 1`, `manifest`, `artifacts`, `baselineMethod`, `candidateMethod`, необязательный `gateOptions`. Артефакты повторно проверяются через `ingestSignedOutcomeArtifact`; источник доверия — только внешний keyring, не сам dataset. Модуль отклоняет недействительные подписи, неизвестные поля, отсутствие validation/holdout, небезопасные права файла и расположение dataset внутри изменяемого state-каталога. Размер ограничен 32 MiB.

Provider не принимает proposal из JSON как подлинный: он самостоятельно восстанавливает его из проверенного ledger, требует `gate.accepted`, затем ищет кандидата по совпадающим `proposalId` и `proposalOutcomeFingerprint`. Нет полного соответствия — нет ревизии. Существующий generator создаёт только новый payload; активация остаётся в отдельном подписанном shadow-evidence / authenticated-approval lifecycle.

Canonical resolver теперь корректно обрабатывает оба случая: pending `staged/shadow` candidate оценивается относительно текущей active версии, а активный источник — относительно сохранённой `previousActive` версии. Для active candidate без предыдущего baseline или для одинаковых payload оценка прекращается. Точные версии и fingerprints проверяются после асинхронной оценки и непосредственно перед staging.

**Важно:** встроен provider, но не подменён deployment-owned evaluator. Пока host-owned processes и experiment config не предоставлены и реальные парные validation/holdout прогоны не завершены, это не production-readiness и не доказанный прирост обучения.


## WorkPass347 — устойчивое чтение signed dataset

Чтение JSON набора доказательств теперь выполняется через открытый файловый дескриптор, а не повторное открытие имени файла после проверок. На POSIX включается O_NOFOLLOW; после открытия проверяется, что dev/ino совпадают с ранее проверенным inode. Метаданные повторно сверяются после чтения, чтобы обнаруживать замену или изменение файла во время операции. Добавлен отдельный регрессионный тест на символическую ссылку.


## WorkPass348 — signed evidence binds the evaluated payload

В native Hermes/P23-режиме каждый outcome-артефакт baseline/candidate должен включать подписанный `payloadFingerprint` (SHA-256 канонического JSON payload). Для каждого метода разрешён ровно один fingerprint, fingerprints baseline и candidate должны различаться. Provider сверяет candidate fingerprint с фактическим кандидатом versioned store, а baseline fingerprint — с текущим active payload или `previousActive` активной версии. Кандидат с правильным proposal ID, но другим payload, отклоняется. Поле в общем outcome-контракте опционально для обратной совместимости; native provider строго требует его только на этом пути.


## WorkPass348 — exact-head validation result

На commit `71e9286f9fe11c6afec851359a96f9e9b0011259` GitHub Actions успешно выполнил тесты встроенного native provider (включая несовпадение payload, отсутствие fingerprint и одинаковые fingerprints baseline/candidate) и runtime TypeScript typecheck. Также успешно завершились WorkPass110 continual-learning metrics, WorkPass108, WorkPass293, WorkPass294, WorkPass105, WorkPass331, WorkPass102 и P26 Learning Validation. Это доказывает корректность покрытых контрактов на данном commit, но не наличие реальных host-owned executable services, не автономное production-развёртывание и не измеренный прирост обучения.
