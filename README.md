# NeuroCore

Основной репозиторий проекта NeuroCore. Репозиторий хранит release-процессы и отчёты; полное дерево исходников текущей рабочей базы доступно в ветке `workpass70-source`.

## Актуальная сборка

- **Последний проверенный hotfix:** WorkPass70 Hotfix 1, 19 октября 2026.
- **Генеральное обновление архитектуры воплощения и анализа:** 31 октября 2026.
- [Мастер-план проекта: 10 этапов цифровой личности](docs/NK1_FINAL_MASTER_PLAN_2026-10-30_RU.md)
- [Трекер прогресса и статусы верификации](docs/PROJECT_PROGRESS_TRACKER_2026-10-30_RU.md)
- [Комплексный анализ системы, адаптация доноров и научный базис](docs/NK1_COMPREHENSIVE_SYSTEM_ANALYSIS_2026-10-31_RU.md)
- [Полный исходный архив в GitHub Releases](https://github.com/ailtron1ss-rgb/NK1/releases/tag/workpass70-hotfix1-2026-10-19)
- [Полное дерево исходников](https://github.com/ailtron1ss-rgb/NK1/tree/workpass70-source)

## Новые возможности и модернизации (31 октября 2026)

- **3D Аватар Макисэ Курису 1-в-1**:
  - Полный процедурный 3D-риг человекоподобного аватара (`app/src/components/avatar/KurisuAnime3DAvatar.ts`) с соблюдением пропорций Steins;Gate, характерных заколок X-формы, локонов и гардероба (белый лабораторный халат, повседневный кардиган, ночное худи, строгий костюм).
  - Вегетативная моторика: микроколебания дыхания, саккадический дрейф взгляда, спонтанное моргание.
  - Двусторонняя кинематика рук (IK): позы "рука у подбородка" (научное размышление), "скрещенные руки" (цундэрэ-защита), жест жестикуляции/объяснения теории.
  - Канал выражения эмоций: румянец (смущение), брови и веки (фокус, шок, радость открытия, теплота).
  - Поддержка внешних моделей: адаптер `vrmLoaderAdapter.ts` с кешированием в IndexedDB для загрузки VRM / GLB аватаров из интернета или локальных файлов.
  - Библиотека каноничных спрайтов Steins;Gate высокого разрешения в `app/public/sprites/kurisu/`.
- **Интеграция передовых технологий и адаптеров**:
  - Память и контекст: адаптеры Letta (многослойный контекст ядра и архив), Mem0 (эпизодический граф связей), HeXiS (гибридная память с консолидацией).
  - Обучение и адаптация: адаптеры CleanRL (PPO гомеостаза), Avalanche (anti-catastrophic forgetting), River (потоковая калибровка когнитивной нагрузки).
  - Физическое проектирование: OpenSCAD / glTF-Validator для аппаратных компонентов.
- **Научный базис**:
  - Complementary Learning Systems (CLS) гиппокамп-неокортекс.
  - Free Energy Principle & Active Inference (Карл Фристон) в моторно-аффективном контуре.
  - Воплощённое познание (Embodied Cognition) и предиктивное кодирование.

SHA-256 полного архива:

```text
9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb  Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip
```

## Исправления hotfix

- Графемная сегментация viseme timeline с сохранением UTF-16 offsets браузерного SpeechSynthesis.
- Корректная обработка combining marks, флагов, ZWJ emoji и последовательностей CR/LF/tab.
- Исправлена ошибка приоритета операторов в continuum-memory timescale score.
- Исправлены блокирующие ошибки UI typecheck и восстановлена успешная development-сборка приложения.

## Проверки

- Speech timeline: 11/11.
- App script regression suite: 229/229.
- App TypeScript check: PASS.
- App Vite development build: PASS.
- Runtime TypeScript check: PASS.
- Continuum timescale regression, speech interrupt gateway, Termux TTS concurrency, receipt reconciliation и organism smoke: PASS.

## Незакрытые release gates

Эта сборка — **implementation hotfix, не production-approved**. Не подтверждены production build вместе с миграцией БД, настоящий browser/Live2D E2E, синхронизация реального Android/Termux audio, независимый multi-seed retrieval uplift (текущий benchmark всё ещё показывает `recallDelta=0`), длительный soak и полный license review. Никаких выводов о субъективном сознании или общей интеллектуальной эффективности из этих тестов не делается.

## Стратегический мастер-план и трекер прогресса

- **Мастер-план (10 жизненно важных этапов):** [docs/NK1_FINAL_MASTER_PLAN_2026-10-30_RU.md](docs/NK1_FINAL_MASTER_PLAN_2026-10-30_RU.md)
- **Реестр статусов и отслеживание прогресса:** [docs/PROJECT_PROGRESS_TRACKER_2026-10-30_RU.md](docs/PROJECT_PROGRESS_TRACKER_2026-10-30_RU.md)
- **Протокол продвижения статусов:** `PLANNED` → `IMPLEMENTED` → `TESTED` → `INTEGRATED` → `MEASURED` → `RELEASED`
- **Проверка воспроизводимости релизов (Этап 1):** `bash scripts/verify-release-reproducibility.sh`

## Следующий этап

Следующий крупный проход должен сосредоточиться на независимой оценке retrieval/learning: paired seeds, неизменяемый holdout, task success, regret, calibration, forgetting, catastrophic failures и ресурсная стоимость. Ничего не продвигать автоматически без устойчивого улучшения на независимом наборе.
