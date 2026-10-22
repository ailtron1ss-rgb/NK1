## WorkPass266 — implementation follow-through: lossless identities and active regression wiring (2026-10-22)

The code pass addressed a specific correctness defect in CausalExperienceStream: silently truncating task and trace identifiers could map distinct external events to the same deduplication key. The canonical owner now validates the full NFKC-normalized string, rejects values outside the bounded length/control-character contract, and applies the same strict trace check while restoring persisted state. The regression suite exercises collision attempts, no-mutation guarantees and invalid snapshot identities.

The WorkPass110 workflow now includes CausalExperienceStream and its test in PR/push path filters, includes the current source branch in push triggers, and explicitly invokes the causal-stream, LegacySpriteDeck render-lifecycle and Live2D integrity regressions. No new dependency was needed.

**Validation state:** retry requested for Actions run 39746182919. The retrieved job is failed but returns steps=null and logs_url=null; this does not establish either a code failure or a pass. Exact-head runtime typecheck, causal regression, app regression and physical-device/browser E2E remain unverified. PR #55 remains draft/unmerged.

**Next implementation target:** audit all call sites of external causal intake and replace any caller-owned stateGrounded assertion used as authority with provenance that can be traced to an observable state transition or canonical independent verifier. Do not change that contract until call sites, ownership and migration requirements have been inspected. No learning score uplift is justified by this pass.

---

## WorkPass264 — strict external causal event intake (2026-10-22)

A focused review of the historical `workpass79-learning-input-integrity` branch found a useful principle in its `ContinualReplayBuffer`: validate task/action contracts before mutating memory. The current `CausalExperienceStream` now applies the relevant boundary rule directly—normalizing and requiring a non-empty external task identity and rejecting action labels outside the canonical organism action set. Regression cases assert that malformed events do not change outcome counts. The old buffer/learner was not copied; NK1 keeps one causal stream owner.

The causal scorecard remains at **57/100 overall learning engineering**, **61% P23 symbolic core**, **36% evidence-grounded maturity**, and **30% project-wide lifelong-learning roadmap** until actual external-task evidence and reproducible test runs justify recalibration. The current HEAD has no commit status records. Three available PR-triggered workflow records report failure with zero visible job steps; their log downloads return BlobNotFound, so the failures cannot be attributed to code. Tests/typecheck remain unconfirmed.

---
## WorkPass263 — reduce host-environment leakage into evaluation authorities (2026-10-22)

The host-owned evaluation adapter now rejects implicit inheritance of common secret-bearing environment variables and runtime-injection settings, including API tokens, credential/profile paths, dynamic-loader overrides, and NODE_OPTIONS. Duplicate inherited keys are rejected as configuration errors. This narrows accidental secret exposure and process behavior injection, but explicit `command.env` remains trusted host configuration and the mechanism is not a sandbox. Targeted regression/typecheck execution is still unconfirmed; GitHub returned no PR-triggered workflow runs for the current HEAD.

---
## WorkPass262 — reduce unnecessary avatar canvas resets (2026-10-22)

The Legacy avatar render loop previously assigned canvas width and height every frame. Since setting either dimension resets the bitmap and drawing context, the loop now resizes only when the actual layout dimensions change. The existing sprite runtime regression was extended to guard this invariant. This improves a hot path without changing the visual asset catalog or introducing a parallel renderer. Execution and app typecheck remain unconfirmed.

---
## WorkPass261 — idempotent external learning intake (2026-10-22)

The causal stream now applies the bounded NFKC trace-identity rule to external learning events as well as runtime outcomes. Duplicate upstream retries resolve to the existing record rather than increasing outcome counts, and the trace-ID set survives snapshot/restore. The regression is now directly invokable through `npm run test:big-pass-90:causal-stream`.

This closes a concrete integration gap in event ingestion, but does not prove exactly-once delivery across external systems: that still depends on stable upstream IDs, durable snapshots, and callers handling the nullable duplicate/evicted result correctly. Runtime tests and typecheck remain unconfirmed.

---
## WorkPass259–260 — selective reintegration from historical learning branch (2026-10-22)

A focused comparison of branch-exclusive code found useful safeguards in the older workpass71-learning-integrity version of CausalExperienceStream.ts that were absent from the active owner. Rather than merging the 32-commit historical branch, two narrow ports were made into the current subsystem:

- **WorkPass259:** normalized and bounded trace IDs; persisted outcome-deduplication IDs across bounded record eviction and restore; disallowed consolidation of ungrounded external records; added regression cases.
- **WorkPass260:** restored task/context-diverse prioritized replay and consolidation selection, with a regression for a small replay batch containing near-equal candidates from different tasks.

The historical branch workpass71-learning-eval-paired-seeds has 56 branch-exclusive commits including standalone paired/holdout evaluation scripts. Those scripts were not copied blindly because the active branch now owns a separate independent evaluator and experiment lifecycle. The historical workpass79-learning-input-integrity has 48 branch-exclusive commits including a standalone ContinualReplayBuffer and vendor intake documents; the exact buffer path is absent from the active branch, so it remains a selective-review item rather than being duplicated into the current replay owner.

**Validation caveat:** the new/extended regressions and runtime typecheck are authored but not confirmed executed successfully. Branch commit counts are history metadata, not a measure of useful features.

---
## WorkPass255–258 — implementation follow-through (2026-10-22)

Four implementation passes followed the strategic audit:

- **WorkPass255 — Legacy avatar runtime:** stabilized the canvas animation loop across speaking/emotion/outfit updates by reading current values from refs rather than restarting the RAF loop.
- **WorkPass256 — asset race handling:** canceled stale sprite image callbacks so slow prior requests cannot overwrite a newer emotion/outfit selection.
- **WorkPass257 — regression coverage:** added app/scripts/legacy-sprite-deck-runtime.test.mjs for the loop-lifetime and stale-image invariants.
- **WorkPass258 — authority path integrity:** pinned working-directory and scratch-root filesystem identities and rechecks directory type, identity, and private POSIX permissions at dispatch; extended the existing host-service regression for run-root replacement.

**Not claimed:** these tests/typechecks have not yet been confirmed passing on an accessible runner. The path identity checks are defense-in-depth and do not close the final TOCTOU window or prove a real sandbox. Browser/Android voice unification and production independent evaluator deployment remain open.

---
# Стратегический аудит развития Neuro Kurisu / NK1

**Дата:** 2026-10-22  
**Репозиторий:** [ailtron1ss-rgb/NK1](https://github.com/ailtron1ss-rgb/NK1)  
**Аудируемая рабочая ветка:** `workpass206-runtime-evaluator-wiring`  
**Связанная линия изменений:** [draft PR #55](https://github.com/ailtron1ss-rgb/NK1/pull/55)  
**Статус документа:** стратегический аудит структуры репозитория, ветвления и направлений развития; это не заявление о полном построчном аудите всех файлов.

## WorkPass254 — результат проверки эксклюзивных изменений ветки Live2D

Проверено сравнение `e09ec25ff5184af2d1051737b247dcbd490d1e79...workpass94-avatar-voice-live2d-audit`: ветка содержит ровно два эксклюзивных коммита, и оба меняют только аудитные документы:

- `docs/WORKPASS94_AVATAR_VOICE_LIVE2D_AUDIT_2026-10-20.md` — 146 добавленных строк.
- `docs/WORKPASS94_AVATAR_VOICE_LIVE2D_FINDINGS_2026-10-20.json` — 178 добавленных строк.

**Решение по ветке:** не требуется переносить из неё кодовые коммиты — эксклюзивный diff содержит только документы. Сами findings оказались полезны: повторное применение Live2D expression подтверждалось в текущем viewer и устранено WorkPass252; небезопасные обращения LegacySpriteDeck к localStorage подтверждались в текущем компоненте и устранены WorkPass253. Отдельный путь браузерного SpeechSynthesis и Android/Termux voice API остаётся архитектурным разрывом и не считается закрытым этими UI-исправлениями.

**Статус проверки:** сравнение commit/file metadata и выборочное чтение исходников выполнены; полное browser/Android E2E не запускалось. Ветка `workpass94-avatar-voice-live2d-audit` не удаляется и не архивируется автоматически.

---

## 1. Краткий вывод

NK1 содержит зрелую по ширине инженерную базу для памяти, когнитивного runtime, действий, обучения, replay, оценки навыков и контролируемого продвижения. Наиболее рациональный путь — не добавлять ещё одну независимую архитектуру агента, а довести существующие подсистемы до единого работающего пути с единым владельцем состояния, происхождением evidence и измеримым результатом.

Главные блокеры развития сейчас — не недостаток новых модулей, а целостность репозитория и переход от интерфейсов к доказанному production execution:

1. **P0 — топология веток и публикации.** `main` не имеет общего предка с `workpass206-runtime-evaluator-wiring` по GitHub compare API. README `main` описывает release/report repository и указывает `workpass70-source` как полное дерево исходников. Это означает, что обычный PR из активной линии в `main` не может быть стандартным fast-forward/merge без отдельного решения о стратегии репозитория. Не выполнять массовое слияние или переписывание истории автоматически.
2. **P0 — CI не даёт достоверного зелёного сигнала.** Предыдущие записи roadmap сообщают о запусках Actions, завершавшихся до выполнения шагов (`runner_id: 0`, пустой список steps) и об отсутствии доступных логов. Текущий аудит не получил подтверждения успешного exact-head CI, typecheck или регрессионных тестов. Это неопределённость инфраструктуры, а не доказательство, что код неверен.
3. **P0 — реальная граница доверенного исполнения ещё не закрыта.** `HostOwnedIndependentEvaluationServices.ts` обеспечивает контролируемый запуск трёх host-owned executables через существующий process supervisor, но сам адаптер не является OS/container sandbox. Нужны реально развёрнутые sandbox launcher, независимые verifier и safety scanner, их конфигурация и end-to-end evidence.
4. **P1 — слишком много исторических веток и draft PR.** Обнаружена большая цепочка специализированных веток и несколько открытых draft PR, которые следует классифицировать по уникальному полезному коду, уникальным тестам, уже перенесённым изменениям и оставшимся эксклюзивным коммитам.
5. **P1 — когнитивная ширина опережает демонстрацию поведения.** Наличие модулей и тестов не равно доказанному улучшению обучения, памяти или агентности. Приоритет — измеримые сценарии и единая эксплуатационная петля, а не рост количества «движков».

**Рекомендация:** сохранить текущую рабочую ветку и PR как отдельную линию интеграции; сначала решить публикационную топологию и вернуть исполняемый CI, затем закрыть реальный trusted-evaluation путь и только после этого продвигать кандидатов на основе сравнительных данных.

## 2. Объём и способ аудита

Проверены метаданные репозитория, описание `main`, список доступных веток с именем `workpass`, список недавних PR, сравнения веток через GitHub compare API и содержимое стратегических документов и ключевого host-owned evaluation adapter на активной ветке.

Проведены сравнительные запросы для следующих точек истории:

- `workpass70-source` → `workpass206-runtime-evaluator-wiring`: active head впереди на 1 078 коммитов; compare endpoint вернул статус `ahead`.
- `workpass79-cognitive-rebuild` → active: active впереди на 699 коммитов.
- `workpass123-authenticated-skill-lifecycle` → active: впереди на 611 коммитов.
- `workpass150-hermes-adapter-verified-lifecycle` → active: впереди на 405 коммитов.
- `workpass172-hermes-compound-revision-orchestrator` → active: впереди на 283 коммита.
- `workpass194-cross-source-verified-replay-consolidation` → active: впереди на 278 коммитов.
- `workpass203-independent-candidate-evaluator` → active: впереди на 234 коммита.
- `workpass94-avatar-voice-live2d-audit` → active: статус `diverged`, active впереди на 975 коммитов, позади на 2 коммита. Эти два эксклюзивных коммита необходимо отдельно проверить перед любым решением об архивировании ветки.

Эти числа показывают относительную историю выбранных ref, но **не** количество полезных уникальных возможностей и не число коммитов, которые нужно слить. Compare для `main` и active возвращает «No common ancestor». Дерево `workpass70-source` и активная ветка сравнимы; `main` — отдельная линия.

Аудит не утверждает, что просмотрены построчно все файлы, все ветки Git и все исторические PR. Ветка `workpass` выдаёт значительный, но не гарантированно исчерпывающий список; при принятии решения о слиянии нужно дополнительно получать полные страницы веток и проверять точные commit ranges.

## 3. Анализ веток и линий разработки

| Ветка / семейство | Роль в истории | Стратегическое решение |
|---|---|---|
| `main` | README описывает release-процессы, отчёты и архивы; исходное дерево не находится в общей Git-истории с active | Считать публикационной линией, не пытаться автоматически вливать в неё текущую ветку. Сначала выбрать целевую модель: монорепозиторий с общей историей, release-репозиторий с артефактами или отдельная исходная ветка |
| `workpass70-source` | Точка, на которую README указывает как на полное дерево исходников; общий предок активной ветки | Использовать как исходную контрольную точку при сравнении source tree и последующих интеграций |
| `workpass71-learning-eval-paired-seeds`, `workpass71-learning-integrity` | Ранние протоколы оценки обучения и целостности данных | Сохранить полезные контракты/регрессии; не оставлять несколько параллельных «источников истины» для оценки |
| `workpass73-audit-fixes` | Аудиторские исправления | Переносить конкретные исправления и их тесты, не считать саму ветку самостоятельной архитектурой |
| `workpass79-cognitive-rebuild` | Крупная когнитивная линия; активная ветка имеет относительно неё 699 дополнительных коммитов | Сверять новые модули по call graph и владельцу состояния; не добавлять повторно уже включённые компоненты |
| `workpass79-learning-input-integrity` | Целостность входов обучающего контура | Сохранить в общей evidence policy и общих проверках входных данных |
| `workpass86-prioritized-replay` – `workpass93-hermes-reflective-learning-gate` | Replay, протоколы оценки, забывание, transfer, drift и gate рефлексивного обучения | Объединить как одну цепочку: verified outcome → выбор replay → измерение forgetting/transfer → gated skill revision; политики replay должны быть взаимозаменяемыми стратегиями, а не разными движками |
| `workpass94-avatar-voice-live2d-audit` | Отдельная линия интерфейса, голоса и Live2D | Особо сохранить UI/asset/voice полезные изменения. Из-за двух эксклюзивных коммитов провести отдельный diff-review; не удалять ветку до извлечения уникального кода |
| `workpass116-seed-clustered-learning-eval` – `workpass124-learning-evidence-hardening` | Статистическая оценка, replay admission, multi-source learning, retrieval feedback, revision gate, authenticated lifecycle и evidence integrity | Свести к каноническим экспериментальному плану, журналу проверенных исходов и одному lifecycle gate; тесты разных источников должны подтверждать один контракт |
| `workpass135-durable-shadow-run-registry` | Долговременный реестр shadow-run | Считать инфраструктурой provenance; не создавать второй registry при дальнейших интеграциях |
| `workpass150-hermes-adapter-verified-lifecycle` – `workpass172-hermes-compound-revision-orchestrator` | Hermes → P23: связывание evidence, promotion gate, генерация ревизий, repair loop, orchestrator | Это одна функциональная цепочка, а не 23 независимых продукта. Оставить Hermes как источник предложений/планов ревизии, P23 — владельцем проверок, evidence, staging и promotion |
| `workpass194-cross-source-verified-replay-consolidation` – `workpass202-verified-replay-count-bridge` | Сведение replay с verified evidence, целями, аффективной значимостью, novelty и счётчиками | Сохранить единый replay admission/selection contract; не допускать повторного учёта одного события и не выдавать novelty/salience за независимое подтверждение успеха |
| `workpass203-independent-candidate-evaluator` | Независимая оценка кандидатов навыка | Канонический evaluator должен быть единственным местом выполнения paired baseline/candidate evaluation и создания связанного provenance |
| `workpass206-runtime-evaluator-wiring` | Runtime composition и host-owned evaluator services; текущая рабочая линия | Продолжать здесь до решения по репозиторию; не переносить непроверенные изменения на `main` |

### PR-структура

Список недавних PR показывает несколько открытых draft PR подряд: #55, #54 и PR #46–#53 в основном покрывают последовательные workpass 194–205. Они не являются автоматически установленным кодом в `main`. PR #55 открыт, draft и не слит; default branch не изменён этой рабочей линией.

На контрольном чтении 2026-10-22 описание PR #55 уже охватывает WorkPass206–264. Это устраняет прежнее расхождение описания, но не снимает draft/unmerged статус и неподтверждённый exact-head CI/production deployment.

## 4. Архитектурная карта: что объединять, а что оставить раздельным

### 4.1 Единый контур навыков и обучения

Целевая последовательность:

`наблюдение ошибки → evidence-backed repair targets → план ревизии → генерация кандидата → независимая baseline/candidate оценка → проверенные исходы → shadow evidence → авторизованное продвижение → долговременная активация`

Владельцы должны оставаться разделёнными по полномочиям:

- **Hermes/revision planner:** формирует гипотезу и предложение исправления, но не подтверждает свой успех.
- **Candidate generator:** производит недоверенный payload кандидата; генерация не означает прохождение.
- **Independent evaluator:** выполняет один и тот же task/seed/manifest/environment protocol для baseline и candidate.
- **VerifiedOutcomeLedger / experiment plan:** хранит фактические исходы и обеспечивает полноту и соответствие плана.
- **Shadow evidence registry:** сохраняет подписанные результаты конкретных запусков.
- **Authenticated promotion gate / versioned candidate store:** единственные владельцы одобрения и активации.
- **Replay subsystem:** выбирает опыт для обучения только после проверки происхождения; не имеет права обходить promotion gate.

Нельзя объединять независимого verifier и safety scanner в одну роль только ради сокращения файлов: это отдельные полномочия. Объединять следует контракты и общую проверку binding, а не независимость источников.

### 4.2 Сведение дублирующихся evidence-контрактов

WorkPass250 уже извлёк единый predicate `hasExactEvaluationBinding` для verifier и scanner: payload, task input, environment, evaluator plan, manifest, experiment plan, scheduled/runtime run, task и seed. Это правильное направление. Следующий шаг — использовать единый типизированный immutable evaluation envelope на стыке evaluator → ledger → shadow registry, чтобы разные мосты не повторяли набор полей и при этом не ослабляли проверку.

### 4.3 Память и replay

Не добавлять новый Hermes memory store. Использовать существующую память как хранилище опыта и контекста, а verified outcome ledger — как доказательную запись результата. При интеграции проверить:
- единственный владелец идентичности эпизода/run;
- единый ID и версия manifest;
- provenance каждого replay item;
- дедупликацию повторных событий;
- разделение validation и holdout;
- метрики forgetting/transfer на фиксированных task streams;
- ограничение бюджета памяти и replay.

### 4.4 Когнитивное ядро, действия и постусловия

Использовать существующие `OrganismRuntime`, `OrganismCore`, `ActionGateway`, планировщик и postcondition/reality evidence путь. Новый источник идей не должен выполнять действие напрямую в обход канонического gateway. Для любого автономного шага нужны наблюдаемое действие, реальный результат/постусловие, provenance и корректная обработка отказа.

### 4.5 UI, voice и Live2D

Линию `workpass94-avatar-voice-live2d-audit` не считать устаревшей только из-за возраста. Сохранить как отдельный продуктовый слой и интегрировать через адаптеры в единый runtime, а не дублировать когнитивную логику в UI. Сначала проверить два эксклюзивных коммита ветки, assets/paths и вызовы API; затем решить, какие файлы уже перенесены, а какие всё ещё уникальны.

## 5. Главные риски и критерии закрытия

| Приоритет | Риск | Что закрывает риск |
|---|---|---|
| P0 | `main` и active не имеют общего предка | Принятое архитектурное решение о модели репозитория; документированный migration/merge plan с резервной копией и проверкой tree/commit provenance |
| P0 | CI запускается без исполняемых шагов или нет достоверных результатов | Исполняемый exact-head workflow с доступными логами; подтверждённые exit codes targeted tests и runtime typecheck |
| P0 | Host adapter ошибочно воспринимается как готовый sandbox | Действительно ограниченный OS/container launcher с запретом неразрешённой сети/файловой системы, CPU/memory/time limits; отдельные владельцы verifier/scanner |
| P0 | Возможен неполный/непарный evidence | Полное покрытие manifest и scheduled runs; baseline/candidate сравнение на идентичных task/seed/split/environment; fail-closed при пропусках и дубликатах |
| P1 | Исторические ветки содержат потерянный уникальный код | Branch inventory с head SHA, merge-base, unique commits, unique files/tests и решением keep/cherry-pick/archive |
| P1 | Разные мосты поддерживают несовпадающие контракты | Один immutable evaluation envelope и одна каноническая проверка целостности на каждом переходе |
| P1 | Replay может усиливать шум или дублировать опыт | Проверенный outcome admission, deduplication, бюджет и измерение полезности на одинаковых потоках задач |
| P1 | Накопление cognitive-модулей без доказанного runtime-вызова | Карта реальных production call paths и владельцев состояния; модули включать только при наличии конкретного вызова и полезного результата |
| P1 | UI/voice/Live2D теряется при консолидации backend | Отдельный сохранённый UI/assets diff и сквозной runtime/API контракт |
| P2 | Сложность релизной процедуры и архивов | Единая release manifest, provenance/SBOM, воспроизводимая сборка и одна каноническая release line после решения о топологии |

## 6. План развития — следующие проходы

### Проход A — P0: топология и проверяемость поставки

1. Зафиксировать роль `main`, `workpass70-source` и active branch; не менять историю автоматически.
2. Составить полный inventory веток: ref/head SHA, общий предок, уникальные коммиты, открытые PR, уникальные файлы, тесты и целевое решение.
3. Восстановить фактическое выполнение CI: сначала понять, почему runner завершает job до шагов; затем получить доступные логи и подтвердить targeted test + runtime typecheck на exact head.
4. Синхронизировать PR #55 title/body с WorkPass249/250 и реальным состоянием.
5. Только после подтверждения тестов и решения о ветках решать, как собирать единую release line.

**Выход:** понятная canonical source branch, воспроизводимый exact-head CI и список веток с решениями, а не массовое слияние вслепую.

### Проход B — P0: реальное независимое оценивание

1. Развернуть реальный sandbox launcher и задокументировать OS-level границы.
2. Развернуть отдельно управляемые verifier и safety scanner.
3. Подключить host factory к production composition явно; отсутствие конфигурации должно оставаться fail-closed.
4. Выполнить end-to-end paired baseline/candidate run на фиксированном manifest с seeds, validation/holdout и ресурсными лимитами.
5. Связать отчёты с ledger/shadow receipts и authenticated approval без пропуска стадий.
6. Сохранить негативные и неудачные результаты как evidence, не переписывать их в успех.

**Выход:** один реально работающий, независимо проверяемый skill lifecycle вместо набора интерфейсов.

### Проход C — P1: структурная консолидация

1. Свести evaluation provenance к одному immutable envelope.
2. Убедиться, что Hermes revision planner, P23 engine, SkillLearnBench adapter, experiment plan и verified outcome ledger образуют один call path.
3. Удалить/объединять дубли только после проверки call sites и ownership; похожее имя файла само по себе не основание для удаления.
4. Соединить replay admission с verified outcome provenance и одной записью эпизода.
5. Оставить отдельными независимые роли, storage boundaries и promotion authority.

**Выход:** меньше параллельных правил при сохранении реальных границ доверия.

### Проход D — P1: доказать полезность обучения

Сравнить на одинаковых task streams, seeds, версиях manifest и бюджете:
- без replay;
- recent replay;
- multi-timescale / reservoir / novelty-aware replay;
- retrieval-feedback curriculum;
- candidate revision с независимым baseline.

Метрики: task success, skill quality, trajectory/action efficiency, forgetting, forward/backward transfer, calibration, catastrophic failure rate, latency, memory/storage cost. Holdout должен быть изолирован от генерации и tuning; автоматическое продвижение допускается только после заранее определённого устойчивого улучшения и safety-clean evidence.

**Выход:** измеримое доказательство пользы или отрицательный результат, который предотвращает ложное продвижение.

### Проход E — P1/P2: продуктовая интеграция

1. Проверить эксклюзивные изменения `workpass94-avatar-voice-live2d-audit`.
2. Восстановить end-to-end UI/API/voice/Live2D сценарий с фактическими runtime-событиями, а не декоративными заглушками.
3. Убедиться, что действия из интерфейса проходят через один canonical ActionGateway, а состояние/память принадлежат runtime.
4. Сохранять рабочие assets и provenance; чистить дубли только после сравнения ссылок и реальных путей загрузки.

**Выход:** единый организм с доступным пользовательским интерфейсом, а не отдельно развивающиеся backend и оболочка.

## 7. Что делать с ветками

Никакую ветку не удалять по одному лишь возрасту или названию. Для каждой ветки итоговое решение должно быть одним из четырёх:

- **KEEP / active:** содержит текущую уникальную работу или служит интеграционной линией.
- **CHERRY-PICK:** содержит конкретные нужные коммиты, не входящие в canonical line.
- **ARCHIVE:** все полезные изменения уже перенесены, а уникальные коммиты проверены и не нужны.
- **INVESTIGATE:** ветка diverged, имеет уникальные UI/assets/behavior changes или неясный merge-base.

Предварительные решения:
- `workpass206-runtime-evaluator-wiring`: KEEP как текущую интеграционную ветку до закрытия P0.
- `workpass70-source`: сохранить как контрольную source baseline до принятия решения по структуре репозитория.
- `workpass94-avatar-voice-live2d-audit`: INVESTIGATE из-за двух коммитов, отсутствующих в active по compare result.
- `workpass150`, `172`, `194`, `203`: использовать как контрольные milestones для истории и уникального diff; не cherry-pick целые ветки, если active уже потомок/содержит их работу.
- `workpass71`, `79`, `86`–`93`, `116`–`124`, `135`, `150`–`172`, `194`–`203`: до архивирования пройти полную проверку unique commits/files/tests, поскольку названия отражают полезные архитектурные этапы, но не доказывают отсутствие уникального кода.

## 8. Что считать реальным прогрессом

Не считать количеством прогресса:
- число новых файлов/движков;
- добавление отчёта без кода;
- наличие теста, который не запускался;
- queued workflow без результата;
- сгенерированный кандидат без независимого сравнения;
- интерфейс promotion без реального доверенного deployment.

Считать прогрессом:
- код, подключённый к существующему production call path;
- объединение дублирующихся контрактов с сохранением security boundaries;
- реально исполненный тест с exit code и доступным логом;
- независимое baseline/candidate evidence на фиксированном протоколе;
- восстановленный UI/API/voice/Live2D сценарий;
- ветка, закрытая после доказанного переноса уникальных изменений.

## 9. Статус на момент аудита

- Репозиторий: private, default branch `main`; размер GitHub repo metadata — около 119 560 KB.
- README `main` указывает `workpass70-source` как полное дерево исходников.
- `main` и active branch не имеют общего предка по GitHub compare API.
- PR #55: open, draft, not merged.
- WorkPass249: отмена до создания приватного request directory и повторная проверка перед запуском supervisor.
- WorkPass250: единая строгая проверка evidence binding для verifier и safety scanner.
- Тесты/typecheck/exact-head CI: **не подтверждены как успешные в этом аудите**.
- Production sandbox/verifier/scanner: **deployment remains open**.
- Ветви UI/Live2D: нужен отдельный review эксклюзивных коммитов.

## 10. Источники внутри репозитория

- [README.md на main](https://github.com/ailtron1ss-rgb/NK1/blob/main/README.md)
- [Cross-source integration roadmap](https://github.com/ailtron1ss-rgb/NK1/blob/workpass206-runtime-evaluator-wiring/docs/P23_CROSS_SOURCE_INTEGRATION_ROADMAP.md)
- [Hermes integration audit](https://github.com/ailtron1ss-rgb/NK1/blob/workpass206-runtime-evaluator-wiring/docs/HERMES_NK1_INTEGRATION_AUDIT_AND_ROADMAP_2026-10-21.md)
- [P23 continual-learning scorecard](https://github.com/ailtron1ss-rgb/NK1/blob/workpass206-runtime-evaluator-wiring/docs/P23_CONTINUAL_LEARNING_SCORECARD_2026-10-20.md)
- [Draft PR #55](https://github.com/ailtron1ss-rgb/NK1/pull/55)

---
**Ограничение интерпретации:** этот отчёт — приоритизированный стратегический аудит на основе доступных GitHub метаданных, выборочных branch comparisons и прочитанных ключевых документов/модулей. Он не заменяет полное построчное ревью всех эксклюзивных коммитов, запуск тестов или deployment validation. Все дальнейшие решения о merge должны опираться на точные diff и проверяемые результаты.


---


## WorkPass265 — master execution blueprint and measurable completion criteria (2026-10-22)

**Checked source ref:** workpass206-runtime-evaluator-wiring  
**Reviewed implementation baseline before the documentation checkpoint:** `58e9c6a00b5835096dac3758968f5b9ce0eb08d2`. The live PR is the authoritative pointer for the current branch HEAD.  
**PR:** #55, open/draft/unmerged; base workpass203-independent-candidate-evaluator  
**Purpose:** turn the broad organism goal into explicit, independently finishable work tracks and a multi-pass execution order. This addendum supersedes older branch-status statements in this document when they disagree with the checked PR metadata above.

### 11.1 Evidence snapshot — what is and is not established

Observed in the checked repository state:

- PR #55 covers 36 changed files, approximately 4,165 additions and 95 deletions, across independent evaluation, learning/evidence, runtime wiring, causal experience intake, and avatar stability. This is diff volume, not a progress percentage.
- WorkPass255–264 include real source edits: stable Legacy avatar render-loop lifetime, stale-sprite race protection, blocked-storage fallback, dispatch-time identity/permission checks for host evaluation authorities, reduced inherited environment leakage, bounded external event identity, persisted duplicate-event protection, and task/context-diverse replay selection.
- The active branch includes a canonical MemoryOS2 owner, P23 learning/replay logic, Hermes-to-P23 candidate-revision/evidence adapters, a versioned skill candidate lifecycle, ActionGateway-centered side-effect handling, and a Live2D viewer with versioned speech/embodiment state.
- The current causal learning scorecard states 57/100 overall learning engineering, 61% P23 symbolic core, 36% evidence-grounded learning maturity, and 30% project-wide lifelong-learning roadmap. These remain engineering estimates, not task-success measurements.
- The latest checked PR metadata did not provide a usable successful exact-head CI result. Three visible PR-triggered workflow records were reported as failures before any visible job steps; their log retrieval was unavailable. That does not prove a code failure, and it does not prove a pass. The tests and app/runtime typechecks for this head therefore remain UNVERIFIED.
- Host-owned executable adapters and dispatch-time filesystem checks are defense-in-depth, not an OS/container sandbox. Independent verifier and safety-scanner binaries/configuration still need deployment-level verification.
- The README, start-here charter, canonical backlog, scorecard, integration roadmap and current audit do not all expose the same newest checkpoint. Documentation entry points must be brought into sync so a new work session does not resume from WorkPass96/149/254 while the active change line is WorkPass264.

**Audit boundary:** this is a targeted strategic audit of the repository metadata, PR #55 changed-file inventory, primary navigation/backlog documents, and selected canonical memory, learning, verification and embodiment files. It is not a claim that every line, every branch, every upstream source or every dynamic execution path has been reviewed. Do not use it as evidence for a full-file audit or a successful build.

### 11.2 Final system objective — functional organism, not a collection of modules

The project is considered functionally mature only when one recoverable runtime can complete this observable loop:

**Perceive → interpret → retrieve relevant experience → maintain a bounded working state → form/revise goals → select a plan → request permission when required → act through the canonical gateway → observe the external postcondition → reconcile uncertain outcomes → store the event → learn only from eligible evidence → consolidate selectively → use the changed capability on a later unseen task.**

The loop must retain correlation IDs, event time, source/provenance, uncertainty, resource budget, cancellation identity and restart semantics at the boundaries where those fields matter. Every stage must have a known canonical owner and a behavioral acceptance case. If a mechanism cannot alter behavior in a measurable scenario, it is not promoted merely because it has a biologically inspired name.

Subjective consciousness remains UNKNOWN / UNRESOLVED. The engineering plan targets persistent self-modeling, adaptive behavior, reliable memory, self-correction and bounded agency; it does not declare that these observables prove subjective experience.

### 11.3 Work tracks — final function and acceptance criteria

#### Track A — Repository topology, reproducible builds and execution evidence (P0)

**Final function:** one named canonical source branch, a release path that can be reproduced from an immutable source/dependency state, and exact-head CI whose logs can diagnose failures.

**Mechanisms:** paginated ref inventory; per-branch head SHA and merge-base mapping; unique-commit/file/test comparison; draft-PR stack map; exact-head workflow status; clean dependency installation; runtime/app typecheck and production build; test-runner reachability map; artifact hashes and rollback instructions.

**Done when:** branch decisions are recorded for every discovered workpass family; the selected source branch is explicit; its tests run with accessible logs on the exact SHA; a clean-room build can reproduce the package; the release path and main branch relationship are documented. No automatic rewrite or mass-merge of unrelated history.

**Immediate observation:** main is a release/report line with no common ancestor reported against the active source branch. Keep main unchanged until the repository owner chooses a documented publication model. Continue code work on the current PR/source stack.

#### Track B — Language, perception and local model operation (P0/P1)

**Final function:** a user request travels through the real application and runtime to the selected language backend; the response identifies the backend actually used and reports provider failures truthfully.

**Mechanisms:** canonical provider policy; local-first llama.cpp adapter where configured; bounded prompts/outputs; request deadlines and cancellation; sanitized remote-provider boundary; separate provider-unavailable versus valid fallback states; correlation across request, memory retrieval and response.

**Done when:** clean-start and live inference work on the target Dell G3 configuration; actual model/revision/quantization/context/GPU layers are recorded; cold/warm latency, memory and error behavior are measured; HTTP-level tests cover success, 503, timeout, malformed response, cancellation, cooldown, fallback identity and recovery. A fake provider validates routing but is not evidence of language quality.

#### Track C — Canonical memory, autobiographical continuity and retrieval quality (P0/P1)

**Final function:** the organism remembers events, facts, procedures, relationships, user preferences and identity-relevant state with time, provenance, revision and contradiction semantics; the system can answer current versus historical queries and can use memory to select correct later actions.

**Mechanisms:** retain MemoryOS2 as the sole writable memory owner; preserve event-time and valid-time separately; explicit supersedes/revision lineage; confidence and source lineage; conflict quarantine/resolution; privacy-aware access; selective forgetting; bounded indexing/residency; task-aware episodic consolidation; separate evaluation-only retrieval experiments.

**Done when:** an independent RU/EN holdout tests facts, historical/current values, superseded details, conflicting sources, unknown answers, recall under interference and memory-grounded tool parameters. Compare BM25/lexical baseline, current retrieval and a candidate on the same corpus and same budget. Report Recall@k, MRR/nDCG as appropriate, stale-memory error, memory-grounded task success, false write/missed write, latency and bytes. Retain per-case results and uncertainty intervals. The recorded recallDelta=0 is a promotion blocker until a sound independent experiment changes that evidence.

**Anti-pattern:** do not call the 48-dimensional legacy hash projection a semantic embedding; do not create a second memory store just to add graph/vector features.

#### Track D — Learning, replay, skill revision and evidence governance (P0/P1)

**Final function:** verified experience changes a future policy/skill in a transferable and reversible way; a generated candidate cannot promote itself.

**Mechanisms:** one P23 learning owner; Hermes as a source of repair/revision proposals rather than a separate authority; task/context-diverse bounded replay; outcome salience, novelty and goal relevance as sampling signals only; normalized/deduplicated causal event intake; exact task/seed/manifest/environment/run binding; separate validation and untouched holdout; signed shadow evidence; externally controlled approval; durable activation, restart validation and rollback.

**Done when:** on a fixed task manifest, compare no-learning, recent replay, diverse/novelty replay and candidate revision using the same budget and paired seeds. Include wrong-feedback, corrupted evidence, task leakage, duplicate delivery, process restart, skill regression, reversal, interference, forward transfer, backward transfer and delayed retention. A candidate is promoted only under a predeclared lower-confidence-bound/minimum-gain rule, no critical task-family regression, valid evidence provenance and a working rollback path. If there is no uplift, record the negative result and keep the old policy.

**Immediate observation:** the source contains extensive evaluator, ledger, registry and promotion machinery, but production sandbox authorities and exact-head tests remain unconfirmed. Implementation coverage must not be substituted for an observed learning gain.

#### Track E — Goals, planning, metacognition and bounded autonomous action (P0/P1)

**Final function:** the organism can select a goal, form a bounded plan, decide when to act/search/verify/ask/stop, execute approved effects, inspect the resulting world state and revise its next step.

**Mechanisms:** canonical OrganismRuntime/OrganismCore and ActionGateway; preconditions/postconditions; capability-based permissions; risk/time/cost ceilings; idempotency keys; cancellation propagation; explicit pending/succeeded/contradicted/unknown/timed-out/cancelled states; independent outcome verification; delayed-evidence reconciliation; evidence debt and calibrated uncertainty.

**Done when:** real side-effect tests cover approval, denial, duplicate retry, lost ACK, ambiguous outcome, external contradiction, timeout, cancellation and process death at each transition. Restart reconciliation proves no duplicate side effects and does not grant learning credit for ACK-only or forged evidence. Every relevant UI/API/tool entry point must follow the same gateway, and the call graph must show no bypass around the final policy/evidence boundary.

**Immediate observation:** file-level controls exist, but an actual OS/container sandbox and external independent verifier/safety scanner are deployment requirements, not satisfied by path checks alone.

#### Track F — Identity, self-model, affect and social continuity (P1)

**Final function:** stable preferences, commitments, goals, known abilities, unresolved beliefs and autobiographical context persist across sessions and model/provider changes; the organism can correct its own prior beliefs without rewriting history.

**Mechanisms:** versioned self-model entries tied to memory provenance; separation of observed facts, user-stated preferences, inferences and hypotheses; temporal revisions; calibrated uncertainty; explicit conflict handling; functional affect/need/goal signals that modulate attention and replay without rewriting outcome truth.

**Done when:** longitudinal held-out scenarios test preference continuity, corrected facts, contradictions, capability changes, forgotten/outdated preferences, provider changes and restart recovery. Ablations show whether affect/goal signals improve task choice or memory use at fixed resource cost. An emotion label or self-report alone never establishes an internal biological state or consciousness.

#### Track G — Live2D, legacy avatar, speech and UI (P1/P2)

**Final function:** avatar expression, gaze, motion, speaking state, interruption and reconnect follow the runtime's real state; the interface exposes capabilities and errors instead of displaying a decorative simulation.

**Mechanisms:** keep the current Live2D viewer and useful Legacy sprite/avatar layer; use one versioned embodiment-intent envelope and monotonic audio clock; reject stale speech and sprite events; avoid unnecessary expression resets and per-frame canvas resize; handle blocked storage and invalid profiles; preserve local version-pinned assets and the genuine fallback path.

**Done when:** production browser tests exercise real assets, iframe recreation, multiple speech utterances, rapid expression/outfit changes, stale callbacks, visibility changes, interrupt/cancel/reconnect and error fallback. Separately verify Android/Termux audio/TTS and actual audio-to-mouth timing on a physical target. VM/source tests do not count as physical device E2E.

#### Track H — Persistence, recovery, security, privacy and source provenance (P0/P1)

**Final function:** state, evidence and active skills survive restart without corrupting identity, duplicating effects or promoting tampered candidates; sensitive user data and credentials remain within explicit boundaries.

**Mechanisms:** schema-aware atomic state mutation; snapshots and restore validation; immutable/digested event/evaluation artifacts; signed evidence and external key authority; least-privilege executors; allow-listed environment; private scratch directories; cancellation of process groups; bounded logs and redaction; SBOM, dependency lock and asset/source hash inventory; license and attribution provenance.

**Done when:** corruption/interrupted-write/migration/backup/restore/rollback tests pass; secret scans and data-flow review cover prompts, embeddings, remote providers, logs and artifacts; dependency/license/asset inventories are generated from the live source commit; all source-derived integrations have exact upstream revision and compatible license decisions.

#### Track I — Resource and target-device engineering (P1/P2)

**Final function:** useful behavior remains responsive and predictable within declared VRAM/RAM/CPU, storage, battery, thermal, latency and offline limits.

**Mechanisms:** profile-aware admission control; bounded context/replay/cache; deadline-aware queues; graceful model fallback; cancellation/backpressure; memory residency and embedding budgets; quantization/device profiles; restart/soak telemetry.

**Done when:** measure on the Dell G3 / GTX 1650 4 GB VRAM and separately on the specified Android target. Record model and asset hashes, quantization, runtime version, RAM/VRAM peaks, CPU/GPU use, cold/warm p50/p95, thermal/battery trend, timeout rate and behavior under memory pressure. Never extrapolate Android results from laptop results.

#### Track J — Scientific mapping and upstream mechanism tournament (continuous; never blocks concrete fixes)

**Final function:** neuroscience, cognitive science, control theory and upstream open-source projects generate specific falsifiable hypotheses for the existing owners, not anatomical renaming or blind copying.

**Mechanisms:** keep a research-intake ledger with source URL/revision/date/license; extract one mechanism and its failure mode; map it to one canonical owner; compare against a simple baseline and ablations at equal resource budget; record promotion or rejection.

**Done when:** every adopted candidate has an exact source revision, license/provenance review, anticipated benefit/cost, contract boundary, behavioral regression, paired baseline and result. Benchmark data must not leak into tuning. Research-only work stays isolated until measured evidence supports promotion.

#### Track K — Consciousness and brain-inspired organization (research-only)

**Final function:** investigate theories of integration, memory, attention, prediction and action while keeping the claims separate from software features.

**Mechanisms:** compare functional requirements inspired by working memory/executive control, episodic consolidation, predictive processing, multi-scale dynamics, recurrent coordination and embodied feedback; use anatomical/connectomic data as constraints for hypotheses where justified, not direct blueprints for code.

**Done when:** each proposed mechanism predicts a falsifiable behavioral result and survives ablation. Use terms such as “memory system,” “self-model” or “attention controller” as engineering descriptions. Subjective experience remains UNKNOWN / UNRESOLVED unless defensible independent scientific criteria and evidence exist.

### 11.4 Upstream/benchmark refresh to add to the source-intake queue

These are newly identified research targets, not claims that NK1 already contains their code, data or license approvals:

- **AMA-Bench (ICML 2026 / PMLR):** long-horizon agent-memory evaluation over real/synthetic trajectories. Use it to expand memory tests from conversation QA to state/action/observation history. https://proceedings.mlr.press/v306/zhao26bs.html
- **Mem2ActBench (ACL 2026):** checks whether remembered preferences and state correctly ground later tool selection and action parameters, not just fact recall. https://aclanthology.org/2026.acl-long.370/
- **Memora / Forgetting-Aware Memory Accuracy (ACL 2026 Findings):** evaluates remembering, reasoning, recommending and penalties for reliance on obsolete facts. Use its principle to test correction and stale-memory failure. https://aclanthology.org/2026.findings-acl.1337/
- **MemoryArena (ICML 2026 / PMLR):** interdependent multi-session tasks in which earlier agent/environment interactions must inform later decisions. Use it to validate memory → action → outcome loops. https://proceedings.mlr.press/v306/he26am.html
- **International Brain Laboratory, “A brain-wide map of neural activity during complex behaviour” (Nature 2025):** standardized decision task and activity across hundreds of brain areas motivate measuring interactions across perception, feedback, choice and action rather than implementing isolated “brain regions.” The data are primarily from mice and must not be presented as a complete human connectome. https://www.nature.com/articles/s41586-025-09235-0
- **“Synaptic connectomics: status and prospects” (Nature Reviews Neuroscience 2025):** supports a multi-scale research track while reminding that connectome structure alone does not provide a complete functional implementation recipe. https://www.nature.com/articles/s41583-025-00957-8

**Intake rule:** verify the paper protocol, code/data repository, version and license before downloading or copying any dataset or implementation. Record these entries as RESEARCH QUEUE until reviewed. Prefer adapting evaluation protocols first; do not vendor an external memory database or agent runtime that would duplicate NK1's canonical owner.

### 11.5 Parallel execution plan — multiple streams, one integrated runtime

Run research/implementation work in parallel when the owners and touched files do not conflict. Merge the behavior into one canonical owner in a deliberate order; “parallel” must not become multiple competing sources of truth.

| Stream | First deliverable | Dependency / merge rule | Gate |
|---|---|---|---|
| A — branch & CI | full branch/PR/head inventory and actionable exact-head workflow | do not rewrite main or merge unrelated ancestry | reproducible source ref + accessible logs |
| B — independent evaluation | real host sandbox, independent verifier/scanner and signed evidence path | only P23 owns lifecycle/promotion | end-to-end matched evaluation and rollback |
| C — memory quality | frozen RU/EN holdout and baseline/candidate harness | MemoryOS2 remains sole writable owner | independent retrieval and action-grounding results |
| D — action integrity | restart/lost-ACK/postcondition trace | all side effects through ActionGateway | no duplicate effect and no unverified credit |
| E — embodiment | browser/Live2D/speech regression and device-run guide | no cognitive state owner in UI | actual browser and device E2E |
| F — source/research intake | branch-exclusive diff decisions and paper/repository register | record source/license/provenance; no blind cherry-picks | measured improvement or explicit rejection |

### 11.6 Eight-pass horizon

1. **Pass 1 — establish trustworthy baseline.** Refresh live head, PR stack, all branch pages and Actions; classify infrastructure failures versus code failures; synchronize README/start-here/backlog/scorecard. This is a gate, not a substitute for implementation.
2. **Pass 2 — close the trusted execution authority.** Provision the actual sandbox launcher and independently controlled verifier and safety scanner; configure fail-closed production composition; exercise cancellation and executable/directory replacement.
3. **Pass 3 — finish evidence-to-promotion lifecycle.** Run matched baseline/candidate tasks with fixed manifest, validation/holdout, seeds and budgets; link verified receipts to shadow runs; prove signed approval, durable activation, restart and rollback.
4. **Pass 4 — memory quality tournament.** Freeze RU/EN task sets; compare current MemoryOS2 retrieval against BM25 and one candidate; include historical/current facts, forgetting, conflicts and memory-grounded action parameters; retain negative results.
5. **Pass 5 — consolidate replay and causal intake.** Keep one normalized event identity, provenance chain, replay admission and skill owner; compare recent/diverse/multi-timescale strategies under equal storage and sampling budgets.
6. **Pass 6 — prove real-model capability and resource limits.** Execute local llama.cpp through the actual UI/runtime, with exact model identity, timeout/cancellation and hardware traces.
7. **Pass 7 — connect the actual embodiment.** Browser plus physical Android/Termux tests for speech clock, Live2D, interrupt/cancel, reconnect, asset loading and visible runtime state.
8. **Pass 8 — release-hardening.** 24–72-hour soak, fault injection, clean-room install, migration/backup/restore/rollback, dependency/SBOM/license/asset provenance and a release decision from measured evidence.

Some work can proceed concurrently in Passes 1–5 (especially independent source inventory, memory benchmark design and UI test harness preparation). A failed prerequisite must block only dependent deployment/promotion, not unrelated useful coding.

### 11.7 Progress accounting — report percentages without manufacturing completion

Maintain four separate measures per track:

1. **Implementation coverage:** fraction of explicitly scoped behaviors with an owner and source path.
2. **Integration coverage:** fraction exercised through the real production call path instead of isolated adapters or source-shaped test doubles.
3. **Verification coverage:** fraction with a successful run on the exact current SHA and accessible output.
4. **Functional efficacy:** benchmark deltas on untouched cases/tasks, paired seeds, confidence intervals and stated resource cost.

A test file written but never executed can raise neither verification coverage nor efficacy. A passing synthetic fixture raises only the corresponding bounded verification measure. A paper link or new module does not increase implementation or efficacy. Record the exact denominator and evidence artifact for every percentage.

Do not publish a new aggregate “overall project completion” until the scoped behavior inventory and weights have been reconciled on the current tree. The old master-strategy overall readiness value and the P23 57/100 score are different triage estimates and must not be averaged or presented as one current project percentage.

### 11.8 Branch-goal matrix and disposition rule

- **main:** keep as release/report/archive publication line until a repository topology decision is approved. Do not try to merge the source stack into it while GitHub reports no common ancestor.
- **workpass70-source:** retain as the original source-tree baseline and comparison anchor; it is not a guarantee of the newest implementation.
- **workpass206-runtime-evaluator-wiring / PR #55:** current integration candidate for evaluator hardening, evidence integrity, causal replay and avatar fixes. Keep draft/unmerged until the sandbox, exact-head CI and deployment-shaped evidence gates pass.
- **workpass203-independent-candidate-evaluator and PR #54:** reference point for independent paired candidate evaluation; compare unique commits before consolidation.
- **workpass194–202 family:** source line for verified replay, goal/affect salience and skill-transfer constraints; integrate only into the canonical replay/learning owner.
- **workpass150–172 Hermes family:** revision proposal, repair observation and compound-skill bridge; Hermes proposes, P23 owns evidence, evaluation, staging and promotion.
- **workpass135 durable shadow-run registry and workpass116–124 learning evidence/lifecycle family:** preserve trusted-run identity, statistics, holdout boundaries and authenticated lifecycle; do not create a second run registry or promotion authority.
- **workpass79 cognitive-rebuild / workpass79 learning-input-integrity and workpass71 learning-integrity/eval families:** compare unique code and tests for cognitive contracts, event validation and paired/holdout protocol; port specific useful protections into canonical owners rather than merge entire historical implementations blindly.
- **workpass86–93 replay/drift/Hermes reflection family:** use as historical design/evidence points for replay, transfer, drift and reflection gates, not as parallel production engines.
- **workpass94-avatar-voice-live2d-audit:** retain for traceability. The checked audit found only documentation-only exclusive commits; its useful findings had already motivated fixes on the active line. Do not delete/archive until a complete branch inventory and asset/call-path check confirms there is no unique live material.
- **All remaining workpass branches:** classify by exact head, merge-base, unique commits, unique files/tests, active callers and decision (port / preserve as reference / archive reversibly). Branch age, name and commit count are not enough to delete or merge.

### 11.9 Definition of done for the whole organism

Release approval is a conjunction of gates, not a mean score. At minimum:

- Reproducible clean build and accessible exact-head CI.
- Real local model inference through the app/runtime with truthful backend attribution.
- Independent memory retrieval and memory-grounded action results with no leakage and no stale-fact regression.
- Held-out learning transfer and retention with no-learning/wrong-feedback controls.
- Real external-action postconditions, idempotency, cancellation and restart reconciliation.
- Verified evaluator/sandbox/verifier/scanner deployment and authenticated skill promotion/rollback.
- Real browser/Live2D/speech and Android/Termux E2E.
- Target-device latency, RAM/VRAM, thermal and soak measurements.
- Complete source/license/dependency/asset provenance review plus backup, restore and rollback proof.
- Claims about subjective consciousness remain explicitly unresolved unless separately justified by scientific evidence.

**Next code-first work after these docs:** unblock actionable exact-head CI while implementing the real sandbox authority and preparing the frozen memory benchmark in parallel. Do not spend the next pass generating more planning documents or test inventories without correcting the deployment/verification bottlenecks described above.

