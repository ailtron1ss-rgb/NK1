# WorkPass330 — host-owned evaluator wiring for autonomous P23 skill revision

**Дата:** 23 октября 2026 г.  
**Рабочая ветка:** `workpass328-upstream-donor-gate` (основана на `workpass70-source`)  
**Назначение:** закрыть обнаруженный разрыв между серверной конфигурацией P23/Hermes и обязательной независимой оценкой в production, сохранив все запреты на фиктивные evidence и автоматическое продвижение.  
**Статус доказательств:** код и контрактные регрессии внесены в Git. Точное исполнение тестов, typecheck и hosted Actions не подтверждены: наблюдавшиеся jobs завершаются до выполнения шагов.

## 1. Найденный production-дефект

До WorkPass330 `server.mjs` создавал проверяемый P23 candidate store, загружал модуль `NEURO_COMPOUND_REPAIR_REVISION_PROVIDER_MODULE` и передавал runtime только:

- `engine`;
- `provideInputs`.

При этом конструктор `OrganismRuntime` в `NODE_ENV=production` требует также `independentEvaluationConfigForRepair`. В runtime есть корректные механизмы для host-owned процессов, но серверный bootstrap не предоставлял способ передать их в свою композицию. Получался конфигурационный тупик: включённый repair provider мог дойти до runtime-конструктора, который отклонял конфигурацию из-за отсутствия независимого evaluator.

Исправление — не ослабить production guard, а явно подключить третий, отдельный модуль доверенного host evaluator.

## 2. Новая конфигурация host evaluator

Добавлен `runtime/neuro-kurisu/src/server/compound-repair-revision-host-config.mjs`. Загрузчик дополнительно требует, чтобы конфигурационный модуль был обычным файлом, не доступным на запись группе/прочим пользователям (POSIX), и находился вне изменяемого `STATE_DIR`; symlink сначала разрешается через `realpath`.

При заданном `NEURO_COMPOUND_REPAIR_EVALUATION_CONFIG_MODULE` сервер загружает отдельный host-config модуль. Он должен экспортировать `createIndependentEvaluationHostConfig({ stateDirectory })` либо default factory. Эта factory возвращает контракт `HostOwnedIndependentEvaluationFactoryOptions`:

- `commands.executor`, `commands.verifier`, `commands.safetyScanner` — три независимых host-owned процесса; каждый имеет абсолютные пути к executable, рабочей директории и раздельным `runRoot`/`surviveDir`; в argv ровно один placeholder `{requestFile}`;
- `tasksForRepair(repair)` — возвращает фиксированный набор задач с обоими split: validation и holdout;
- `environmentFingerprintForRepair(repair)` — digest используемой среды;
- `experimentAuthorityForRepair(repair)` — в production обязателен; связывает tasks с каноническим manifest, validation/holdout plans и verified-outcome ledger;
- опционально `serviceTimeoutMs`.

Затем NK1 передаёт эту конфигурацию в уже существующий `createHostOwnedIndependentEvaluationConfigFactory`. Он остаётся единственным владельцем подготовки независимых executor/verifier/scanner и проверяет их executable identity, разделение каталогов хранения, права, окружение и границы запуска. Нового evaluator или хранилища исходов не создано.

**Изоляция полномочий:** repair provider и host evaluator обязаны указывать на разные реальные файлы. Host-config factory получает только `stateDirectory`; она не получает объекты P23 engine, candidate store или trusted-run registry и не может использовать их напрямую в качестве полномочия на продвижение кандидатов. В production отсутствие отдельного host-config модуля — явная ошибка старта, а не тихий переход к самопроверке.

### Когда переменные настроены

- `NEURO_COMPOUND_REPAIR_REVISION_PROVIDER_MODULE` — существующий trusted provider, создающий подлинный proposal и генераторные входы;
- `NEURO_COMPOUND_REPAIR_EVALUATION_CONFIG_MODULE` — отдельный host config, задающий host-owned исполнитель, verifier, safety scanner и фиксированный эксперимент;
- существующие `NEURO_SKILL_SHADOW_VERIFIER_KEYS_JSON` и `NEURO_SKILL_PROMOTION_APPROVAL_KEYS_JSON` остаются обязательными для соответствующих verified-shadow и authenticated-approval путей.

Относительные module paths разрешаются относительно корня проекта; абсолютные пути поддерживаются. При включённом provider в production отсутствующий evaluator config отвергается до создания runtime. Если evaluator config задан без provider, старт тоже прекращается как misconfiguration.

## 3. Опциональный автономный цикл

Добавлен opt-in параметр `NEURO_COMPOUND_REPAIR_BACKGROUND_REVISION_JSON`.

Пример безопасного расписания:

```json
{"enabled":true,"initialDelayMs":300000,"intervalMs":900000}
```

- `initialDelayMs`: 0–86 400 000 мс;
- `intervalMs`: 60 000–86 400 000 мс;
- неизвестные поля, неверные типы, невалидный JSON и выход за пределы диапазона приводят к явной ошибке;
- отсутствие параметра не включает фоновые запуски;
- `enabled: true` требует настроенный provider и независимую оценку.

Дальнейшая работа принадлежит существующему `OrganismRuntime` scheduler: он ждёт eligible verified non-holdout repair evidence, проверяет состояние организма/ресурсный бюджет и только просит P23 сформировать **staged candidate**. Навык не активируется автоматически и не обходит подписанный shadow evidence или авторизованный promotion.

Таким образом, это подключение существующего механизма, а не утверждение, что само расписание уже выполнено на реальном устройстве или что получено измеримое улучшение обучения.

## 4. Регрессии и подключение к workflow

Добавлен `runtime/neuro-kurisu/tests/workpass330-production-revision-wiring.mjs`. Его 11 контрактных случаев охватывают:

1. запрет production-режима без host evaluator config;
2. сохранение dev-режима, в котором feature не включён автоматически;
3. загрузку host factory с отдельного пути;
4. отказ при совпадении provider/evaluator module;
5. отказ, если экспорт не соответствует контракту;
6. обязательный host-owned experiment authority в production;
7. отказ при отсутствии одной из трёх service-команд;
8. отсутствие фонового расписания по умолчанию и проверку допустимых значений;
9. отказ от writable host evaluator module и отказ от файла внутри state directory;
10. отказ от неполной service-конфигурации и неверного production authority;
11. привязку реального `server.mjs` к evaluator factory и background config в runtime-конфигурации.

Тест зарегистрирован как `test:workpass330:production-revision-wiring`, включён в корневой `audit:quick` и WorkPass71 core CI. Написанный regression-тест не следует считать успешно исполненным, пока job действительно не выполнит его.

## 5. Изменённые файлы и коммиты

- `runtime/neuro-kurisu/src/server/compound-repair-revision-host-config.mjs` — загрузчик host evaluator и parser фонового расписания.
- `runtime/neuro-kurisu/src/server/server.mjs` — отдельный env config module, передача независимой evaluator factory в runtime, опциональное расписание.
- `runtime/neuro-kurisu/tests/workpass330-production-revision-wiring.mjs` — регрессии контракта и server wiring.
- `runtime/neuro-kurisu/package.json` — новый script.
- корневой `package.json` — включение нового теста в `audit:quick`.
- `.github/workflows/workpass71-validation.yml` — отдельный CI шаг.
- текущий отчёт — документирование контракта и его границ.

Ключевые commits:
- helper: [`235d81e9fe969250d528d659c8739610611c0682`](https://github.com/ailtron1ss-rgb/NK1/commit/235d81e9fe969250d528d659c8739610611c0682), последующее ограничение полномочий host config: [`1c2926e9226cdfc775e1f8ee626e704148498c98`](https://github.com/ailtron1ss-rgb/NK1/commit/1c2926e9226cdfc775e1f8ee626e704148498c98);
- runtime server wiring: [`e8b94f7bc95b2e916531d5ca285374edff6c4344`](https://github.com/ailtron1ss-rgb/NK1/commit/e8b94f7bc95b2e916531d5ca285374edff6c4344), subsequent least-privilege hardening: [`81a29ad5460a7fdd99b8acd4445e2d19c6f76e25`](https://github.com/ailtron1ss-rgb/NK1/commit/81a29ad5460a7fdd99b8acd4445e2d19c6f76e25);
- runtime script: [`bf5627f6fffefa46ea492e9a40aecf444216fcaf`](https://github.com/ailtron1ss-rgb/NK1/commit/bf5627f6fffefa46ea492e9a40aecf444216fcaf);
- root quick-audit wiring: [`674d2bbae8fa13a5c4964f8b73335c6961cdca05`](https://github.com/ailtron1ss-rgb/NK1/commit/674d2bbae8fa13a5c4964f8b73335c6961cdca05);
- workflow: [`569071f2a3f66f382943f69d0e5589e44947324e`](https://github.com/ailtron1ss-rgb/NK1/commit/569071f2a3f66f382943f69d0e5589e44947324e);
- server-to-runtime regression: [`172df528701fb3864e799f2b8cbb4e14d891c924`](https://github.com/ailtron1ss-rgb/NK1/commit/172df528701fb3864e799f2b8cbb4e14d891c924).

## 6. Что ещё не доказано

- Новый test и runtime typecheck не подтверждены запуском на exact head.
- GitHub Actions на последних ревизиях останавливается до выполнения шагов; это оставляет результат **UNKNOWN / UNVERIFIED**, а не PASS и не доказанную ошибку приложения.
- В репозитории не добавлен готовый production evaluator module с host executable путями/ключами/замороженным task manifest: они зависят от доверенного deployment окружения. Поэтому нельзя заявлять, что достаточно только установить одну env-переменную и автономное обучение уже работает.
- Настроенная factory ещё должна пройти реальные validation/holdout задачи, доказать task-success и non-regression, выдать подлинные подписанные shadow receipts и оставить candidate staged до отдельного одобрения.
- Новых зависимостей нет. `main` не менялась, release ZIP не скачан и не заменён.

## 7. Следующие шаги

1. Выполнить `npm --prefix runtime/neuro-kurisu run test:workpass330:production-revision-wiring` и `npm --prefix runtime/neuro-kurisu run typecheck` на exact head, как только GitHub runner действительно начнёт выполнять шаги.
2. Подготовить отдельный deployment-owned host config: три разных executable identity, раздельные run/survive roots, зафиксированные manifest/validation/holdout plans и authority для верификации результата. Не размещать эти authority рядом с исполняемым кандидатом и не принимать self-reported success.
3. После отработки пути пройти frozen paired-seed evaluation, сравнить baseline/candidate по task success, trajectory, skill quality, safety, retention и ресурсам; не повышать project quality score без измеренного результата.
4. Только после подтверждения реального provider module и независимой оценки включить `NEURO_COMPOUND_REPAIR_BACKGROUND_REVISION_JSON`; проверять staged candidates и вручную/через отдельную аутентифицированную authority одобрять продвижение.
