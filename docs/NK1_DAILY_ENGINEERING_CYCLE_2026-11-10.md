# NK1 — ежедневный инженерный цикл 2026-11-10

## 1. Снимок проекта и преемственность

- Репозиторий: `ailtron1ss-rgb/NK1`.
- Каноническая рабочая ветка: `workpass70-source`.
- Live HEAD на момент запуска: `189643ede8f3904dd670f0109a28b7536e894c00`.
- Родитель HEAD: `26e2c823284d4238199c80cd1eb8363c5d5c8456`.
- Последний commit: `[NK1][Avatar] Add secure remote VRM/GLB import`, 2026-11-07.
- Дерево source branch: 10,934 entries; tree response не truncated.
- HEAD из checkpoint 2026-11-01 (`735b83d...`) устарел. Не использовать его как live baseline.
- Прочитаны root `AGENTS.md`, `README.md`, `NEUROCORE_START_HERE.md`, canonical backlog и `docs/RESEARCH_INTAKE_LEDGER.md`. Root handoff и README по-прежнему указывают checkpoint 2026-11-01; исторические WorkPass-блоки ниже него не являются live truth.
- Открытый docs PR #831 содержит циклы 2026-11-06/07/08, но его head `aaa51b6e96a409ca0eaa0307af25c790bd3d8414` diverged относительно live source: 23 commits ahead / 2 behind. Не обновлялся и не переписывался: безопасное продвижение требует отдельной синхронизации без force-push.

### Release inventory

| Артефакт | Метаданные GitHub | Состояние проверки |
|---|---|---|
| Stable tag `Neuro` | `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, SHA-256 `c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286` | Метаданные прочитаны; ZIP binary не скачан/не inspected |
| Latest published including prerelease: `workpass70-hotfix1-2026-10-19` | `Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip`, 136,354,713 bytes, SHA-256 `9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb` | Метаданные прочитаны; ZIP binary не скачан/не inspected |

Причина ограничения: доступный GitHub fetch возвращает текстовые данные, а попытка загрузить asset через доступный container downloader была отклонена, поскольку web-слой не смог открыть release URL (cache miss). Поэтому не проверялись CRC/member list/source parity. Не утверждать, что текущий source уже находится в Release ZIP. License review остаётся human gate: redistribution approval не подтверждён.

### Source CI

Для live source HEAD `189643ede8f3904dd670f0109a28b7536e894c00` проверены 7 push runs; все 7 завершились SUCCESS:

- 42341468790 — Avatar Model Preflight
- 42341468836 — UserModel explicit-forget integrity
- 42341468820 — Hexis source lineage contract
- 42341468833 — browser affect snapshot coherence
- 42341468783 — NeuroCore core regression validation
- 42341468784 — embodiment switch contract
- 42341468785 — WorkPass79 cognitive runtime regression

## 2. Счётчики цикла

| Счётчик | Значение | Значение счётчика |
|---|---:|---|
| generated | 18 | Сформированы 18 направлений |
| attempted | 5 | Выполнялись задачи 01, 02, 09, 14, 18 |
| completed | 2 | Полностью завершены задачи 01 и 14 (последняя — перевод существующего PR в review-ready, не merge) |
| partially_completed | 3 | Задачи 02, 09 и 18: реализация/CI продвинулись, но остаются downstream/release gates |
| blocked | 3 | Задачи 04, 05 и 16 требуют независимого датасета или реального hardware soak |
| deferred | 10 | Нет доказанного нового дефекта либо зависимость уже покрыта существующим PR/интеграцией |
| verified | 2 | Полностью подтверждены задачи 01 и 14; частичные CI-подрезультаты не засчитываются как полностью verified |

## 3. Пакет 18 направлений

Статус `no-new-work` означает, что на текущем HEAD не найден отдельный недублирующийся дефект для нового изменения. Это не утверждение, что направление полностью готово к релизу.

| ID | Домен и конкретный результат | Приоритет | Зависимости | Риск / обратимость | Критерий приёмки | Источник факта и статус |
|---|---|---:|---|---|---|---|
| NK1-D20261110-01 | **Core / OrganismBus.** Синхронизировать live HEAD, ancestry, entrypoint docs, backlog, research ledger и exact-SHA source Actions; заменить устаревший 2026-11-01 snapshot только после отдельной безопасной записи. | P0 | GitHub live refs, root docs | Низкий; read-only | HEAD/parent совпадают с API; 7/7 source push runs проверены; устаревший checkpoint помечен | Выполнено и verified: HEAD `189643e...`; AGENTS/README/START_HERE/backlog/ledger прочитаны; 7/7 SUCCESS |
| NK1-D20261110-02 | **Perception / world model.** Закрыть spoof/replay путь: только executor-minted action result и action-bound postcondition receipt могут переводить внешнее наблюдение в grounded state. | P0 | PR #852; PR #853 для восстановления evaluator CI | Высокий; локализованная обратимая правка | Невозможны caller-constructed/copy/replay/cross-run receipts; все downstream consumers проверены; 17/17 exact-head checks | Частично: PR #852 head `44833e2...`, 35 commits ahead / 0 behind, 14 files; Actions 16/17 success. Единственный failure — Inspect ACP dependency, исправление отдельно в #853 |
| NK1-D20261110-03 | **Memory ingest / admission.** Не дублировать admission/forget logic: подтвердить сохранённый UserModel v2 tombstone path и повторную проверку explicit-forget. | P1 | Уже интегрированный UserModel v2 | Низкий; no-new-work | Нет регрессии: forget tombstone не восстанавливает забытый claim после restore/replay | no-new-work: UserModel v2 с durable forgetting уже присутствует; explicit-forget Actions на текущем PR head успешен |
| NK1-D20261110-04 | **Retrieval / recall.** Подготовить независимый RU/EN holdout с source-group provenance и пятью paired seeds; не подменять его synthetic CI fixture. | P0 | Независимый лицензированный dataset, frozen corpus/config/evaluator | Высокий; dataset immutable | `recallDelta > 0` на независимом holdout; ≥5 paired seeds; RU и EN gates; leakage/abstention controls | blocked: внешнего независимого набора данных в этом запуске нет; synthetic Inspect fixture не доказывает uplift |
| NK1-D20261110-05 | **Consolidation / MemFS / restore.** Сохранить atomic backup/restore path; следующий отдельный эксперимент — filesystem/power-loss failure injection, не повторять уже закрытый process-SIGKILL regression. | P1 | Реальная файловая среда / fault injection | Средний; тест обратим | Recovery после interrupted write, сохранение последнего verified backup, restart/restore replay integrity | blocked: базовые backup fixes интегрированы; hardware/filesystem power-loss soak не проводился |
| NK1-D20261110-06 | **Motivation / drives / initiative.** Не добавлять ещё один scheduler; измерить внутренне инициированные действия на soak поверх существующего cadence path. | P1 | Long-running runtime, независимая классификация spontaneous vs scripted | Средний; read-only measurement | ≥1 explainable internally initiated action/hour без scripted trigger и с корректным interrupt/sleep accounting | deferred: cadence work уже существует; новый независимый soak evidence отсутствует |
| NK1-D20261110-07 | **Planning / selector / forward model.** Проверить только новые counterfactual/selector regressions; не переписывать planner без проваленного теста. | P2 | Existing planner runtime | Средний; тестовая правка обратима | Одинаковый input даёт детерминированный ranking; rejected/unsafe action не проходит к executor | no-new-work: cognitive planner cadence weighting check на PR #852 head SUCCESS; новый дефект не выделен |
| NK1-D20261110-08 | **ActionGateway / Hermes skills / permissions.** Сохранить единый ActionGateway и текущую policy composition N.E.K.O.; не создавать второй tool gateway. | P1 | Существующий N.E.K.O. event fabric и manifest policy | Высокий; fail-closed | Denied action не исполняется; policy restore атомарен; повторная доставка idempotent | no-new-work: source уже содержит governed N.E.K.O. ingress/event-fabric work; Action Gateway governance Actions на PR #852 SUCCESS |
| NK1-D20261110-09 | **Reflection / outcome / reafference.** Привязать outcome credit к конкретному decision/execution и verified postcondition; исключить перенос результата на другое действие. | P0 | PR #852; #853 для evaluator | Высокий; обратимая контрактная правка | Decision ID, executor result и exact verifier assessment связаны; copied/replayed/mismatched receipt отвергается | Частично: входит в PR #852; 16/17 Actions success, единственный failure находится в dependency setup Inspect evaluator |
| NK1-D20261110-10 | **SelfModel / personality.** Проверить calibrated self-claims и autobiographical continuity только на реальных trace-backed episodes; не повышать readiness по числу модулей. | P2 | Независимый runtime trace и long soak | Низкий; no-new-work | Self-claim ссылается на доступное evidence; неизвестное состояние остаётся UNKNOWN | deferred: новый подтверждённый дефект или внешний self-initiation evidence не найден |
| NK1-D20261110-11 | **UserModel / ToM.** Не создавать второй forget ledger; сохранить существующие tombstones, explicit correction/forget и restore replay guards. | P1 | UserModel v2 canonical owner | Низкий; no-new-work | Forget/correction переживает restore и не возвращает забытый claim | no-new-work: durable forgetting уже интегрировано; exact-head UserModel explicit-forget Actions SUCCESS |
| NK1-D20261110-12 | **EthicalGate / PEA / privacy.** Не плодить policy layer; проверять текущую fail-closed ActionGateway/N.E.K.O. manifest boundary. | P1 | Existing policy owner | Высокий; no-new-work | Missing/invalid policy не выдаёт tool permission; privacy/approval regressions остаются зелёными | deferred: новые adversarial failures не обнаружены в текущем наборе; независимый red-team проход не выполнялся |
| NK1-D20261110-13 | **Embodiment integration / MotorFrame.** Не добавлять пустой 2.5D renderer; сначала определить depth-rig contract и доказать совместимость с общим MotorFrame. | P2 | 2.5D rig/asset и renderer capability contract | Средний; no-new-work | Один semantic motor command управляет поддерживаемыми 2D/2.5D/3D channels; unsupported channel не имитируется | deferred: renderer-neutral motion и 2D/3D switch уже существуют; полноценный 2.5D depth-rig не подключён |
| NK1-D20261110-14 | **Avatar asset pipeline.** Убрать вторую полноразмерную копию VRM/GLB при сборке Blob из bounded stream chunks; сохранить SharedArrayBuffer fallback. | P1 | Существующая remote avatar import policy/preflight | Низкий; изолированная правка | Multi-chunk, non-zero byteOffset и SharedArrayBuffer regressions; exact PR-head Actions 5/5 | Выполнено и verified: PR #838 head `cc27cd0...`, 2 files, 5/5 Actions SUCCESS; PR переведён в ready-for-review, не merged. Реальный device peak-RSS пока не измерен |
| NK1-D20261110-15 | **Speech / STT-TTS / prosody.** Не дублировать ASR observer или mouth reset; следующим отдельным шагом измерить реальный audio/viseme drift и interruption. | P1 | Android audio hardware, licensed voice/model assets | Средний; measurement-only | Lip-sync drift ≤80 ms; interrupt ≤200 ms; terminal/unknown speech очищает mouth channels | deferred: ASR observer и speech lifecycle reset интегрированы; phone audio soak отсутствует |
| NK1-D20261110-16 | **Mobile runtime / Android / Termux.** Провести 10k deterministic phone ticks и background/foreground soak на реальном устройстве. | P1 | Реальный Android/Termux device | Средний; soak обратим | 10k ticks; ≤50 ms phone tick; корректный offline behavior; restart/resume и interrupt semantics | blocked: физическое устройство и soak в текущей среде недоступны |
| NK1-D20261110-17 | **App/API/infrastructure.** Не создавать новые Supabase/MongoDB/Redis проекты или схемы; сначала подтверждать существующий NK1 adapter owner и authorization. | P2 | Явное архитектурное разрешение и доступы | Высокий; внешние изменения не выполнять | Только существующий canonical adapter; никаких production writes/secrets без разрешения | no-new-work: в AGENTS зафиксировано отсутствие NK1 data plane/adapter; новые сервисы не создавались |
| NK1-D20261110-18 | **Validation / CI / Release ZIP / provenance.** Исправить несовместимость Inspect AI/ACP, добавить import smoke gate и отдельно закрыть ZIP/license release gate. | P0 | PR #853; доступ к binary Release asset; human license decision | Средний для CI; высокий для Release | Push и PR Actions exact SHA зелёные; release ZIP распакован/проверен на member/CRC/source parity; redistribution approved | Частично: PR #853 head `2bae288...`; push run 42820173786 SUCCESS (18/18), PR run 42820349910 SUCCESS (18/18), runtime regression 42820349975 SUCCESS. ZIP binary не inspected; human license gate открыт |

## 4. Реальные изменения и PR

### Новая инженерная правка

Изолированная ветка: `aspect/inspect-ai-acp-compat-20261110`

- `evaluation/inspect_ai/requirements.txt`: `agent-client-protocol==0.12.1` pinned alongside `inspect-ai==0.3.286`.
- `.github/workflows/workpass72-inspect-ai-evidence.yml`: добавлен явный `import acp.helpers; import inspect_ai` smoke gate до запуска обеих Inspect задач.
- Commits:
  - `7803944f126abc9afe783b8322653344bc2a00b7` — pin ACP runtime;
  - `f2156a18dc276998305d6a11cb34ecbb908fbf97` — первоначальный smoke step (YAML scalar syntax failure, job не стартовал);
  - `2bae2883286bfd783c5adcf7b8148b8d70e795f4` — исправлен YAML scalar.
- PR [#853](https://github.com/ailtron1ss-rgb/NK1/pull/853): open, ready for review, mergeable, не merged. Изменено 2 файла.

### Сопровождение существующих PR

- [PR #852](https://github.com/ailtron1ss-rgb/NK1/pull/852): body обновлён фактическим результатом exact-head CI (16/17) и ссылкой на dependency fix #853. PR остаётся Draft; не merged.
- [PR #838](https://github.com/ailtron1ss-rgb/NK1/pull/838): проверен diff (2 файла), exact-head Actions 5/5; переведён в ready-for-review, body исправлен. Не merged.
- [PR #831](https://github.com/ailtron1ss-rgb/NK1/pull/831): оставлен нетронутым из-за diverged head (23 ahead / 2 behind); force-push/rebase не выполнялись.
- `workpass70-source` и `main` напрямую не изменялись. Release, production, secrets, external services и paid resources не менялись. PR не сливались.

## 5. Проверки

| SHA / PR | Проверка | Результат |
|---|---|---|
| Source `189643ede8f3904dd670f0109a28b7536e894c00` | 7 exact-SHA push workflows | 7/7 SUCCESS |
| PR #852 head `44833e2006caa5a10c5d9fde17bf055d3a865e19` | PR-triggered workflows | 16/17 SUCCESS; единственный failure — Inspect task startup из-за ACP import |
| PR #853 head `2bae2883286bfd783c5adcf7b8148b8d70e795f4` | Push workflow 42820173786 | SUCCESS, 18/18 steps |
| PR #853 head `2bae2883286bfd783c5adcf7b8148b8d70e795f4` | PR workflow 42820349910 | SUCCESS, 18/18 steps |
| PR #853 head `2bae2883286bfd783c5adcf7b8148b8d70e795f4` | WorkPass79 regression 42820349975 | SUCCESS |
| PR #838 head `cc27cd02a06d90d0578102306e0456f6e0ab743c` | Exact PR-head Actions | 5/5 SUCCESS |

Причина исходного CI failure на #852 установлена по job log: `inspect-ai==0.3.286` импортирует `acp.helpers`, но resolver установил `agent-client-protocol==1.0.0`, после чего импорт завершился `ModuleNotFoundError`. PR #853 фиксирует версию и проверяет import contract. Это не доказывает retrieval uplift: CI использует synthetic fixture.

## 6. Статус implemented / connected / tested / released

| Компонент | Implemented | Connected | Tested | Released |
|---|---|---|---|---|
| External reality receipt boundary (#852) | Да, в PR branch | В PR branch к OrganismRuntime/GroundedWorldState | Частично: 16/17 Actions; один evaluator dependency failure | Нет |
| Inspect AI / ACP evaluator (#853) | Да, в PR branch | Да, в WorkPass72-73 workflow | Да: push 18/18, PR 18/18 и WorkPass79 SUCCESS | Нет |
| Remote VRM/GLB memory path (#838) | Да, в PR branch | Да, в remote avatar loader | Да: 5/5 exact-head Actions | Нет |
| UserModel explicit forget | Уже в source | Да, canonical UserModel owner | Exact-head workflow SUCCESS | В Release ZIP не подтверждено |
| N.E.K.O. ASR observer | Уже в source | Да, source event path | Source exact-SHA checks SUCCESS | В Release ZIP не подтверждено |
| Release package | Source/metadata exist | ZIP/source parity не доказана | Binary CRC/member inspection не выполнена | Нет нового подтверждённого Release |

## 7. Адаптация целей и блокеры

- Закрыта подцель: устранить плавающий Inspect/ACP resolver boundary; PR #853 прошёл push и PR exact-head checks.
- Повышен приоритет: повторно прогнать PR #852 после интеграции #853; не менять его branch history force-push.
- Поддерживается приоритет P0: независимый RU/EN holdout с ≥5 paired seeds и проверкой source-group leakage.
- Не повышать readiness: независимый holdout и реальный phone soak отсутствуют; Release ZIP не inspected, license approval не получен.
- Не менять основную миссию NK1; не добавлять новый memory store, второй ActionGateway, пустой 2.5D renderer или неподключённые инфраструктурные адаптеры.

## 8. Следующие 5 действий

1. Human review и отдельное решение по merge PR #853; этот цикл merge не выполнял.
2. После интеграции #853 повторно проверить/re-run exact-head Actions PR #852; при необходимости подготовить безопасное обновление без force-push.
3. Human review PR #838; отдельно получить browser/device peak-RSS evidence для remote avatar import.
4. Получить immutable licensed RU/EN holdout с source-group provenance, независимой разметкой и пятью paired seeds.
5. Получить доступный способ скачать и распаковать последний Release ZIP; провести CRC/member/source parity и завершить human license review до любой публикации.

## 9. Handoff следующему циклу

Начинать со свежего GitHub API snapshot, а не со старого SHA в README/AGENTS. На момент завершения этого цикла:

- source HEAD: `189643ede8f3904dd670f0109a28b7536e894c00`;
- PR #852: Draft, head `44833e2006caa5a10c5d9fde17bf055d3a865e19`, 16/17 Actions success;
- PR #853: ready for review, head `2bae2883286bfd783c5adcf7b8148b8d70e795f4`, push + PR evaluator checks success;
- PR #838: ready for review, head `cc27cd02a06d90d0578102306e0456f6e0ab743c`, 5/5 Actions success;
- PR #831: open Draft, diverged vs current source; не переписывать историю;
- Release: latest prerelease ZIP 2026-10-19 по метаданным; binary не inspected;
- merge, release publication, production writes, secrets и external services не менялись.

Главные незакрытые доказательные gates: external receipt provenance downstream review; независимый RU/EN recall uplift; filesystem power-loss; Android/Termux soak; real speech/viseme timing; Release ZIP parity и human license approval.
