# Пакет доказательств лицензирования Neuro Kurisu / NK1

## Повторный аудит 2026-11-01 — актуальный статус

- Source: `workpass70-source` @ exact audited SHA `8cf8872ad6005007d1eb1a3b04e82c7f56105c4f`.
- Release workflow: [non-publishing exact-SHA audit run 41286922912](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41286922912).
- Точный audit artifact: `releaseRedistributionReady=false`, **115 ошибок**; freshness/provenance/SBOM checks и захват отчёта прошли, fail-closed остановка произошла на человеческом license review.
- Инвентарь: 477 locked npm components; fingerprint `a10f75530eeac185de88cdf338b094c2cbd9bec7a4c16c9cee7b5d040cb92cd4`; 8 source archives; 11 repository LICENSE/NOTICE.
- Error breakdown: global review 5; root 5; runtime 5; npm inventory 5; source archives 40; repository license files 55.
- Все 11 repository LICENSE/NOTICE review records теперь существуют в manifest, но остаются `pending`; ни одна запись не получила human approval или redistribution grant.
- `runtime/neuro-kurisu/LICENSE` явно обозначает private / all rights reserved. Для публичного ZIP это отдельное решение правообладателя, а не техническая формальность.


**Срез:** 2026-10-31  
**Назначение:** фактическая инвентаризация для человеческой проверки. Это не юридическое заключение и не разрешение на распространение.

## Последний подтверждённый аудит

- Исторический исходный SHA аудита 2026-10-31: `7dc96bd0dfa612f6b47c37b6add2bc6ba82a33d2`.
- Исторический workflow run: [41234198086](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41234198086).
- Аудит завершился fail-closed: `releaseRedistributionReady=false`, **136 ошибок**.
- На историческом срезе было зафиксировано 8 исходных архивов и 11 файлов LICENSE/NOTICE в репозитории.
- В locked npm inventory обнаружено **477 компонентов**.
- Измеренный fingerprint: `a10f75530eeac185de88cdf338b094c2cbd9bec7a4c16c9cee7b5d040cb92cd4`.
- В `RELEASE_LICENSE_REVIEW.json` исправлен только фактический `componentCount: 462 → 477`. Поле fingerprint оставлено `null`, статусы и поля человеческого одобрения не заполнены.
- После этой коррекции следующий аудит должен подтвердить остаток ошибок; до его выполнения нельзя заявлять новое число ошибок.

## Лицензии в app/.grok/skills

Три локальных файла:

- `app/.grok/skills/generate2dmap/LICENSE`
- `app/.grok/skills/generate2dsprite/LICENSE`
- `app/.grok/skills/video2dsprite/LICENSE`

Все три файла побайтно совпадают с [LICENSE проекта 0x0funky/agent-sprite-forge](https://github.com/0x0funky/agent-sprite-forge/blob/main/LICENSE). Текст — MIT. Это подтверждает совпадение текста лицензии, но само по себе не доказывает точное происхождение каждого skill-каталога или разрешение на распространение всего NK1.

## Четыре vendor LICENSE: evidence records добавлены, approval отсутствует

| Локальный файл | Проверенное upstream-свидетельство | Отличие / ограничение |
|---|---|---|
| `runtime/neuro-kurisu/research/vendor/CleanRL/LICENSE` | [vwxyzjn/cleanrl LICENSE](https://github.com/vwxyzjn/cleanrl/blob/master/LICENSE); root MIT notice | SHA-256 локального файла: `34ad40e40ee9d274d4bfcbcd1b56f2a1f8a22b5eb71e42094e78151b76377a85`. Upstream LICENSE — составной файл с дополнительными third-party notices. Локальный файл содержит только начальную root MIT часть и не является полной копией upstream LICENSE. Intake заявляет, что код не копировался, адаптировались только методы. |
| `runtime/neuro-kurisu/research/vendor/ContinualAI-Avalanche/LICENSE` | [ContinualAI/avalanche LICENSE](https://github.com/ContinualAI/avalanche/blob/master/LICENSE); MIT | SHA-256 локального файла: `81a826c503145d79c454c6e49fce9f7bea17d8c1dacff93fe0dbc92283c8bbe5`. Локальная копия не byte-identical, но полный текст совпадает после нормализации whitespace; различие — переносы/пробелы. |
| `runtime/neuro-kurisu/research/vendor/OpenAI-Baselines/LICENSE` | [openai/baselines LICENSE](https://github.com/openai/baselines/blob/master/LICENSE); MIT | SHA-256 локального файла: `fd85a61f2f086d9da85b5d3cbb1a5f49665fc7fe9fed5f799cb5753ad766f710`. Локальный файл совпадает с upstream по содержимому. |
| `runtime/neuro-kurisu/research/vendor/SkillLearnBench/LICENSE` | [cxcscmu/SkillLearnBench](https://github.com/cxcscmu/SkillLearnBench); GitHub repository metadata reports MIT | SHA-256 локального файла: `d4a5e863f521c0fe405a0d94271be34740539f9dfa973c99ab883a771f7fa622`. Локальный LICENSE совпадает с upstream LICENSE по содержимому. |

Файлы `UPSTREAM_INTAKE.md` для этих четырёх компонентов указывают, что исходный код не копировался, а адаптировались методики. Это утверждение требует подтверждения владельцем проекта. Четыре записи добавлены в `repositoryLicenseFiles` со статусом `pending`, точными SHA-256, выражением лицензии и evidenceRef. Поля reviewer/reviewerType/reviewedAt оставлены пустыми, `redistributionApproved=false`; никакого approval не добавлено.

## Другие обнаруженные LICENSE/NOTICE

- Три skill LICENSE выше — MIT; текст совпадает с найденным upstream.
- `legacy/input-archives/hexis-main-2026-10-08/LICENSE` совпадает с [QuixiAI/Hexis LICENSE](https://github.com/QuixiAI/Hexis/blob/main/LICENSE); upstream metadata указывает MIT.
- `legacy/input-archives/will-main-2026-10-08/LICENSE` совпадает с [mindot-ai/will LICENSE](https://github.com/mindot-ai/will/blob/main/LICENSE); upstream metadata указывает Apache-2.0.
- `legacy/input-archives/will-main-2026-10-08/NOTICE` совпадает с upstream NOTICE Mindot.
- `runtime/neuro-kurisu/LICENSE` говорит, что проект private / all rights reserved. Это не открытая лицензия и не явное разрешение на распространение.
- В корне репозитория отдельный root LICENSE не обнаружен.

## Восемь исходных архивов

Все перечисленные архивы входят в release-source tree. Для них нельзя считать распространение разрешённым только по факту наличия архива в репозитории.

| Архив | Что известно сейчас | Что ещё требуется |
|---|---|---|
| `legacy/input-archives/NOMEGA_PASS20_CAPABILITY_FORGE.zip` | Автоматическая инвентаризация не обнаружила license notice на верхнем уровне | Проверить вложенные файлы, владельца, происхождение и разрешение на распространение |
| `legacy/input-archives/NeuroCore_V126_Consolidation_Decontaminated_2026-09-30.zip` | На верхнем уровне license notice не найден | Подтвердить авторство/права и проверить вложенные notices |
| `legacy/input-archives/NeuroCore_V143_FwPKM_Language_2026-10-01.zip` | На верхнем уровне license notice не найден | Подтвердить авторство/права и проверить вложенные notices |
| `legacy/input-archives/external-sources/conscio-4.8.2.tar.gz` | В архиве обнаружен member LICENSE | Не установлены проверенный upstream URL, точная лицензия и версия источника |
| `legacy/input-archives/grok-workspace.zip` | На верхнем уровне license notice не найден | Установить, что именно упаковано, владельца и вложенные notices; не предполагать связь с xAI Grok |
| `legacy/input-archives/raw-source-archives/letta-main.zip` | В архиве обнаружен LICENSE; текущий upstream [letta-ai/letta](https://github.com/letta-ai/letta) имеет Apache-2.0 metadata | Не подтверждены точный commit и совпадение LICENSE внутри конкретного архива |
| `legacy/input-archives/raw-source-archives/lumina-main.zip` | В архиве обнаружен LICENSE | Название Lumina неоднозначно; upstream и точная версия не установлены |
| `legacy/input-archives/raw-source-archives/will-main.zip` | В архиве обнаружены LICENSE и NOTICE; текущий upstream [mindot-ai/will](https://github.com/mindot-ai/will) имеет Apache-2.0 metadata; локальные extracted LICENSE/NOTICE совпадают с upstream | Не подтверждён точный commit, из которого собран zip |

Фраза «license не найден на верхнем уровне» не означает, что вложенных лицензий нет. Архивы не были полностью распакованы и проверены рекурсивно в этой итерации.

## Что остаётся только за человеком

1. Утвердить лицензию корневого проекта и право распространять его исходники.
2. Разрешить распространение runtime: текущий LICENSE указывает private / all rights reserved.
3. Просмотреть полный список 477 locked npm components и принять решение о redistribution; fingerprint остаётся неутверждённым.
4. Для каждого из 8 архивов установить владельца, upstream/commit, license expression и право включения в публичный Release ZIP.
5. Рассмотреть все 11 repository LICENSE/NOTICE: все записи уже есть в manifest, но остаются pending без human approval.
6. Только после этого заполнить human reviewer, дату, evidenceRef и redistributionApproved, затем повторить release audit.

**Ничего не помечено как approved. Новый Release не опубликован.**


## Статусы manifest после evidence-only обновления

- Все 11 repository LICENSE/NOTICE файлов теперь имеют строки в manifest; четыре vendor строки добавлены с проверенными SHA-256.
- Все 8 source archive rows получили `licenseExpression: NOASSERTION` и evidenceRef, пока точные архивные лицензии/происхождение не проверены.
- Root project получил `NOASSERTION` (корневой LICENSE отсутствует); runtime получил `LicenseRef-NK1-Private-All-Rights-Reserved` как внутреннее обозначение текущего private notice.
- `NOASSERTION` означает отсутствие подтверждённого утверждения о лицензии, а `LicenseRef-NK1-Private-All-Rights-Reserved` обозначает локальный proprietary notice. Ни одно из этих значений не разрешает распространение.
- Все записи остаются `pending`; `redistributionApproved=false`; `reviewerType`, `reviewer` и `reviewedAt` не заполнены. Это evidence-only инвентаризация, не human approval.
