# NK1 — Cognitive Module Runtime (lifecycle + canonical checkpoint integration)

**Дата:** 26 ноября 2026  
**Каноническая база:** workpass70-source@7e601680c765d6dc94e51e4c8f5e729b48a6f56e  
**Реализация:** Draft PR #1210, ветка aspect/module-runtime-lifecycle-20261126

## 1. Назначение

CognitiveModuleRuntime — контролируемый host для жизненного цикла когнитивных модулей NK1. Он позволяет добавлять и заменять заранее зарегистрированные компоненты через стабильные манифесты, контракты зависимостей, разрешения, snapshot/restore и явную миграцию состояния.

Этот слой не создаёт второго владельца памяти, World Model, целей, решений или идентичности. Он управляет включением и остановкой расширений, а данные и действия по-прежнему должны проходить через существующих canonical owners.

## 2. Граница доверия

В текущем pre-launch варианте модульный код передаётся только через host-owned factory: () => CognitiveModule.

Манифест не может:
- указывать путь, URL, npm-пакет или архив для динамического импорта;
- заставлять runtime исполнять произвольный код;
- самостоятельно выдавать себе capability;
- получать весь набор host grants только потому, что они принадлежат его ID;
- записывать собственные гипотезы в canonical factual state;
- автоматически продвигать новую версию кода в каноническую среду.

Это намеренный выбор. Registry и lifecycle могут быть расширены динамической загрузкой позже, но она должна иметь отдельную модель подписей, sandbox и promotion gates.

## 3. Манифест модуля

Поля CognitiveModuleManifestV1:
- schemaVersion: 1;
- id: стабильный ID, например memory.visual-index;
- version: semver;
- runtimeApiVersion: точная версия host-контракта;
- stateSchemaVersion: версия собственного snapshot;
- dependencies: список module ID;
- capabilities: список запрашиваемых полномочий.

Пример:

    const manifest = {
      schemaVersion: 1,
      id: 'memory.visual-index',
      version: '1.0.0',
      runtimeApiVersion: 1,
      stateSchemaVersion: 1,
      dependencies: ['memory.core'],
      capabilities: ['memory.read', 'memory.index.write'],
    } as const;

Идентификатор — устойчивый адрес владельца. Версия модуля и версия его persistent state — разные величины: код может обновиться без изменения state schema, а state schema может измениться с обязательной миграцией.

## 4. Capabilities и минимальные полномочия

Host выдаёт grants отдельно от манифеста:

    const host = new CognitiveModuleRuntime({
      hostApiVersion: 1,
      grants: {
        'memory.visual-index': ['memory.read', 'memory.index.write'],
      },
    });

При подключении через `OrganismRuntime` host автоматически привязывается к `CognitiveModuleCheckpointStore`; вручную передавать отдельный долговременный store не требуется. Показанный ниже `stateStore` остаётся допустимым для изолированных unit-тестов и standalone-host сценариев.

Модуль активируется только если каждая объявленная capability присутствует в host grants. В его контекст попадает пересечение двух наборов: запрошенные capabilities ∩ разрешённые host capabilities. Незаявленные host grants не раскрываются модулю.

Контекст предоставляет только moduleId, moduleVersion, grantedCapabilities, hasCapability(name) и requireCapability(name).

Любая внешняя операция всё равно должна проходить через уже существующие ActionGateway, consent и policy owners. Наличие memory.read не даёт модулю право произвольной записи памяти или выполнения внешних действий.

## 5. Жизненный цикл

    registered
       |
       v
    initializing ---- failure ----> failed
       |
       v
    active
       |
       v
    quiescing -- snapshot + durable save --+
       |                                   |
       +-- failure + successful resume --> active
       |
       +-- shutdown success -------------> stopped
       |
       +-- ambiguous/failed shutdown ----> failed

Контракт экземпляра включает:
- initialize(context);
- health();
- snapshot();
- restore(state, stateSchemaVersion);
- migrateState(state, fromVersion, toVersion) — optional;
- quiesce(context);
- resume(context);
- shutdown(context).

Зависимости активируются в topological order. Остановка идёт в обратном порядке. Зависимость нельзя остановить, пока на ней есть активный dependent. Отсутствующая зависимость и цикл блокируют активацию до вызова factory и до любых побочных эффектов.

## 6. Состояние и миграции

Host использует тот же `JsonStateStore<PersistedOrganism>`, который уже принадлежит `OrganismCore`. `CognitiveModuleCheckpointStore` оборачивает его и размещает envelopes в `PersistedOrganism.system.cognitiveModuleRuntime` внутри того же durable payload. Это не отдельный JSON-файл, не вторая база и не второй владелец истины.

`OrganismRuntime` автоматически:
1. загружает module envelopes вместе с каноническим состоянием организма;
2. привязывает host к in-memory `CognitiveModuleStateStore` адаптеру;
3. активирует модули после восстановления Core и embodiment, но до запуска scheduler/autonomy;
4. при каждом полном durable checkpoint вызывает `snapshotAll()` для активных модулей без quiesce/shutdown;
5. при остановке дренирует очередь, останавливает модули в обратном порядке и включает их финальные snapshots в единый `core.flush()`.

`CognitiveModuleRuntime.bindStateStore()` разрешён только до активации. Это защищает от разделения состояния между разными persistence owners. `CognitiveModuleCheckpointStore` сохраняет последнюю успешную версию envelope, если текущий snapshot конкретного модуля не удался, но **не коммитит новый checkpoint организма**: ошибка фиксируется в диагностике и передаётся вызывающему коду. После успешного повторного snapshot весь новый checkpoint фиксируется атомарно через прежний canonical store.

Envelope связывает module ID и module version, state schema version, timestamp и snapshot state.

Размер каждого module snapshot ограничен по UTF-8 JSON bytes: по умолчанию **1 MiB**, настраиваемый предел — от 1 байта до **16 MiB**. Лимит учитывает строки, ключи и структурные разделители и проверяется инкрементально при клонировании; он действует при snapshot, restore и миграции состояния. Превышение лимита отклоняет операцию до durable save. При неудачной штатной остановке модуль возобновляется через `resume`, если shutdown ещё не начался.

Поддерживаются только JSON-подобные data values: null, строки, boolean, конечные числа, плотные массивы и plain objects. Циклы, getter/setter, symbol keys, дырявые массивы, пользовательские прототипы и функции отклоняются. Snapshot не должен выполнять пользовательский getter во время проверки.

Если загруженная schema старше текущей, модуль обязан реализовать migrateState(state, from, to). После миграции restore получает уже target schema version. Более новая сохранённая schema блокирует активацию, а не обрезается молча.

## 7. Поведение при сбоях

| Сбой | Поведение host |
|---|---|
| Нет dependency / цикл | Не вызывает factory и не начинает активацию |
| Capability отсутствует | Fail-closed до factory |
| Ошибка load / migration / restore / initialize | Модуль получает статус failed |
| Ошибка quiesce / snapshot / durable save при штатной остановке | Вызывает resume; остаётся active только если resume прошёл |
| Ошибка `snapshotAll()` на обычном checkpoint | Сохраняет предыдущую durable generation, отклоняет текущий checkpoint целиком, оставляет модуль active и показывает ошибку в diagnostics |
| Ошибка resume после неудачной остановки | Статус failed |
| Ошибка shutdown после сохранения | Состояние уже сохранено; экземпляр помечается failed, его нельзя объявлять active |
| Ошибка health | Health result unhealthy, runtime не скрывает ошибку |

Неопределённый результат остановки не трактуется как успешный shutdown. Успешный save предшествует shutdown; это не заменяет атомарный durable checkpoint всей системы — такой checkpoint остаётся обязанностью общей Persistence/Continuity линии.

## 8. Использование

    host.register({
      manifest,
      factory: () => new MemoryVisualIndexModule(),
    });

    const organism = new OrganismRuntime({
      stateFile: './nk1-state.json',
      cognitiveModuleRuntime: host,
      autoRun: false,
    });
    await organism.init();
    const health = await organism.cognitiveModuleHealth();
    const diagnostics = organism.cognitiveModuleDiagnostics();

    // The organism owns orderly shutdown and the final canonical checkpoint.
    await organism.stop();

Регистрация сама по себе не вызывает factory. Для изолированного включения отдельного модуля его dependencies должны уже быть active. activateAll() проверяет весь граф и активирует его в правильном порядке; при ошибке пытается остановить уже активированные в этом проходе модули в обратном порядке.

## 9. Что намеренно отложено

До первого прототипа не включаем:
- произвольную dynamic import / загрузку ZIP или внешних модулей;
- hot swap работающего модуля;
- автоматически исполняемое самопереписывание;
- внешний marketplace / каталог;
- promotion модулей без независимого holdout, host admission и rollback;
- отдельная долговременная база или sidecar для module state; state хранится внутри canonical organism checkpoint.

После прототипа можно отдельно проектировать hot swap, подписи, sandbox и promotion gates.

## 10. Проверки и границы доказательств

В PR добавлены регрессии на:
- manifest ID/version и дубли;
- отсутствие factory side effects при регистрации;
- deny-before-factory для capabilities;
- least-privilege context;
- зависимости, cycles, обратный порядок shutdown;
- snapshot/save/restore и schema migration;
- rollback/resume при неудачной записи;
- quiesce/shutdown failure states;
- JSON-safe snapshot, __proto__ как обычный ключ и запрет getter execution;
- health degradation;
- non-disruptive `snapshotAll()` для активных модулей;
- rebinding state store только до активации;
- canonical checkpoint round-trip через новый host;
- сохранение последнего хорошего module snapshot при ошибке одного модуля;
- фактический `OrganismRuntime.init → flush → stop → restart` integration path.

CI включает pinned TypeScript 5.8.3 semantic typecheck, оба module lifecycle/checkpoint regression suite, architecture dependency budget и core ownership audit. Это подтверждает интеграцию на CI, но не является доказательством полного Android/Termux power-loss soak, внешней sandbox isolation, hot swap или готовности всего NK1 к первому запуску.
