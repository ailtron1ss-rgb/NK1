# NK1 — консолидация веток Affect Restore Integrity
**Дата аудита:** 2026-11-19  
**Репозиторий:** `ailtron1ss-rgb/NK1`  
**Каноническая ветка:** `workpass70-source`  
**Область:** только семейство восстановления состояния `EmotionAppraisalEngine`; это не полный аудит всех веток репозитория.

## Контрольная точка релиза

- Release: `NeuroKurisu0.1`, tag `Neuro`, опубликован 2026-10-19.
- ZIP: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`.
- Размер по GitHub metadata: 135 290 615 байт.
- SHA-256 по GitHub release asset metadata: `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`.

Метаданные релиза и checksum подтверждены. Сам ZIP в ходе этой сессии не был скачан и распакован, поэтому проверка состава архива и побайтового соответствия исходному дереву **не заявляется**. В релиз ничего не записывалось.

## Что установлено по веткам

### Семейство 3 ноября

| Ветка | Head SHA | PR | Статус PR |
|---|---|---:|---|
| `aspect/affect-restore-integrity-20261103` | `9a2b36a8004966e0c6be550eff9e0898f5bb2422` | #712 | Closed, not merged; superseded by #713 |
| `aspect/affect-restore-integrity-20261103-v2` | `c4285f2c44739a03455fafe50bfa10e66862a7e0` | #713 | Closed, not merged |
| `aspect/affect-restore-integrity-20261103-v3` | `ecaedf58569c07a79a262e019f891597420cf6b0` | #719 | Closed, not merged |
| `aspect/affect-restore-integrity-rebased-20261103` | `7886bc265b492a0505808bf845159c515b418f76` | #741 | Merged |

У `v2`, `v3` и `rebased` совпадают Git blob SHA всех трёх изменённых файлов:

- `EmotionAppraisalEngine.ts`: `49ed9407ea34ae839618aab1fca032bb0fc953db`
- `big-pass-172-emotion-interoceptive-mind.mjs`: `547263da5043c62e08dad4dfb4f51905e8be8c58`
- `nk1-emotion-restore-integrity.yml`: `1ae50d7c421b4491d0a316db0bb3e7b83112ed33`

Это доказывает идентичность **содержимого трёхфайлового патча**, но не полных Git-деревьев. Полные tree SHA отличаются:

- v2: `b154127d713a812845205d643f37cdefa1bb99f6`
- v3: `d4420c0ae235ce4427f286d7b3f922fd38477818`
- rebased: `33b37842676a8df9a3c45f35c81a4182008c4210`

Следовательно, refs нельзя удалять на основании только одинаковых файлов патча: базовые снимки/истории у веток разные. #741 — актуальная на тот момент перенесённая версия; дальнейшие current-source корректировки были выполнены позже.

### Другие ветки восстановления

| Ветка / PR | Head SHA / состояние | Итог |
|---|---|---|
| `aspect/affect-state-restore-integrity-20261102` / #667 | `6a8f6527d308c662a09ad0d7bcb0820396d08355`; closed, not merged | Старая реализация не переносилась поверх более нового source. Полезные тесты и документ выборочно перенесены в #961. |
| `aspect/emotion-restore-integrity` / #665 | `0b01f181668e87ed24e510383519eec9dd666b70`; closed 2026-11-19, not merged | Четыре донорских пути просмотрены. Старый `restore()` не переигрывался поверх текущего кода. Полезные проверки были выборочно сохранены в последующих PR. Ветка сохранена для provenance. |
| `fix/emotion-appraisal-restore-integrity-20261101` / #634 | PR closed, not merged | Устаревшая ветка-донор; её текущее-source поведение было перенесено отдельными последующими PR. |
| `workpass610-affect-restore` / #619 | PR open, Draft; 14 files, +608/-21 | Смешанный/широкий набор изменений. Не закрывался и не удалялся: требуется отдельный аудит всех 14 файлов, он не эквивалентен узкому restore-патчу. |

Соседние ветки `affect-voice-dominance`, `avatar-brain-affect-bridge`, `avatar-cognitive-affect-coupling`, `memory-affect-context-reranking`, `p80-self-state-restore-integrity` и `personality-state-restore-integrity` не объявляются дублями этого семейства: по назначению это другие аспекты, которые нужно анализировать отдельно.

## Что уже интегрировано в текущий source

Параллельные работы в этом же репозитории уже завершили нужную консолидацию кода. Повторный runtime PR от этого аудита не создавался, чтобы не внести дубликат.

| PR | Результат | Merge commit |
|---|---|---|
| [#961](https://github.com/ailtron1ss-rgb/NK1/pull/961) | Merged: выборочные hostile-input регрессии, отдельный affect workflow и handoff-документ | `b04945b0da485d92da0ec52d1264aeda6dc76b76` |
| [#965](https://github.com/ailtron1ss-rgb/NK1/pull/965) | Merged: глубокие current-source restore regressions, allowlist outcome keys, дедупликация ID и проверка связанных feeling/episode | `1fc8446d95e4e1d64547b853224250248c965a29` |
| [#971](https://github.com/ailtron1ss-rgb/NK1/pull/971) | Merged: явный `util.types.isProxy` guard для прозрачных Proxy-объектов и массивов плюс регрессии | `9edf8c2c5297774acb93d24ca261675ffcefafad` |

На точных PR HEAD GitHub Actions отчитался об успешных специализированных проверках и unified runtime:

- #961, head `96a7e85e2e85b96f0e7ae05d3548d64fbba574b3`: affect restore run #3 — SUCCESS; Emotion Restore Integrity run #1069 — SUCCESS; unified runtime run #2429 — SUCCESS.
- #965, head `f188f52b59ffc752c7f9f6cd647f6913dddc0efd`: affect-state restore run #11 — SUCCESS; unified runtime run #2440 — SUCCESS; Emotion Restore Integrity run #1073 — SUCCESS.
- #971, head `cb52c0a7d864010191386ca7059972741d1da29a`: affect-state restore run #20 — SUCCESS; unified runtime run #2450 — SUCCESS; Emotion Restore Integrity run #1085 — SUCCESS.

Таким образом, в текущем `workpass70-source` уже присутствуют allow-list restore validation, ограничения размеров записей/массивов, проверки malformed/accessor/inherited/hostile/revoked inputs, transparent Proxy rejection и связанные тесты/workflows. Дополнительный дублирующий код из этой ветки не нужен.

## Действия в рамках этого аудита

1. Сопоставлены шесть refs веток вокруг restore-integrity и связанные PR.
2. Подтверждено совпадение SHA трёхфайлового патча между v2/v3/rebased; отдельно проверены различия полных tree SHA.
3. PR #665 закрыт как superseded без merge. Его ветка не удалялась.
4. PR #619 оставлен открытым: его 14 файлов не проверены в рамках данного узкого прохода, поэтому закрывать его или удалять ветку пока небезопасно.
5. Runtime-код из временной ветки этого аудита не переносится: функциональность уже интегрирована PR #965/#971. Эта ветка предназначена только для хранения данного branch-family report.

## Ограничения и следующий безопасный шаг

- Не удалена ни одна историческая ветка: точное совпадение изменённых файлов не означает совпадение полного branch tree.
- Не закрыт #619: нужен отдельный file-by-file review его 14 файлов и проверка зависимых PR.
- Это один завершённый проход по выбранному аспекту, а не полный аудит всех 200+ refs репозитория.
- ZIP от 19 октября не распаковывался; release parity не проверялась.
- Источник истины для дальнейшей работы — актуальный `workpass70-source`, а не старые ветки-доноры или `main`.

