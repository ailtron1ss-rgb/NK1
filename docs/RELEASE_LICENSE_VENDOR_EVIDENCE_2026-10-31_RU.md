# Пакет доказательств лицензирования Neuro Kurisu / NK1

**Срез:** 2026-10-31  
**Назначение:** фактическая инвентаризация для человеческой проверки. Это не юридическое заключение и не разрешение на распространение.

## Последний подтверждённый аудит

- Исходный SHA: `7dc96bd0dfa612f6b47c37b6add2bc6ba82a33d2`.
- Workflow run: [41234198086](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41234198086).
- Аудит завершился fail-closed: `releaseRedistributionReady=false`, **136 ошибок**.
- Зафиксировано 8 исходных архивов и 11 файлов LICENSE/NOTICE в репозитории.
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

## Четыре vendor LICENSE без записей человеческого review

| Локальный файл | Проверенное upstream-свидетельство | Отличие / ограничение |
|---|---|---|
| `runtime/neuro-kurisu/research/vendor/CleanRL/LICENSE` | [vwxyzjn/cleanrl LICENSE](https://github.com/vwxyzjn/cleanrl/blob/master/LICENSE); root MIT notice | Upstream LICENSE — составной файл с дополнительными third-party notices. Локальный файл содержит только начальную root MIT часть и не является полной копией upstream LICENSE. Intake заявляет, что код не копировался, адаптировались только методы. |
| `runtime/neuro-kurisu/research/vendor/ContinualAI-Avalanche/LICENSE` | [ContinualAI/avalanche LICENSE](https://github.com/ContinualAI/avalanche/blob/master/LICENSE); MIT | Локальная копия не byte-identical, но полный текст совпадает после нормализации whitespace; различие — переносы/пробелы. |
| `runtime/neuro-kurisu/research/vendor/OpenAI-Baselines/LICENSE` | [openai/baselines LICENSE](https://github.com/openai/baselines/blob/master/LICENSE); MIT | Локальный файл совпадает с upstream по содержимому. |
| `runtime/neuro-kurisu/research/vendor/SkillLearnBench/LICENSE` | [cxcscmu/SkillLearnBench](https://github.com/cxcscmu/SkillLearnBench); GitHub repository metadata reports MIT | Локальный LICENSE совпадает с upstream LICENSE по содержимому. |

Файлы `UPSTREAM_INTAKE.md` для этих четырёх компонентов указывают, что исходный код не копировался, а адаптировались методики. Это утверждение требует подтверждения владельцем проекта. Для четырёх LICENSE-файлов отсутствуют записи в `repositoryLicenseFiles`; я не добавлял фиктивных reviewer, timestamp, approval или redistribution permission.

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
5. Рассмотреть 11 repository LICENSE/NOTICE: 7 записей уже есть, но pending; 4 vendor LICENSE пока не имеют review records.
6. Только после этого заполнить human reviewer, дату, evidenceRef и redistributionApproved, затем повторить release audit.

**Ничего не помечено как approved. Новый Release не опубликован.**
