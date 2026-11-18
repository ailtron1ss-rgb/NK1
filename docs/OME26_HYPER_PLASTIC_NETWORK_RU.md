# OME26 — Hyper-Plastic Network (исследовательский контур)

**Статус:** IMPLEMENTED как изолированный research-прототип; не подключён к автоматическому изменению весов активной LLM и не опубликован в Release.

## Что реализовано

- Небольшая MLP-гиперсеть принимает нормализованный контекст из существующего `B292CognitiveStateBus`: тип задачи, уверенность, неопределённость, новизна, остаточный бюджет, стратегия, когнитивная нагрузка, тепловое состояние, готовность и устойчивость.
- Остаточный бюджет передаётся вызывающим кодом из уже существующего `CognitiveBudgetManager`; новая копия бюджета/OrganismState не создаётся.
- Гиперсеть выдаёт ограниченные LoRA-факторы `A` и `B`; обновление вычисляется как `ΔW = (α/r) · B · A`.
- Ограничены rank, target shape, факторные значения и L2-норма итоговой дельты. Базовая матрица не модифицируется на месте; адаптер, target metadata и его матрицы замораживаются, SHA-256 fingerprint повторно проверяется перед математической композицией.
- Есть offline `trainStep` с global L2 gradient clipping, проверкой конечности и атомарным commit набора новых параметров; checkpoint snapshot/restore привязан к target/rank/alpha и проверяется по SHA-256. Обучение не вызывается из runtime.
- Promotion gate требует не менее пяти согласованных paired seeds для calibration и отдельного holdout, единый base-model/adapter fingerprint, положительный calibration gain, положительную одностороннюю 95% нижнюю границу для holdout gain, отсутствие зафиксированных safety regressions и средний latency overhead не выше 20%.
- Backend route остаётся на baseline, пока host не выдаст capability через `createTrustedHyperPlasticAdapterCapabilities` с настоящим loader, exact target layers и pinned base-model SHA-256. Plain caller objects/booleans не принимаются; capability и promotion permit — раздельные process-local object capabilities. JSON-копии не авторизуют маршрут.

## Границы доказательств

- Сейчас это математический и контрактный прототип на малых матрицах, а не LoRA-патч для реальной llama.cpp/Transformer-модели.
- Весовые параметры гиперсети и offline fitting API реализованы, но калиброванный реальный обучающий корпус, модель-специфичный export, quantization compatibility и измеренный inference uplift ещё не представлены.
- Synthetic evaluation reports в тесте подтверждают работу gate и вычислений, а не качество реальной модели, transfer или ускорение.
- Promotion permit и backend capability — process-local object capabilities, а не криптографические подписи, hardware attestation или sandbox. Подлинность evaluation evidence обеспечивается отдельно Ed25519-подписями `VerifiedOutcomeArtifact`; fingerprint гиперсети/адаптера/checkpoint — SHA-256 digest, но сам по себе не подписывает происхождение.
- Сгенерированный адаптер и его вложенные матрицы замораживаются; композиция повторно проверяет fingerprint и норму дельты. Checkpoint гиперсети также имеет checksum-проверку при restore.
- `OpenAICompatibleLocalChatProvider` явно публикует immutable capability `supportsLowRankAdapters=false`: OpenAI-compatible `/chat/completions` не реализует загрузчик LoRA. Для live route потребуется отдельный host-owned backend loader; текущий провайдер остаётся baseline-only.

## Runtime-интеграция

- В `OrganismCore` добавлены read-only snapshot канонического B292 и метод оценки стоимости через уже существующий `CognitiveBudgetManager`.
- `OrganismRuntime` получил opt-in `hyperPlasticResearch.enabled`; по умолчанию контур выключен. Требуется SHA-256 fingerprint точной базовой модели и model-specific target shape. Cadence должна быть чётной, чтобы брать свежий B292 (Core пересобирает его на чётных тиках).
- На заданной чётной cadence и при достаточной новизне runtime проверяет `b292.tick === cycle.tick`, затем оценивает и списывает `research` через тот же Core-owned budget manager ровно один раз на когнитивный tick. Повторный tick, стратегия `defer`, невалидная модель или неподходящий ресурсный режим блокируются до списания.
- Кандидат выходит в результате цикла и evidence/journal как `shadow-only`; базовая модель и активный backend не меняются.

## Следующий инженерный этап

1. Подключить адаптер только к локальному backend, который явно предоставляет queryable capability и точный список поддерживаемых target layers.
2. Реализовать export/load формата адаптера, совместимого с конкретной моделью, LoRA scaling и квантованием; baseline остаётся неизменяемым.
3. Получить независимый RU/EN task corpus с закрытым holdout и пятью или более paired seeds; включить одинаковые токен-/latency-/memory бюджеты.
4. Сравнить baseline, fixed adapter и hypernetwork-conditioned adapter; измерить качество, latency, RAM/VRAM и негативный transfer. Автопромоушен не включать до независимого подтверждения.

## Проверки

`npm run test:ome26:hyper-plastic-network`
`npm run test:ome26:provider-capabilities`
`npm run test:ome26:signed-outcome-metrics`
`npm run test:ome26:signed-promotion`
`npm run test:ome26:runtime-budget-bridge`
`npm run test:ome26:runtime-integration`

Workflow `.github/workflows/ome26-hyper-plastic-network.yml` выполняет runtime typecheck, signed metrics/evidence, provider capabilities, runtime budget, real runtime wiring и hypernetwork contract tests на PR. Этот research PR не меняет Release ZIP и не выполняет автоматическое слияние.
