# NK1 — Master Plan X: живой реестр выполнения

**Дата среза:** 26 ноября 2026 года  
**Источник требований:** Library / «Мастер план x.docx», Master Plan X / 2.0  
**Канонический источник:** `workpass70-source@9008a8982a5173304456bee2c604bd0bc8665964`  
**Назначение:** единый точный счётчик уникальных задач T3-001–T3-144. Это не новая дорожная карта и не замена исходному Master Plan X.

## Правило зачёта

Задача считается завершённой только после прохождения обязательной цепочки:

`SPECIFIED → SOURCE_PRESENT → CONNECTED → TESTED → INDEPENDENTLY_VERIFIED → DEVICE_VERIFIED (если применимо) → RELEASED`

Для промежуточного статуса сохраняются конкретный SHA, PR, тестовый прогон и причина. Open PR, успешный CI на PR-head, наличие класса/интерфейса, документация или локальный patch **не означают завершение**. Неизвестное обозначается `NOT_AUDITED/UNVERIFIED`, а не PASS/FAIL.

Не складывать 75 аспектов, 121 work package, 205 реконструированных работ, 144 T3-пункта, 305 work units, 1000 taxonomy units, 20 streams и 12 Prototype 0.1 волн: это разные перекрывающиеся уровни детализации. Единственный знаменатель этого счётчика — **144 уникальных T3 ID**.

## Контрольная шкала

| Показатель | Текущее подтверждение |
|---|---:|
| Уникальных T3-задач в плане | 144 |
| Полностью завершено и доказано в canonical source | **0 / 144 (0%)** |
| Проверено на точном HEAD открытого PR | 8 / 144 (5,56%) |
| Точный PR-head CI зелёный, но код не в source | 6 / 144 (4,17%) |
| PR-head CI имеет ошибки | 2 / 144 (1,39%) |
| Не проверено в этом первом проходе | 136 / 144 (94,44%) |

**Важно:** 0% означает «в этой первичной сверке не зачтена ни одна задача на полном пороге завершения», а не «в проекте нет реализации». 6 зелёных PR-head проверок показывают проверенную работу на отдельных ветках, но она ещё не вошла в канонический исходник.

## Статусы и свежие находки

| T3 | Направление | PR | Точный HEAD | Actions |
|---|---|---:|---|---:|
| T3-020 | Current-cycle workspace | [#1186](https://github.com/ailtron1ss-rgb/NK1/pull/1186) | `a29e67f6…` | 73/73 PASS |
| T3-022 | CEF monotonic order / logical time | [#1189](https://github.com/ailtron1ss-rgb/NK1/pull/1189) | `9b131d1b…` | 66/66 PASS |
| T3-029 | Runtime checkpoint generation | [#1170](https://github.com/ailtron1ss-rgb/NK1/pull/1170) | `2095bce3…` | 75/75 PASS |
| T3-031 | Crash-safe continuity journal | [#1174](https://github.com/ailtron1ss-rgb/NK1/pull/1174) | `e1f83557…` | 76/76 PASS |
| T3-050 | Initiative lease / retry | [#1181](https://github.com/ailtron1ss-rgb/NK1/pull/1181) | `974c885b…` | 77/78; 1 failure |
| T3-052 | Durable obligations outbox | [#1182](https://github.com/ailtron1ss-rgb/NK1/pull/1182) | `fb1c5ebb…` | 81/81 PASS |
| T3-086 | World → appraisal/attention | [#1175](https://github.com/ailtron1ss-rgb/NK1/pull/1175) | `0d3b3824…` | 46/49; 3 failures |
| T3-118 | Plugin/cognitive immune quarantine | [#1169](https://github.com/ailtron1ss-rgb/NK1/pull/1169) | `ed40b0a6…` | 23/23 PASS, but stacked on #1170 |

Все перечисленные PR открыты и не включены в canonical source. #1186, #1170, #1174, #1182 остаются Draft; #1189 открыт не Draft. #1169 зависит от #1170 и не является самостоятельным PR поверх source. #1175 имеет `mergeable=false` и три ошибки; #1181 имеет одну ошибку. Не сливать до устранения причин и повторного exact-head CI.

## Исправления структуры волн

- **T3-037–T3-044:** в таблице волн A–G отсутствует назначение. Все восемь задач оставлены `UNASSIGNED`; их нельзя тихо потерять или произвольно разнести без сверки зависимостей.
- **T3-118:** фигурирует в Wave B (P0 safety) и Wave F (research/special mechanisms). Основное назначение — **Wave B**; Wave F записана как вторичная связь. В знаменателе задача считается один раз.
- Волны A–G не смешиваются с отдельной схемой 12 Prototype 0.1 волн и 20 streams.

## Что делаем дальше

1. Проверяем PR #1189 на точных diff/restore инвариантах, обновляем устаревшее описание CI, затем решаем вопрос code review/интеграции по правилам репозитория.
2. Разбираем CI failures PR #1181 и #1175 по фактическим job logs, не ослабляя assertions.
3. Продолжаем последовательность P0: #1170 → #1169, затем #1174; у каждого зависимого PR перечитываем base/head и exact-head Actions перед merge.
4. Расширяем реестр до полного 144/144 статусного аудита, связывая каждый пункт с canonical owner, runtime call site, тестом, критерием и evidence.
5. Только после стабилизации P0 переходим к полной Wave C/D и сквозному Prototype 0.1.

## Baseline и Release

- Source: `workpass70-source@9008a8982a5173304456bee2c604bd0bc8665964`.
- `main@06e01cdd0a8e60ed70991f22e842887f544d1ebf` — отдельный release/metadata контур; не переносить source work напрямую в main.
- Последний Release на момент сверки: [NeuroKurisu0.1 / tag Neuro](https://github.com/ailtron1ss-rgb/NK1/releases/tag/Neuro), 19 октября 2026.
- ZIP metadata digest: `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`; независимое извлечение и source/ZIP parity остаются `UNVERIFIED`.
- Не менять `contracts/RELEASE_LICENSE_REVIEW.json` или человеческое подтверждение лицензий автоматически.

---

**Срез точечных GitHub проверок от 2026-11-26.** Открытые PR и их проверки — промежуточные артефакты, не completed tasks. Перед каждым интеграционным решением HEAD, base SHA, changed files и Actions должны быть перечитаны заново.
