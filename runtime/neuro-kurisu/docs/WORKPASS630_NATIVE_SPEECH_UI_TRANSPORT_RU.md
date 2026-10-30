# WorkPass630 — доставка событий нативной речи в UI

**Дата:** 30 октября 2026  
**Аспект:** 16 — голос, речь и синхронизация тела  
**Базовая ветка:** work/nk1-aspect9-unified-voice-prosody-2026-10-30

## Найденный разрыв

WorkPass628/629 уже создают:
- канонический план просодии для browser и Termux;
- browser SpeechLifecycleEventV1;
- NativeSpeechProviderEventV1 для команд и процессов Termux;
- runtime facade EmbodimentRuntime.subscribeNativeSpeechEvents();
- валидирующий NativeSpeechHostRouter.

Но router ещё не был подключён к HTTP-серверу и React/Live2D интерфейсу. Поэтому UI не мог показывать фактическую телеметрию процесса Termux.

## Реализация WorkPass630

- Добавлен SSE transport GET /api/organism/voice/events, который подписывается через connectNativeSpeechHostRouter.
- Введены лимит одновременных stream-подключений, ограниченная очередь backpressure, heartbeat и очистка подписки при закрытии клиента.
- Добавлен browser EventSource adapter с проверкой протокола, event/operation ID, sequence, monotonic timestamp и обязательного playbackVerified=false.
- AvatarStage отображает состояние нативного provider отдельно от browser TTS.
- Native process events не изменяют viseme, browser speech clock или фазу speaking.

## Эпистемическая граница

process-spawned означает только успешное создание процесса.  
process-exited означает только закрытие процесса.  
interrupt-requested означает только запрос на прерывание.

Ни одно из этих событий не доказывает, что аудио стало слышимым, началось или прекратилось. Для акустического lip-sync всё ещё нужен независимый playback/audio clock и фактический аудиосигнал/phoneme timing.

## Проверки

- Runtime SSE regression: открытие потока, фильтрация некорректных событий, порядок, cleanup, bounded backpressure, лимит подключений.
- App regression: EventSource payload validation, duplicate/stale rejection, connection state, unsubscribe, отсутствие ложного playback claim.
- Затем hosted CI на точном HEAD.

## Осталось после WorkPass630

- Подключить нативный Android TTS progress callback или независимый audio-output observer.
- Подключить реальный audio clock и акустические фонемы/висемы.
- Провести Android/Termux E2E и измерить задержку lip-sync.
- Устранить риск одновременной выдачи browser и native output, добавив явный provider arbitration.
- Только после device validation считать native playback частью полного голосового сценария.
