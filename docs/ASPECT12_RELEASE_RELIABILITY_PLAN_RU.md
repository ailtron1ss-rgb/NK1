# NK1 — Аспект 12: производительность, надёжность, тестирование и выпуск

Дата начала: 2026-10-30. Рабочая ветка: `aspect12-release-reliability-2026-10-30`.

## Цель

Довести систему до воспроизводимого, измеряемого и безопасного выпуска. Аспект 12 отвечает не за наличие тестов как таковых, а за доказательство того, что конкретный исходный SHA собирается, проходит нужные регрессии, работает в браузере и на целевых устройствах, сохраняет данные при сбоях и выпускается в проверенный Release ZIP.

## Текущее состояние — фактическая исходная точка

- Репозиторий: `ailtron1ss-rgb/NK1`.
- Активная исходная линия для этого прохода: `work/nk1-autonomous-motor-control-2026-10-30`, HEAD `6d2c72df3d307d3819da8ac47cef81e268cd801c`.
- Node.js pin: `.nvmrc = 24`.
- Приложение и runtime имеют отдельные package manifests и lockfiles.
- Существуют release metadata, SBOM/provenance, source-hygiene, CI reliability и release-license readiness проверки.
- Последние доступные запуски на указанном HEAD показывали смешанное состояние: часть workflow уже завершилась успешно, часть оставалась queued/in progress. Это не доказывает прохождение всего набора.
- Последние релизные assets на момент начала работ датированы 19.10.2026. Их нельзя считать обновлёнными текущими исходниками.
- `contracts/RELEASE_LICENSE_REVIEW.json` остаётся pending. В worklist от 28.10 зафиксированы 135 незакрытых записей; это блокер распространения, а не повод автоматически одобрить лицензии.
- В `SUPER_VERSION.json` прямо перечислены непроверенные области: production build, реальный browser/Live2D playback, Android TTS, долгий soak, memory uplift, rollback и license review.

## Разделение доказательств

1. **Структурная проверка:** manifests, lockfiles, версии, исходная чистота, секреты, SBOM и метаданные.
2. **Unit/contract:** функции и инварианты отдельных модулей.
3. **Integration:** совместная работа приложения, runtime, базы, памяти, голоса и тела.
4. **Browser E2E:** реальная загрузка приложения, ошибки консоли, desktop/mobile viewport, маршруты, голос и аватар.
5. **Device E2E:** физический Android, аудиовыход, прерывание речи, восстановление, память и производительность.
6. **Soak/recovery:** длительная работа, перезапуск, backup/restore, утечки и деградация.
7. **Release proof:** exact source SHA, чистая сборка, безопасный ZIP, SBOM/provenance, SHA-256 и реально загруженный GitHub Release asset.
8. **Human clearance:** лицензии и права распространения подтверждаются человеком по конкретным хешам; автоматический сканер не является юридическим одобрением.

Нельзя подменять один уровень другим. Успешный unit-тест не доказывает E2E; успешный E2E не доказывает Android soak; commit не доказывает, что Release ZIP обновлён.

## План работ по аспектам

### 12.1. CI и воспроизводимость
- единый Node pin из `.nvmrc`;
- exact-SHA checks, без старых успешных запусков;
- отдельная классификация runner startup failure, test failure, timeout и cancellation;
- контроль lockfile drift;
- фиксированные версии actions и минимальные permissions;
- артефакты отчётов с SHA исходника.

### 12.2. Полная тестовая пирамида
- unit и contract tests;
- runtime smoke и persistence/restart tests;
- app/runtime typecheck;
- production build + DB migration на отдельной staging-базе;
- интеграционные тесты критических потоков;
- покрытие реальных исполняемых тестов, а не только упоминаний в workflow.

### 12.3. Browser E2E
- запуск Chromium на реальном runner;
- desktop и mobile viewport;
- login/initialization/chat;
- Live2D/2.5D/3D переключение и fallback;
- voice start/interrupt/resume;
- console/page errors, горизонтальный overflow;
- сбор screenshots, trace и JSON verdict;
- exact SHA в отчёте.

### 12.4. Производительность
Измерять, а не угадывать:
- cold start и warm start;
- route transition;
- frame time p50/p95/p99;
- dropped frames;
- JS heap и GPU resource trend;
- загрузку VRM/Live2D assets;
- input-to-motion latency;
- speech-to-mouth offset;
- memory retrieval latency;
- runtime tick latency;
- CPU, RAM, battery и thermal trend на Android.

Для каждой метрики хранить baseline, device/browser/runtime metadata и пороги. Не вводить произвольные бюджеты без исходных измерений.

### 12.5. Android и аппаратная совместимость
- физический Android, а не только эмулятор;
- установка чистой сборки;
- microphone/speaker/TTS permissions;
- синхронизация аудио и мимики;
- background/foreground transitions;
- screen rotation и low-memory recovery;
- offline/online transitions;
- минимум 60 минут первичного soak, затем 4–8 часов release soak;
- фиксация модели устройства, Android build и thermal state.

### 12.6. Надёжность данных
- backup перед миграцией;
- restore на чистое окружение;
- schema upgrade и downgrade/rollback policy;
- crash/restart во время записи;
- идемпотентность повторных событий;
- проверка целостности memory, settings, avatar selection и user data;
- восстановление после повреждённого или неполного snapshot.

### 12.7. Безопасность и лицензии
- secret scanning;
- dependency/SBOM fingerprint;
- source provenance и archive hashes;
- проверка LICENSE/NOTICE;
- проверка уязвимостей и критических advisories;
- ручное решение по root/runtime, зависимостям и исходным архивам;
- запрет на подстановку фиктивных reviewer/evidence/status.

### 12.8. Release ZIP — канонический артефакт
- собирать ZIP из точного проверенного source SHA;
- исключать node_modules, state, секреты, кэши и временные отчёты;
- включать manifests, SBOM, provenance и release report;
- проверять ZIP traversal/path collisions, CRC и SHA-256;
- сверять asset с tag и source SHA;
- публиковать новый Release asset только после прохождения обязательных gates;
- после загрузки повторно скачать asset и проверить его SHA-256.

**Правило проекта:** Release ZIP, а не `main`, — канонический поставляемый артефакт. Не утверждать, что релиз обновлён, пока asset не появился в GitHub Releases и его хеш не проверен.

### 12.9. Наблюдаемость и эксплуатация
- единый JSON health report;
- диагностический bundle без секретов и персональных данных;
- version/build/source SHA в UI и runtime diagnostics;
- структурированные crash reports;
- ограниченная ротация логов;
- privacy-safe telemetry;
- runbook для восстановления и rollback.

## Добавлено в этом проходе

`tools/aspect12-release-readiness.mjs` — fail-closed структурный аудит manifests, lockfiles, source hygiene и human license clearance. По умолчанию он формирует отчёт и явно показывает блокеры. С флагом `--require-release-ready` pending review становится ошибкой. Скрипт не пытается выдавать структурный проход за browser/device/release proof.

`tools/aspect12-release-readiness.test.mjs` — регрессии на lock drift, pending licenses, secret-shaped files и границы доказательств.\n\n`app/scripts/aspect12-browser-smoke.mjs` — реальный Chromium smoke для desktop (1365×900) и mobile viewport (390×844): проверяет HTTP-ответ, непустой рендер, uncaught page errors и горизонтальное переполнение; сохраняет DOMContentLoaded, FCP, navigation wall time и transfer-size в JSON с exact source SHA. Это базовый browser smoke, не полная проверка диалога, аватара, голоса или физического Android.\n\n`app/scripts/aspect12-browser-smoke.test.mjs` — unit-регрессии для агрегирования p50/p95 и обработки отсутствующих метрик.

## Критерии 100%

- [ ] Exact-SHA CI зелёный для всех обязательных workflow.
- [ ] Production build и migration проходят на изолированной staging DB.
- [ ] Базовый Chromium smoke проходит на desktop и mobile viewport (добавлен; exact-HEAD результат ожидается).\n- [ ] Полный browser E2E диалога, авторизации, Live2D/2.5D/3D, речи и переключения тела проходит на desktop и mobile viewport.
- [ ] Live2D, 2.5D и 3D проверены на реальном runtime.
- [ ] Android physical-device smoke и аудио-синхронизация подтверждены.
- [ ] 60-минутный и 4–8-часовой soak завершены без критической деградации.
- [ ] Backup/restore и rollback проверены на реальных данных-тестах.
- [ ] Performance baselines и budgets зафиксированы на репрезентативных устройствах.
- [ ] SBOM/provenance соответствуют exact source SHA.
- [ ] Все human license decisions завершены с evidence.
- [ ] ZIP прошёл archive-safety, integrity и reproducibility проверки.
- [ ] Новый Release asset загружен, повторно скачан и SHA-256 подтверждён.

## Текущий статус

Аспект 12 не может считаться готовым. На старте: автоматизированная инфраструктура существует, но реальные browser/device/soak доказательства и human license clearance остаются открытыми. Точный процент будет повышаться только по закрытым критериям, а не по числу добавленных файлов.
