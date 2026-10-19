# Нейро Курису — текущий статус реализации (WorkPass 50, 16.10.2026)

**База:** `Neuro_Kurisu_WORKPASS49_2026-10-16.zip` · **Runtime:** `35.71.0` · **Persisted schema:** `225` · **Статус:** implementation-workpass, не release-ready.

## Главное изменение — связная инициатива вместо набора отдельных подсказок

1. `P33PersonhoodCore` остаётся единственным владельцем graded interest profile. Профили получают evidence из активных целей, выбранных self-authored goals и подтверждённых learning/memory сводок; повтор одного evidence ID не изменяет интерес второй раз.
2. Явная реакция пользователя на доставленную инициативу теперь замыкается обратно в тот же профиль: положительная/вовлечённая реакция мягко повышает силу соответствующей области; отрицательная аккуратно снижает её и влияет только на связанный домен/тему, не стирая личность. Feedback provenance и stable ID сохраняются через сериализацию P33.
3. Выбор темы продолжает учитывать источник/свежесть/значимость/интерес/текущий appraisal affect, а `LanguageOrgan` получает короткий канонический контекст интереса и временного эмоционального выражения. Устойчивая личность не заменяется текущей эмоцией.
4. Исправлен таймер самостоятельного диалога: автономные когнитивные циклы не сбрасывают quiet-time как будто пришёл пользователь. Это убирало возможность дойти до собственной инициативы в некоторых циклах.

## Главный сквозной шаг — runtime/доставка/восстановление

Тест создаёт настоящий `OrganismRuntime` с включённым фоновым clock scheduler, задаёт реальные цели и воспоминания в состоянии организма и проводит полный control-flow через deterministic provider seam: scheduler → когнитивный цикл → provider request/prompt → staged `ready` message → UI ACK → явный ответ пользователя → feedback в профиль → durable flush → restart → отсутствие повторной доставки → новый автономный цикл. Отдельная проверка запускает фоновый scheduler с `autoRun` и подтверждает, что он сам доходит до provider seam и сохраняет инициативу после ACK.

**Важная граница:** это доказывает реальный runtime control-flow с детерминированным mock provider, а не настоящий длительный диалог с живой моделью. Живой провайдерный idle-run и production-браузер здесь не были запущены.

## Воплощение/голос

`AvatarStage` получил выключенный по умолчанию голосовой режим, выбор системного голоса, отмену текущей речи при переключении/новой реплике/размонтаже, языковой выбор и приближённое преобразование границ слов в форму рта. Live2D получает mouth open/form, expression intensity, gaze, tilt, gesture и motion token из фактического текста, appraisal emotion и thinking state. Word-boundary lipsync не является фонемно-точной синхронизацией; production build и реальный браузерный тест остаются открыты.

## Подтверждённые изменения

- P33 interest/feedback continuity — PASS, включая positive/negative feedback, idempotency и persistence.
- Runtime background clock → provider seam → ready/ACK/checkpoint/restart — PASS на детерминированном провайдере.
- Runtime TypeScript typecheck — PASS.
- Голосовая и Live2D интеграция написана; браузерное исполнение пока NOT RUN.
- Persisted state schema осталась 225; ни второй memory owner, ни второй persona owner не добавлялись.

## Что не закрыто

- Настоящий provider / длительный idle-run после установки приложения; quality, latency, stop/resume and actual external-model behavior.
- Production Vite build, interactive browser E2E и фактическая загрузка Legacy/Live2D viewer.
- Аудиобуфер/фонемный тайминг вместо приближённых word-boundary движений рта.
- Реальный action receipt → Reafference → temporal credit на настоящем устройстве/провайдере.
- Retrieval uplift: `recallDelta=0`, кандидат не продвигается.
- Target-host local inference, rollback/fault injection, полный review nested-source licences и soak.

**Weighted roadmap остаётся 78.0%.** Подробные 36 областей и критерии закрытия: `docs/ROADMAP_GAPS_TO_TARGET_WORKPASS50.md`.
