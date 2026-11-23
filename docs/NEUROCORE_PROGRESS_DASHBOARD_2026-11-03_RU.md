# NeuroCore / NK1 — панель прогресса и единый план проходов (2026-11-03)

**Ветка сессии:** `feature/memory` (HEAD `4f2def8`, 2026-10-25).
**Важно:** удалённый репозиторий ушёл далеко вперёд. `feature/memory` — не самая свежая линия: активные интегрирующие ветки — `aspect/*-20261102`, `nk1-unified-brain-architecture-convergence-*` (PR #693), `aspect/engineering-software-baseline-20261102` (PR #694), 3D-embodiment (PR #688/#695). CHANGELOG доходит до **WorkPass537** (2026-10-25) с зелёными прогонами «Memory persistence regression».

> Этот документ фиксирует **проверенные в этой сессии** факты, честные проценты и план на несколько проходов. Процент — инженерная оценка, не научный балл; он **понижается** при обнаружении скрытого отказа.

---

## 1. Что реально проверено в этой сессии (OBSERVED)

| Проверка | Команда | Результат |
|---|---|---|
| Установка app-зависимостей | `npm ci` в `app/` | ✅ 419 пакетов, tsc доступен |
| **Рантайм typecheck (настоящий tsc)** | `node scripts/typecheck-runtime.mjs` | ✅ **PASS**, 0 ошибок (было ложно «FAIL/82 parse-fail» из-за отсутствия node_modules) |
| App typecheck | `tsc --noEmit` | ❌ → ✅ **после фикса** (был реальный блокер: `checkJs` падал на `*.test.mjs`) |
| Memory CI-gate (5 тестов) | persistence / causal-projection / canonical-store / consolidator / … | ✅ все PASS |
| Память/retrieval/continuum набор | 90 тестов | **73 PASS / 17 FAIL** (до правок) |
| `big-pass-126` (retrieval benchmark) | — | ❌ → ✅ **после фикса** (stale `schemaVersion`, отсутствовали `licenseId`+`contentSha256`) |
| `memory-temporal-inspector-closure` | — | ❌ → ✅ **после фикса** (`asOfAt:null` отвергался как invalid) |
| Живой CI на ветке | GitHub Actions API | ✅ `Memory persistence regression` = **success** (SHA `b6ed8070`) |

### Найденные и исправленные реальные дефекты (в этой сессии)

1. **`scripts/typecheck-runtime.mjs`** — fallback-проверка вызывала `node --check <file.ts>`, а `--check` **никогда не срезает типы** (падает на любой аннотации). Это давало 82 ложных `TS_PARSE_FAIL`. Заменено на `module.stripTypeScriptTypes()` + `--check` по срезанному файлу → теперь реальные синтаксические ошибки, без ложных.
2. **`app/tsconfig.json`** — `checkJs:true` проверял `src/legacy/avatar/safeLocalStorage.test.mjs` и валил `npm run typecheck` (6 ошибок). Тест запускается Node, а не tsc → добавлено исключение `src/**/*.test.mjs`. App typecheck теперь PASS.
3. **`MemoryOS2.retrieve()`** — `asOfAt:null` отвергался как `memory-temporal-options-invalid`, хотя контракт требует «null → текущее время». Исправлено.
4. **`tests/big-pass-126-memory-retrieval-benchmark.mjs`** — тест ассертил `schemaVersion:3` (реально `6`) и не задавал `licenseId`/`contentSha256`, поэтому `provenanceComplete` был false. Тест переведён на корректные значения; теперь он честно репортит `recallDelta=0 / not-promoted`.

---

## 2. Панель прогресса по подсистемам (%)

Колонки: **Impl** (код есть), **Integr** (вызывается в реальном пути), **Verif** (измерено на независимых данных). Три шкалы нельзя складывать.

| Подсистема | Impl | Integr | Verif | Блокер |
|---|---:|---:|---:|---|
| Runtime-ядро (OrganismCore/цикл) | 80 | 65 | 20 | нет сквозного real-model E2E |
| Языковой провайдер (llama.cpp/Ollama) | 75 | 60 | 15 | нет замеров на Dell G3, нет 503/timeout/cancel матрицы |
| Память: persistence + temporal revision | 85 | 70 | 35 | нет реального autobiographical-корпуса |
| **Память: retrieval quality** | 80 | 70 | **10** | `recallDelta=0`, независимый RU/EN holdout отсутствует |
| Обучение / transfer / forgetting | 55 | 35 | **8** | нет held-out transfer + controls |
| Верификация действий / безопасность | 70 | 55 | 20 | матрица spoof/late/duplicate/restart не закрыта |
| Личность / непрерывность | 60 | 45 | 12 | нет слепых диалоговых наборов |
| UI / browser / Live2D / voice | 65 | 50 | 15 | нет реального browser/Android E2E |
| CI / тестовая достижимость | 80 | 70 | 55 | часть тестов не подключена к CI |
| Provenance / лицензии | 55 | 45 | 30 | нет исчерпывающего SBOM/license-инвентаря |
| Security / privacy | 55 | 45 | 25 | нет threat-model + pen-review |
| Observability / recovery | 60 | 50 | 30 | нет 24–72ч soak и fault-injection |
| Performance / energy / thermal | 35 | 25 | 5 | нет baseline на целевом железе |
| Packaging / reproducible release | 50 | 40 | 20 | нет clean-room build/rollback |
| Научная валидность заявок | 60 | 55 | 25 | часть заявок без независимых экспериментов |
| **ИТОГО (не среднее, триаж)** | **64** | **52** | **20** | проект **не release-ready** |

Обучение (P23 scorecard): symbolic core **61%**, evidence-grounded maturity **36%**, lifelong roadmap **30%**, overall **57/100** — без изменений (эта сессия чинит инфраструктуру/корректность, не доказывает uplift).

---

## 3. Конечная цель по каждой линии (ветке) + механизмы

| Линия | Конечная цель (DoD) | Ключевые механизмы |
|---|---|---|
| `feature/memory` | Доказанное качество памяти | Единый `MemoryOS2`; dense+BM25 RRF; temporal as-of; FAMA-метрика; provenance-bound evidence |
| `aspect/memory-*` (affect/evidence/freshness/reranking) | Память, влияющая на решения | Affect-context reranking, evidence freshness, memory→action |
| `nk1-unified-brain-*` | Один связный когнитивный цикл | Единая шина состояний, единый владелец на способность |
| `aspect/engineering-software-baseline-*` | Воспроизводимый CI-гейт | Exact-head build+typecheck+targeted tests, доступные логи |
| `aspect/avatar-3d-*` / embodiment | Реальное воплощение | Единый `EmbodimentIntent v1`, аудио-часы, Live2D/3D |
| `fix/*` (causal-binding, telemetry, replay-evidence) | Достоверность | Signed replay artifacts, закрытие boolean-trust дыр |

---

## 4. План на несколько проходов вперёд (параллельные потоки)

### Поток A — Верифицируемость (блокирующий)
- A1. Свести 20+ workflow к одному exact-head гейту; добиться runs **со steps и логами**.
- A2. Подключить «сиротские» тесты (17 падавших не в CI) к гейту по мере починки.
- A3. Зафиксировать локальную воспроизводимость (`install:all` + typecheck + build) как скрипт `verify:all`.

### Поток B — Память (главный приоритет доказательности)
- B1. Заморозить независимый RU/EN retrieval-корпус (revision/парафразы/контрадикции/multi-hop) + provenance hash.
- B2. Baseline BM25 vs текущий гибрид на одном корпусе; per-case отчёт.
- B3. Dense-эмбеддинги (`LocalEmbeddingProvider`) как отдельный RRF-канал; абляция.
- B4. FAMA-подобная метрика (stale-fact use) + as-of/supersession тесты.
- B5. Memory→action task-family (Mem2ActBench-идея).

### Поток C — Обучение
- C1. Задачи, где одна verified-попытка улучшает **другую** holdout-задачу.
- C2. Controls: no-learning/shuffled/wrong-feedback/replay-disabled.
- C3. Метрики: transfer/forgetting/interference/calibration.

### Поток D — Действие/безопасность
- D1. Матрица timeout/lost-ACK/spoof/late/duplicate на каждом переходе.
- D2. At-most-once или идемпотентная сверка; явные ambiguous-состояния.

### Поток E — Embodiment
- E1. Реальный browser E2E + production build.
- E2. Live2D/TTS прерывание, аудио-часы; Android/Termux тесты.

### Поток F — Интеграция OSS/исследований
- F1. По каждому кандидату (Mem0, Zep/Graphiti, A-MEM, HippoRAG 2, Letta, Hexis, retention-bench, AgentMemoryBench) — URL/revision/license → изолированный эксперимент → решение в `RESEARCH_INTAKE_LEDGER.md`.
- F2. Свежие метрики: FAMA (Memora), MINTEval, AMA-Bench, Mem2ActBench, MemoryArena.

---

## 5. Ближайшие 10 шагов

1. Один exact-head CI-гейт с логами (A1).
2. `verify:all` локальный скрипт (A3).
3. Независимый RU/EN корпус + hash (B1).
4. Baseline vs кандидат отчёт (B2).
5. Dense-RRF абляция (B3).
6. FAMA-метрика + тесты (B4).
7. Memory→action family (B5).
8. Learning controls на одинаковых потоках (C1–C2).
9. Матрица action-safety (D1).
10. Реестр OSS-решений (F1).
