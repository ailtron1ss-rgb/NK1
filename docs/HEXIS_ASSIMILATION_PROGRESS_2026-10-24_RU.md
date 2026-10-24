## WorkPass510 — актуализация после boundary-проходов (2026-10-24)

- **feature/emotions:** добавлена строгая проверка всех интероцептивных значений и homeostatic pressure в диапазоне [0,1] до обновления предсказателя состояния тела. Добавлены проверки отклонения NaN/вне диапазона/нечислового давления без изменения состояния.
- **feature/feedback:** исправлена семантика RealityEvidenceLedger.recent(limit): нулевой/отрицательный limit теперь означает ноль записей, а не одну; добавлены регрессии и npm alias существующего теста idempotency.
- **planning/master-audit-roadmap:** обновлена карта донорских механизмов Hermes self-evolution, GEPA и Voyager: failure-conditioned reflection, curriculum и compositional skills остаются внутри P23/единого evidence pipeline, без второго memory/optimizer/promotion authority.
- Точные HEAD после записей: эмоции ушли дальше на 5df9149, feedback — ae75696; соответствующие Actions на момент среза queued/in progress. Из-за этого новые тесты не отмечаются как passed. На learning/memory latest-head также имеются неуспешные WorkPass105/110/P26 runs; их причины требуют отдельного исправительного прохода.
- Процентные оценки ниже не повышаются: локальная корректность двух контрактов не доказывает сквозное улучшение обучения, автономии или готовность к выпуску.

---

## WorkPass504 — обновление карты интеграции после WP500–503 (2026-10-24)

- Пересверен текущий planning snapshot: рабочие изменения уже дошли до WorkPass503, поэтому предыдущие заметки о ранних TypeScript/test blockers трактуются как исторические наблюдения, а не как гарантированно актуальные ошибки текущих HEAD.
- WorkPass502 синхронизировал строгую валидацию UnifiedCognitiveLoop между feedback/perception: события проверяются на границе plain-data до мутации состояния; контрольные символы фильтруются без неоднозначного regex.
- WorkPass499/502 усилили trust boundary reality evidence: пользовательский отчёт остаётся отдельным классом и сам по себе не удовлетворяет external-grounding promotion; неподтверждённые импортированные outcomes после restore не считаются verified outcomes.
- WorkPass503 восстановил отсутствующий npm alias test:p26:learning-input-integrity и переключил Hermes reflective diagnostics на Node 24 --experimental-transform-types для поддержки TypeScript parameter properties. Повторные CI runs отмечены как pending; это не равнозначно успешному exact-head CI.
- Следующая цель интеграции — не добавлять ещё один параллельный Hexis/Hermes runtime, а довести один причинный конверт через action receipt → postcondition verifier → RealityEvidenceLedger → MemoryOS2/P65 → P23. На каждом переходе должны сохраняться source lineage, decision/action identity, trust class и restore/replay idempotency.
- До закрытия прохода сравнить последние HEAD feedback/perception/learning/memory; прогнать целевые тесты на точных SHA; после этого синхронизировать интерфейс и regression contract в PR. Не сливать категории и не обновлять release ZIP без подтверждённых gates.

---

## WorkPass497 — shared identity now reaches P23 causal records (2026-10-24)

- `CausalExperienceStream` now uses the same deterministic projection-ID function as the reality evidence ledger. Grounded outcomes and unverified external imports are intentionally separated by role.
- Legacy snapshot restore reconstructs missing deterministic IDs; regression coverage checks stable runtime IDs, restore stability, and NFKC-normalized external retries.
- New identity only correlates events; it never promotes external imports to trusted learning. They remain `stateGrounded=false`, `replayEligible=false` and excluded from trusted outcome aggregates.
- Next integration boundary: carry the verified action/decision receipt through RealityEvidenceLedger and MemoryOS2/P65 into this P23 record, preserving the upstream provenance across restart.

---

## WorkPass489 — общая identity-функция для reality projections (2026-10-24)

- `EvidenceEventIdentity.ts` теперь одинаков по blob SHA в `feature/feedback` и `feature/perception`; `RealityEvidenceLedger.realityEvidenceEventId` вызывает общий `createRealityEvidenceEventId`.
- Сохранён старый контракт ID `nk1-reality:<role>:<48-hex>`, чтобы не менять существующие snapshot/replay ссылки. Контрольные символы фильтруются явной проверкой code point.
- Decision-bound outcome identity и projection identity остаются разными типами по смыслу: первый выявляет изменение результата при том же решении, второй связывает проекцию с исходным событием/ролью/дискриминатором.
- Добавлен regression test и включён в `test:p2841`. Сам test/CI на последнем SHA не подтверждён выполненным runner; полный runtime мост до MemoryOS2/P65/P23 остаётся открытым.
- WorkPass487 в `feature/feedback` также убрал duplicate `verifyOperationalCycle` и исправил несколько точечных type/input-validation несоответствий; тестовый прогон остаётся непроверенным.

---

## WorkPass486 — текущий технический срез (2026-10-24)

- Создан отдельный технический документ [NK1 project analysis](NK1_PROJECT_ANALYSIS_2026-10-24_RU.md): владельцы подсистем, степень подтверждения integration bridge, observed CI/typecheck blockers, очередность объединения веток и release gates.
- Подтверждено расхождение event identity между feedback и perception: это две веточные реализации, а не одна завершённая общая API. До сквозной передачи verifier/receipt → RealityEvidenceLedger → MemoryOS2/P65 → P23 мост остаётся частичным.
- На runtime typecheck в `feature/experiments` обновлена конфигурация и добавлена реальная Node types dependency, однако успешный semantic check на точном HEAD ещё нужно подтверждать фактическим workflow.
- Следующие кодовые шаги: устранить duplicate `verifyOperationalCycle`, согласовать тест полного набора missing stages с контрактом, исправить тип/импорт/валидацию по подтверждённому текущему SHA, затем унифицировать event identity и проверить retry/conflict/restore сценарии.
- Не объявляются успешными тесты без фактически завершившегося job; PR merge и Release ZIP не подразумеваются коммитом в рабочую категорийную/плановую ветку.

---

# Neuro Kurisu / NK1 — progress and Hexis assimilation checkpoint

**Дата:** 2026-10-24  
**Назначение:** живой engineering triage, чтобы разные категорийные ветки двигались к одной цифровой личности, а не превращались в независимые проекты.

## Как читать проценты

Это **инженерная оценка готовности по имеющемуся коду и зафиксированным release gates**, не эмпирический балл интеллекта, не доля выполненных строк и не доказательство сознания. «Реализовано в ветке» не означает «прошло exact-head CI», «слито в integration» или «вошло в Release ZIP».

## Сводная оценка

| Метрика | Оценка | Обоснование |
|---|---:|---|
| Архитектурный охват целевого организма | 65% | Основные области ядра, памяти, обучения, мотивации, self/user model, безопасности и embodiment представлены в архитектуре/коде, но end-to-end целостность ещё не подтверждена. |
| Готовность к релизу | 44% | Открыты точные CI/typecheck, независимый memory-to-action и learning holdout, полноценные host sandbox/verifier, реальный model/voice/Live2D E2E, soak и release-asset reconciliation. |
| Hexis-адаптация: механизмами | 54% | В ветках уже есть адаптации доказательной памяти P65/MemoryOS2 и reviewed-correction/P23, плюс новые проверки lineage replay; ещё нет общего runtime receipt identity сквозь все подсистемы и завершённого heartbeat/skill-governance port. |
| Память и доказательность | 69% | Есть канонический MemoryOS2, provenance, temporal/revision history и P65; измеримого независимого recall uplift пока нет. |
| Самообучение и жизненный цикл навыков | 68% | P23/Hermes, curriculum, независимая оценка, holdout-проверки и promotion gates существуют; exact-head CI и общий реальный end-to-end learning gain остаются открыты. |
| Автономная инициатива и драйвы | 48% | В NK1 есть cognitive life/goal scheduling, однако Hexis-style budgeted heartbeat ещё нужно доказуемо связать с общим ActionGateway, receipts, лимитами и восстановлением. |
| Личность, отношения и эмоциональная непрерывность | 51% | Есть отдельные подсистемы и ветки, но требуется подтверждение общей долгоживущей state continuity и синхронизации поведенческих решений. |
| Голос, аватар и воплощение | 46% | Реализация и специализированные ветки присутствуют; целевой real-device E2E и синхронизация голоса/эмоций/Live2D остаются release gates. |

**Качественная оценка learning stack: 62/100.** Это triage-оценка архитектуры и доказательных ограждений. Эмпирическое качество обобщения не сертифицировано: независимый holdout, многократные seeds, негативный перенос и outcome verification должны определять настоящую оценку.

## Категорийные ветки — конечная цель

| Ветка | Конкретная конечная цель | Ближайший обязательный переход |
|---|---|---|
| `feature/memory` | Одна каноническая память с источниками, независимыми lineages, временной историей, противоречиями и безопасной консолидацией | Протянуть один event/receipt ID через MemoryOS2 → P65 и проверить replay/restore idempotency |
| `feature/learning` | P23 как единственный контур обучения навыкам: реальные ошибки → diagnosis → кандидат → независимая проверка → контролируемая активация → откат | Проверить exact-head regression, затем связать outcome/evidence IDs с memory lineage и пережить restart |
| `feature/perception` | Сенсорные наблюдения с происхождением, временем, уверенностью, калибровкой и границей между наблюдением и выводом | Сформировать один версионируемый observation envelope, который без потери provenance потребляют memory и P65 |
| `feature/emotions` | Контекстно-зависимое состояние эмоций, обновляемое опытом и выражаемое через поведение/аватар, но не обходящее политику | Разделить наблюдаемый эмоциональный сигнал, оценку и устойчивое состояние; закрыть hostile-restore и continuity tests |
| `feature/personality` | Стабильное SelfModel/ядро ценностей и постепенная изменяемость убеждений/стиля под доказательствами | Защитить конститутивные идентичность/ценности от обычного memory update; привязать изменяемые черты к истории/доказательствам |
| `feature/feedback` | Реальный результат действия и проверенная постусловием обратная связь становятся источником обучения, но ACK/self-report не становится ground truth | Сквозной receipt → independent verifier → P23 credit, включая повтор, конфликт, позднее доказательство и восстановление после restart |
| `feature/visual-embodiment` | Один avatar/voice state, выводимый из состояния организма и конкретного речевого действия | Live2D/voice E2E на целевой машине с измерением audio-to-mouth latency и восстановлением после interruption |
| `feature/experiments` | Воспроизводимый экспериментальный контур: manifest, paired seeds, train/validation/holdout, стоимость и публикация результатов | Добиться доступного exact-head запуска workflow и независимого результата против baseline |
| `planning/master-audit-roadmap` | Владение единой архитектурой, зависимостями, метриками, source provenance, release gates и маршрутом между ветками | Обновлять этот scorecard фактическими runs/metrics, не отметками «вроде готово» |
| `integration` | Проверяемый объединённый source stack без конфликтующих owners; стабильная база для сборки release asset | Принимать draft PR только после проверки diff, точного CI-head и корректного порядка stacked PR |
| `main` / Release ZIP | Воспроизводимый пользовательский релиз, построенный из согласованного кода, с контрольными суммами и rollback | Не переносить код туда обходным путём; синхронизировать release asset только после прохождения release gates |

Ветка `main` остаётся отдельной publication/release line и не является прямой целью слияния исходного rebuild-стека. Перед каждым интеграционным проходом нужно обновлять live PR heads и GitHub comparison: ветки с одинаковым названием категории могут быть существенно разойдены по истории.

## Зафиксированные кодовые проходы этого цикла

### WorkPass477 / H2 — `feature/memory`

- Добавлен необязательный стабильный `independenceKey` в P65 evidence revision.
- Независимость свидетельства определяется по нормализованному lineage key, а не по имени издателя/хоста.
- Evidence replay ключуется lineage + evidence ID, чтобы смена имени хоста или stance не давала второй голос.
- Lineage metadata и ключи истории ограничены по размеру; legacy v2 snapshot восстанавливается с консервативным source fallback.
- Расширен `p65-independent-evidence-revision.mjs` для зеркал публикаций, противоречий в одной lineage, нормализации и round-trip.

Источники: [P65EpistemicLedger](https://github.com/ailtron1ss-rgb/NK1/blob/feature/memory/runtime/neuro-kurisu/src/organism/memory/P65EpistemicLedger.ts), [регрессия](https://github.com/ailtron1ss-rgb/NK1/blob/feature/memory/runtime/neuro-kurisu/tests/p65-independent-evidence-revision.mjs).

### WorkPass477 / H3 — `feature/learning`

- Повтор того же review-evidence fingerprint не может усилить зрелость correction rule под новым observation ID.
- Restore оставляет первый подтверждённый artifact и карантинит поздние записи с повторным fingerprint для того же правила.
- Тестовые события получили разные fingerprints; добавлены проверки live-отказа и restore-quarantine.

Источники: [CorrectionRuleMemory](https://github.com/ailtron1ss-rgb/NK1/blob/feature/learning/runtime/neuro-kurisu/src/organism/learning/CorrectionRuleMemory.ts), [регрессия](https://github.com/ailtron1ss-rgb/NK1/blob/feature/learning/runtime/neuro-kurisu/tests/hexis-correction-memory.mjs), [карта адаптации Hexis](https://github.com/ailtron1ss-rgb/NK1/blob/feature/learning/docs/UPSTREAM_HEXIS_ADAPTATION.md).

### WorkPass478 / H4 — интеграционная карта

- Обновлено описание источников QuixiAI Hexis, hexis-framework Hexis и Bevel Hexis, включая границы копирования кода.
- Задана целевая цепочка: action receipt → canonical memory → P65 → P23 → независимая оценка → согласованная активация → receipt/rollback.
- Полный общий runtime bridge обозначен как открытая работа, а не завершённая интеграция.

### WorkPass479 / H4 partial — `feature/feedback`

- Added `EvidenceEventIdentity.ts`, a shared domain-separated identity helper reused by the existing `OutcomeVerificationService` and by embodied action results.
- `RealityEvidenceLedger` now deduplicates same-ID/same-payload retries, quarantines conflicting payload reuse during live ingest and restore, and excludes quarantined IDs from claim promotion and external-evidence counts.
- `OrganismRuntime` binds the same embodied event ID to separate action and consequence rows. The new regression is wired into P2841 while preserving its existing persistence regression.
- This advances H4 but does **not** close it: verifier-issued outcome IDs still need full propagation across canonical MemoryOS2, P65 and P23; exact-head CI remains unverified.

## Следующие несколько проходов — код вперёд

1. **H4 — evidence identity bridge (memory + feedback):** принять общий immutable event/receipt identity; транзитивно связывать MemoryOS2, P65 и VerifiedOutcomeLedger; тестировать mirror, duplicate, conflict, late proof и restart.
2. **H5 — learning integration:** привязать diagnosis/repair candidate к точному тракту действия и исходным receipts; кандидат не должен менять live behavior до независимого validation/holdout и promotion.
3. **H6 — autonomous heartbeat:** переиспользовать NK1 scheduler/cognitive cycle, не вводить второго планировщика; бюджет, cooldown, stale context, permission-check, ActionGateway и outcomes должны образовывать один цикл.
4. **H7 — perception/emotion/self:** единый timestamped observation envelope; uncertainty и source provenance сохраняются от восприятия до оценки/памяти; изменения self/user model получают основание и аудит.
5. **H8 — embodiment + release:** реальный голос/аватар, Android/Termux run, restart/soak, чистая установка, проверенный workflow, синхронизация release asset.

На каждом шаге — преимущественно implementation: код, контракт, wiring и регрессия в владельческой ветке; затем changelog и точный статус проверки. Не создавать новые модули ради плана, не переключать канонического владельца памяти/обучения и не объявлять улучшение без baseline/holdout evidence.

## Release blockers, которые остаются реальными

- Exact-head CI/typecheck в некоторых текущих стэках ещё не подтверждён; исторический успешный workflow не подтверждает новейший commit.
- Публичная ошибка Actions с runner provisioning не равна ни code failure, ни успешной проверке.
- Независимое улучшение memory retrieval не подтверждено; известный baseline ранее показывал `recallDelta=0`.
- Промоушен обучения должен пройти independent evaluator/holdout; синтетические fixture-тесты сами по себе не доказывают перенос навыка.
- Реальный sandbox/verifier/scanner, local model inference на целевом устройстве, browser/audio/Live2D E2E, security/privacy, soak и clean-room packaging остаются необходимыми.
- Никакое количество модулей, heartbeat или самоотчётов не доказывает субъективное сознание; цель разработки — измеримое поведение автономной, непрерывной и саморазвивающейся цифровой личности.

