# Реестр ассимиляции внешних источников в NK1

**Дата:** 26 ноября 2026
**Основной проект:** `runtime/neuro-kurisu` (TS-организм, 751 файл исходников)
**Источники:** `research/` и `integrations/` в этом же репозитории
**Статус документа:** живой реестр; обновляется в каждой волне ассимиляции.

## 0. Зачем этот реестр

В репозитории лежат пять независимых исследовательских кодовых баз, написанных на Python, и одна интеграция на JS. До этой волны **ни один** из них не был подключён к основному runtime: `grep` по `src/` не находил ни `nomega`, ни `omestro`, ни `deepcode`, ни `neurocore-v143`, ни `inspect-ai`. То есть это был архив, а не источник.

Реестр фиксирует по каждому источнику: что взято, куда именно встроено, чем проверено, какая ожидается польза, что осталось. Правило: **идея без теста и без точки вызова не считается ассимилированной**.

## 1. Инвентарь источников

| Источник | Объём | Что это по факту | Статус в этой волне |
|---|---:|---|---|
| `research/neurocore-v143` | 77 файлов, 1,0 MB, 50 модулей, 11 392 строки Python | Пакет `neurocore`: нейронный субстрат, память, пластичность, мобильный профиль, адаптивный compute, консолидация | **Волна 1: 4 механизма ассимилированы** |
| `research/nomega-pass20` | 720 файлов, 4,8 MB | Платформа синтеза программ, эволюционного поиска, governed self-modification, evidence-инфраструктура | Волна 3 (кандидаты выделены) |
| `research/deepcode/neurocore_organism_v21.py` | 1 файл, 84 KB, 104 функции | PyTorch RL-агент: Option-Critic, C51, RSSM, intra-option actor | Волна 2 (кандидаты выделены) |
| `research/inspect-ai-nk1-evaluator` | 7 файлов, 76 KB | Внешний evaluator NK1 на `inspect_ai` с evidence-файлами | Волна 3 (нужен Python-мост) |
| `research/omestro` | 1 файл, 44 KB | Реестр 32 идей OmeStro со статусами PR | Использован как карта покрытия, не как код |
| `integrations/neko-memory-shadow` | 6 файлов | Shadow-интеграция гибридного recall и MemoryOS2-preview | Уже существует отдельно; кандидат на слияние в волне 2 |

## 2. Волна 1 — ассимилировано

Все четыре механизма взяты из `research/neurocore-v143/src/neurocore/current/` и портированы в чистый TypeScript без зависимостей (в источнике — PyTorch; в runtime нет тензорного слоя, поэтому переносится **политика**, а не сеть).

### 2.1. Таблица

| Механизм (источник) | Модуль NK1 | Точка вызова | Тест | Потенциальная польза |
|---|---|---|---|---|
| `uncertainty_write.py` | `src/organism/system/UncertaintyWriteGate.ts` | `MemoryWritePolicy.decide` | `tests/memory-write-primitives.mjs` | Канал с шумными остатками получает меньший вес записи; канал с малыми остатками — больший. Ограничено `[0.25, 1.5]`, поэтому не может инвертировать решение |
| `hippo_credit.py` | `src/organism/system/HippoLegsCredit.ts` | `MemoryWritePolicy.observeOutcome` | `tests/memory-write-primitives.mjs` | Сжатая история потока ошибок (порядок 8, O(N²) на шаг, без растущего буфера) — детектор смены режима, а не только текущего уровня ошибки |
| `fast_consolidation.py` | `src/organism/system/FastSlowConsolidationGate.ts` | `MemoryWritePolicy.decide` → флаг `promote` | `tests/memory-write-primitives.mjs` | Возврат «остывшей» памяти только по evidence: минимум наблюдений + стабильные нормы ошибки и обновления + защита важных координат |
| `adaptive_compute.py` | `src/organism/system/DeepWorkSelector.ts` | `MemoryWritePolicy.decide` → флаг `deep` | `tests/memory-write-primitives.mjs` | Явный контракт «сколько элементов батча может пойти в дорогую ветку» (`min/max deep fraction`), детерминированный выбор при равных сложностях |
| — (владелец) | `src/organism/system/MemoryWritePolicy.ts` | `OrganismCore` (точка записи памяти) | `tests/memory-write-policy.mjs`, `tests/memory-write-policy-runtime.mjs`, `tests/memory-write-policy-http.mjs` | Единый владелец состояния политики: bounded-гейн, режимы `off/shadow/active`, снапшот/восстановление |

### 2.2. Как это встроено

- **Владелец состояния.** `MemoryWritePolicy` добавлен в `MemorySubsystemRuntime` рядом с `MemoryRetentionEconomy` и `MemoryCausalEconomy`. Это не второй memory store: политика ничего не хранит из памяти организма, только собственную статистику решений.
- **Срез состояния.** `persisted.system.memoryWritePolicy` — по тому же шаблону, что `memoryRetentionEconomy`: объявление в `OrganismCore`, default, `restore()` в `init`, проекция в `PersistenceProjectionCoordinator`, пропуск в `StateMigrations`.
- **Точка вызова.** В цикле кодирования памяти (`OrganismCore`, участок `memoryRetentionEconomy.assess`) политика вызывается до оценки удержания, а `observeOutcome` — после, вместе с `memoryRetentionEconomy.observeOutcome`.
- **Режимы.**
  - `shadow` (по умолчанию) — решения записываются, поведение не меняется;
  - `active` (`NEURO_MEMORY_WRITE_POLICY=active`) — гейн применяется к входной `salience01` (в пределах 0.75–1.25), а стабильная «остывшая» память может не уходить в dormant;
  - `off` — политика не считает и не растёт.
- **Наблюдаемость.** `GET /api/organism/memory/write-policy` (read-only, требует токен) отдаёт режим, число решений, средний гейн, число смен режима ошибки, число promotions, диагностику всех четырёх подмодулей и последние решения.

### 2.3. Замеры

| Показатель | Значение |
|---|---|
| Размер состояния политики (worst case: 300 решений, 256 отслеживаемых id) | **31,1 KB** |
| Бюджет роста состояния после подключения (80 шагов) | 11,77 MB — **без изменений** (порог 13,5 MB) |
| HiPPO: восстановление константного сигнала (160 шагов) | отклонение < 0,02 |
| HiPPO: корреляция с медленной синусоидой | 0,825 |
| Гейн записи в прогоне runtime | 1,004 (среднее), границы соблюдены |

### 2.4. Проверка

```
npm run test:assimilation-wave1
```

Результат (26.11.2026):

| Тест | Результат |
|---|---|
| `memory-write-primitives` | PASS |
| `memory-write-policy` | PASS |
| `memory-write-policy-runtime` | PASS — 10 shadow-решений, состояние переживает рестарт, active-режим считает применения |
| `memory-write-policy-http` | PASS — 401 без токена, 200 + `readOnly: true` с токеном |

Регрессия вокруг затронутых мест:

| Тест | Результат |
|---|---|
| `big-pass-45-retention-governance` | PASS |
| `memory-retention-net-value-workpass41` | PASS |
| `big-pass-48-persistence` | PASS |
| `big-pass-155-restart-persistence` | PASS |
| `state-growth-budget` | PASS |
| `api-security-policy`, `http-request-context` | PASS |
| `p35-server-smoke`, `ui-smoke`, `server-security-smoke` | PASS |
| `typecheck-runtime` (syntax-only, degraded) | OK, 751 файл |

### 2.5. Честные ограничения волны 1

- `active`-режим проверен на коротком прогоне (6 шагов) и на юнит-уровне; долгосрочного A/B «shadow vs active» по качеству памяти **нет** — это отдельный эксперимент (волна 2).
- `promote` в runtime срабатывает редко: он требует ≥8 наблюдений одного и того же `memoryId` и флага `dormant`. В юнит-тесте сценарий воспроизведён, в runtime-прогоне promotions = 0.
- `DeepWorkSelector` в волне 1 используется с батчем из одного кандидата; его реальная ценность раскрывается на батче (replay-события, кандидаты реранка) — это волна 2.
- Перенос сетей (RSSM, C51, Option-Critic) не делался и не планируется без отдельного решения: в runtime нет тензорного слоя, и «нейронная копия» без обучения была бы декоративной.

### 2.6. Уже красные тесты (не связаны с волной 1)

| Тест | Падает на baseline | Причина проверки |
|---|---|---|
| `big-pass-317-organism-reality-closure` | да | `distributionShift/neuralGap/personalityGap` не проходят порог |
| `big-pass-165-memory-economy` | да | `unifiedCognitiveCycle.completeCycles = 0` |

Оба падения воспроизведены на чистом дереве (stash всех правок волны 1), поэтому в регрессию волны 1 не входят.

## 3. Волна 2 — очередь (обосновано, не сделано)

| # | Кандидат | Источник | Зачем | Риск |
|---:|---|---|---|---|
| 1 | Применить `DeepWorkSelector` к батчу replay-событий и кандидатов реранка | `adaptive_compute.py` | Реальная экономия дорогой ветки на батче, а не на одном элементе | Меняет обучающий поток при `active` |
| 2 | Ортогональное стирание (QED) для векторной памяти | `erase_control.py` | Удаление воспоминания без «остаточного» влияния на соседние векторы | Нужен доступ к векторам `LocalEmbeddingProvider` |
| 3 | Sparse-роутинг top-k с учётом неопределённости | `sparse_routing.py` | Выбор подсистемы под задачу с явной неопределённостью | Дублирует существующие роутеры — нужен аудит владельцев |
| 4 | Дедупликация/деконтаминация holdout | `decontamination.py` (571 строка) | Честные замеры памяти на независимом holdout | Требует корпуса |
| 5 | A/B shadow vs active по качеству памяти | волна 1 | Доказать пользу, а не только работоспособность | Нужен holdout и метрика recall |
| 6 | Приоритизированный replay (SequenceReplay) | `deepcode/neurocore_organism_v21.py` | Лучше использовать ограниченный буфер воспроизведения | Влияет на `replayBuffer` — топ роста состояния |
| 7 | Распределённая оценка исходов (C51-идея) | `deepcode/neurocore_organism_v21.py` | Хранить не среднее, а распределение исходов для решений | Рост состояния |
| 8 | Мост к внешнему evaluator | `inspect-ai-nk1-evaluator` | Независимая проверка качества вне runtime | Нужен Python + `inspect_ai` |
| 9 | Governance-манифесты и evidence-лейблы | `nomega-pass20` | Формализовать «FACT/MEASURED/UNKNOWN» в отчётах | Организационный, не кодовый |
| 10 | Слияние shadow-recall в каноническую память | `integrations/neko-memory-shadow` | Гибридный recall уже написан и покрыт тестами | Дублирование владельца памяти |

## 4. Правила ассимиляции (чтобы не размножать владельцев)

1. Один владелец на тип состояния. Политика — владелец своей статистики; память остаётся у `MemoryFabric`/`MemoryOS2`.
2. Новый механизм входит в `shadow`-режиме, включается флагом, и только потом обсуждается `active` по умолчанию.
3. Каждый перенос обязан иметь: юнит-тест на семантику источника, интеграционный тест на точку вызова и запись в этом реестре.
4. Ограничения источника сохраняются: если в Python модуль «candidate-only, disabled by default», в NK1 он тоже не включён по умолчанию.
5. Если перенос требует тензорного слоя, переносится политика (числа, пороги, правила), а не сеть.
