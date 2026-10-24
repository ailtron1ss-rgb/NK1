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
