# Текущее состояние Neuro-Kurisu SUPER — WorkPass 13

**Дата среза:** 10 октября 2026 года  
**База:** WorkPass 12  
**Runtime:** 35.40.0 / schema 223  
**Статус:** implementation-workpass, НЕ release-ready.

## Главный вывод

Последний официальный scorecard на 9 октября относился к WorkPass 7 и показывал 63,55%. WorkPass 8–12 добавили существенные механизмы в Memory 2.0 и transport, но не пересчитывали общий score. На этом проходе обновлена оценка с теми же фиксированными весами: **67,80% взвешенного implementation-roadmap прогресса**, то есть +4,25 п.п. от исторической базы. Это не означает, что 67,8% релизных проверок пройдены, и не является вероятностью успешного релиза.

## Согласованный счёт задач

В нормализованном инвентаре **40 неповторяющихся deliverables**: **23 DONE (57.5%)**, **9 PARTIAL (22.5%)**, **8 TODO (20.0%)**. Если лишь для сравнения приписывать каждому PARTIAL половину балла, получается 68.8% эквивалента; это не заменяет взвешенный scorecard. Исторические таблицы не суммировались, поскольку содержат повторяющиеся задачи из разных workpass.

## Взвешенный прогресс по направлениям

| Код | Направление | Вес | Оценка исполнения | Баллы | Что осталось |
|---|---|---:|---:|---:|---|
| A | Canonical source lineage and single-owner architecture | 15% | 100% | 15.00 | Сохранять single-owner границы и подтверждать изменения manifest-ом. |
| B | Runtime integration, API/UI routes and smoke/linkage coverage | 15% | 92% | 13.80 | Полная dependency-complete сборка, browser E2E и авторизация диагностических маршрутов. |
| C | Memory 2.0, retrieval/admission and benchmark evidence | 15% | 60% | 9.00 | Реальный размеченный temporal holdout и фактическое baseline-vs-candidate качество. |
| D | Agency, action schema, execution, outcome and reafference | 20% | 60% | 12.00 | Полная причинная трасса, external postconditions и стресс ActionCompetition/reafference. |
| E | Portable subject continuity and social/known-entity dossier | 10% | 75% | 7.50 | Коррекция/expiry/conflict и portable fidelity в браузерных межсессионных сценариях. |
| F | External transport, SDK, idempotency and replay | 10% | 40% | 4.00 | Remote receipts, reconnect/disconnect fault injection и внешние postconditions. |
| G | Research promotion and controlled experiments | 5% | 40% | 2.00 | Воспроизводимые multi-seed/holdout результаты и явные promote/adapt/research решения. |
| H | Release durability: build, E2E, rollback, soak, SBOM/provenance | 10% | 45% | 4.50 | Production build, browser E2E, clean-room recovery, soak и final SBOM/provenance. |

**Итого: 67.80%**. Остаток по взвешенной дорожной карте — **32.20 п.п.** Открытые/частичные deliverables: 17 из 40.

## Что уже сделано

- Единственный writable organism/runtime остаётся `runtime/neuro-kurisu` — второй canonical owner не создан.
- WorkPass 8/11/12 укрепили качество оценки памяти: целостность разметки, provenance, полные retrieval fingerprints, детерминизм, offline runner, bootstrap CI, MRR confidence gate и atomic no-overwrite отчёты.
- WorkPass 9/10 укрепили идемпотентность Conscio/Hexis и transport-envelope/ACK/backpressure/replay логику WILL.
- Статические проверки imports/linkage, адресные HTTP smoke, runtime checks, asset audit и целостность архивов успешно проходили в последнем задокументированном проходе.
- В WorkPass 13 root package version согласован с `SUPER_VERSION.json`; добавлены корневой алиас `audit:workpass12`, контракт метаданных и повторяемая команда `audit:workpass13`.

## Что частично сделано

- Агентская цепочка имеет MotorSchema, canonical execution owner, outcome classes и targeted reafference, но нет полного браузерного доказательства input → action → independently verified outcome → persistence → UI для всех критических сценариев.
- KnownEntityDossier и portable fidelity есть в коде; коррекции сущностей, expirations и межсессионная поведенческая fidelity не закрыты browser E2E.
- Внешний транспорт имеет local idempotency, ACK и replay guards, но не доказана доставка с remote receipt после реальных timeout/reconnect/failure сценариев.
- Backup/restore helper тестируется, но clean-room upgrade/rollback drill не проводился.
- Исследовательские источники адаптированы выборочно, однако кандидаты остаются research-only без независимых метрик/holdout.

## Что ещё не сделано / блокирует релиз

1. Настоящий независимо размеченный MemoryOS2 temporal holdout и benchmark baseline-vs-candidate. Synthetic fixtures подтверждают стенд, не production uplift.
2. Чистая установка app dependencies и полная root/app TypeScript + React/Vite production build. Во время WorkPass 13 попытка `npm ci` из каталога app остановилась на registry DNS `EAI_AGAIN`; первичная команда `npm --prefix app ci` также выявила некорректную инструкцию запуска. README и runbook теперь вызывают `npm run install:all`, который устанавливает зависимости с правильным `cwd=app`. Это устраняет командный/документационный дефект, но сетевой blocker и успешная сборка остаются неподтверждёнными.
3. Desktop/mobile browser E2E, включая интерактивный Live2D, спрайтовый fallback и пользовательские сценарии.
4. Clean-room install, backup/restore, миграция, upgrade и rollback drill.
5. Multi-hour soak с измерением памяти/CPU/disk/resource growth.
6. Remote transport receipt/reconnect/fault-injection проверки.
7. Финальная SBOM/license/NOTICE/provenance проверка и release-candidate sign-off.

## Рабочие этапы крупными пакетами

### Этап 1 — базовая линия и качество метаданных (WorkPass 13, завершён в коде)
Свести версии, lockfile consistency, root-level audit commands и единую таблицу прогресса. Приёмка — тесты контрактов проходят, версия/lockfiles согласованы, scorecard и normalized inventory сохранены.

### Этап 2 — установка зависимостей, полноценная сборка и UI E2E
Один большой пакет: воспроизводимый `npm ci` по app lockfile; semantic app typecheck; production build; Playwright-пути для chat, runtime diagnostics, auth gates, Live2D/sprite fallback, desktop/mobile. Исправить настоящие найденные дефекты и собрать повторяемый evidence bundle. Не засчитывать статический linkage как E2E.

### Этап 3 — capability evidence graph + agency loop
Сделать матрицу восьми критических сценариев; каждому — correlation ID, Action/Outcome receipt, независимое postcondition, persistence verification, UI-visible result и fault case. Доработать competition/reafference/cross-session correction, без второго execution/memory owner.

### Этап 4 — Memory 2.0 на реальных данных
Подготовить manifest происхождения и labeling protocol; закрепить temporal holdout до прогона; запустить одинаковые baseline/candidate budgets с несколькими evaluation seed; опубликовать Recall@k/MRR, CI, contradiction/safety rates, latency/cost и решение promote/adapt/research. Если данных нет — инструмент готов, но uplift остаётся unverified.

### Этап 5 — внешний transport, recovery и abuse stress
Fault inject timeout, disconnect, duplicate ACK, missing receipt, changed payload, stale replay и concurrent retries в тестовом адаптере провайдера; проверить remote postcondition и восстановление без повторного опасного действия. Выполнить чистый backup/restore/upgrade/rollback и multi-hour soak.

### Этап 6 — release candidate и неизменяемые артефакты
Собрать финальный SBOM, license/NOTICE, provenance manifest, hash archive, build/browser logs, restore drill results и sign-off matrix. Каждый gate либо проходит с артефактом, либо остаётся блокером; не закрывать TODO словесным подтверждением.

## Метод и ограничения

Scorecard сохраняет веса WorkPass 7, чтобы проценты были сопоставимы. Completion поднят только для C (Memory 2.0: 45→60) и F (transport: 20→40) на основании новых кодовых deliverables WorkPass 8–12; остальные направления сохранены. Никакой production uplift, full UI build или release readiness не заявляется без соответствующих артефактов.

Подробный машиночитаемый inventory: `docs/PROJECT_CURRENT_STATUS_2026-10-10_WORKPASS13.json`. Взвешенный scorecard: `docs/PROJECT_PROGRESS_SCORECARD_2026-10-10_WORKPASS13.json`.
