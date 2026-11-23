# NK1 / NeuroCore — аналитический отчёт по веткам и план консолидации

**Дата среза:** 2026-11-23  
**Репозиторий:** `ailtron1ss-rgb/NK1`  
**Рабочая source-линия:** `workpass70-source`  
**HEAD ствола на момент анализа:** `0035eca4a6583ab42d6780ea1e5c9f3c8ecab393` (2026-11-22)  
**HEAD `main`:** `06e01cdd0a8e60ed70991f22e842887f544d1ebf` (2026-11-20)  
**Тип документа:** аналитический отчёт, не release approval и не разрешение на удаление веток.

> **Дополнено 2026-11-23:** операционный статус и актуальный порядок действий — в `docs/BRANCH_CONSOLIDATION_LIVE_STATUS_2026-11-23_RU.md`. Базовые цифры ниже — снимок 1 091 ветки / ствол `0035eca`; финальный снимок — 1 105 веток / ствол `89a7047ca`: #1104 и #1106 merged, risk-aware recovery в стволе, #1101 интегрирован, #1112 закрыт без merge; открыты только #1095/#1099 (hold).

---

## 0. Краткий итог

1. В репозитории **1 091 ветка** (по `git ls-remote`), **1 073 уникальных HEAD** и **3 группы веток с полностью совпадающим HEAD** (21 ref; 18 лишних имён). Четвёртая «группа» в локальном зеркале была артефактом alias `origin`, а не отдельной удалённой веткой.
2. Это **не одна история, а две независимые**:
   - `main` — 41 коммит, release/report-линия;
   - source-линия с корнем `ba37a66…` — 4 247 коммитов в `workpass70-source`.
   У `main` и source-линии **нет общего предка**. Прямой merge между ними невозможен и не нужен.
3. Реальный ствол проекта — **`workpass70-source`**, а не `main`. В нём уже содержатся **134 tip-а веток** как предки; ещё **331 ветка** имеет merged PR, чей merge commit находится в стволе (включая squash/merge-случаи).
4. Из 881 ветки, не содержащейся в стволе:
   - **18** отстают не более чем на 20 коммитов — это текущая волна;
   - **4** — на 21–100 коммитов;
   - **15** — на 101–500;
   - **844** — более чем на 500 коммитов (исторические снимки).
5. Открыто **279 PR**: 214 Draft, 65 Ready. Из них **134** целятся в `workpass70-source`, **32** — в `main`, **13** — в `integration`, остальные — в специализированные ветки. **86 PR** стоят друг на друге (stacked); самая длинная цепочка — **22 уровня**.
6. Дубли и почти-дубли:
   - **29 групп** с идентичным patch-содержимым (59 веток);
   - **41 группа** с идентичным git-tree (106 ref);
   - **103 семейства версий** (`-v2`, `-v3`, `-final`, `-current`, `-rebased`, `-r2`…) — 242 ветки.
7. По содержанию: только **41** ветка полностью совпадает со стволом по всем изменённым blob-ам; **533** частично; **299** полностью расходятся (это, как правило, старые снимки, которые при слепом merge откатили бы более новый код). У **440** веток есть пути, отсутствующие в стволе (1 263 уникальных пути) — это кандидаты на выборочный salvage, а не на wholesale merge.
8. **Цель связывания веток** — не «слить всё во всё», а свести работу в одну управляемую систему:
   - один канонический source-ствол (`workpass70-source`);
   - 12–14 долгоживущих аспектных веток по доменам;
   - короткоживущие task-ветки от аспекта;
   - отдельная integration-линия;
   - `main` — только release/docs, не источник runtime-кода.
9. **Практический вывод:** сначала слить 10 текущих Draft-PR (волна 2026-11-22) и проверить 1 закрытый rebased-вариант (#1090), затем архивировать уже вошедшее, затем разобрать дубли/семейства версий, а 844 старые ветки не сливать целиком — только выборочно переносить уникальные файлы/символы с provenance.

---

## 1. Что за проект и зачем вообще связывать ветки

NeuroCore / NK1 — биоинспирированная когнитивная система («организм») с единым циклом:

```
Perceive → Appraise → Attend → Recall → Predict → Motivate → Plan → Act → Observe → Reflect → Consolidate
```

Проект уже описан как набор взаимосвязанных контуров: восприятие, память/обучение, self/affect/drives, world model, мотивация/действия, воплощение/голос, безопасность/доказательства, evaluation/observability. В документации зафиксированы:

- 20 потоков программы завершения и 305 work units;
- 12–14 целевых аспектных веток;
- 75-aspect machine registry;
- release-линия `main` и source-линия `workpass70-source`.

Ветки создавались в трёх разных стилях:

| Стиль | Что означает | Проблема |
|---|---|---|
| `workpassNN-*` | исторический проход/WorkPass | много последовательных снимков одного и того же направления |
| `aspect/<domain>-*` | работа по аспекту | почти всегда ответвлялась от старого source и не rebase-илась |
| `fix/*`, `work/*`, `feature/*` | точечные задачи | пересекаются по файлам и по смыслу с aspect-ветками |
| `consolidation/*`, `integrate/*` | специальные волны сведения | часть уже в стволе, часть осталась висеть |
| `docs/*`, `audit/*`, `research/*` | документация/исследования | не должны смешиваться с runtime-merge |
| `jules-*` | сгенерированные ветки | часто отдельная история без общего предка |

**Цель единой системы:** каждая capability должна иметь одного владельца, один persisted state schema и один путь в канонический runtime. Ветка — это единица работы, а не единица поставки. Поставка — это проверенный commit/PR + evidence, а не имя ветки.

---

## 2. Инвентаризация веток

### 2.1 Общие числа

| Показатель | Значение |
|---|---:|
| Веток на GitHub (`ls-remote`) | **1 091** |
| Remote-tracking ref в локальном зеркале | 1 092 (включая `origin/HEAD`; по `ls-remote` — 1 091) |
| Уникальных HEAD SHA | **1 073** |
| Групп с одинаковым HEAD | **3** |
| Веток в этих группах | 21 |
| Лишних alias-имён | 18 |
| Всего коммитов в fetched history | 21 256 |
| Коммитов в `workpass70-source` | 4 247 |
| Коммитов в `main` | 41 |
| PR всего | 1 089 |
| PR merged | 476 |
| PR closed без merge | 334 |
| PR open | **279** |
| PR open Draft / Ready | **214 / 65** |
| Merged PR, чей merge commit в стволе | **409** |
| Merged PR, вошедшие в другие базы | 67 |
| Веток с merged PR в стволе | **331** |
| Веток — прямых предков ствола | **134** |

> Для сверки: census самого проекта на 2026-11-22 фиксировал 1 074 refs / 1 056 unique HEAD. Наш срез на 2026-11-23 — 1 091 / 1 073, то есть примерно +17 refs за сутки; это подтверждает, что репозиторий продолжает активно пополняться ветками.

### 2.2 Семейства веток

| Семейство | Всего | В стволе (ancestry) | Не слито | ≤20 behind | 21–100 | 101–500 | >500 | Leaf tips | Open PR | Нет общего предка |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `aspect/` | 271 | 27 | 243 | 15 | 3 | 6 | 219 | 220 | 58 | 1 |
| `fix/` | 180 | 14 | 159 | 0 | 0 | 2 | 157 | 147 | 30 | 7 |
| `work/` | 159 | 15 | 141 | 0 | 0 | 0 | 141 | 129 | 43 | 3 |
| `workpass*` (root) | 159 | 25 | 129 | 0 | 0 | 0 | 129 | 111 | 63 | 5 |
| root-level (без префикса) | 107 | 11 | 59 | 0 | 0 | 0 | 59 | 85 | 42 | 37 |
| `consolidation/` | 62 | 23 | 36 | 0 | 0 | 2 | 34 | 38 | 0 | 3 |
| `feature/` | 44 | 3 | 38 | 0 | 0 | 0 | 38 | 37 | 18 | 3 |
| `docs/` | 30 | 3 | 22 | 2 | 1 | 1 | 18 | 27 | 8 | 5 |
| `integrate/` | 27 | 12 | 15 | 0 | 0 | 1 | 14 | 13 | 0 | 0 |
| `feat/` | 14 | 0 | 5 | 0 | 0 | 0 | 5 | 12 | 6 | 9 |
| `audit/` | 6 | 0 | 6 | 0 | 0 | 0 | 6 | 4 | 1 | 0 |
| `research/` | 5 | 0 | 5 | 0 | 0 | 1 | 4 | 5 | 0 | 0 |
| `planning/` | 4 | 0 | 4 | 0 | 0 | 0 | 4 | 4 | 2 | 0 |
| `cline/` | 3 | 0 | 3 | 0 | 0 | 0 | 3 | 3 | 0 | 0 |
| `architecture/` | 2 | 0 | 2 | 0 | 0 | 0 | 2 | 2 | 2 | 0 |
| `optimization/` | 2 | 0 | 2 | 0 | 0 | 0 | 2 | 2 | 1 | 0 |
| `rebase/` | 2 | 0 | 2 | 0 | 0 | 0 | 2 | 0 | 0 | 0 |
| прочие (`automation`, `ci`, `compat`, `experiment`, `jules`, `maintenance`, `nk1`, `perf`, `prototype`, `salvage`, `test`, `typescript`, `verify`) | 13 | 1 | 10 | 1 | 0 | 2 | 7 | 11 | 5 | 2 |
| **Итого** | **1 090** | **134** | **881** | **18** | **4** | **15** | **844** | **850** | **279** | **75** |

> В таблице 1 090 веток без `main` и alias `origin`; полный счёт — 1 091.

### 2.3 Возраст и дрейф

Распределение last-commit по датам показывает три волны:

- **23–31 октября 2026** — основной массив WorkPass-веток;
- **1–4 ноября 2026** — вторая волна (149 веток 1 ноября);
- **13–22 ноября 2026** — новая аспектная волна и consolidation-проходы.

Но дата последнего коммита обманчива: даже свежие ветки отстают от ствола на 13–21 коммит, потому что ствол двигался после их создания. Веток с `behind = 0` среди неслитых **нет**.

---

## 3. Содержание веток

### 3.1 Домены (multi-label по именам веток)

Одна ветка может относиться к нескольким доменам, поэтому суммы не складывать.

| Домен | Веток |
|---|---:|
| Docs / research | 417 |
| Safety / governance / evidence | 249 |
| Memory / retrieval | 232 |
| Integration / tools / adapters | 160 |
| Brain / cognition runtime | 151 |
| Embodiment / avatar | 135 |
| Learning / evaluation | 128 |
| Affect / personality / user model | 102 |
| Autonomy / planning / goals | 99 |
| Infra / CI / release | 97 |
| UI / app / mobile | 45 |
| Evaluation / observability | 27 |
| Voice / speech | 23 |
| Без явного доменного ключевого слова | 110 |

### 3.2 Какие файлы реально меняются

Суммарные касания путей в неслитых ветках (multi-count, одна ветка может трогать путь несколько раз в истории, но здесь — уникальные ветки на путь):

| Путь / область | Касаний |
|---|---:|
| `runtime/neuro-kurisu` | 19 940 |
| `legacy/input-archives` | 3 300 |
| `.github/workflows` | 1 945 |
| `app/src` | 659 |
| `CHANGELOG.md` | 571 |
| `app/scripts` | 275 |
| `package.json` (root/app/runtime) | 438 |
| `NEUROCORE_START_HERE.md` | 126 |
| `tools/*` | ~700 |
| `docs/*` | ~1 000+ |
| `research/research_bridge.py` | 61 |

Вывод: основная масса изменений — это **runtime/neuro-kurisu**, тесты, workflow и документация. Именно там пересекаются ветки и возникают конфликты.

### 3.3 Текущая волна: 22 ветки не старше 100 коммитов от ствола

| Ветка | behind | ahead | Файлов | PR | Смысл |
|---|---:|---:|---:|---|---|
| `aspect/active-information-outcome-closure-20261122` | 13 | 2 | 4 | #1098 Draft | cognition: non-finite outcome receipts |
| `aspect/risk-aware-recovery-runtime-wiring-20261122` | 13 | 6 | 5 | #1101 Draft | autonomy: bounded recovery + `OrganismRuntime` |
| `aspect/p34-evidence-lifecycle-integrity-20261122` | 13 | 12 | 4 | #1097 Draft | P34 evidence lifecycle |
| `aspect/nmcn-runtime-bridge-20261122-r1` | 13 | 28 | 10 | #1099 Draft | NMCN sidecar 0.4.2, server/runtime |
| `aspect/autonomous-cycle-cooperative-batching-20261122` | 14 | 4 | 3 | #1094 Draft | cooperative cancellable batches |
| `aspect/cognitive-resource-interrupt-routing-20261122` | 14 | 4 | 4 | #1096 Draft | resource-escalated interrupt routing |
| `aspect/memory-eviction-projection-reconcile-rebased-20261122` | 14 | 4 | 4 | #1090 closed | rebased memory eviction reconcile |
| `aspect/cognitive-health-runtime-supervision-current-20261122` | 14 | 6 | 5 | #1095 Draft | current-source health supervision |
| `aspect/action-audit-redaction-20261122` | 14 | 7 | 4 | #1093 Draft | ActionGateway redaction |
| `aspect/nmcn-runtime-bridge-20261122` | 14 | 7 | 7 | — | базовая версия, superseded by `-r1` |
| `test/hexis-hmx-restart-idempotency-20261122` | 16 | 2 | 2 | #1085 Draft | restart idempotency test |
| `aspect/memory-hmx-conflict-boundary-20261122` | 16 | 4 | 3 | #1086 merged | HMX conflict isolation |
| `aspect/memory-eviction-projection-reconcile-20261122` | 16 | 5 | 4 | #1088 merged | memory eviction reconcile |
| `aspect/avatar-sleep-animation-fallback-20261122` | 16 | 6 | 4 | #1087 merged | avatar sleep animation |
| `aspect/cognitive-health-runtime-supervision-20261122` | 16 | 9 | 5 | #1092 closed | superseded by `-current` |
| `docs/neurocore-project-map-analysis-20261121` | 16 | 27 | 8 | #1084 Draft | project map + census |
| `aspect/hexis-hmx-export-import-contract-20261121` | 17 | 16 | 8 | #1083 merged | HMX export/import contract |
| `docs/neurocore-live-checkpoint-current-20261121` | 18 | 3 | 2 | #1082 merged | live checkpoint docs |
| `aspect/omestro10-mechanism-serendipity-current-20261121` | 21 | 19 | 15 | #1081 merged | mechanism serendipity |
| `aspect/startup-probe-pr-path-filter-20261121` | 97 | 1 | 1 | #1080 merged | CI path filter |
| `aspect/prototype-health-readiness-probe-guard-20261121` | 99 | 5 | 3 | #1078 merged | health readiness guard |
| `docs/neurocore-prototype-live-checkpoint-20261121` | 99 | 2 | 2 | #1077 closed | superseded docs checkpoint |

---

## 4. Как ветки связаны между собой

### 4.1 Две несовместимые истории

```
main (root e5e610c, 41 commit)
  └── release/report/docs lineage, HEAD 06e01cd
      НЕТ общего предка с source-линией

source lineage (root ba37a66, ~21k commits)
  └── workpass70-source (HEAD 0035eca, 4 247 commit)
        ├── integration-nk1-system-cohesion-20261122 (уже предок ствола)
        ├── integrate/branch-ancestry-consolidation-20261121-15
        ├── 134 tip-а веток — прямые предки ствола
        └── 850 leaf-tip цепочек, из которых 844 отстают >500
```

`git merge main workpass70-source` не сработает: `No common ancestor`. Это не ошибка клона, а свойство репозитория. `main` — отдельная линия релизов и отчётов, source — отдельная линия кода.

### 4.2 Реальный ствол и интеграционные ветки

- **`workpass70-source`** — канонический source-ствол. Содержит 117 branch-tip как предков; на момент анализа HEAD `0035eca` (22 ноября), на 1 коммит новее `integration-nk1-system-cohesion-20261122`.
- **`integration-nk1-system-cohesion-20261122`** — integration-ветка, уже вошедшая в ствол; её HEAD `e271a1e`.
- **`integrate/branch-ancestry-consolidation-20261121-15`** — специальная ancestry-консолидация 15 доноров; уже в стволе.
- **`consolidation/*`** — 62 ветки, 23 уже в стволе. Это готовая инфраструктура сведения; 36 не слиты, но многие имеют merged PR в других базах.
- **`integrate/*`** — 27 веток, 12 в стволе; остальные — старые точечные переносы.

### 4.3 Топология DAG

- **1 073** уникальных tip.
- **850** leaf-tip среди source-веток (**852** с учётом `main`/alias) — это «головы» независимых цепочек.
- **222** tip-а содержатся в более поздних ветках (superseded внутри source-линии), из них **134** — прямо в стволе `workpass70-source`.
- **850** leaf-tip — не слиты; из них:
  - 18 — ≤20 behind;
  - 4 — 21–100;
  - 15 — 101–500;
  - 743 — >500;
  - 70 — без общего предка (в основном `main`-линия и `jules-*`).

### 4.4 Stacked PR: ветки, стоящие друг на друге

- **86** открытых PR имеют base, который сам является head другого открытого PR.
- **193** open PR — «корни» стеков.
- Самая длинная цепочка — **22 уровня**:

```
operation-omega-hexis-2026-10-24
  → workpass331-unified-cognitive-kernel-2026-10-24
  → workpass332-live-runtime-kernel-2026-10-24
  → workpass339-intrinsic-drive-goal-bridge-2026-10-25
  → workpass350-kernel-completion-integrity
  → workpass351-event-fabric-idempotency
  → workpass352-stale-decision-replay-guard
  → workpass353-completion-replay-preflight
  → workpass354-completion-anchor-provenance
  → work/nk1-substrate-restore-integrity-2026-10-26-r1
  → workpass362-event-fabric-restore-boundary
  → … (ещё 10 уровней)
  → workpass373-action-gateway-ingress
```

Такие цепочки **нельзя** сливать по одному PR: каждый следующий основан на предыдущем, а все они отстают от ствола на ~1 985 коммитов. Это исторический donor-стек, а не актуальная очередь merge.

### 4.5 Дубли и семейства версий

| Тип дубля | Групп | Веток/ref | Что это значит |
|---|---:|---:|---|
| Одинаковый HEAD | 3 | 21 ref | разные имена указывают на один commit/tree |
| Одинаковый git-tree | 41 | 106 ref | разные commit-ы, но идентичное дерево |
| Одинаковый patch (набор изменённых файлов + blob SHA) | 29 | 59 | идентичное содержимое патча |
| Семейства версий (`-v2/-v3/-final/-current/-rebased/-rN`) | 103 | 242 | несколько попыток одной задачи |

Крупнейшая группа одинакового HEAD — **17 ref**:

```
nk1-all-branches-merge-2026-10-23
nk1-integration-workspace-2026-10-22
rebuild
workpass79-cognitive-rebuild
workpass116-seed-clustered-learning-eval
workpass117-verified-replay-admission
workpass118-multi-source-learning-integration
workpass119-skill-retrieval-feedback-curriculum
workpass120-verified-skill-revision-gate
workpass121-ledger-bound-promotion-proposals
workpass122-promotion-gate-coverage-hardening
workpass123-authenticated-skill-lifecycle
workpass124-learning-evidence-hardening
workpass135-durable-shadow-run-registry
workpass203-independent-candidate-evaluator
workpass206-runtime-evaluator-wiring
workpass313-actions-history-audit
```

Это **исторический общий предок** (0 ahead / ~982 behind относительно старого source), а не 17 независимых реализаций. Но удалять эти refs нельзя без проверки PR/tag/workflow-ссылок: часть из них используется как base в открытых PR.

Примеры семейств:

- `aspect/affect-restore-integrity-20261103` + `-v2` + `-v3` + `-rebased` — 4 ветки, у v2/v3/rebased идентичный patch; каноническая — `-rebased` (merged #741).
- `aspect/cognitive-health-runtime-supervision-20261122` и `-current-20261122` — 5 общих файлов; каноническая — `-current`.
- `aspect/nmcn-runtime-bridge-20261122` и `-r1` — 7 общих файлов; каноническая — `-r1` (28 ahead, pinned sidecar 0.4.2).
- `aspect/memory-eviction-projection-reconcile-20261122` и `-rebased` — 4 общих файла; #1088 merged, #1090 closed.
- `aspect/inspect-ai-acp-compat-20261113` + `-rebased`; каноническая — `-rebased` (merged #871).

### 4.6 Содержательная эквивалентность со стволом

Проверка: для каждой неслитой ветки сравнивались blob SHA всех изменённых путей с текущими blob-ами `workpass70-source`.

| Класс | Веток | Интерпретация |
|---|---:|---|
| Все изменённые blob-ы совпадают со стволом | **41** | содержимое уже представлено в стволе; безопасно архивировать после проверки |
| Часть blob-ов совпадает | **533** | часть работы уже в стволе, часть — старее/отличается; нужен file-level review |
| Все blob-ы отличаются | **299** | как правило, старый снимок; слепой merge откатил бы новый код |
| Только новые пути, которых нет в стволе | 7 | потенциально уникальные файлы |
| Нет file delta | 1 | пустая/служебная ветка |

Дополнительно: **440** веток содержат хотя бы один путь, отсутствующий в стволе; всего **1 263** уникальных пути. Самые частые «отсутствующие» пути:

```
.github/workflows/repository-wiring-audit.yml         93 ветки
tools/verify-repository-wiring.mjs                    93
tools/verify-repository-wiring.test.mjs               93
runtime/neuro-kurisu/tests/cognitive-dependency-runtime-wiring.mjs   91
runtime/neuro-kurisu/src/organism/core/CognitiveRoutingPolicy.ts     87
runtime/neuro-kurisu/tests/cognitive-routing-policy*.mjs             87
runtime/neuro-kurisu/tests/unified-substrate-runtime-wiring.mjs      76
runtime/neuro-kurisu/src/organism/integration/hexis/*.mjs            64
runtime/neuro-kurisu/tests/memory-budget-restore-integrity.mjs       64
```

Это **не** значит, что все 1 263 пути нужно переносить: часть из них — старые версии файлов, позже переименованных или заменённых в стволе. Это карта для выборочного salvage, а не очередь merge.

---

## 5. Целевая модель единой системы

### 5.1 Роли веток

| Роль | Ветка | Правило |
|---|---|---|
| Release / docs | `main` | только release/report/docs; **не** источник runtime-кода; не сливать source напрямую |
| Канонический source | `workpass70-source` | единственный ствол runtime; все изменения приходят сюда через PR |
| Integration | `integration/*` | временная линия для сложных меж-аспектных сведений; после проверки вливается в ствол |
| Долгоживущий аспект | `aspect/<domain>` | один владелец capability; создаётся от актуального ствола |
| Task | `aspect/<domain>/<topic>-<date>` | короткоживущая; вливается в свой аспект |
| Consolidation | `consolidation/<topic>-<date>` | только сведение/ancestry/provenance; не второй runtime |
| Historical donor | `workpass*`, `work/*`, `fix/*` | архив/донор; не сливать целиком |

### 5.2 13 целевых аспектов

| № | Аспект | Что входит | Основные семейства |
|---:|---|---|---|
| 1 | `core-organism-runtime` | OrganismBus/State, cognitive cycle, scheduling, lifecycle | `aspect/*cognit*`, `workpass331–373`, `architecture/*` |
| 2 | `memory-and-retrieval` | MemoryOS2, MemoryFabric, HMX/HeXis, episodic/semantic, forgetting | `aspect/memory*`, `aspect/hexis*`, `workpass5xx`, `nk1-hexis-*` |
| 3 | `learning-and-neuroplasticity` | replay, LoRA/QLoRA, skill lifecycle, consolidation | `aspect/*plastic*`, `aspect/*skill*`, `workpass11x–12x` |
| 4 | `motivation-autonomy-planning` | drives, goals, initiative, action selection, consequences | `aspect/autonom*`, `aspect/consequence*`, `aspect/world*` |
| 5 | `affect-personality-usermodel` | affect, identity, UserModel, ToM, interoception | `aspect/affect*`, `aspect/personality*`, `aspect/emotion*` |
| 6 | `embodiment-avatar` | 2D/2.5D/3D, Live2D, VRM/GLB, rig, motion | `aspect/avatar*`, `aspect/embod*`, `aspect/kurisu*` |
| 7 | `voice-and-speech` | ASR/TTS, turn-taking, prosody, lip-sync | `aspect/voice*`, `consolidation/neko-*`, `nk1-workpass7x-whisper` |
| 8 | `tooling-and-integrations` | MCP, plugins, adapters, donor frameworks, NMCN | `aspect/nmcn*`, `aspect/integrat*`, `hexis-*bridge*` |
| 9 | `safety-trust-and-governance` | gates, consent, permissions, receipts, redaction | `aspect/action-*`, `aspect/*evidence*`, `fix/*integrity*` |
| 10 | `evaluation-and-observability` | holdouts, paired seeds, benchmarks, telemetry | `aspect/b261-*`, `aspect/inspect-*`, `aspect/*holdout*` |
| 11 | `client-mobile-and-ux` | frontend, mobile, Termux, UI flows | `app/*`, `aspect/prototype-*`, `feature/visual-*` |
| 12 | `infrastructure-release-and-operations` | CI, workflows, build, packaging, release | `docs/*release*`, `fix/release-*`, `workpass79-*` |
| 13 | `research-and-assimilation` | donor research, literature, unaccepted experiments | `research/*`, `aspect/source-archive*`, `planning/*` |

### 5.3 Правила, без которых система снова распадётся

1. Одна capability — один аспект-владелец. Запрещены два «мозга», два memory store, два goal store.
2. Новая ветка создаётся **от актуального ствола**, а не от старого снимка.
3. Merge только через PR с exact-head CI; имя ветки не является доказательством.
4. `main` не используется как замена source-интеграции.
5. Любой перенос фиксирует provenance: исходная ветка, PR, commit SHA, выбранные файлы, blob SHA.
6. Ветка удаляется только после архивного tag и проверки всех PR/tag/workflow-ссылок.
7. Нельзя перезаписывать более новый файл старым снимком только потому, что у ветки «больше номер WorkPass».

---

## 6. План слияния и консолидации

> **Исторический план (снимок `0035eca`).** Актуальный порядок — в `docs/BRANCH_CONSOLIDATION_LIVE_STATUS_2026-11-23_RU.md`. На финальном снимке #1104 и #1106 merged; risk-aware recovery уже в `89a7047ca`; #1084/#1085/#1093/#1094/#1096/#1097/#1098/#1101/#1102/#1112 закрыты; актуальны только #1095/#1099 (hold по budget). Не выполнять волны ниже без повторной проверки head SHA.

### Этап 0. Заморозка и фиксация (1 день)

1. Зафиксировать текущий census: 1 091 ref / 1 073 unique HEAD / 279 open PR.
2. Поставить annotated tag на ствол и на все ветки, которые будут архивироваться:
   ```bash
   git tag -a archive/pre-consolidation-2026-11-23 origin/workpass70-source -m "Branch consolidation baseline"
   ```
3. Сохранить список open PR head/base и защитить эти refs от удаления.
4. Зафиксировать exact-head CI ствола (по документации проекта — 18/18 SUCCESS на checkpoint `a98dbfe`; на `0035eca` требуется перепроверка).

### Этап 1. Архивировать уже вошедшее (без merge)

Кандидаты:

- **134** ветки — прямые предки ствола;
- **331** ветка — имеет merged PR в стволе (включая squash);
- **41** ветка — все изменённые blob-ы совпадают со стволом;
- **29** групп patch-дублей (59 веток) — оставить по одному каноническому представителю;
- **3** группы одинакового HEAD (21 ref) — оставить по одному ref на группу, но только после проверки PR/tag/workflow.

Действие: annotated tag `archive/branches-2026-11-23/<branch>` + запись в `docs/consolidation/`; удаление ref — только после проверки, что ref не является base открытого PR и не упоминается в workflow/docs.

### Этап 2. Слить текущую волну (10 открытых Draft-PR + 1 закрытый rebased-вариант)

Все 10 PR целятся в `workpass70-source` и отстают на 13–21 коммит. Перед merge каждый нужно привести к текущему стволу **merge-коммитом**, не force-push:

```bash
git switch <branch>
git merge origin/workpass70-source
# разрешить конфликты, запустить доменные тесты
git push
```

Порядок — по возрастанию конфликтного риска:

#### Волна A — независимые, низкий риск

| № | PR | Ветка | Почему сначала |
|---:|---|---|---|
| 1 | #1093 | `aspect/action-audit-redaction-20261122` | ActionGateway, изолированные файлы |
| 2 | #1096 | `aspect/cognitive-resource-interrupt-routing-20261122` | CognitiveFrame, 4 файла |
| 3 | #1098 | `aspect/active-information-outcome-closure-20261122` | cognition, 4 файла |
| 4 | #1097 | `aspect/p34-evidence-lifecycle-integrity-20261122` | P34, 4 файла |
| 5 | #1085 | `test/hexis-hmx-restart-idempotency-20261122` | только тест + CHANGELOG |

#### Волна B — core runtime, строго последовательно

Все три трогают `OrganismRuntime.ts`; параллельный merge даст конфликт.

| № | PR | Ветка | Пересечение |
|---:|---|---|---|
| 6 | #1094 | `aspect/autonomous-cycle-cooperative-batching-20261122` | `OrganismRuntime.ts` |
| 7 | #1095 | `aspect/cognitive-health-runtime-supervision-current-20261122` | `OrganismRuntime.ts`, workflow, package.json |
| 8 | #1101 | `aspect/risk-aware-recovery-runtime-wiring-20261122` | `OrganismRuntime.ts`, `UnifiedCognitiveCycle.ts` |

После каждого merge — rebase/merge следующей ветки на новый ствол и повторный exact-head CI.

#### Волна C — memory и integration

| № | PR | Ветка | Комментарий |
|---:|---|---|---|
| 9 | #1090 (reopen) | `aspect/memory-eviction-projection-reconcile-rebased-20261122` | #1088 уже merged; проверить, что rebased-вариант не дублирует; если дублирует — закрыть и архивировать |
| 10 | #1099 | `aspect/nmcn-runtime-bridge-20261122-r1` | 10 файлов, `OrganismRuntime.ts`, `server.mjs`; сливать последним |

#### Волна D — docs

| № | PR | Ветка | Комментарий |
|---:|---|---|---|
| 11 | #1084 | `docs/neurocore-project-map-analysis-20261121` | обновить census этим отчётом; docs-only |

#### Dry-run merge против текущего ствола

Проверка `git merge-tree --write-tree --name-only origin/workpass70-source <branch>` (без изменения рабочего дерева):

| Ветка | Результат | Конфликтующие файлы |
|---|---|---|
| `aspect/action-audit-redaction-20261122` | clean | — |
| `aspect/cognitive-resource-interrupt-routing-20261122` | clean | — |
| `aspect/p34-evidence-lifecycle-integrity-20261122` | clean | — |
| `aspect/autonomous-cycle-cooperative-batching-20261122` | clean | — |
| `docs/neurocore-project-map-analysis-20261121` | clean | — |
| `aspect/active-information-outcome-closure-20261122` | conflict | `runtime/neuro-kurisu/package.json` |
| `test/hexis-hmx-restart-idempotency-20261122` | conflict | `CHANGELOG.md` |
| `aspect/cognitive-health-runtime-supervision-current-20261122` | conflict | `CHANGELOG.md`, `runtime/neuro-kurisu/package.json` |
| `aspect/risk-aware-recovery-runtime-wiring-20261122` | conflict | `CHANGELOG.md` |
| `aspect/nmcn-runtime-bridge-20261122-r1` | conflict | `CHANGELOG.md` |
| `aspect/memory-eviction-projection-reconcile-rebased-20261122` | conflict | `runtime/neuro-kurisu/package.json` |

Все конфликты — механические (`CHANGELOG.md`, `package.json`), runtime-файлы в dry-run сливаются автоматически. Это не отменяет semantic review и exact-head тесты: merge-tree не проверяет поведение.

После слияния — архивировать superseded-ветки:

- `aspect/nmcn-runtime-bridge-20261122` (superseded by `-r1`);
- `aspect/cognitive-health-runtime-supervision-20261122` (superseded by `-current`);
- `aspect/memory-eviction-projection-reconcile-20261122` (если rebased-вариант вошёл);
- `docs/neurocore-prototype-live-checkpoint-20261121` (closed #1077);
- уже merged: `aspect/avatar-sleep-animation-fallback-20261122`, `aspect/memory-hmx-conflict-boundary-20261122`, `aspect/hexis-hmx-export-import-contract-20261121`, `aspect/omestro10-mechanism-serendipity-current-20261121`, `docs/neurocore-live-checkpoint-current-20261121`, `aspect/startup-probe-pr-path-filter-20261121`, `aspect/prototype-health-readiness-probe-guard-20261121`.

### Этап 3. Создать 13 аспектных веток

Создавать **от актуального ствола**, не от старых снимков:

```bash
for a in core-organism-runtime memory-and-retrieval learning-and-neuroplasticity \
         motivation-autonomy-planning affect-personality-usermodel embodiment-avatar \
         voice-and-speech tooling-and-integrations safety-trust-and-governance \
         evaluation-and-observability client-mobile-and-ux \
         infrastructure-release-and-operations research-and-assimilation; do
  git branch aspect/$a origin/workpass70-source
done
```

Переносить в них только то, что прошло file-level review. Не копировать целые деревья старых веток.

### Этап 4. Legacy salvage: 844 ветки >500 behind

Не сливать целиком. Правило:

1. Сгруппировать по домену (13 аспектов), а не по WorkPass-номеру.
2. Для каждой группы найти:
   - файлы, которых нет в стволе (`missing_paths`);
   - файлы, чей blob отличается (кандидаты на более новую реализацию — проверить вручную);
   - файлы, чей blob совпадает (уже в стволе — пропустить).
3. Переносить только уникальные файлы/символы, с provenance-записью.
4. Для каждой перенесённой единицы — доменный тест и exact-head CI.
5. После переноса — архивный tag и закрытие PR/ветки.

Приоритет salvage:

| Приоритет | Что | Почему |
|---|---|---|
| P0 | HMX boundary guard из #866 | реальный integrity gap в live source (по документации проекта) |
| P1 | memory/retrieval: `CognitiveRoutingPolicy.ts`, `unified-substrate-runtime-wiring.mjs`, HMX projector adapters | 60–90 веток содержат эти пути; возможна забытая функциональность |
| P1 | safety/governance: `verify-repository-wiring.mjs`, audit workflows | 93 ветки; инфраструктура проверок |
| P2 | avatar/embodiment: VRM/GLB, rig, 2.5D | много старых снимков, высокий риск конфликтов |
| P3 | docs/research/planning | архивировать как историю, не сливать в runtime |

### Этап 5. `main` — отдельная release-линия

- В `main` попадают только release/docs/artifact-изменения.
- Source-код в `main` не merges-ится напрямую: нет общего предка.
- Релиз собирается из проверенного `workpass70-source` и публикуется как asset + manifest + hash.
- 32 открытых PR в `main` — это docs/release-линия; их нельзя смешивать с runtime-PR.

### Этап 6. Гигиена на будущее

1. Запрет новых `workpassNN-*`, `fix/*`, `feature/*` как постоянных семейств.
2. Имя: `aspect/<domain>/<topic>-<YYYYMMDD>`.
3. Максимальный возраст task-ветки — 14 дней; иначе закрыть/архивировать.
4. Максимальный размер PR — один домен; cross-domain — только через integration-ветку.
5. Branch protection на `workpass70-source`: require exact-head checks, запрет force-push.
6. Автоматический census раз в неделю: refs, unique heads, behind>500, duplicate groups, open PR draft ratio.

---

## 7. Что нельзя делать

| Антипаттерн | Почему опасно |
|---|---|
| `git merge` старых веток целиком | 299 веток имеют все blob-ы отличными от ствола; это откат более нового кода |
| Merge `main` и `workpass70-source` | нет общего предка; получится искусственная история и конфликт всей кодовой базы |
| Сливать 22-уровневый stacked-стек по одному PR | каждый уровень основан на предыдущем; все отстают на ~1 985 коммитов |
| Удалять 17-ref группу одинакового HEAD | часть refs используется как base открытых PR; нужна проверка ссылок |
| Считать «merged PR» доказательством, что tip ветки в стволе | 221 ветка имеет merged PR, но tip не является предком (squash/merge) |
| Считать имя `workpassNNN` признаком актуальности | больший номер не значит более новый код; проверять дату и blob |
| Мержить docs-ветки в runtime | смешивает release-линию и source-линию |

---

## 8. KPI консолидации

| Метрика | Сейчас | Цель через 1 месяц | Цель через 3 месяца |
|---|---:|---:|---:|
| Всего refs | 1 091 | ≤400 | ≤150 |
| Unique HEAD | 1 073 | ≤380 | ≤140 |
| Веток >500 behind | 844 | ≤300 | 0 (архив) |
| Дубль-групп (patch/tree/head) | 29 / 41 / 4 | ≤10 | 0 |
| Семейств версий >1 ветки | 103 | ≤30 | ≤5 |
| Open PR | 279 | ≤120 | ≤60 |
| Draft среди open PR | 214 (77%) | ≤50% | ≤25% |
| Open PR с behind >100 | 237 | ≤80 | ≤10 |
| Веток с merged PR в стволе, но не архивированных | ~197 | ≤50 | 0 |
| Медианный behind open PR | ~1 000+ | ≤100 | ≤20 |
| Exact-head CI на стволе | требует перепроверки | 100% green | 100% green |

---

## Приложение A. 22 ветки (исторический снимок): рекомендуемое действие

> Снимок `0035eca`. На финальном снимке #1104/#1106 merged; risk-aware recovery в `89a7047ca`; #1084/#1085/#1093/#1094/#1096/#1097/#1098/#1101/#1102/#1112 закрыты; актуальны только #1095/#1099 (hold). Актуальная матрица — в `docs/BRANCH_CONSOLIDATION_LIVE_STATUS_2026-11-23_RU.md`.

| Ветка | Действие | Обоснование |
|---|---|---|
| `aspect/action-audit-redaction-20261122` | **Не мержить** (#1093 closed) | superseded стволом; реализация сильнее |
| `aspect/cognitive-resource-interrupt-routing-20261122` | **Не мержить** (#1096 closed) | `dirtyDomains` уже в стволе |
| `aspect/active-information-outcome-closure-20261122` | **Не мержить** (#1098 closed) | поглощён #1104 |
| `aspect/p34-evidence-lifecycle-integrity-20261122` | **Не мержить** (#1097 closed) | поглощён #1104 |
| `test/hexis-hmx-restart-idempotency-20261122` | **Не мержить** (#1085 closed) | поглощён #1104 |
| `aspect/autonomous-cycle-cooperative-batching-20261122` | **Не мержить** (#1094 closed) | trunk уже содержит `setTimeout`; signal API не выделен |
| `aspect/cognitive-health-runtime-supervision-current-20261122` | **Hold** (#1095) | budget 46>45 + workflow/type |
| `aspect/risk-aware-recovery-runtime-wiring-20261122` | **Не мержить** (#1101 closed) | уже в стволе `89a7047ca` |
| `aspect/nmcn-runtime-bridge-20261122-r1` | **Hold** (#1099) | budget 46>45 |
| `docs/neurocore-project-map-analysis-20261121` | **Не мержить** (#1084) | stale runtime-diff; docs поглощены #1106 |
| `aspect/memory-eviction-projection-reconcile-rebased-20261122` | **Проверить и либо merge, либо archive** (#1090 closed) | #1088 уже merged; возможен дубль |
| `aspect/memory-eviction-projection-reconcile-20261122` | **Archive** | #1088 merged |
| `aspect/memory-hmx-conflict-boundary-20261122` | **Archive** | #1086 merged |
| `aspect/avatar-sleep-animation-fallback-20261122` | **Archive** | #1087 merged |
| `aspect/hexis-hmx-export-import-contract-20261121` | **Archive** | #1083 merged |
| `aspect/omestro10-mechanism-serendipity-current-20261121` | **Archive** | #1081 merged |
| `docs/neurocore-live-checkpoint-current-20261121` | **Archive** | #1082 merged |
| `aspect/startup-probe-pr-path-filter-20261121` | **Archive** | #1080 merged |
| `aspect/prototype-health-readiness-probe-guard-20261121` | **Archive** | #1078 merged |
| `aspect/nmcn-runtime-bridge-20261122` | **Archive** | superseded by `-r1` |
| `aspect/cognitive-health-runtime-supervision-20261122` | **Archive** | superseded by `-current` |
| `docs/neurocore-prototype-live-checkpoint-20261121` | **Archive** | #1077 closed, superseded |

---

## Приложение B. Дубли: канонический представитель

| Семейство / группа | Каноническая ветка | Остальные — архив |
|---|---|---|
| Affect restore 20261103 | `aspect/affect-restore-integrity-rebased-20261103` (merged #741) | `-20261103`, `-v2`, `-v3` |
| Consequence ecology | `integrate/consequence-calibration-lineage-followup-20261120` (merged #1052) | `aspect/consequence-ecology-20261117` |
| HMX episodes/relationships | `aspect/hexis-hmx-episodes-relationships-20261113-final` | `-20261113` |
| HMX relationship direction | `aspect/hexis-hmx-relationship-direction-20261113-final` (merged #878) | `-20261113` |
| Inspect ACP compat | `aspect/inspect-ai-acp-compat-20261113-rebased` (merged #871) | `-20261113` |
| Inspect memory gates | `aspect/inspect-memory-independent-group-gates-20261103-v2` (merged #755) | `-v1` |
| Memory confirmatory five-seed | `integrate/memory-confirmatory-five-seed-current-source-20261121` (merged #1065/#1069) | `aspect/memory-confirmatory-five-seed-gate-20261121` |
| Memory eviction reconcile | `aspect/memory-eviction-projection-reconcile-20261122` (merged #1088) | `-rebased` (проверить) |
| Memory live action telemetry | `aspect/memory-task-conditioned-utility-20261115` (merged #894) | `aspect/memory-live-action-telemetry-20261118` |
| Neural prosthesis residual | `consolidation/neural-prosthesis-layer-force-current-parent-20261120` (merged #1017) | `aspect/neural-prosthesis-transformer-residual-20261117` |
| Neurok engineering OS | `aspect/neurok-os-evidence-status-invariants-20261104` (merged #778) | `aspect/neurok-engineering-os-20261103` |
| P23 holdout firewall | `aspect/p23-holdout-firewall-rebase-20261118` (merged #941) | `-current-source-20261114` |
| Release archive reconciliation | `aspect/release-archive-reconciliation-20261103-v2` (merged #754) | `-v1` |
| Source archive review | `aspect/source-archive-review-rebased-20261103` (open #742) | `-20261103` (open #731) |
| Will voluntary attention | `aspect/will-voluntary-attention-budget-20261113-final` (merged #874) | `-rebased` |
| World forge | `integrate/worldforge-to-sharedfuture-after-calibration-20261120` (merged #1054) | `aspect/world-forge-integrated-20261117` |
| Grounded spatial memory | `consolidation/grounded-spatial-memory-current-20261119-v2` (merged #987) | `-current-20261119` |
| Neko streaming | `consolidation/neko-streaming-current-source-implementation-20261119-v3` (merged #994) | `-v2` |
| Bilingual holdout / mem0 | `feature/workpass601-independent-bilingual-holdout-2026-10-28` (merged #335) | `nk1-hexis-mem0-integration-20261027` |
| Cognitive planner restore | `fix/cognitive-planner-restore-integrity-20261101-r3` (merged #622) | `-r2` |
| HeXis belief dedupe | `fix/hexis-belief-dedupe-contract-2026-10-27` (merged #252) | `nk1-workpass509-prevent-fallback-candidate-contamination-2026-10-27` |
| HMX atomic staging | `fix/hexis-hmx-atomic-section-staging-2026-10-26` (closed #227) | `fix/hexis-hmx-atomic-staging-on-idempotent-2026-10-26` |
| Runtime clock backoff | `fix/runtime-clock-task-failure-backoff-2026-10-28` (merged #337) | `nk1-hexis-canonical-apply-2026-10-27` (open #284) |
| Executor checkpoint continuity | `work/nk1-executor-checkpoint-continuity-final-2026-10-30` (open #440) | `-refresh` |
| External observation / receipt snapshot | `work/nk1-receipt-snapshot-fingerprint-2026-10-26-r1` (merged #178) | `work/nk1-external-observation-contract-2026-10-26-r1` |
| Final release gate | `work/nk1-unified-cycle-integrity-release-2026-10-26-r1` (merged #211) | `work/nk1-final-release-gate-2026-10-26-r3` (open #163) |
| Operational cycle atomicity | `work/nk1-operational-cycle-atomicity-2026-10-26-r1` (merged #174) | `work/nk1-release-metadata-lineage-rebased-2026-10-26-r1` |
| UserModel correction provenance | `work/nk1-usermodel-correction-provenance-current-source-2026-11-01` (merged #534) | `work/nk1-usermodel-correction-provenance-2026-11-01` |
| GLB complexity budget | `workpass83-glb-complexity-current` (merged #546) | `workpass82-glb-complexity-budget` |

> Для каждой строки перед архивированием проверить: не является ли ветка base открытого PR; нет ли на неё ссылок в workflow/docs; сохранён ли provenance в tag.

---

## Приложение C. 13 аспектов и текущие семейства

| Аспект | Ветки-кандидаты (примеры) |
|---|---|
| core-organism-runtime | `aspect/cognitive-*`, `aspect/autonomous-*`, `workpass331–373`, `architecture/*` |
| memory-and-retrieval | `aspect/memory-*`, `aspect/hexis-*`, `aspect/hmx-*`, `workpass5xx`, `nk1-hexis-*` |
| learning-and-neuroplasticity | `aspect/neuro-plastic-*`, `aspect/elastic-*`, `aspect/skill-*`, `workpass11x–12x` |
| motivation-autonomy-planning | `aspect/autonom*`, `aspect/consequence-*`, `aspect/world-*`, `aspect/shared-future-*` |
| affect-personality-usermodel | `aspect/affect-*`, `aspect/emotion-*`, `aspect/personality-*`, `aspect/interoceptive-*` |
| embodiment-avatar | `aspect/avatar-*`, `aspect/embod*`, `aspect/kurisu-*`, `aspect/motor-*` |
| voice-and-speech | `aspect/voice-*`, `consolidation/neko-*`, `nk1-workpass7x-whisper` |
| tooling-and-integrations | `aspect/nmcn-*`, `aspect/integrat*`, `hexis-*-bridge-*`, `mem0-*` |
| safety-trust-and-governance | `aspect/action-*`, `aspect/*evidence*`, `fix/*integrity*`, `audit/*` |
| evaluation-and-observability | `aspect/b261-*`, `aspect/inspect-*`, `aspect/*holdout*`, `research/*` |
| client-mobile-and-ux | `app/*`, `aspect/prototype-*`, `feature/visual-*`, `feature/emotional-*` |
| infrastructure-release-and-operations | `docs/*release*`, `fix/release-*`, `workpass79-*`, `typescript/*` |
| research-and-assimilation | `research/*`, `aspect/source-archive*`, `planning/*`, `master-plan-*` |

---

## Приложение D. Методология и воспроизводимость

### Источники

- GitHub REST API: repo metadata, 1 089 PR (state/base/head/merge_commit), rate limit 5 000/час.
- `git ls-remote --heads origin` — 1 091 ref.
- Blobless partial clone + full history: `git fetch --filter=blob:none --unshallow origin '+refs/heads/*:refs/remotes/origin/*'` — 21 256 commit, 27 MB `.git`.
- `git merge-base`, `git rev-list --count`, `git diff-tree --raw`, `git ls-tree -r`.
- DAG-анализ: `git rev-list --all --parents` + bitset-мемоизация для ancestry/leaf-типов.
- Сверка blob SHA изменённых путей с текущим деревом `workpass70-source`.

### Ключевые проверки

```bash
# 1. Ствол и main
git rev-parse origin/workpass70-source
git rev-parse origin/main

# 2. Нет общего предка
git merge-base origin/main origin/workpass70-source || echo "no common ancestor"

# 3. Ветка в стволе?
git merge-base --is-ancestor <branch> origin/workpass70-source

# 4. Дрейф
git rev-list --count <merge-base>..<branch>
git rev-list --count <merge-base>..origin/workpass70-source

# 5. Содержимое изменённых файлов
git diff-tree -r --raw --no-commit-id <merge-base> <branch>
git ls-tree -r origin/workpass70-source

# 6. Patch-дубли
git diff-tree -r --raw --no-commit-id <base> <branch> | sort
```

### Ограничения

1. Тесты и CI в рамках этого анализа **не запускались**; все merge-рекомендации требуют exact-head CI.
2. Blobless clone не содержит содержимого всех blob-ов; выводы о «совпадении» основаны на blob SHA, а не на семантическом diff.
3. `behind` считается от merge-base с `workpass70-source`; для старых веток это не «уникальность», а «насколько снимок отстал».
4. 71 ветка без общего предка (в основном `main`/`jules-*`) требует отдельного анализа, а не merge.
5. Ни одна ветка не удалена и не переименована; отчёт не является разрешением на deletion.
6. Release ZIP, лицензии и production readiness не проверялись; отчёт не меняет release gates.

---

## Итоговая рекомендация

**Не пытаться слить 1 091 ветку в одну.** Правильная цель — свести систему к:

```
main (release/docs)
  ↑ artifact + docs PR
workpass70-source (единственный runtime-ствол)
  ↑ PR с exact-head CI
13 аспектных веток (владельцы capability)
  ↑ короткоживущие task-ветки
archive/* (tag + provenance для всего остального)
```

**Ближайшие 10 действий (фактический статус — в live status):**

1. Не выполнять волны A/B из этого снимка: #1093, #1096, #1098, #1097, #1085, #1094 уже закрыты; #1104 merged.
2. #1106 — docs; уже merged в `538411128`.
3. #1101 — уже интегрирован в `89a7047ca`; патч не применять.
4. #1099/#1095 — hold до решения по architecture budget.
5. #1102 — закрыть как superseded.
6. #1084/#1102/#1101/#1112 — закрыты; не восстанавливать.
7. Поставить archive tags на закрытые ветки.
8. Обновить census через #1106.
9. Ввести branch policy (14 дней, один домен на PR, exact-head CI).
10. Запустить еженедельный census и архивировать patch-дубли/семейства версий.
