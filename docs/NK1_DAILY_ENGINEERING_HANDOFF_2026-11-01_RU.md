# NK1 — ежедневный инженерный handoff и 18-направленный backlog

**Снимок:** 2026-11-01  
**Канонический репозиторий:** https://github.com/ailtron1ss-rgb/NK1  
**Каноническая source-ветка:** `workpass70-source`  
**Проверенный HEAD на момент снимка:** `b75a1c081661ea9ffaed87639a2d51a6f34fd8cd`  
**Этот документ:** операционный handoff и очередь следующего цикла; он не является заявлением о выполнении перечисленных задач.

## 1. Что подтверждено на текущем source HEAD

- `workpass70-source` указывает на `b75a1c081661ea9ffaed87639a2d51a6f34fd8cd`.
- Последний WorkPass71 progress report указывает `b5800365979c3736e8b69b630396e1022c2d41d8`. GitHub compare показывает, что текущая ветка на **19 коммитов впереди**, без отставания. Поэтому WorkPass71 остаётся историческим baseline, а не описанием текущего HEAD.
- Официальный взвешенный scorecard последнего отчёта — **80.1%**, без повышения в этом handoff. Не пересчитывать score по количеству коммитов или workflow.
- На точном HEAD `b75a1c...` наблюдались 10 успешных workflow и 3 отменённых workflow. Отменённые прогоны не считаются успешными:
  - PASS: [Adaptive Experience Memory Boundary](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41315150956)
  - PASS: [UserModel explicit-forget integrity](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41315150981)
  - PASS: [WorkPass287-288 cognitive contracts](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41315150957)
  - PASS: [Action Gateway governance](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41315151060)
  - PASS: [Verified learning and skill lifecycle](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41315150963)
  - PASS: [Hexis source lineage contract](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41315150890)
  - PASS: [Memory integrity and retrieval gates](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41315150929)
  - PASS: [World perception integrity](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41315150949)
  - PASS: [WorkPass72-73 independent evidence and memory evaluation](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41315150985)
  - PASS: [Unified organism runtime](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41315151015)
  - CANCELLED: browser affect snapshot coherence, NeuroCore core regression validation, WorkPass79 cognitive runtime regression.
- Текущий GitHub Release: tag `Neuro`, release `NeuroKurisu0.1`, опубликован 2026-10-19. Asset: `Neuro_Kurisu_WORKPASS70_2026-10-19.zip`, 135,290,615 bytes, GitHub metadata digest `sha256:c5cf6a63661e28b30f976d03c8839a231341d73a09489b9066f062e29b224286`. Архив в этой сессии не скачан и не распакован: digest из метаданных не выдавать за независимую проверку ZIP.
- Release gate [Issue #485](https://github.com/ailtron1ss-rgb/NK1/issues/485) остаётся human-only blocker: корневая лицензия отсутствует; runtime LICENSE помечает проект private / all rights reserved; review root/runtime/source archives и 477 locked npm components не утверждён. Не менять manifest на approved без решения человека.

## 2. Состояние связанных PR

Проверяй состояние заново в каждом запуске — snapshot быстро устаревает.

| PR | Тема | Состояние в снимке | Следующее действие |
|---|---|---|---|
| [#576](https://github.com/ailtron1ss-rgb/NK1/pull/576) | Восстановление verified backup при отсутствии primary | Open; head `cbd873ff...`; base SHA `c039f84c...`; GitHub сообщил dirty | Сверить конфликтующие изменения FileStateStore с актуальным HEAD; не переносить старый #569 повторно |
| [#569](https://github.com/ailtron1ss-rgb/NK1/pull/569) | Та же persistence recovery задача | Closed, superseded by #576 | Сохранить для истории, не возобновлять |
| [#574](https://github.com/ailtron1ss-rgb/NK1/pull/574) | MotorFrame status-reference integrity | Merged | Изменение уже находится в source lineage; проверить дальнейшую регрессию, не дублировать |
| [#563](https://github.com/ailtron1ss-rgb/NK1/pull/563) | MotorFrame outcome-reference integrity | Open, dirty; base старее текущего source | Проверить, не перекрывается ли #574; точечно rebase/перенос только уникального diff |
| [#559](https://github.com/ailtron1ss-rgb/NK1/pull/559) | Предыдущая версия того же outcome-reference fix | Closed, not merged | Не считать интегрированным; сравнивать только если требуется найти уникальные изменения |
| [#560](https://github.com/ailtron1ss-rgb/NK1/pull/560) | Нейтрализация mouth state вне speaking | Open, dirty; base старее текущего source | Перенести на свежую основу после проверки текущей реализации и сохранить тесты |
| [#557](https://github.com/ailtron1ss-rgb/NK1/pull/557) | Avatar preflight path filter | Open; base старее текущего source | Проверить, что parser implementation действительно запускает preflight на точном актуальном SHA |
| [#570](https://github.com/ailtron1ss-rgb/NK1/pull/570) | Architecture scanner false positives | Open; base SHA старее текущего source | Проверить exact diff, актуальность дефекта и CI; не считать зелёный CI старой базы достаточным |
| [#564](https://github.com/ailtron1ss-rgb/NK1/pull/564) | Durable UserModel forget tombstones | Open draft; base SHA старее текущего source | Проверить совместимость с уже влитым explicit-forget; сохранить уникальную защиту после 512-entry replay rollover |

Старые ветки не удалять автоматически. Не сливать PR без отдельного разрешения. Не объединять дублирующиеся реализации по названию: сначала сравнить tree, ancestry, diff и exact-SHA checks.

## 3. Ежедневный пакет — 18 конкретных направлений

Статусы в таблице отражают приоритет следующего цикла, а не утверждение, что задача уже выполнена. На каждый новый день конкретизируй файл, сценарий и критерий по новому HEAD; не копируй формулировки буквально.

| ID | Направление и задача | Приоритет | Зависимости | Критерий приёмки / доказательство | Статус |
|---|---|---:|---|---|---|
| NK1-D20261101-01 | **Core:** проверить, что все фазы Perceive→Appraise→Plan→Act→Reflect→Consolidate используют один актуальный OrganismState и не создают параллельного владельца состояния | P1 | Unified organism runtime | Тест на один и тот же tick/correlation ID, phase transition и отсутствие split-brain state; exact-SHA CI | ready |
| NK1-D20261101-02 | **Perception:** проследить provenance/identity sensor evidence от входа до world-model/appraisal; добавить регрессию на устаревший или несогласованный frame | P1 | Core state contract | Неверная/устаревшая evidence identity отклоняется до appraisal; confidence не повышается без новых данных | ready |
| NK1-D20261101-03 | **Memory ingest:** проверить admission, source lineage, contradiction handling и дедупликацию на изменившихся/повторных фактах | P1 | MemoryOS2 | Повтор источника не создаёт независимое corroboration; конфликт сохраняет provenance и не перезаписывает истину молча | ready |
| NK1-D20261101-04 | **Retrieval:** расширить holdout от пассивного QA к memory-to-action parameter grounding для underspecified запросов | P0 | Retrieval + ActionGateway | Запрос не содержит нужного аргумента; только память даёт его; точный tool+args match, leakage check, baseline и минимум 5 paired seeds | ready |
| NK1-D20261101-05 | **Consolidation/restore:** актуализировать #576 на current source; проверить missing-primary, corrupt-primary, backup preservation и unchanged-save recovery | P1 | FileStateStore + recovery CI | Тесты подтверждают восстановление и повторное создание primary без повреждения последнего verified backup; CI на точном SHA | blocked: dirty PR base |
| NK1-D20261101-06 | **Motivation/initiative:** проверить cadence/silence/external interrupt semantics и отделить запланированную внутреннюю инициативу от heartbeat | P1 | OrganismRuntime | Due wake запускает внутреннюю активность, внешний сигнал не задерживается; измерять инициативу отдельно от skipped ticks | ready |
| NK1-D20261101-07 | **Planning:** проверить, что selector/forward-model использует retrieved constraints и может отклонить план с недостающими параметрами | P1 | Retrieval + appraisal | План либо содержит подтверждённые параметры, либо запрашивает недостающее; no guessed constraints | ready |
| NK1-D20261101-08 | **ActionGateway/Hermes:** проверить permission boundary, tool schema, idempotency и exactly-once recovery на актуальном runtime | P1 | Tool governance + receipts | Повтор/replay не повторяет side effect; unsafe action остаётся blocked без approval; workflow exact SHA | ready |
| NK1-D20261101-09 | **Reflection/outcome:** проверить, что learning credit выдаётся только по верифицированному внешнему postcondition, а ACK/exception/timeout остаётся unresolved | P1 | Action receipts + evidence ledger | Неуспешное/неизвестное действие не улучшает skill score; late proof reconciliation идемпотентен | ready |
| NK1-D20261101-10 | **SelfModel/personality:** связать автобиографические утверждения с доказательствами и проверять temporal consistency после restart | P1 | SelfModel + persistence | Не подтверждённое событие не превращается в durable self-claim; restart сохраняет provenance | ready |
| NK1-D20261101-11 | **UserModel/ToM:** проверить explicit forget tombstones и запрет повторного добавления устаревших наблюдений после rollover/restart | P1 | Existing explicit-forget + #564 | Устаревшая запись до deletion boundary отклоняется даже после 520+ событий; свежий явный re-consent разрешён | blocked: stale draft base |
| NK1-D20261101-12 | **EthicalGate/PEA:** adversarial-тесты на privilege escalation, prompt injection, user-controlled provenance и cross-user leakage | P0 | ActionGateway + UserModel | Неавторизованные действия/данные отклоняются; все allow paths имеют проверяемый caller provenance | ready |
| NK1-D20261101-13 | **Embodiment integration:** проверить единый renderer-neutral MotorFrame и транзакционный handoff 2D/2.5D/3D после merged #574 | P1 | MotorFrame + renderer adapters | Невалидный frame не доходит до renderer; переключение сохраняет semantic state и не оставляет два активных тела | ready |
| NK1-D20261101-14 | **Avatar assets:** прогнать GLB/VRM preflight на hosted Kurisu asset, проверив complexity bounds, SHA, buffer cardinality и fallback | P1 | Asset catalog + preflight CI | Неверный hash/структура отклоняются до GLTFLoader; локальный/процедурный fallback работает; browser visual E2E отдельно | ready |
| NK1-D20261101-15 | **Speech:** перенести/проверить #560: mouth channels нейтральны вне speaking; проверить barge-in, cancellation и late audio callbacks | P1 | Semantic body projection | Для idle/ended/cancelled/unknown mouthOpen=0; active speaking сохраняет viseme; отдельно измерить реальный lip/audio drift | blocked: stale PR base |
| NK1-D20261101-16 | **Mobile/Termux:** подготовить и выполнить реальный Android soak, включая audio interrupt, offline restore и 10k deterministic ticks | P0 | Device harness + mobile build | На физическом телефоне p95 tick ≤50 ms; audio interrupt ≤200 ms; полный лог и модель устройства; без устройства — blocked, не simulated pass | blocked: physical device |
| NK1-D20261101-17 | **App/API/infrastructure:** dependency-complete production build, DB migration/rollback и adapter inventory; не создавать новые MongoDB/Supabase/Redis stores без подтверждённого текущего владельца | P1 | App/runtime package graph | Чистая установка/build, миграция и rollback на disposable/test environment; RLS/security review для Supabase; Mongo pool settings только после workload data | ready |
| NK1-D20261101-18 | **Validation/release/convergence:** exact-source release gate, branch/PR ancestry, SBOM/provenance и human license review | P0 | Issue #485 + source SHA + Release ZIP | Никакой публикации до human approval, exact-SHA checks, скачанного ZIP и независимой SHA-256 проверки | blocked: human license review |

### Приоритетный dependency order

1. Сначала P0 safety/release/data-truth blockers и восстановление/целостность.
2. Затем PRs на stale base — сравнить и перенести только уникальные изменения на текущий source SHA; не плодить повторные PR.
3. Memory-to-action holdout зависит от стабильных retrieval и ActionGateway contracts.
4. Embodiment UI зависит от общего MotorFrame; реальная visual/audio/phone верификация отдельно от unit tests.
5. Production build/migration и Release ZIP выполняются после стабилизации source и ручного license gate.

## 4. Перевод новых исследований в проверяемые NK1 эксперименты

Это исследовательские кандидаты, а не доказательство, что их архитектуры следует копировать или что они уже интегрированы.

- [AgentCL: Toward Rigorous Evaluation of Continual Learning in Language Agents](https://arxiv.org/abs/2606.02461), 2026. Разделять compositional/dependent task streams и независимый read-only holdout; измерять plasticity, stability и generalization отдельно. В NK1 применить к P26/MemoryOS2 и исключить улучшение только на повторяющихся задачах.
- [Mem2ActBench: A Benchmark for Evaluating Long-Term Memory Utilization in Task-Oriented Autonomous Agents](https://arxiv.org/abs/2601.19935), 2026. Проверять не только retrieval recall, но и точное применение памяти к выбору инструмента и параметрам действия. Добавить leak-checked underspecified prompts и exact Tool Accuracy.
- [Evo-Memory: Benchmarking LLM Agent Test-time Learning with Self-Evolving Memory](https://arxiv.org/abs/2511.20857), 2025. Сравнить memory-enabled и memoryless baseline на последовательных task streams; отделить write/read phase от read-only evaluation и измерять task outcome после каждого шага.
- [Retrieval-Driven Memory Reconsolidation for Long-Term LLM Agents](https://arxiv.org/abs/2609.16053), 2026. Рассматривать retrieval-triggered локальную reconsolidation только как отдельную экспериментальную гипотезу; сравнивать downstream task success, memory graph churn, latency и forgetting, не менять production memory topology до ablation/holdout.

**Инженерный вывод:** текущая критическая недостающая проверка — не ещё один общий recall score, а доказательство, что NK1 применяет долговременную память для правильного действия, не использует устаревшие сведения и не ухудшает независимые задачи.

## 5. Инфраструктура и подключённые инструменты

- GitHub connector доступен и использован для source/PR/CI/release metadata.
- Firecrawl research и Consensus paper search/fetch доступны и использованы для исследования.
- Supabase и MongoDB Atlas connectors присутствуют, но package manifests просмотренных root/runtime не показывают прямых строк-зависимостей `supabase`, `mongodb` или `redis`; это не доказывает отсутствие адаптеров в других файлах.
- Redis connector в текущем окружении отсутствует.
- Replit не обнаружил подключённого приложения NK1 в предыдущем поиске; не создавать новый app без отдельного решения.
- Не запускать production DB mutations, не создавать новые проекты/кластеры, не использовать платные ресурсы и не добавлять секреты без явного разрешения.

## 6. Правила преемственности

- В начале следующего цикла сначала перечитать этот handoff, затем проверить live HEAD, Release, PR, exact-SHA Actions и только потом менять статусы.
- Этот snapshot относится к 2026-11-01. Если его SHA не является актуальным, не применять его механически.
- Для каждого изменённого компонента отдельно ставить IMPLEMENTED / CONNECTED / TESTED / RELEASED.
- Не повышать официальный 80.1% score без обновлённого scorecard с воспроизводимыми raw evidence; independent holdout и real phone soak остаются обязательными.
- Merge, Release publication, license approval, production mutation, secret/permission changes и удаление веток остаются под отдельным контролем пользователя.
