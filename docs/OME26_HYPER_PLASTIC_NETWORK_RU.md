# OME26 — Hyper-Plastic Network (исследовательский контур)

**Статус:** IMPLEMENTED как изолированный research-прототип; не подключён к автоматическому изменению весов активной LLM и не опубликован в Release.

## Что реализовано

- Небольшая MLP-гиперсеть принимает нормализованный контекст из существующего `B292CognitiveStateBus`: тип задачи, уверенность, неопределённость, новизна, остаточный бюджет, стратегия, когнитивная нагрузка, тепловое состояние, готовность и устойчивость.
- Остаточный бюджет передаётся вызывающим кодом из уже существующего `CognitiveBudgetManager`; новая копия бюджета/OrganismState не создаётся.
- Гиперсеть выдаёт ограниченные LoRA-факторы `A` и `B`; обновление вычисляется как `ΔW = (α/r) · B · A`.
- Ограничены rank, target shape, факторные значения и L2-норма итоговой дельты. Базовая матрица не модифицируется на месте; адаптер, target metadata и его матрицы замораживаются, fingerprint повторно проверяется перед математической композицией.
- Есть offline `trainStep`, checkpoint snapshot/restore с проверкой размеров и конечности чисел. Обучение не вызывается из runtime.
- Promotion gate требует не менее пяти согласованных paired seeds для calibration и отдельного holdout, единый base-model/adapter fingerprint, положительный calibration gain, положительную одностороннюю 95% нижнюю границу для holdout gain, отсутствие зафиксированных safety regressions и средний latency overhead не выше 20%.
- Backend route остаётся на baseline, если backend не рекламирует поддержку low-rank adapters, не поддерживает точный target layer, base-model fingerprint расходится или permit не был выдан gate в текущем процессе. JSON-копия permit не авторизует адаптер.

## Границы доказательств

- Сейчас это математический и контрактный прототип на малых матрицах, а не LoRA-патч для реальной llama.cpp/Transformer-модели.
- Весовые параметры гиперсети и offline fitting API реализованы, но калиброванный реальный обучающий корпус, модель-специфичный export, quantization compatibility и измеренный inference uplift ещё не представлены.
- Synthetic evaluation reports в тесте подтверждают работу gate и вычислений, а не качество реальной модели, transfer или ускорение.
- Permit — in-process object capability для защиты от простых JSON/caller-boolean подмен; это не криптографическая подпись и не замена независимому evaluator/host verifier при реальном deployment. Fingerprint адаптера — детерминированный идентификатор прототипа, не криптографический digest.
- Сгенерированный адаптер и его вложенные матрицы замораживаются; композиция повторно проверяет fingerprint и норму дельты. Checkpoint гиперсети также имеет checksum-проверку при restore.
- Реальный backend сегодня не заявляет low-rank capability в этой ветке; поэтому стандартный runtime остаётся на базовой модели.

## Runtime-интеграция

- В `OrganismCore` добавлены read-only snapshot канонического B292 и метод оценки стоимости через уже существующий `CognitiveBudgetManager`.
- `OrganismRuntime` получил opt-in `hyperPlasticResearch.enabled`; по умолчанию контур выключен. Требуется SHA-256 fingerprint точной базовой модели и model-specific target shape.
- На заданной cadence и при достаточной новизне runtime читает B292 из Core, оценивает и списывает `research` через тот же Core-owned budget manager ровно один раз.
- Кандидат выходит в результате цикла и evidence/journal как `shadow-only`; базовая модель и активный backend не меняются.

## Следующий инженерный этап

1. Подключить адаптер только к локальному backend, который явно предоставляет queryable capability и точный список поддерживаемых target layers.
2. Реализовать export/load формата адаптера, совместимого с конкретной моделью, LoRA scaling и квантованием; baseline остаётся неизменяемым.
3. Получить независимый RU/EN task corpus с закрытым holdout и пятью или более paired seeds; включить одинаковые токен-/latency-/memory бюджеты.
4. Сравнить baseline, fixed adapter и hypernetwork-conditioned adapter; измерить качество, latency, RAM/VRAM и негативный transfer. Автопромоушен не включать до независимого подтверждения.

## Проверки

`npm run test:ome26:hyper-plastic-network`
`npm run test:ome26:signed-outcome-metrics`
`npm run test:ome26:signed-promotion`
`npm run test:ome26:runtime-budget-bridge`
`npm run test:ome26:runtime-integration`

Workflow `.github/workflows/ome26-hyper-plastic-network.yml` выполняет этот тест и runtime typecheck на PR. Этот research PR не меняет Release ZIP и не выполняет автоматическое слияние.
