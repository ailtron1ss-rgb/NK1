# NK1 — полный план оставшихся работ: 164 этапа / 1640 шагов
**Дата:** 31 октября 2026
**Рабочая база:** `workpass70-source`
**Состояние:** application `35.90.0` · organism core `100.32.0-r26-hierarchical-lowrank-causal` · state schema `225` · release `WorkPass70`
**Официальная оценка:** `overallPercent = 80.1`, остаток `19.9` взвешенных пунктов (scorecard WorkPass70).

> Это не второй мастер-план и не приказ создать 164 модуля. Это **карта оставшихся работ** с зависимостями и критериями выхода.
> Канонические источники: `docs/NK1_EXECUTION_PLAN_100_PERCENT_RU_2026-10-30.md`, `docs/NEUROCORE_MASTER_STRATEGY_AND_BRAIN_MAP.md`, `docs/NEUROCORE_1000_WORK_UNIT_BACKLOG.md`.
> Машиночитаемая истина: `VERSION.json` + `RELEASE_MANIFEST.json` + `ARCHITECTURE_MANIFEST.json` + `src/organism/system/ReleaseContract.ts`.

---

## 0. Как читать этот план

**Волны.** Работа сгруппирована в волны W0–W9 по зависимостям: сначала измеряемость и целостность, затем ядро, затем действие/тело, затем поставка, затем исследование.

**Этапы.** 164 этапа. Каждый этап — атомарная единица с одним владельцем-подсистемой, одним наблюдаемым поведением и одним критерием выхода.

**Шаги.** Каждый этап раскрывается в канонический 10-шаговый микроцикл (5 жизненных гейтов × 2: «сделать» + «проверить»). 164 × 10 = **1640 шагов**. Шаги не выдуманы: это стандарт, уже принятый в `NEUROCORE_1000_WORK_UNIT_BACKLOG.md` (`OBSERVE / SPEC / FIX / TEST / PROVE`).

**Правила.** Каждый этап: (1) имеет владельца из `src/organism/*`; (2) не создаёт второй параллельный владелец сущности; (3) требует проверяемого свидетельства; (4) fail-closed — нельзя закрывать фиктивно или обходом.

**Чего нельзя делать.** Не генерировать пустые заглушки ради счётчика; не считать PASS unit-тестов доказательством device/E2E; не засчитывать код из отдельной ветки как интегрированную возможность; не складывать проценты аспектов в один средний процент.

---

## 1. Фактическая исходная точка (свидетельства)

| Область | Факт | Источник |
|---|---|---|
| Код ядра | 652 `.ts` в `src/`, ~114 тыс. строк; 1367 тестов `.mjs` | инвентаризация дерева |
| Подсистемы organism | 14 доменов: core 19.5k, learning 24.3k, cognition 27.4k, system 23.5k LOC | `src/organism/` |
| Тело | body 21 файл / 2.98k LOC; integration 13 / 2.59k | `src/organism/body`, `integration` |
| Скрипты | 1825 в runtime `package.json`, 186 в корневом | `package.json` |
| Ветки | 524 remote; 100 открытых PR | `git`, GitHub API |
| Релизы | последний asset `workpass70-hotfix1-2026-10-19`; нового нет | GitHub Releases |
| Лицензии | `contracts/RELEASE_LICENSE_REVIEW.json` → `status: pending` | контракт |
| Память | `memoryRecallDelta = 0`, кандидат `not-promoted` | scorecard |
| Release-гейты | восстановлены в WorkPass635 (architecture/source-truth/pass104/миграции) | PR #458 |

### 1.1 Взвешенные потоки работ (scorecard WorkPass70)

| Поток | Вес | Готовность | Пункты | Ключевой разрыв |
|---|---:|---:|---:|---|
| A. Каноническая линия и единый владелец | 15 | 100% | 15.0 | Длительный soak, единый ownership событий |
| B. Runtime/API/UI интеграция и linkage | 15 | 99% | 14.85 | Установленные зависимости + browser E2E |
| C. Память 2.0, retrieval/admission | 15 | 72% | 10.8 | Независимый holdout, `recallDelta > 0` |
| D. Агентность, действие, исход, реafference | 20 | 87% | 17.4 | Реальные provider/device postconditions |
| E. Непрерывность субъекта и досье | 10 | 76% | 7.6 | Длительная оценка личности |
| F. Внешний транспорт, SDK, идемпотентность | 10 | 48% | 4.8 | Реальный provider/device E2E |
| G. Исследование и контролируемые эксперименты | 5 | 70% | 3.5 | Промоушен по измеренному выигрышу |
| H. Durability: build, E2E, rollback, soak, SBOM | 10 | 62% | 6.15 | License review, новый ZIP, soak |

### 1.2 Открытые release-гейты (из scorecard, дословно)

1. Установка зависимостей app из lockfile в сети; production Vite build; desktop/mobile browser E2E; измерение p95 audio→mouth.
2. Проверка прерывания голоса и stale-event на реальном браузерном звуке и Android/Termux TTS (exit процесса ≠ тишина).
3. Протокол acceptance/ACK-gap/process-kill/reconnect/duplicate-replay/postcondition на реальном адаптере.
4. Независимый RU/EN holdout памяти; `recallDelta` пока 0.
5. Кausal learning на реальной квитанции/наблюдении/credit/restart.
6. Live soak инициативы, промоушен/rollback, профиль модели GTX 1650 4GB, clean-room restore, 24–72 ч soak, license review.

---

## 2. Волны и порядок (зависимости)

```
W0 Измеряемость и целостность      ──► W1 Ядро и состояние
                                        │
                                        ├─► W2 Память и непрерывность ──┐
                                        ├─► W3 Обучение и пластичность  │
                                        ├─► W4 Личность/досье           │
                                        ├─► W5 Мотивация/автономия      │
                                        └─► W6 Эмоции/регуляция         │
                                                                        ▼
W7 Действие/безопасность ─► W8 Голос+тело+UI ─► W9 Поставка/исследование
```

Правило: W0 закрывается первым. Волны W2–W6 могут идти параллельно, если каждая опирается на зафиксированный baseline SHA из W0. W7–W9 требуют закрытого W1.

---

## 3. W0 — Измеряемость и целостность (этапы 001–010)

| # | Этап | Владелец | Критерий выхода |
|---:|---|---|---|
| 001 | Зафиксировать baseline SHA и зелёный `release:final` | `scripts/audit-all.mjs` | Артефакт baseline с SHA + полный PASS-лог |
| 002 | Гигиена `audit:forensics`: 38 long-line (>800) | `package.json`, `StateMigrations.ts`, `OrganismCore.ts` | `FORENSICS=PASS` по long-line |
| 003 | Гигиена `audit:forensics`: 10 duplicate-name | vendored LICENSE, `src/learning`↔`tests` | Решение: перенос/исключение/обоснование |
| 004 | Разблокировать `audit:pass106/107/108` | `scripts/audit-pass106.mjs` | Три аудита PASS |
| 005 | Независимый multi-seed holdout-реестр | `learning/HostOwnedIndependentEvaluationServices.ts` | Реестр неизменяем, подписан, contamination-проверка |
| 006 | Soak-harness (24–72 ч) | `core/OrganismRuntime.ts` | Отчёт soak с метриками деградации |
| 007 | Переоценка 12 аспектов по raw-данным | `docs/` | Проценты заменены метриками |
| 008 | Каталог метрик «измерено vs заявлено» | `verification/FunctionPassport.ts` | Таблица с указателем на артефакт |
| 009 | Fail-closed регрессия на обход гейтов | `tests/` | Попытка обхода → ненулевой код |
| 010 | Единый измерительный CI-workflow | `.github/workflows/` | Workflow гоняет W0-гейты на exact SHA |

---

## 4. W1 — Ядро и единое состояние (этапы 011–028)

| # | Этап | Владелец | Критерий выхода |
|---:|---|---|---|
| 011 | Утвердить единственные writable owners | `core/OrganismCore.ts` | Карта владельцев без дублей |
| 012 | Запретить новые прямые импорты между подсистемами | `scripts/audit-architecture.mjs` | Аудит ловит новый прямой импорт |
| 013 | Замкнуть цикл Perceive→…→Consolidate | `core/OrganismRuntime.ts` | 10k ticks без разрыва цепи |
| 014 | Версионируемые события + causal parent links | `memory/EventSourcing.ts` | Replay воспроизводит граф |
| 015 | Монотонный tick и единый clock | `core/` | Нет расхождения часов |
| 016 | Идемпотентность событий/действий | `system/` | Дубль-доставка не даёт двойного эффекта |
| 017 | Реестр orphan async tasks | `core/` | Нет незавершённых задач после restart |
| 018 | Уменьшить монолит `OrganismCore.ts` (малые извлечения) | `core/` | Каждое извлечение с регрессией |
| 019 | Ownership-проверка «двух владельцев сущности» | `scripts/audit-core-ownership.mjs` | Аудит PASS, ноль дублей |
| 020 | Restart/restore без изменения исхода | `persistence/StateMigrations.ts` | Replay идентичен |
| 021 | p95 tick ≤ 50 ms на целевом устройстве | `core/` | Измерение на Android/Dell G3 |
| 022 | Единый error taxonomy | `system/` | Классификация покрывает все пути |
| 023 | Degraded mode при отказе провайдера | `integration/` | Фолбэк без ложного успеха |
| 024 | Cancellation/deadline propagation | `core/` | Отмена доходит до всех стадий |
| 025 | Correlation IDs сквозь весь цикл | `server/`, `core/` | Трасса целостна |
| 026 | Инвентарь владельцев: живой граф вызовов | `tools/super-inventory.mjs` | Манифест из текущего коммита |
| 027 | Adversarial: дубликаты событий/потеря links | `tests/` | Негативные контроли проходят |
| 028 | Evidence-гейт W1 (promote/defer/reject) | `docs/` | Явное решение с обоснованием |

---

## 5. W2 — Память и непрерывность (этапы 029–046)

| # | Этап | Владелец | Критерий выхода |
|---:|---|---|---|
| 029 | Единый канонический владелец памяти | `memory/CanonicalMemoryLifecycleAuthority.ts` | Второй writable-путь удалён |
| 030 | Evidence records: source/timestamp/confidence | `memory/EvidenceLineageProvenance.ts` | Каждая запись прослеживаема |
| 031 | Разделять observation/report/inference/simulator/unknown | `memory/P65EpistemicLedger.ts` | Тесты на подмену типа |
| 032 | Temporal/spatial grounding | `memory/` | Stale/out-of-order отвергаются |
| 033 | Entity tracking и contradiction update | `body/TemporalObjectTracker.ts` | Противоречие пересматривает belief |
| 034 | Provenance и lineage памяти | `memory/SourceMonitor.ts` | Полная цепочка источника |
| 035 | Admission по net utility/harm/redundancy | `memory/MemoryBudgetCausalHarness.ts` | Отказ без бюджетного давления |
| 036 | Независимый RU/EN holdout (freeze + leakage) | `learning/` | `recallDelta` измерен, leakage=0 |
| 037 | Baseline/candidate с CI и shuffle-контролем | `memory/MemoryRetrievalBenchmark.ts` | Отчёт с интервалами |
| 038 | False-memory rate | `memory/` | Метрика и порог |
| 039 | Transfer/reversal/interference/forgetting suite | `learning/` | Контроли no-learning/wrong-feedback |
| 040 | Consolidation: реплей без «подглядывания» | `memory/AdaptiveExperienceConsolidator.ts` | Holdout не загрязняется |
| 041 | Bilingual retrieval integrity | `learning/` | RU/EN не деградируют взаимно |
| 042 | Semantic vector integrity | `.github/workflows/workpass605-*` | Векторный кандидат не промоутится без выигрыша |
| 043 | Tombstone safety | `memory/` | Удаление не воскрешает |
| 044 | Multi-timescale memory consistency | `memory/MultiTimescaleMemory.ts` | Уровни согласованы |
| 045 | Promotion decision по измеренному выигрышу | `learning/` | Явное promote/defer с числами |
| 046 | Evidence-гейт W2 | `docs/` | Решение с обоснованием |

---

## 6. W3 — Обучение и пластичность (этапы 047–064)

| # | Этап | Владелец | Критерий выхода |
|---:|---|---|---|
| 047 | Единый владелец learning-состояния | `learning/UnifiedLearningSubstrate.ts` | Нет второго владельца |
| 048 | Verified outcome evaluators | `learning/P36VerifiedOutcomeLedgerEvaluator.ts` | Credit только при реальной квитанции |
| 049 | Квитанции через `OutcomeVerificationService` | `system/OutcomeVerificationService.ts` | Caller-булев не даёт credit |
| 050 | Paired-seed confidence | `learning/IndependentSkillCandidateEvaluator.ts` | Доверительные интервалы |
| 051 | P23 lifecycle/journal durability | `learning/` | Restore не теряет журнал |
| 052 | Fail-closed при недоступном журнале | `learning/` | Отказ, а не тихая потеря |
| 053 | Causal replay credit (long-horizon) | `memory/ExperienceContinuumFabric.ts` | `assignments` подтверждены квитанцией |
| 054 | Transfer probe с реальными квитанциями | `learning/` | Перенос измерен, не заявлен |
| 055 | Anti-contamination holdout registry | `learning/` | Runtime-телеметрия ≠ holdout |
| 056 | Robust metrics (median/IQR) | `learning/SkillEvaluationReport.ts` | Устойчивость к выбросам |
| 057 | Real skill transfer на field-данных | `learning/` | Долгосрочное свидетельство |
| 058 | Forgetting/reversal controls | `learning/` | Нет ложного роста |
| 059 | Self-change lineage | `learning/` | Изменение прослеживаемо |
| 060 | Promotion/rollback контролируемого самоизменения | `learning/` | Rollback возвращает baseline |
| 061 | Ambiguous/refused outcomes не влияют на competence | `learning/` | Тест на неоднозначный исход |
| 062 | Learning governance | `.github/workflows/p26-learning-validation.yml` | Гейт на exact SHA |
| 063 | Adversarial: wrong-feedback/no-learning | `tests/` | Негативные контроли |
| 064 | Evidence-гейт W3 | `docs/` | Решение с обоснованием |

---

## 7. W4 — Личность, SelfModel, досье (этапы 065–082)

| # | Этап | Владелец | Критерий выхода |
|---:|---|---|---|
| 065 | Единый SelfModel владелец | `developmental/` | Нет дубля |
| 066 | Стабильные черты личности | `developmental/` | Метрика устойчивости |
| 067 | Автобиографическая непрерывность | `memory/AutobiographicalMemory.ts` | История переживает restart |
| 068 | Self-description и его эволюция | `developmental/` | Объяснимая динамика |
| 069 | UserModel evidence-bounded | `developmental/` | Не переобобщает |
| 070 | Досье известных сущностей | `system/` | Скоуп и приватность |
| 071 | История отношений | `developmental/` | Последовательность |
| 072 | Identity lock | `tests/` | Идентичность не сбрасывается |
| 073 | Long-horizon personality sequence | `developmental/` | Длительная оценка |
| 074 | Self/User model persistence | `persistence/` | Схема-миграция |
| 075 | Privacy границ досье | `system/` | Нет утечки |
| 076 | Consistency: черты ↔ решения | `developmental/` | Нет противоречий |
| 077 | Emotion↔personality связь | `developmental/` | Причинная цепь |
| 078 | Adversarial: identity reset/spoof | `tests/` | Негативные контроли |
| 079 | Social cognition continuity | `developmental/` | Согласованность |
| 080 | Value drift контроль | `developmental/` | Изменение объяснимо |
| 081 | Dossier redaction | `app/` | Публичный вид скрывает приватное |
| 082 | Evidence-гейт W4 | `docs/` | Решение с обоснованием |

---

## 8. W5 — Мотивация и автономия (этапы 083–096)

| # | Этап | Владелец | Критерий выхода |
|---:|---|---|---|
| 083 | Потребности → цели | `system/` | Цели выводятся из потребностей |
| 084 | AutonomousSocialInitiativeEngine | `system/AutonomousSocialInitiativeEngine.ts` | Инициатива не спамит |
| 085 | Quiet-hours | `system/` | Молчание в часы покоя |
| 086 | Cancellation инициативы | `system/` | Отмена срабатывает |
| 087 | Полезность инициатив (метрика) | `system/` | Измеренная польза |
| 088 | Interest feedback loop | `system/` | Обратная связь работает |
| 089 | Background initiative soak | `system/` | Live-прогон |
| 090 | Goal arbitration | `cognition/` | Конфликты разрешаются |
| 091 | Planner cadence | `.github/workflows/workpass586-*` | Гейт на exact SHA |
| 092 | Reflective payload budget | `cognition/` | Ограничение ресурсов |
| 093 | Self-directed research safety | `research/` | Безопасный поиск |
| 094 | Adversarial: spam/runaway loop | `tests/` | Негативные контроли |
| 095 | Initiative ↔ userModel связь | `system/` | Персонализация |
| 096 | Evidence-гейт W5 | `docs/` | Решение с обоснованием |

---

## 9. W6 — Эмоции и регуляция (этапы 097–106)

| # | Этап | Владелец | Критерий выхода |
|---:|---|---|---|
| 097 | Appraisal → emotion chain | `cognition/` | Причинная цепь |
| 098 | Homeostasis/affect интеграция | `core/CognitiveArchitectureMap.ts` | Слой согласован |
| 099 | Affect ↔ body expression | `body/` | Выражение соответствует состоянию |
| 100 | Emotion smoothing по renderer | `app/` | Нет разрывов |
| 101 | Bounded emotion dynamics | `cognition/` | Нет runaway |
| 102 | Interoceptive delta | `core/OrganismCore.ts` | Метрика |
| 103 | Affect-aware speech | `body/VoiceEmbodiment.ts` | Просодия соответствует |
| 104 | Adversarial: эмоциональный спам | `tests/` | Негативные контроли |
| 105 | Emotional explainability | `cognition/` | Прослеживаемость |
| 106 | Evidence-гейт W6 | `docs/` | Решение с обоснованием |

---

## 10. W7 — Действие, инструменты, безопасность (этапы 107–122)

| # | Этап | Владелец | Критерий выхода |
|---:|---|---|---|
| 107 | ActionGateway единый владелец | `core/` | Нет второго пути |
| 108 | Output-контракты инструментов | `system/` | Схемы валидируются |
| 109 | Исправить bounded-regex regression | `tests/tool-input-contracts-*` | Тест PASS |
| 110 | External postcondition | `system/OutcomeVerificationService.ts` | Симуляция ≠ реальный исход |
| 111 | Lost-ACK reconciliation | `body/EmbodiedRecoveryController.ts` | Нет двойного эффекта |
| 112 | Process-kill/restart | `persistence/` | Восстановление корректно |
| 113 | Duplicate delivery | `system/` | Идемпотентность |
| 114 | Spoofed/late proof rejection | `system/` | Ложное доказательство отвергнуто |
| 115 | Authorization для реальных действий | `system/` | Без ticket → approvalRequired |
| 116 | Rollback действия | `system/` | Откат возвращает состояние |
| 117 | Safety policy sanitization | `body/EmbodiedInteractionController.ts` | Политика не подделывается |
| 118 | Reach/contact grounding | `body/` | Физическое действие требует live-камеры |
| 119 | Adversarial: spoof/late/duplicate | `tests/` | Негативные контроли |
| 120 | Real provider/device E2E | `integration/` | Реальный адаптер |
| 121 | Action proof matrix полная | `docs/` | Матрица закрыта |
| 122 | Evidence-гейт W7 | `docs/` | Решение с обоснованием |

---

## 11. W8 — Голос, тело, UI (этапы 123–146)

| # | Этап | Владелец | Критерий выхода |
|---:|---|---|---|
| 123 | EmbodimentIntent v1 канонический | `body/` | Единый родительский control |
| 124 | RU/EN grapheme-viseme timeline | `app/` | Привязка к monotonic clock |
| 125 | Audio clock / phoneme timing | `body/` | Реальная привязка |
| 126 | Interruption/stale rejection | `body/` | Поздние события отвергаются |
| 127 | Android/Termux TTS E2E | `body/AndroidEmbodimentBridge.ts` | Реальный звук |
| 128 | p95 audio→mouth на desktop | `app/` | Измерение |
| 129 | p95 audio→mouth на mobile | `app/` | Измерение |
| 130 | Native speech transport | `body/NativeSpeechEventChannel.ts` | События доходят в UI |
| 131 | BodyRendererRegistry handoff | `app/` | Переключение без сброса личности |
| 132 | 2D original asset production | `app/` | Production-арт |
| 133 | 2.5D depth-rig production | `body/` | Rigged assets + visual E2E |
| 134 | 3D VRM runtime | `app/Avatar3DStage.tsx` | Лицензированный VRM |
| 135 | Cross-renderer completion receipts | `app/` | Независимые квитанции |
| 136 | Camera evidence grounding | `body/CameraEvidenceProcessor.ts` | Live-камера |
| 137 | Vision semantic backend | `body/GeminiVisionSemanticBackend.ts` | Реальный backend |
| 138 | Spatial interaction adapters | `body/` | Реальные sensors |
| 139 | Wardrobe modular packs | `body/` | Реальные packs |
| 140 | Body switch transaction | `body/EmbodimentRuntime.ts` | Атомарность |
| 141 | UI wiring audit | `scripts/audit-ui-function-wiring.mjs` | PASS |
| 142 | Browser E2E desktop | `app/` | Реальный Chromium |
| 143 | Browser E2E mobile | `app/` | Реальный Chromium |
| 144 | Adversarial: lost ACK/restart body | `tests/` | Негативные контроли |
| 145 | Embodiment soak | `body/` | Длительный прогон |
| 146 | Evidence-гейт W8 | `docs/` | Решение с обоснованием |

---

## 12. W9 — Поставка и исследование (этапы 147–164)

| # | Этап | Владелец | Критерий выхода |
|---:|---|---|---|
| 147 | License review: root project | `contracts/RELEASE_LICENSE_REVIEW.json` | Human-решение на точном хеше |
| 148 | License review: runtime | `contracts/` | Human-решение |
| 149 | License review: npm deps | `contracts/` | SBOM согласован |
| 150 | License review: source archives | `contracts/` | Redistribution approved |
| 151 | License review: vendored LICENSE | `contracts/` | Решение по каждому |
| 152 | Clean install из lockfile | `package.json` | Воспроизводимо |
| 153 | Production Vite build | `app/` | Сборка без ошибок |
| 154 | Packaging smoke | `tools/` | Пакет валиден |
| 155 | Provenance и SBOM | `tools/super-sbom.mjs` | Подписано |
| 156 | Новый Release ZIP + SHA256 | GitHub Release | Asset проверен |
| 157 | Backup/restore/rollback | `tools/super-restore.mjs` | Восстановление корректно |
| 158 | Clean-room restore | `tools/` | Чистое окружение |
| 159 | Security/privacy gates | `scripts/` | Нет утечек |
| 160 | Target-host model profile (GTX 1650 4GB) | `integration/` | Профиль измерен |
| 161 | 24–72 ч soak финальный | `core/` | Отчёт |
| 162 | Research: контролируемые эксперименты | `research/` | Методология |
| 163 | Research: фальсифицируемые критерии «разума» | `research/` | Каждый атрибут опровержим |
| 164 | Финальный evidence-гейт и release decision | `docs/` | Решение с обоснованием |

---

## 13. Канонический 10-шаговый микроцикл (раскрытие любого этапа)

| Шаг | Жизненный гейт | Действие | Свидетельство |
|---:|---|---|---|
| 1 | OBSERVE | Инвентаризовать владельца и путь вызова | Baseline-артефакт + путь |
| 2 | OBSERVE | Зафиксировать точный разрыв в свидетельствах | Список пробелов |
| 3 | SPEC | Описать контракт входа/выхода/состояния | Ревью контракта |
| 4 | SPEC | Описать failure-модель (timeout/cancel/privacy/restart) | Матрица отказов |
| 5 | FIX | Минимальное изменение в существующем владельце | Диф + ревью инвариантов |
| 6 | FIX | Не создавать параллельный владелец/заглушку | Подтверждение владельца |
| 7 | TEST | Регрессия, отвергающая старый режим отказа | Вывод регрессии |
| 8 | TEST | Негативный контроль + границы/дубли/взаимодействия | Вывод негативного контроля |
| 9 | PROVE | Focused + cross-cutting прогон | CI/device-запись |
| 10 | PROVE | Явное promote/defer/reject + rollback | Решение с обоснованием |

**Итого:** 164 этапа × 10 = **1640 шагов**; из них 46 этапов (W0–W1 + W9) — критические для релиза.

---

## 14. Порядок ближайших действий (следующий проход)

1. **W0-001/002/003/004:** зафиксировать baseline SHA и закрыть `audit:forensics` → разблокировать `audit:pass106/107/108`.
2. **W0-005/006:** независимый holdout-реестр + первый soak-отчёт.
3. **W0-007:** переоценка процентов по raw-данным (заменить триаж-оценки).
4. **W1-011/013/019:** карта единых владельцев и замкнутый когнитивный цикл.
5. **W2-036:** первый измеренный `recallDelta` на неизменяемом holdout (высший приоритет по весу: поток C).

---

## 15. Критерий завершения (дословно из канонического плана)

Проект достигает 100% операционной готовности только когда выполнено всё ниже:

- все 12 аспектов достигли `MEASURED`;
- все candidate-ветки интегрированы или закрыты с обоснованием;
- память показывает независимый положительный recall uplift на holdout;
- автономия и личностная непрерывность подтверждены длинными сценариями;
- голос и аватар синхронизированы на реальном браузере и Android;
- переключение 2D/2.5D/3D не сбрасывает личность и ход диалога;
- реальные внешние действия требуют authorization и независимых postconditions;
- clean install/build/migration/backup/soak/rollback/security завершены;
- все license/NOTICE/redistribution решения закрыты для точных хешей;
- новый Release содержит ZIP/SBOM/provenance/SHA256 с проверенной lineage.

**Границы:** проценты — инженерная оценка; PASS unit-тестов не заменяет device/E2E; код в ветке не засчитывается как интегрированная возможность; ни один критерий нельзя закрывать фиктивно.

_Этот документ подготовлен AI-агентом (OpenHands) по поручению владельца репозитория._
