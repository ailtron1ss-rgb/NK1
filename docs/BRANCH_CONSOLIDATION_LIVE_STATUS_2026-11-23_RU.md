# NK1 / NeuroCore — живой статус консолидации (финальный снимок)

**Дата снимка:** 2026-11-23
**Ствол:** `workpass70-source` @ `89a7047ca`
**Живых веток:** 1 105 (на момент финальной проверки; счётчик продолжает расти)
**Базовый аналитический отчёт:** `docs/BRANCH_ANALYSIS_AND_CONSOLIDATION_REPORT_2026-11-23_RU.md`
**Тип документа:** операционный статус, не разрешение на удаление веток и не release approval.

---

## 0. Главное

1. **Docs-направление слито.** PR #1106 (`project analysis map + integration ledger + census`) merged в ствол `538411128`; CI 9/9 success.
2. **Runtime/autonomy-направление слито upstream.** Ствол `89a7047ca` уже содержит risk-aware recovery (`riskRecoveryApplied` в 2 runtime-файлах) и обновлённый planner-gate контракт; trunk CI 19/19 success. PR #1101 закрыт.
3. **Наш consolidation PR #1112 закрыт без merge.** Он был собран из #1101 на стволе `538411128`, получил 30/30 зелёных проверок, но ствол успел уйти на `89a7047ca` и уже содержал ту же функциональность с более новым тестом. Merge #1112 откатил бы новый тест, поэтому PR закрыт как superseded. Это ключевая проверка на негативные последствия.
4. **Открыты только #1095 и #1099.** Оба уникальны, но заблокированы `runtimeOutDegree=46 > 45`; #1095 дополнительно workflow v4/Node22 и `unref` type.
5. **Все остальные PR закрыты или merged:** #1084, #1085, #1093, #1094, #1096, #1097, #1098, #1102, #1105, #1101, #1112.
6. **Ветка `aspect/memory-concept-stem-precision-20261123`** — без PR, 3 коммита, based on current trunk; не мержить до появления PR и зелёного CI.
7. **Безопасных merge до решения по architecture budget не осталось.** Принудительно поднимать лимит или мержить stale-ветки нельзя.

---

## 1. Таймлайн изменений

| Момент | Веток | Ствол | Что произошло |
|---|---:|---|---|
| Базовый отчёт | 1 091 | `0035eca` | исходный снимок |
| Середина анализа | 1 095 | `272b1dc84` | combined-security; #1104 создан |
| #1104 merged | 1 098 | `4972c2d52` | P34 + active info + HMX в стволе |
| #1106 merged | 1 101 | `538411128` | docs map + ledger + census |
| **Финал** | **1 105** | **`89a7047ca`** | **risk-aware recovery в стволе; #1112 закрыт** |

**Вывод:** upstream двигался быстрее, чем шла консолидация. Перед любым merge нужно заново получить head SHA и повторить `merge-tree`/CI — цифры этого документа не вечны.

---

## 2. Открытые PR

| PR | Head | Ahead/Behind | CI | Mergeable | Конфликты | Вердикт |
|---|---|---:|---|---|---|---|
| #1099 | `5671cb247` | 28 / 55 | 63/64, 1 fail | dirty | `CHANGELOG.md` | **HOLD: budget 46>45** |
| #1095 | `27eb23c3a` | 6 / 56 | 54/60, 6 fail | dirty | `CHANGELOG.md`, `package.json` | **HOLD: workflow/type + budget** |

### 2.1 #1099 — NMCN runtime bridge

- Уникальный `NmcNRuntimeBridge`; в стволе отсутствует.
- Падает `Import graph and layer boundaries`: `runtimeOutDegree=46 > 45` для `OrganismRuntime.ts`.
- Не мержить до архитектурного решения.

### 2.2 #1095 — cognitive health supervision

- Уникальный `inspectRuntimeCognitiveHealth`; в стволе отсутствует.
- 6 fail: `local-language-resilience`, `metrics`, `verified-promotion`, `Import graph and layer boundaries`, `targeted-and-regression`, `action-governance`.
- Дополнительно: workflow использует `actions/checkout@v4`, `actions/setup-node@v4`, `node-version: 22.14.0` вместо Node 24 / `.nvmrc`; `timeout.unref?.()` даёт `TS2339`.
- После исправления workflow/type останется budget-блокер.

---

## 3. Merged и closed PR

| PR | Состояние | Причина |
|---|---|---|
| **#1104** | **merged** (`4972c2d52`) | P34 + active info + HMX; 15/15 checks |
| **#1106** | **merged** (`538411128`) | docs map + ledger + census; 9/9 checks |
| #1084 | closed | stale runtime-diff (+2692/−1152, 22 runtime-файла); не docs-only |
| #1085 | closed | HMX restart поглощён #1104 |
| #1097 | closed | P34 поглощён #1104 |
| #1098 | closed | active info поглощён #1104 |
| #1093 | closed | redaction уже в стволе, реализация сильнее |
| #1096 | closed | `dirtyDomains` уже в стволе |
| #1094 | closed | trunk уже содержит `setTimeout`; signal API не выделен |
| #1102 | closed | stale integration; behind 24 и 4 конфликта |
| #1105 | closed | предлагал порог `.34`; в #1104 выбран `.45` |
| #1101 | closed | risk-aware recovery уже в стволе `89a7047ca` |
| #1112 | closed (наш) | superseded стволом; merge откатил бы новый planner-тест |

**Проверка после merge #1104:** на стволе проходили P34, outcome attribution и active information closed-loop (`experiments=3`).

---

## 4. Разбор собственного действия: PR #1112

Что было сделано:

1. От ствола `538411128` создана ветка `consolidation/runtime-risk-aware-20261123`.
2. В неё смержен #1101 (6 коммитов); конфликт `CHANGELOG.md` разрешён сохранением обеих записей.
3. Применён проверенный planner-gate test patch.
4. Локально прошли: planner PASS, big-pass 162 PASS, autonomy PASS.
5. Ветка запушена без force; создан PR #1112; exact-head CI — **30/30 success**.

Почему merge не выполнен:

- За время CI ствол ушёл на `89a7047ca` и независимо интегрировал risk-aware recovery.
- В стволе уже есть `riskRecoveryApplied` и более новый planner-gate контракт.
- `merge-tree` показал конфликт в planner-тесте; merge #1112 откатил бы новый контракт.
- PR закрыт без merge; ветка оставлена для archive/provenance.

**Вывод:** зелёный CI на устаревшем head недостаточен. Обязательна повторная проверка текущего ствола непосредственно перед merge.

---

## 5. Направления консолидации

| Направление | Что относится | Статус |
|---|---|---|
| Docs / release | #1106, project map, ledger, census, наши отчёты | #1106 merged; отчёты в `docs/` (untracked) |
| Runtime / autonomy | risk-aware recovery (#1101) | merged upstream в `89a7047ca` |
| Architecture / budget | #1099, #1095 | hold: `runtimeOutDegree 46>45` |
| Memory | `aspect/memory-concept-stem-precision-20261123` | WIP, PR нет |
| Archive | все closed PR | archive tags перед удалением |

---

## 6. Безопасный порядок действий

### Шаг 1. #1099/#1095 — решение по budget

1. **Предпочтительно:** делегировать новую функциональность существующему owned-runtime, чтобы не увеличивать out-degree.
2. **Альтернатива:** явно поднять `maxRuntimeOutDegree` до 46 с обоснованием и owner approval.
3. **Иначе:** hold; не мержить.

Для #1095 сначала исправить workflow (Node 24 / `.nvmrc`, `actions/*@v4` → актуальные) и тип `timeout.unref?.()`.

### Шаг 2. Архив закрытых веток

- Annotated tag `archive/branches-2026-11-23/<branch>` на head каждого closed PR.
- Не удалять ref, пока он является base открытого PR или упоминается в workflow/docs.
- Удаление — только после проверки ссылок.

### Шаг 3. Наши отчёты

- Файлы в `docs/` сейчас untracked.
- Если нужно зафиксировать их в репозитории — отдельный docs-only PR; не смешивать с runtime.

### Шаг 4. Census

- Повторить `git ls-remote` и PR census после стабилизации; текущие 1 105 ветки — снимок.

---

## 7. Самопроверка и последствия

| Действие | Результат | Последствия |
|---|---|---|
| #1104 | merged в `4972c2d52`; 15/15 | профильные тесты на стволе PASS |
| #1106 | merged в `538411128`; 9/9 | docs-направление закрыто |
| #1112 | создан, 30/30 CI, закрыт без merge | предотвращён откат нового planner-теста |
| #1101 | closed | функциональность уже в `89a7047ca` |
| Force-push | не выполнялся | история PR не переписана |
| Удаление веток | не выполнялось | потерь нет |
| Временные worktree | удалены | рабочее дерево не изменено |

**Важно:** локальная ветка `consolidation/runtime-risk-aware-20261123` осталась после закрытия #1112 — как archive/provenance. Это единственное созданное ответвление; оно не мержилось.

---

## 8. Итоговая рекомендация

1. **Не мержить #1099/#1095** до решения по `runtimeOutDegree 46>45`.
2. **#1095** дополнительно требует workflow/type исправлений.
3. **Закрытые PR** — archive tags, затем при необходимости удаление refs.
4. **Наши отчёты** — отдельный docs-only PR, если требуется зафиксировать в репозитории.
5. **Перед любым merge** — заново получить head SHA, `merge-tree`, exact-head CI и проверить, что функциональность ещё не в стволе.

Ни один PR не был смержен с откатом более новых изменений; ни одна ветка не удалена; force-push не выполнялся.
