# N.E.K.O. voice transcript observer — интеграция NK1

## Назначение

Адаптирован только поздний observer-only путь N.E.K.O. — событие voice_transcript_observed. Старый арбитр voice_transcript, позволявший плагинам возвращать cancel_response или менять текущий диалог, в NK1 не переносится.

## Точка подключения

OrganismRuntime.listen() и OrganismRuntime.voiceTurn() вызывают NekoPluginVoiceTranscriptBridge.publishFinal() только после получения финального текста от существующего Termux STT. Частичные результаты, TTS-события и текст самой Макисэ в этот канал не попадают.

## Включение

По умолчанию мост отсутствует и публикация выключена. Хост должен явно создать NekoPluginVoiceTranscriptBridge и передать его через RuntimeConfig.nekoPluginVoiceTranscriptBridge.

Для создания требуются:

- enabled: true;
- непустой точный список targetPluginIds (до 32 плагинов);
- синхронная проверка согласия hasConsent({ sessionId, ... }), возвращающая строго true;
- синхронный non-blocking enqueueToPlugins(pluginIds, event), возвращающий строго true только если событие принято локальной очередью транспорта.

Пример host composition:

\`\`\`ts
const voiceObserver = new NekoPluginVoiceTranscriptBridge({
  enabled: true,
  targetPluginIds: ['study_companion'],
  hasConsent: ({ sessionId }) => consentStore.hasVoiceTranscriptConsent(sessionId),
  enqueueToPlugins: (pluginIds, event) => pluginEventQueue.enqueue(pluginIds, event),
});

const runtime = new OrganismRuntime({
  ...runtimeConfig,
  nekoPluginVoiceTranscriptBridge: voiceObserver,
  voiceTranscriptCharacterName: 'Kurisu',
});
\`\`\`

Сама NK1 не включает транспорт, не обнаруживает плагины и не задаёт согласие за пользователя. До предоставления host-owned publisher и реального consent store мост остаётся выключенным.

## Границы безопасности

- Публикуются только speakerRole: user и final: true.
- Каждый вызов заново проверяет согласие; отказ или исключение означают deny.
- Получатели фиксируются host allowlist, не берутся из входной расшифровки.
- Пейлоад ограничен по символам/байтам; неизвестные поля, accessor-объекты и Proxy отклоняются.
- В событии только transcript и минимальные session/turn/provider metadata. Аудио, произвольная metadata и сырые объекты ASR не пересылаются.
- Дополнительная запись текста в CognitiveEventFabric/Memory не создаётся; replay-кэш держит только digest.
- Callback транспорта синхронный: runtime не ожидает обработчики плагинов и не использует их ответы. Ошибка enqueue не влияет на STT, listen() или voiceTurn().

## Проверки

- tests/neko-plugin-voice-transcript-bridge.mjs — consent, allowlist, validation, size caps, idempotency/conflict, transport failure.
- tests/neko-plugin-voice-runtime-wiring.mjs — точка после STT final в listen() и voiceTurn(), пустой результат и изоляция ошибок observer.
