# NK1 Aspect 9 — Unified voice, speech and body synchronization

**Date:** 2026-10-30  
**Branch:** `work/nk1-aspect9-unified-voice-prosody-2026-10-30`  
**Base:** `workpass70-source` @ `ad564d1879028f00549be41ec5172a2f72e25897`

## Scope

Unify the browser speech path with organism affect/action context and the existing versioned embodiment timeline. This pass does not claim neural/acoustic phoneme alignment: browser Web Speech still exposes imperfect boundary events and the current viseme schedule remains grapheme-derived.

## Implemented in this pass

- Removed the parallel browser-only affect-to-prosody algorithm: browser TTS now adapts the canonical `VoiceEmbodiment.buildVoicePlan` used by the organism runtime.
- The browser adapter supplies a neutral body baseline where Android thermal/circadian telemetry is unavailable; the native runtime continues to use its measured body state. Shared language inference, breath-mode detection, tone, pause budget, pitch, rate, volume and emphasis now come from one planner.
- Tightened the canonical frustration/anger profile: slower rate, longer pause budget and reduced emphasis prevent negative high-arousal states from becoming more forceful.
- The viseme timeline is built using the exact selected speech rate, keeping mouth timing consistent with the utterance configuration.
- The same prosody emphasis is published through `EmbodimentIntentV1.voiceEmphasis`, so the Live2D viewer receives the utterance's delivery intent.
- Added focused tests for language inference, parameter bounds, affect regulation and cognitive-load modulation.

## Why it matters

The previous browser path used a fixed `rate=0.96` and a tiny pitch switch for joy/anger. The runtime voice planner already had richer state-aware prosody, but browser TTS previously carried a second, divergent mapping. The browser now consumes the canonical planner directly, so future improvements land once and are shared by browser and Termux delivery. The speech clock protocol remains unchanged.

## Remaining gates

- Run the app TypeScript check and focused tests on the branch; the focused regression now compares the browser adapter field-for-field with the canonical runtime planner.
- Verify browser speech boundary behaviour in Chromium and Android WebView; Web Speech support differs by platform.
- Verify native Termux TTS consumes the same bounded prosody plan and reports outcome separately from playback certainty.
- Add acoustic/phoneme timestamps for providers that expose them; do not present grapheme-derived visemes as phoneme ground truth.
- Add real audio capture comparison and lip-sync latency measurement.
- Validate Live2D, Original 2D and VRM/3D with the same speech event and cancellation token.

## Evidence boundary

Source changes and focused unit coverage are committed on this candidate branch. No hosted CI, Android device playback, acoustic quality, or Release ZIP refresh is claimed until independently verified.


## Follow-up — speech clock edge-case regressions

The focused timeline suite now also covers provider-boundary duplicate suppression, backward audio-time rejection, malformed boundary rejection, first-boundary origin refinement, the 16-anchor history cap and preservation of the newest calibration. Monotonic-clock tests exercise invalid anchors and late/malformed elapsed-time reports. These tests strengthen deterministic clock invariants; they do not substitute for Chromium/WebView audio capture or phoneme-level alignment.


## Follow-up — versioned speech lifecycle events

The browser speech adapter now records each utterance through SpeechLifecycleEventV1: queued, started, provider character boundary, ended, cancelled or error. Each event carries an utterance ID, event ID, provider, clock ID, monotonic timestamp and strictly increasing per-utterance sequence. The contract rejects duplicate/out-of-order sequence numbers, clock/provider changes, regressing character boundaries and any event after a terminal phase. Browser callbacks also retain the existing active-session identity guard, so late callbacks from a superseded utterance cannot mutate the current session.

The contract is provider-neutral and names a native TTS provider, but the native adapter has not yet been wired to emit these events. The browser boundary remains a provider-reported text offset, not a phoneme timestamp. No Android/Termux playback or acoustic sync validation is claimed.

## Дополнительная корректировка

- При проверке полного lifecycle cleanup обнаружен синтаксически некорректный `try/catch` в cleanup-функции speech-effect. Исправлен на корректную конструкцию `try { synth.cancel(); } catch { ... }`, чтобы best-effort cancellation не блокировала разбор модуля.
- Исправление внесено в исходник и CHANGELOG. Оно не считается подтверждением успешного TypeScript/build/test: эти проверки всё ещё необходимо выполнить в окружении проекта.


## Follow-up — устранение CI-регрессии отрицательного аффекта

- Hosted run `41019591325` выявил реальную регрессию в `negative high-arousal affect is de-escalated by the canonical plan`: anxiety rate не была ниже calm при `action=respond`, поскольку выбор `focused` тона перекрывал базовый warm-профиль, а прежняя поправка была недостаточной.
- Усилены отдельные поправки anxiety и frustration/anger в единственном каноническом `buildVoicePlan`; границы параметров остаются ограниченными существующим clamp.
- Это исправление внесено в исходник и CHANGELOG. Проверка на новом HEAD ещё не завершена; до успешного повторного CI регрессия считается исправленной на уровне кода, но не валидированной.

## Native TTS wiring — уточнённая граница

`EmbodimentRuntime.speak()` получает только итоговый `SpeechGatewayResult`, а `AndroidEmbodimentBridge.speakViaTermuxWithOutcome()` отслеживает процесс и operation ID. В текущем контракте нет канала доставки промежуточных provider events из ActionGateway обратно в avatar timeline. Кроме того, `termux-tts-speak` process close не является доказательством завершения Android audio playback. Поэтому native `started`/`ended`/`boundary` нельзя безопасно синтезировать из текущих данных; следующий шаг — добавить явный event sink через gateway и сохранять `playbackVerified=false` там, где подтверждения нет.


## Follow-up — повторная hosted CI-проверка после de-escalation fix

- На HEAD `94ea1495df92b24151b16a8d9967bfb103c8c8cd` получены шесть завершённых успешных GitHub Actions workflow, включая `NeuroCore core regression validation` (run `41026176662`).
- Таким образом, ранее упавший тест отрицательного высоко-arousal аффекта прошёл в новом запуске CI вместе с пятью другими связанными workflow. Это подтверждает соответствующие hosted regression gates на данном HEAD, но не заменяет локальный полный app build, браузерный E2E, Android/Termux audio capture или акустическое измерение lip-sync.
- Native event sink остаётся следующим архитектурным шагом: текущий gateway передаёт executor-у только execution identity/idempotency metadata и возвращает финальный результат. Промежуточные callback-события нельзя протащить через durable JSON receipt как обычные данные; для них нужен отдельный process-local event channel с жёсткой привязкой к execution/utterance ID и фильтрацией поздних событий.


## Native Termux provider event channel — implementation

Добавлен `NativeSpeechEventChannel` как process-local канал наблюдаемости провайдера. `AndroidEmbodimentBridge` публикует события с привязкой к operation ID:

- `command-requested` — NK1 передал команду в Termux bridge;
- `process-spawned` — Node подтвердил создание процесса;
- `process-exited` — процесс завершился, с exit code/signal и причиной;
- `process-error` — ошибка создания/работы процесса;
- `interrupt-requested` и `interrupt-unconfirmed` — запрос остановки процесса и отсутствие подтверждения playback state.

Каждое событие имеет собственный event ID, sequence внутри operation ID и monotonic timestamp. Подписчики изолированы: исключение наблюдателя не меняет результат TTS. Канал ограничивает память таблицы последовательностей 256 operation ID.

**Критически важно:** это не события воспроизведения и не `SpeechLifecycleEventV1`. Поле `playbackVerified` всегда равно `false`; `process-spawned` не означает, что Android TTS начал выдавать звук, а `process-exited` не означает, что звук закончился. Канал пока локален процессу runtime и ещё не доставляется в браузерный/Live2D viewer. Для полной синхронизации следующий шаг — явный host-to-UI transport с сохранением operation/utterance identity, а затем независимый playback/audio clock source; нельзя подменять их process events.

Добавлен тестовый набор `test:workpass628:native-speech-events` для порядка и изоляции operation ID, монотонного времени, безопасных подписчиков/unsubscribe и запрета трактовать process events как playback evidence. Hosted CI для новых коммитов ещё не подтверждён.


### Typecheck correction

Первый CI-прогон новой интеграции поймал несовместимость импорта `node:perf_hooks` с минимальными ambient declarations runtime. Источник исправлен: используется типизированный глобальный `performance.now()` (монотонные часы Node), без расширения shim и без новой зависимости. Исправление записано в CHANGELOG; повторная hosted-проверка нового HEAD ожидается.

### Порядок при reentrant-подписчиках

Дополнительно закрыт edge case: observer мог синхронно вызвать `publish()` во время доставки текущего события, из-за чего следующий подписчик мог увидеть вложенное событие раньше исходного. Канал теперь ставит вложенные публикации в FIFO-очередь; все подписчики получают одинаковый total order. Добавлен отдельный regression. CI-проверка этого follow-up ещё ожидается.


### Монотонность timestamp при регрессирующем источнике часов

- В NativeSpeechEventChannel добавлен per-operation last timestamp: новый timestamp равен max(clock sample, предыдущий timestamp этой операции). Это защищает event contract от тестового clock reset, некорректного injected clock и любых локальных регрессий измерителя.
- При bounded eviction удаляются и sequence, и timestamp state одного operation ID, поэтому диагностическая память остаётся ограниченной.
- Добавлен regression для clock samples 100 → 95 → 120 с ожидаемыми event timestamps 100 → 100 → 120.
- На текущем HEAD `92f2c6d1e57f61eb4f6110ec808d2f264e203308` новый hosted CI run пока не появился. Последняя проверенная Core Regression на предыдущем HEAD прошла; этот follow-up не объявляется CI-валидированным до нового запуска.
