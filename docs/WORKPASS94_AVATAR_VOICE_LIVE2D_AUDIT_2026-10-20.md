# WorkPass94 — сквозной аудит аватара, голоса и Live2D

**Дата:** 2026-10-20  
**Репозиторий:** [ailtron1ss-rgb/NK1](https://github.com/ailtron1ss-rgb/NK1)  
**Аудированная ветка / HEAD:** `workpass79-cognitive-rebuild` / `e09ec25ff5184af2d1051737b247dcbd490d1e79`  
**Ветка отчёта:** `workpass94-avatar-voice-live2d-audit`  
**Тип:** source-level audit + проверка наличия тестов/CI evidence. Не является подтверждением работы на реальном устройстве.

## Итог

**Статус: PARTIAL / RELEASE GATE OPEN.** Основной путь аватара и визуализатора реализован, модель и локальные runtime-ассеты присутствуют, имеются регрессионные тесты временной шкалы речи и проверки целостности модели. При этом полноценная сквозная проверка реального браузера, физического аудио и Android/Termux на текущем HEAD не подтверждена. Найдены конкретные риски синхронизации выражений и устойчивости Legacy fallback; UI браузерного голоса и серверный Android/Termux voice runtime остаются разными путями.

## 1. Границы и метод

Проверены актуальный Git tree (10 224 записи; API сообщил `truncated=false`), ветка/HEAD, основные UI-компоненты, iframe viewer, shared embodiment contract, модельные JSON-ссылки, asset manifest, voice API маршруты, Android/Termux bridge, относящиеся к теме тесты, package scripts, workflow triggers и последний GitHub Actions run на точном HEAD.

Ключевые источники:
- [AvatarStage.tsx](../app/src/components/AvatarStage.tsx)
- [embodimentTimeline.ts](../app/src/components/avatar/embodimentTimeline.ts)
- [Live2D viewer](../app/public/live2d/viewer.html)
- [LegacySpriteDeck.tsx](../app/src/legacy/avatar/LegacySpriteDeck.tsx)
- [EmbodimentIntent v1 schema](../contracts/embodiment-intent.v1.schema.json)
- [Canonical public asset manifest](../contracts/inventory/canonical-public-assets-workpass42.json)
- [Runtime voice API](../runtime/neuro-kurisu/src/server/server.mjs)
- [Android/Termux embodiment bridge](../runtime/neuro-kurisu/src/organism/body/AndroidEmbodimentBridge.ts)
- [Embodiment timeline tests](../app/scripts/embodiment-timeline.test.mjs)
- [Live2D asset integrity test](../runtime/neuro-kurisu/tests/live2d-integrity.mjs)
- [Speech interruption gateway test](../runtime/neuro-kurisu/tests/workpass69-speech-interruption-gateway.mjs)
- [WorkPass71 validation workflow](../.github/workflows/workpass71-validation.yml)
- [WorkPass79 cognitive regression workflow](../.github/workflows/workpass79-cognitive-regression.yml)

## 2. Сквозная архитектура, подтверждённая исходниками

### UI → AvatarStage → Live2D iframe

1. `app/src/routes/index.tsx` реально монтирует `AvatarStage` на главной странице.
2. `AvatarStage` читает канонический `OrganismSnapshot`: эмоцию, последний вариант действия, состояние размышления и последний ответ Курису.
3. Речь браузера включается пользователем явно; существующая история чата не озвучивается при первом mount.
4. Для нового ответа Курису создаётся `SpeechSynthesisUtterance`, выбирается сохранённый голос или голос языка, создаётся grapheme/viseme timeline.
5. Состояние публикуется в iframe одним версионированным сообщением `kurisu_embodiment_intent` (protocol v1): speech identity, clock, phase, mouth pose, expression, gaze, head/body motion.
6. Viewer проверяет origin и источник сообщения, версию/порядок состояния, речевой clock и cancellation token; затем применяет параметры модели.
7. Viewer загружает локальные Pixi/Cubism vendor bundles и модель, отправляет `live2d_ready`; ошибка запуска отправляет `live2d_error`. UI показывает понятный fallback и предлагает Legacy.

### Модель и ресурсы

- Ветка содержит локальные vendor bundles Pixi/Cubism, основной `Kurisu.model3.json`, мобильный `Kurisu-mobile.model3.json`, текстуры, physics, CDI, expressions и motions.
- Canonical public assets описаны в SHA-256/size manifest и синхронизируются в app public перед Vite dev/build. Скрипт синхронизации запрещает незаметно перезаписывать изменённые целевые файлы.
- Model JSON перечисляет локальные относительные ссылки на Moc, текстуры, physics, display info, expressions и motions.
- Отдельный Legacy sprite path существует и доступен через переключатель.

### Голосовой путь — два разных механизма

**Браузерный голос в AvatarStage:** `window.speechSynthesis` / `SpeechSynthesisUtterance`. Он озвучивает новые ответы в UI и привязывает mouth animation к приблизительной временной шкале текста и событиям `onboundary`.

**Runtime voice:** сервер предоставляет `/api/organism/voice/speak`, `listen`, `status`, `interrupt`, `turn`. Runtime строит voice plan и использует Android/Termux TTS/STT, а физические speech/interrupt операции проходят через ActionGateway. Для микрофонного ввода и серверного speech output применяются approval checks. Прерывание корректно обозначается как запрос остановки, но не как независимое доказательство тишины (`playbackVerified:false`).

Эти механизмы нельзя считать единым сквозным voice pipeline: AvatarStage управляет браузерным TTS, а runtime API — отдельным Android/Termux каналом.

## 3. Находки

### F-01 — Выражение Live2D может переинициализироваться на каждом кадре речи
**Приоритет: P1 · Статус: SOURCE-LEVEL DEFECT INDICATOR**

В `app/public/live2d/viewer.html` каждый принятый `kurisu_embodiment_intent` вызывает `applyEmbodiment(intent)`, а та без сравнения с предыдущим выражением вызывает `applyExpression(...)`. В то же время AvatarStage обновляет mouth pose примерно каждые 40 ms во время речи и публикует новое состояние. Следовательно, одно и то же expression может повторно запускаться на каждом lip-sync update; это способно сбрасывать/прерывать expression transition и создаёт лишнюю работу. Реальное визуальное проявление ещё не измерено в браузере.

**Исправление:** кэшировать последнюю применённую expression и вызывать `model.expression` только при смене expression/нужной интенсивности; отдельно проверить, что mouth-only updates не перезапускают expression или motion. Добавить тест на повторные сообщения с неизменной эмоцией.

### F-02 — UI TTS и Android/Termux voice runtime не сведены в один управляющий путь
**Приоритет: P1 · Статус: ARCHITECTURE GAP**

AvatarStage непосредственно использует browser SpeechSynthesis. При этом `app/src/neuro-kurisu/api.ts` экспортирует методы `voiceSpeak`, `voiceListen`, `voiceTurn`, `voiceStatus`, `voiceInterrupt`, а сервер имеет соответствующие маршруты с gateway/approval semantics. В проверенном UI пути переключатель голоса не управляет серверным voice runtime; UI microphone/listen path в AvatarStage отсутствует. Поэтому браузерное «Голос: вкл.» не означает, что Android/Termux TTS/STT доступен, и server voice status не является источником статуса browser speech.

**Решение:** выбрать и документировать один из вариантов: (а) явно оставить браузерный TTS как отдельный UI provider, а Android/Termux как отдельный runtime capability с отдельными контролами/статусом; либо (б) интегрировать AvatarStage в единый provider/controller API с общей корреляцией speechEventId, interrupt и визуального таймлайна. Не создавать второй источник истины для статуса речи.

### F-03 — Legacy fallback не выдерживает запрет/сбой localStorage
**Приоритет: P2 · Статус: SOURCE-LEVEL DEFECT**

В `LegacySpriteDeck.tsx` чтение `window.localStorage.getItem` в initializer и запись в effect не обёрнуты в try/catch. В отличие от AvatarStage, где storage errors обработаны, Legacy path может выбросить исключение в среде с заблокированным storage. Это особенно неприятно, потому что Legacy является резервным UI при недоступности Live2D.

**Исправление:** безопасные read/write helpers с fallback на `lab_coat` и session-only state; regression с mock localStorage, выбрасывающим SecurityError.

### F-04 — Legacy «lip sync» является индикатором, а не артикуляцией
**Приоритет: P2 · Статус: FUNCTIONAL LIMITATION**

LegacySpriteDeck при `speaking` рисует пульсирующий эллипс в нижней части спрайта; он не меняет форму рта по viseme. Это допустимый визуальный fallback, но не эквивалент Live2D lip-sync. UI должен не представлять его как полноценную синхронизацию губ.

### F-05 — Viseme timeline — приближение, не синхронизация по акустике
**Приоритет: P2 · Статус: DOCUMENTED LIMITATION**

`embodimentTimeline.ts` строит форму рта по grapheme/символьным весам и привязывает временную шкалу к browser SpeechSynthesis boundary/elapsedTime. Сам модуль прямо отмечает, что Web Speech API не предоставляет PCM или фонемные границы. В viewer реально применяются главным образом `ParamMouthOpenY` и `ParamMouthForm`; отдельная строка `viseme` не превращается в отдельный артикуляционный параметр модели. Это разумная эвристика, но нельзя считать phoneme-level lip-sync.

**Следующий уровень:** записывать реальный playback clock/PCM, использовать доступные акустические/фонемные события или согласованный provider timeline; измерять offset и jitter на RU/EN, interruption, background/visibility и mobile.

### F-06 — На активном HEAD нет подтверждённой CI-проверки UI/Live2D
**Приоритет: P1 · Статус: VALIDATION GAP**

На точном HEAD `e09ec25ff5184af2d1051737b247dcbd490d1e79` GitHub Actions run [39384864459](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39384864459) завершился success. Но это workflow `workpass79-cognitive-regression.yml`, который проверяет cognitive/runtime регрессии и не запускает app UI test suite, embodiment timeline test или browser/Live2D E2E.

UI-тесты существуют: `app/scripts/embodiment-timeline.test.mjs` проверяет grapheme offsets, monotonic clock, cancellation/stale messages и выполняет VM-тест обработчика viewer. `workpass71-validation.yml` запускает app script tests, typecheck, development build и `test:embodiment-timeline`, а также speech gateway/concurrency tests. Однако этот workflow настроен на push в `workpass70-source` и `workflow_dispatch`, без pull_request trigger; поэтому успешный WorkPass79 run не доказывает, что эти проверки были запущены на текущем HEAD.

**Исправление процесса:** добавить UI/asset/voice regression workflow на push и pull_request для рабочей ветки (или общего CI), затем проверить точный SHA run. Отдельно добавить настоящий browser E2E, потому что VM-проверка не рендерит Cubism модель и не воспроизводит физический звук.

### F-07 — Полная реальная сквозная проверка пока не закрыта
**Приоритет: P1 · Статус: UNRESOLVED / RELEASE GATE OPEN**

Не подтверждены этим аудитом: реальный production build вместе с asset hydration и DB migration, Playwright/browser запуск с фактически загруженной моделью, playback audio + mouth timing, speech interruption и iframe remount/visibility, Android/Termux TTS/STT на устройстве, поведение при отсутствии permission/provider, длительный soak и целевое mobile/desktop performance. README и WorkPass76 register также перечисляют browser/Live2D/TTS E2E и Android/Termux synchronization как незакрытые release gates.

Это не означает, что все эти сценарии сломаны; означает, что adequate evidence отсутствует.

## 4. Проверочная матрица

| Контур | Что подтверждено исходниками/тестами | Что не доказано |
|---|---|---|
| Mount UI | AvatarStage импортирован и смонтирован в главном route | Runtime browser render на актуальном HEAD |
| Live2D viewer | Локальные vendor scripts, boot path, model loading, ready/error messages | Фактический успешный запуск Cubism в браузере |
| Model assets | Model JSON, motion/expression refs, manifest hashes/sizes | Фактическое успешное чтение каждого asset в production bundle после hydration |
| Protocol | Versioned intent, origin/source checks, sequence/cancellation validation | E2E timing under real speech/visibility/remount |
| Browser TTS | Opt-in, voice selection, new-turn detection, cancel/error callbacks | Реальный звук, качество RU/EN, Android browser differences |
| Mouth animation | Grapheme timeline + monotonic clock tests | Acoustic/phoneme alignment, measured jitter |
| Legacy fallback | Real sprite deck and outfit catalog | Storage-denied behavior; true mouth animation |
| Android/Termux TTS | Capability detection, gateway dispatcher, keyed interruption and uncertain outcome handling in source/tests | Physical device playback and verified silence |
| STT/microphone | Server endpoint and approval gate exist | Visible UI flow and end-to-end transcription/chat loop |
| CI | Latest WorkPass79 cognitive workflow passed exact HEAD | App/Live2D/voice suite passed exact HEAD |
| Release | Existing release-gate docs explicitly acknowledge gaps | Production approval / device certification |

## 5. Приоритетный план закрытия

1. **P1 code fix:** suppress duplicate Live2D expression reapplication; regression with repeated mouth-only updates.
2. **P1 architecture decision:** define whether browser and Termux speech are independent providers or one canonical voice controller; expose truthful per-provider status.
3. **P1 CI:** run app typecheck, app script suite, asset integrity, embodiment timeline and runtime speech gateway tests on the audit HEAD.
4. **P1 browser E2E:** Playwright launch, verify `live2d_ready`, loaded model/canvas, expression transitions, mouth movement, new turn, interruption, viewer remount and visibility pause/resume; capture console/page errors.
5. **P1 audio E2E:** browser TTS on supported desktop/mobile browser; Android/Termux TTS/STT separately on actual target; record provider, permission, latency, cancellation result and whether silence was independently verified.
6. **P2 resilience:** wrap Legacy localStorage; test disabled storage, missing sprites, broken vendor/model references and iframe load failure.
7. **P2 quality:** measure RU/EN lip-sync offset/jitter and CPU/GPU/VRAM on target device; do not describe grapheme interpolation as phoneme synchronization.
8. Keep Legacy as a transparent fallback; do not delete historical assets or implementations until dependency/provenance and license checks are complete.

## 6. Evidence status and honesty boundary

- **OBSERVED:** repository branch/HEAD/tree and current workflow metadata were read from GitHub.
- **IMPLEMENTED:** UI/avatar/voice/model paths and the listed test sources exist.
- **CI-PROVEN (limited):** WorkPass79 cognitive regression workflow passed at exact HEAD; this does not cover the UI/Live2D/voice gates above.
- **SOURCE-LEVEL DEFECT:** Legacy localStorage exception path.
- **SOURCE-LEVEL DEFECT INDICATOR:** expression application is called for every accepted intent and can be retriggered by frequent mouth updates; verify visible impact in browser E2E.
- **UNKNOWN / UNRESOLVED:** real device playback, actual Live2D render, physical microphone path, production packaging and timing quality.

No repository code was changed as part of this audit. The audit artifacts are being committed on a separate audit branch; `main` and the existing draft PR are left untouched.
