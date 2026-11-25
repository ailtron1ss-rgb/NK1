# Взаимодействие с интерфейсом и пользователем — WorkPass 24 Nov 2026

## Назначение

Этот проход укрепляет прикладную оболочку NeuroCore/NK1: пользовательский ввод, чат, достоверное отображение канонического состояния, навигацию, голосовые настройки и переключение воплощения. Он не добавляет второго владельца памяти, мотивации, эмоций или решений.

## Архитектурный контур

1. `app/src/routes/index.tsx` выбирает пользовательский раздел и связывает главную страницу с компонентами.
2. `app/src/organism/store.ts` владеет только состоянием UI: снимком последнего подтверждённого runtime, транспортным статусом, состоянием чата, навигацией и локальными предпочтениями отображения.
3. `app/src/organism/snapshotSync.ts` не допускает применения устаревших ответов UI-snapshot.
4. `app/src/neuro-kurisu/api.ts` остаётся единственным транспортным шлюзом frontend → runtime.
5. `MindHud`, `MotivationPanel`, `AvatarStage` и `ChatPanel` являются read-only/interaction projections. Они не создают канонические когнитивные значения.

## Изменённое поведение

### Канонический снимок и соединение

- В UI раздельно показываются connecting / connected / degraded / disconnected.
- Последний успешный снимок сохраняется при потере связи; frontend не заменяет его фиктивными нулевыми данными.
- Снимок принимается только от последнего начатого запроса. Для одной версии backend отклоняются ответы с более старым timestamp или регрессировавшим tick при равном timestamp.
- Более новый timestamp допускает меньший tick после перезапуска runtime.
- Ошибка старого запроса не может перевести уже восстановленное соединение в degraded.
- Деградация языкового провайдера отделена от сетевого состояния: UI может быть connected, одновременно честно показывая language fallback.

### Чат и доставка

- Черновик восстанавливается при неудачной отправке, если пользователь не начал вводить новый текст.
- Новый текст, введённый во время ожидающего запроса, не перезаписывается восстановлением старого черновика.
- У пользовательских реплик есть локальные состояния sending / sent / rejected / unknown.
- 4xx and typed owner-decline outcomes are marked rejected; network/server failures without a confirmed outcome remain unknown.
- Повторная отправка не запускается автоматически: запрос мог быть обработан сервером до потери ответа.
- История локального чата сохраняется в прежнем ограниченном browser cache; reset очищает только UI-историю, а не каноническую память организма.

### Голосовой ввод пользователя

- Интерфейс использует существующий `POST /api/organism/voice/listen`, а не браузерную имитацию микрофона.
- Каждый запуск проходит через существующий ActionGateway microphone-input approval challenge и ActionApprovalCenter.
- Полученный transcript вставляется в поле сообщения как черновик; он не отправляется автоматически.
- При остановке интерфейс вызывает `voice/interrupt` и проверяет текущее состояние через `voice/status`.
- Если runtime не подтвердил завершение capture, UI удерживает состояние stop-unconfirmed и блокирует новый запуск до повторной проверки.
- Неизвестный, пустой или недоступный ASR не превращается в пустой отправленный запрос.

### Разделы и параметры

- Добавлена нижняя навигация: Home / Memory / Motivation / Settings / More.
- Настройки аватара и browser TTS перешли в общий Zustand UI-store, поэтому экран Settings и AvatarStage работают с одним набором предпочтений.
- Backend voice capabilities (STT/TTS, listening/speaking) передаются в UI snapshot; browser speech и runtime voice показываются как разные пути.
- Начальные display preferences читаются после mount, чтобы пользовательский localStorage не вызывал SSR hydration mismatch.
- 2.5D показан как выключенный до подтверждения production artwork/rig/visual gates.
- 3D остаётся явно обозначенным Preview.
- HUD и Motivation скрывают стартовые boot defaults до первого подтверждённого canonical snapshot.

### Операционный центр и дополнительные инструменты

- Memory Explorer использует read-only MemoryOS2 inspector: current/all temporal scope, semantic preview, источник/происхождение записи, confidence/salience и экспорт сырого ответа.
- Runtime Health panel агрегирует независимые GET snapshots: status-lite, session continuity и action-recovery queue. Периодическое обновление останавливается на скрытой вкладке.
- Action recovery queue остаётся только диагностикой; UI не повторяет и не исполняет неопределённые внешние действия автоматически.
- Command Palette открывается по Ctrl/⌘+K и через видимую кнопку; поддерживает переход по разделам, обновление canonical snapshot и sleep/wake, когда runtime подключён.
- Chat composer поддерживает многострочный ввод (Enter отправляет, Shift+Enter добавляет строку), копирование ответов, локальный экспорт истории и подтверждение очистки только browser transcript.

## Проверочные модули

- `app/scripts/organism-snapshot-sync.test.mjs`: поздний ответ, timestamp regression, tick regression, перезапуск runtime, смена schema/version, malformed metadata.
- `app/scripts/chat-draft.test.mjs`: восстановление неудачного черновика и сохранение нового ввода.
- `app/scripts/chat-delivery.test.mjs`: sending/sent/rejected/unknown и неизменность посторонних реплик.
- `app/scripts/voice-interaction.test.mjs`: валидный transcript, пустой/неверный ответ, ограничение размера, runtime listening status.

## Границы этого прохода

- Browser SpeechSynthesis остаётся opt-in и запускается только на новых ответах; экран Settings управляет теми же предпочтениями, что AvatarStage.
- Voice capture получает отдельный requesting state: UI не пишет «слушает», пока runtime не подтвердил voice.listening=true; approval challenge остаётся отдельным.
- Многострочный чат и экспорт работают только с локальной browser history; это не является экспортом/изменением canonical MemoryOS2.
- Настоящий microphone/ASR session start/result/permissions не объявляется готовым этим UI-проходом. Наличие native provider process events само по себе не доказывает успешное воспроизведение аудио.
- Акустический playback receipt, Android device soak, GPU-presented frame, измеренный lip-sync и visual acceptance 3D-модели остаются отдельными проверками.
- 2.5D не активируется без принятого layered asset pack.
- Этот PR не меняет main, workpass70-source или опубликованный Release ZIP.

## Текущая проверка

Изолированные тесты чистых helper-модулей выполняются локально через Node 22 type stripping. Полный app script suite, semantic TypeScript typecheck и bundle build закреплены отдельным GitHub Actions workflow и должны считаться подтверждёнными только по результату на точном HEAD PR.
