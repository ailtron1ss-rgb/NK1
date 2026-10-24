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

