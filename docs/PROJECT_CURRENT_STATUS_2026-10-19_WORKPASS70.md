# Текущий статус Neuro Kurisu — WorkPass 70 (19.10.2026)

**Каноническая база:** `Neuro_Kurisu_WORKPASS69_2026-10-19.zip`. **Рабочий проход:** WorkPass70. Runtime `35.90.0`, persisted schema `225`. Статус: `implementation-workpass`; релизные ворота открыты.

## Реальная кодовая работа

- Добавлен `EmbodimentIntent v1`: один typed/versioned envelope от AvatarStage к Live2D viewer для идентификатора речи, аудиочасов, фазы речи, визем, выражения лица, взгляда, позы/движения, priority и cancellation token.
- Добавлен RU/EN grapheme-viseme timeline с индексами `SpeechSynthesis` в UTF-16, единым монотонным аудиочасом для `audioTimeMs` и выборки визем; word-boundary `charIndex` переякоривает карту символов, а `elapsedTime` используется как дополнительная привязка без отката high-water mark.
- Viewer принимает единый контракт, отвергает старый `stateVersion` и откат `audioTimeMs` для текущего аудиочаса, проверяет токен отмены и закрывает рот после ended/cancelled/unknown.
- `AvatarStage` игнорирует поздние callbacks старого произнесения и повторно отправляет актуальный intent после готовности/пересоздания iframe.

## Проверки

- App script suite: 227/227 PASS.
- Фактический inline handler viewer: 9/9 protocol checks in isolated JS VM; это не настоящий браузерный render/audio E2E.

- Новые тесты таймлайна/контракта: 9/9 PASS.
- Строгая проверка TypeScript для нового helper: PASS.
- Runtime typecheck: PASS с доступным компилятором TypeScript из PATH.
- JavaScript встроенного viewer: `node --check` PASS.
- JSON schema: корректно разбирается.

## Ограничения

Это не доказательство идеальной синхронизации аудио и губ. Web Speech boundary events не дают PCM/phoneme ground truth, поэтому таймлайн приближённый. Реальный browser/Live2D playback E2E, измерение p95 offset, production Vite build и app typecheck требуют установленных app dependencies и запуска настоящего браузера; в данном проходе этого не было. Никакой тест не объявляет физическое Android TTS проверенным. Retrieval `recallDelta=0`; кандидат памяти остаётся `not-promoted`.

Официальный взвешенный score не меняется: **80,1%**. Тесты и добавленные файлы не используются как самостоятельное основание для роста оценки.
