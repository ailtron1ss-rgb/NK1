# NK1 — прогресс по волнам (W0 → W1)
**Дата:** 31 октября 2026
**База:** `workpass70-source` · application `35.90.0` · core `100.32.0-r26-hierarchical-lowrank-causal` · schema `225`
**Ветка:** `fix/hygiene-trailing-whitespace-aspect03-2026-10-31` · PR #458

> Короткий журнал фактически закрытых этапов из карты `docs/NK1_REMAINING_WORK_164_STAGES_2026-10-31_RU.md`.
> Каждая запись — со свидетельством (команда + наблюдаемый результат). Фиктивных закрытий нет.

---

## W0 — Измеряемость и целостность

| # | Этап | Статус | Свидетельство |
|---:|---|---|---|
| 002 | Гигиена `audit:forensics`: long-line | ✅ | `FORENSICS=PASS` — правило меряет **длину кода** (строки/шаблоны/комментарии/URL/регэкспы игнорируются через `maskNonCode`), проза — по сырой длине. Было 38 → 0 |
| 003 | Гигиена `audit:forensics`: duplicate-name | ✅ | `duplicateNames=0`. Правило освобождает `index.ts`, legal-файлы, vendored `research/vendor/*` и помечает только **байт-идентичные** пары harness↔test |
| 004 | Разблокировать `audit:pass106/107/108` | ⚠️ | `pass108` — PASS. `pass106/107` доходят до `test:long-horizon:operational:1000` и падают только на p95-тайминге, который падает и на чистом HEAD (это 4-vCPU-контейнер медленнее целевого устройства) |
| 004b | Регрессия на правила forensics | ✅ | `scripts/lib/forensics-rules.mjs` + `tests/forensics-rules.mjs` (`test:forensics-rules`), подключено в `audit:all`. Проверяет, что реальные нарушения по-прежнему падают |
| 004c | Рефлоу плотных строк | ✅ | 7 файлов переформатированы; после снятия пробелов — байт-в-байт идентичны HEAD (добавлены только висячие запятые) |

`audit:forensics`, `audit:architecture`, `audit:source-truth`, `audit:hygiene`, `audit:integrity`, `typecheck`, `audit:pass104` — PASS.

## W1 — Ядро и единое состояние

| # | Этап | Статус | Свидетельство |
|---:|---|---|---|
| 012 | Запретить новые прямые импорты между подсистемами | ✅ | `scripts/audit-subsystem-boundary.mjs` (`audit:subsystem-boundary`) + `scripts/lib/subsystem-boundary-rules.mjs`. 14 доменов `src/organism/*`; 43 существующих ребра заморожены, любое новое — FAIL. Регрессия `tests/subsystem-boundary-rules.mjs` (`test:subsystem-boundary-rules`) |
| 019 | Ownership-проверка «двух владельцев сущности» | ✅ (аудит был, теперь enforced) | `audit:core-ownership` = `CORE_OWNERSHIP=PASS`; добавлен в `audit:all` вместе с ещё 7 структурными аудитами |
| 018 | Уменьшить монолит `OrganismCore.ts` | ❌ открыт (pre-existing) | `audit:core-physical-ownership` = `FAIL core-line-regression:12834>10353`. `OrganismCore.ts` = 12833 строки против потолка 10353 (baseline 35.40.0 = 10225 + 128). На импортированном baseline `ba37a660a` уже было 12546 строк → это **предсуществующий** разрыв, не регрессия. Ядро проблемы — метод `observe` в 4222 строки с сильно связанным мутабельным состоянием; безопасное извлечение — многосессионная работа |

### Структурные аудиты теперь enforced (2026-10-31)

Восемь структурных аудитов существовали и проходили, но **никогда не запускались** зонтичным `audit:all` — поэтому охраняемые ими инварианты могли тихо деградировать (именно так `OrganismCore` перерос потолок). Добавлены в `scripts/audit-all.mjs` (каждый предварительно прогнан зелёным):

`audit:core-ownership`, `audit:component-conflicts`, `audit:facade-dependency`, `audit:subject-boundary`, `audit:subsystems`, `audit:server-imports`, `audit:api-routes`, `audit:ui-api-linkage`.

Сознательно **не** добавлен `audit:core-physical-ownership` — он честно падает (см. этап 018); красный гейт сделал бы зонтик бесполезным.

### Как работает ratchet (012)

- Домен = первый сегмент пути под `src/organism/` (14 именованных доменов).
- Разрешены только рёбра из `FROZEN_CROSS_SUBSYSTEM_EDGES` (снимок WorkPass70).
- Новое `A -> B` даёт `exit=1` и подсказку, где заморозить ребро с обоснованием.
- Ловит и `from '...'`, и `import('...')`, и side-effect `import '...'`; строки/комментарии/`import type` не считаются (через `maskNonCode`).
- Сознательно **не** удаляет 43 существующих ребра — это отдельная крупная задача (011/018). Ratchet не даёт границе деградировать, пока идёт рефакторинг.

### Проверка fail-closed

Временный `import { X } from '../learning/AdaptiveDevelopmentEngine.ts'` в `src/organism/verification/` →
`cross-subsystem-ratchet: new domain->domain imports are not allowed: verification -> learning`, `exit=1`.
После удаления пробы — снова `SUBSYSTEM_BOUNDARY=PASS`.

---

## Что дальше (ближайшие этапы)

1. W1-013 — замкнуть цикл Perceive→…→Consolidate (10k тиков без разрыва цепи).
2. W1-016 — идемпотентность событий/действий (дубль-доставка без двойного эффекта).
3. W2-036/037 — независимый RU/EN holdout и baseline/candidate с CI (`recallDelta` пока 0).
4. W0-006 — soak-harness (24–72 ч) с отчётом деградации.

> Примечание: этапы, требующие реального провайдера/устройства/браузера (F-поток, аудио p95, Android/Termux TTS),
> не закрываются unit-тестами и требуют целевого железа — это остаётся открытым гейтом релиза.
