# OmeStro — реестр интеграции 32 идей в NK1

**Снимок:** 17 ноября 2026  
**Репозиторий:** `ailtron1ss-rgb/NK1`  
**Каноническая исходная ветка:** `workpass70-source`  
**Исходный HEAD на момент создания реестра:** `bee2b133fdedd48723bc49b3eedae5f0df929c1c`  
**Источник концепций:** `OmeStro.docx` (32 пункта).

## 1. Что означает статус

Реестр различает наличие идеи, код в ветке, PR, слияние в source и выпуск в Release ZIP. Открытая ветка или Draft PR не считаются интеграцией. Даже merged PR не означает независимую научную проверку или наличие функции в последнем Release ZIP.

- **MERGED** — PR закрыт слиянием в `workpass70-source`.
- **DRAFT** — отдельный открытый Draft PR; требуется проверка diff, точного HEAD, CI, зависимостей и отката.
- **STACKED** — PR направлен не в source напрямую, а в другой aspect-PR; сначала необходимо пройти родительскую ветку.

На этом снимке подтверждены два слияния: #901 ChronoTruth и #913 Cognitive Immune System. Остальные 30 направлений существуют в отдельных PR/ветках, но ещё не объединены в source.

## 2. Полный каталог

| № | Идея OmeStro | PR | Снимок состояния | Ветка / зависимость |
|---:|---|---:|---|---|
| 01 | NeuroForge | [#897](https://github.com/ailtron1ss-rgb/NK1/pull/897) | DRAFT | `aspect/neuroforge-donor-capability-engine-20261116` |
| 02 | Dyadic Mind | [#898](https://github.com/ailtron1ss-rgb/NK1/pull/898) | DRAFT | `aspect/dyadic-mind-collaboration-layer-20261117` |
| 03 | Proof-Carrying Skills | [#899](https://github.com/ailtron1ss-rgb/NK1/pull/899) | DRAFT | `aspect/proof-carrying-skills-20261117` |
| 04 | Undo-First Intelligence | [#910](https://github.com/ailtron1ss-rgb/NK1/pull/910) | DRAFT | `aspect/undo-first-intelligence-20261117` |
| 05 | Cognitive Immune System | [#913](https://github.com/ailtron1ss-rgb/NK1/pull/913) | MERGED | `feature/ome-stro-05-cognitive-immune` |
| 06 | Shared Future | [#903](https://github.com/ailtron1ss-rgb/NK1/pull/903) | DRAFT | Корень цепочки сценариев |
| 07 | Developmental Genome | [#902](https://github.com/ailtron1ss-rgb/NK1/pull/902) | DRAFT | Родитель для #912 |
| 08 | ChronoTruth | [#901](https://github.com/ailtron1ss-rgb/NK1/pull/901) | MERGED | `aspect/chrono-truth-bitemporal-memory-20261117` |
| 09 | Negative Space Memory | [#900](https://github.com/ailtron1ss-rgb/NK1/pull/900) | DRAFT | `aspect/negative-space-memory-20261117` |
| 10 | Mechanism Serendipity | [#904](https://github.com/ailtron1ss-rgb/NK1/pull/904) | DRAFT | `aspect/mechanism-serendipity-20261117` |
| 11 | Cognitive Parliament | [#905](https://github.com/ailtron1ss-rgb/NK1/pull/905) | DRAFT | `aspect/cognitive-parliament-evidence-deliberation-20261117` |
| 12 | Intent Compiler | [#906](https://github.com/ailtron1ss-rgb/NK1/pull/906) | DRAFT | `aspect/intent-compiler-20261117` |
| 13 | Open Loop Radar | [#909](https://github.com/ailtron1ss-rgb/NK1/pull/909) | DRAFT | `aspect/open-loop-radar-20261117` |
| 14 | The Invention Loop | [#907](https://github.com/ailtron1ss-rgb/NK1/pull/907) | DRAFT | Родитель для #911 |
| 15 | World Forge | [#916](https://github.com/ailtron1ss-rgb/NK1/pull/916) | STACKED | Базируется на #903 |
| 16 | Synaptic Commons | [#919](https://github.com/ailtron1ss-rgb/NK1/pull/919) | DRAFT | `aspect/synaptic-commons-independent-20261117` |
| 17 | Morphogenesis | [#912](https://github.com/ailtron1ss-rgb/NK1/pull/912) | STACKED | Базируется на #902 |
| 18 | Science Republic | [#911](https://github.com/ailtron1ss-rgb/NK1/pull/911) | STACKED | Базируется на #907 |
| 19 | Developmental Multiverse | [#914](https://github.com/ailtron1ss-rgb/NK1/pull/914) | DRAFT | `workpass19-developmental-multiverse` |
| 20 | Constitution Evolution | [#915](https://github.com/ailtron1ss-rgb/NK1/pull/915) | DRAFT | `aspect/omestro-20-constitution-evolution-20261117` |
| 21 | Consequence Ecology | [#928](https://github.com/ailtron1ss-rgb/NK1/pull/928) | STACKED | Базируется на #916 |
| 22 | Substrate Independence | [#927](https://github.com/ailtron1ss-rgb/NK1/pull/927) | DRAFT | `aspect/omestro-22-substrate-independence-20261117` |
| 23 | Neuro-Plastic Core | [#930](https://github.com/ailtron1ss-rgb/NK1/pull/930) | DRAFT | Локальный LoRA/QLoRA pipeline |
| 24 | Layer Force | [#931](https://github.com/ailtron1ss-rgb/NK1/pull/931) | STACKED | Базируется на #925 |
| 25 | Adaptive Synaptic Matrix | [#921](https://github.com/ailtron1ss-rgb/NK1/pull/921) | DRAFT | Валидация и маршрутизация адаптеров |
| 26 | Hyper-Plastic Network | [#920](https://github.com/ailtron1ss-rgb/NK1/pull/920) | DRAFT | `aspect/ome26-hyper-plastic-network` |
| 27 | Test-Time Neuroplasticity | [#924](https://github.com/ailtron1ss-rgb/NK1/pull/924) | DRAFT | Контекстно-ограниченная адаптация |
| 28 | Neural Prosthesis | [#925](https://github.com/ailtron1ss-rgb/NK1/pull/925) | DRAFT | Родитель для #931 |
| 29 | Teacher-Student Distillation | [#929](https://github.com/ailtron1ss-rgb/NK1/pull/929) | DRAFT | Верифицируемый distillation pipeline |
| 30 | Elastic Neural Plasticity | [#923](https://github.com/ailtron1ss-rgb/NK1/pull/923) | DRAFT | Селективные parameter updates |
| 31 | Cognitive-to-Neural Bridge | [#922](https://github.com/ailtron1ss-rgb/NK1/pull/922) | DRAFT | Cognitive state → neural control metadata |
| 32 | NeuroCore Neural JIT | [#926](https://github.com/ailtron1ss-rgb/NK1/pull/926) | DRAFT | Shadow compiler; promotion не предполагается |

## 3. Реальные цепочки зависимостей

Стрелка означает, что дочерняя работа уже направлена в ветку родительского PR и не может быть объединена в source отдельно от корректной последовательности:

- **#903 Shared Future → #916 World Forge → #928 Consequence Ecology**
- **#902 Developmental Genome → #912 Morphogenesis**
- **#907 Invention Loop → #911 Science Republic**
- **#925 Neural Prosthesis → #931 Layer Force**

Остальные PR в этом реестре направлены непосредственно в `workpass70-source`, если в таблице не указано иное.

## 4. Очередность консолидации

Это порядок проверки и объединения, а не приказ автоматически слить все PR.

### Этап A — доказательства, эпистемика и безопасные действия

1. Проверить уже объединённые #901 и #913 на текущем source HEAD и наличие их тестов в полном прогоне.
2. Разобрать #899 Proof-Carrying Skills, #910 Undo-First Intelligence, #900 Negative Space Memory, #905 Cognitive Parliament, #906 Intent Compiler и #909 Open Loop Radar.
3. Проверить #898 Dyadic Mind на совместимость с UserModel, canonical memory, явным подтверждением пользователя и существующими gateway/permissions.
4. Применять один canonical owner на тип данных/решение; не добавлять дублирующие memory stores или параллельные execution gateways.

### Этап B — развитие архитектуры и мировых моделей

1. Синхронизировать и проверить #902 → #912.
2. Синхронизировать и проверить #903 → #916 → #928.
3. Проверить #907 → #911, затем #904 Mechanism Serendipity, #915 Constitution Evolution, #914 Developmental Multiverse, #919 Synaptic Commons, #897 NeuroForge и #927 Substrate Independence.
4. Применять изменения только после инвариантов, сценариев отката, версионности и независимых регрессионных проверок.

### Этап C — адаптация нейронного субстрата

1. #930 Neuro-Plastic Core: offline LoRA/QLoRA pipeline, неизменяемая базовая модель, holdout и provenance.
2. #921 Adaptive Synaptic Matrix и #920 Hyper-Plastic Network: маршрутизация только проверенных артефактов с гарантированным возвратом к baseline.
3. #924 Test-Time Neuroplasticity и #929 Teacher-Student Distillation: отдельные budget/holdout/rollback gates.
4. #925 Neural Prosthesis → #931 Layer Force: боковой Transformers sidecar; Layer Force должна оставаться выключенной по умолчанию и не воздействовать на скрытые состояния через prompt metadata.
5. #923 Elastic Neural Plasticity, #922 Cognitive-to-Neural Bridge и #926 Neural JIT: только после согласования общих контрактов, одного владельца модели/адаптеров и явного promotion gate.

## 5. Интеграционные ворота

Для каждого PR проверять по точному HEAD:

- реальный diff и отсутствие повторной реализации существующего canonical owner;
- тесты нового поведения и регрессии соседней подсистемы;
- GitHub Actions на HEAD PR, а не на прежнем коммите;
- exact base SHA и правильный parent/child порядок; при движении source повторно синхронизировать цепочку;
- сценарии отключения, fallback, rollback и восстановления после ошибки;
- доказательства качества на holdout / paired seeds там, где заявлено обучение или адаптация;
- измерения latency, memory и целевого устройства там, где заявлена realtime/phone пригодность;
- классификацию IMPLEMENTED / INTEGRATED / TESTED / INDEPENDENTLY CONFIRMED / RELEASED.

Ни концептуальный документ, ни открытый PR, ни зелёный unit test не доказывают production quality или независимое улучшение когнитивной системы.

## 6. Блокеры текущего снимка

- `workpass70-source` на момент реестра: `bee2b133fdedd48723bc49b3eedae5f0df929c1c`.
- PR #925 всё ещё указывает базовый SHA `1e83a011fc677ff20f2348570322bd562181d9ff`, который старше текущего source и предшествует слияниям #901 и #913. Перед финальной интеграцией #925 его необходимо обновить на актуальную source-основу; после этого проверить/перестроить дочерний #931 поверх обновлённого #925.
- #931 — Draft PR; он не является частью #925, пока не будет принят в родительскую aspect-ветку.
- Latest Release ZIP остаётся отдельным источником истины для выпуска. Ни этот реестр, ни любой из открытых PR не должны описываться как released, пока проверка самого опубликованного ZIP не подтвердит содержимое.

## 7. Следующий исполняемый шаг

После завершения текущей проверки #931 выполнить отдельный интеграционный проход: синхронизировать #925 с текущим `workpass70-source`, повторно проверить точный HEAD #925, затем перебазировать/обновить #931 на новый HEAD родителя и повторить весь relevant CI. Только после этого продолжать этап A–C по очереди выше.

## 8. Проверка актуальности на 18 ноября 2026

Последняя повторная сверка GitHub:

- `workpass70-source`: `bee2b133fdedd48723bc49b3eedae5f0df929c1c`.
- Последний Release по-прежнему `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, опубликован 19 октября 2026, SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.
- #901 и #913 остаются единственными подтверждёнными merged PR из этого каталога.
- #930 Neuro-Plastic Core получил новые коммиты 18 ноября и находится на HEAD `913ffc8edca3bea6aa35d17fddb9f6ae58574a21`; base SHA обновлён до merge commit #901 `2676da93eda716313345d37700612de638fcbe76`, но PR остаётся Draft.
- #922 Cognitive-to-Neural Bridge обновлён 18 ноября до `4ffa92dee1f461903982d3a2fd213c6a03088dfb`, base остаётся `1e83a011fc677ff20f2348570322bd562181d9ff`.
- #926 Neural JIT обновлён 18 ноября до `ab75af47ab8c47bf82a2822e3c6861d818021f48`, base остаётся `1e83a011fc677ff20f2348570322bd562181d9ff`.
- #931 Layer Force обновлён 18 ноября тестами на hook-laziness/low precision; проверяется текущий новый HEAD `38edc6c0c28e44df029205e08b5c168338888f83`. PR остаётся Draft и stacked на #925.
- #925 по-прежнему HEAD `8ae6445642f52f9eef06fb1a3070682129764558`, base SHA `1e83a011fc677ff20f2348570322bd562181d9ff`.
- #934 этот реестр остаётся Draft и имеет актуальную для момента создания базу `bee2b133fdedd48723bc49b3eedae5f0df929c1c`.

### Синхронизация source

Для 28 открытых PR (кроме #930, чей base уже перешёл на merge commit #901, и stacked children, чьи базы являются feature heads) найден stale source base `1e83a011fc677ff20f2348570322bd562181d9ff`. Эти ветки не следует массово сливать поверх нового source без обновления базы и exact-head CI. Сначала нужно обновить базовые aspect PR и их дочерние зависимости в правильном порядке.

### Статус Layer Force после последнего расширения

В #931 добавлены два новых обязательства к контракту:

1. Профиль загружается/валидируется без установки PyTorch hooks; hooks ставятся лениво только при входе в явный request-scoped `activate(profile_id)`. Это убирает hook overhead в выключенном режиме и при preloading профилей без default selection.
2. Низкоточная FP16/BF16 запись должна строго соблюдать per-token delta cap после округления к dtype модели, а не только до округления в FP32.

На HEAD `38edc6c0c28e44df029205e08b5c168338888f83` GitHub Actions run `44238241640` для новых проверок находится в очереди; до завершения не считать эти два новых свойства подтверждёнными.

