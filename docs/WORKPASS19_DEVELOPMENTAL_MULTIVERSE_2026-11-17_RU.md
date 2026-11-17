# WorkPass 19 — Developmental Multiverse (2026-11-17)

## Status

**IMPLEMENTED — bounded experiment coordinator, first integration slice.** This is not yet an autonomous subprocess farm and does not apply candidate policies to the live organism.

The implementation extends the existing P55 developmental-fork concept through `DevelopmentalMultiverse` and `variantsFromP55Forks()`. P55's active data-only forks can become experiment arms; rejected/replaced forks are excluded.

## Lifecycle

1. `createSession()` accepts one source revision, one environment fingerprint, a five-knob baseline policy profile, candidate deltas, matched validation scenario/seed pairs, and a disjoint holdout scenario set.
2. `validationWorkPlan()` emits the baseline control plus every candidate for every validation pair. The work items share the same initial-state fingerprint and pair fingerprint. The only mutable state exported is the explicit five-number policy profile; memory, conversations, identity records, credentials, and executable code are not copied.
3. The host evaluator records bounded metrics (`quality01`, `cost01`, `safety01`, `stability01`) against the exact work-item fingerprints. Duplicate measurements, unplanned scenarios, changed environments, altered policy profiles, and mismatched source/state bindings are rejected.
4. `selectValidationFinalist()` uses validation pairs only. It enforces non-regressing safety, zero candidate safety violations, bounded cost/stability regressions, and a minimum utility gain. At most one candidate is selected.
5. `holdoutWorkPlan()` then exposes the untouched holdout pairs to baseline + finalist only. Non-finalists never receive holdout items.
6. `finalize()` requires at least five paired holdout observations and a positive lower 95% paired confidence bound, while enforcing the safety/cost/stability gates again. The result is `eligible-for-independent-review` or `rejected`.

Utility is a transparent comparison aid: 0.45 × quality + 0.25 × safety + 0.20 × stability + 0.10 × (1 − normalized cost). Safety violations are a hard veto, not something that can be offset by quality.

## Safety and persistence

- The experiment coordinator is off-cycle. It does not run automatically on the hot cognitive tick.
- It creates data-only work plans; the host is responsible for executing each arm in a genuinely isolated process/runtime and collecting observations.
- A positive local holdout result is **not independent verification**. The decision explicitly requires independent verification and never promotes or writes a profile to live policy.
- Snapshot restore replays observations through the same binding checks and recomputes the selection/result; persisted decision fields are not trusted.
- Session inputs are normalized through a strict allowlist; additional caller fields are discarded.

## Verification

- `tests/developmental-multiverse.mjs`: matched arms, baseline identity, validation-only selection, finalist-only holdout, paired confidence bound, hard safety veto, tampered binding/snapshot rejection, restart replay, P55 adapter filtering, and no automatic promotion.
- The focused Node 22 test passes locally.
- Full runtime typecheck and repository Actions remain authoritative and must pass on the exact PR HEAD before merge.

## Remaining integration work

- Bind work items to the existing host-owned independent executor/verifier/safety-scanner services; this module currently exposes the contract and records observations but does not claim to spawn or isolate child processes itself.
- Run a clean synthetic benchmark suite with fixed artifacts and at least five independent holdout seeds per finalist.
- Only after the independent evaluator returns authenticated evidence should the existing governance/promotion pipeline be asked to consider a policy change. No direct P55 action-bias change is made here.
- No Release ZIP was rebuilt or published by this work pass.


## Усиление и интеграция — 17.11.2026

### Исполняемый P23-контур

Добавлен `DevelopmentalMultiverseIndependentRunner`. Он не принимает произвольные метрики от вызывающей стороны: каждый arm строит отдельный набор фиксированных задач и запускает их через `createIndependentSkillCandidateEvaluator` из P23. В production этот evaluator должен быть создан на основе `createHostOwnedIndependentEvaluationServices`, то есть с отдельными host-owned executor, verifier и safety-scanner. Полный контекст (payload, task, environment, plan, manifest, planned run) проверяется evaluator; runner дополнительно сверяет run ID, план, manifest, trial coverage и evaluation fingerprint прежде чем допустить observation.

### Разделение данных и фаз

- Validation-only и holdout-only стали поддерживаемыми режимами P23 evaluator; старый paired режим по умолчанию не изменён.
- В первой фазе runner физически передаёт evaluator только validation tasks. Holdout остаётся в manifest для split-binding, но его task inputs не передаются дочерним процессам.
- После validation runner выбирает максимум один finalist. В holdout запускаются только baseline и этот finalist.
- Варианты получают только пять whitelisted policy knobs, scenario task input и хэши. Сценарный factory не получает candidate profile и не может незаметно менять входы между arms.
- Запрещены memory/identity/conversation/secret/credential/token/password поля в scenario data; вход ограничен 64 KiB, глубина — 24.

### Evidence и восстановление

- Для каждого observation сохраняется P23 evaluator fingerprint, общий task-plan fingerprint, manifest fingerprint, оба split-plan fingerprints, method, verifier ID и exact planned/run ID.
- Final result считает проверенные observations, количество разных evaluator plans и агрегирует fingerprint evidence.
- `recordValidationObservations` и `recordHoldoutObservations` — атомарные batch admission: при любой ошибке состояние до batch сохраняется.
- `AtomicFileDevelopmentalMultiverseCheckpointStore` пишет checkpoint через private temporary file + fsync + atomic rename; при восстановлении snapshot повторно проигрывается через прежние проверки и digest сверяется.
- File checkpoint — single-writer storage. SHA-256 обнаруживает повреждение/случайное изменение, но не является подписью, anti-rollback или шифрованием; каталог и ключевые службы должны оставаться host-owned.

### Остаточные границы

Runner не применяет предложенный профиль к live P55 и не включает autonomous promotion. Host должен предоставить реальные OS/container isolation и независимо развёрнутые authority executables; сам TypeScript-адаптер не является sandbox. Показатель cost — измеренное среднее wall-time на scenario, нормированное на заданный host budget. Stability здесь — bounded single-run proxy из executability/ordered trajectory, а не долгосрочная дисперсия повторных запусков. Результат остаётся review artifact и требует отдельного promotion gate, independent review и rollback path.


### Канонический P23 outcome ledger

Каждый arm теперь после проверки evaluation digest и run bindings отдельно коммитит свои validation-only либо holdout-only outcomes через `recordIndependentEvaluationOutcomes()` в `VerifiedOutcomeLedger`. Этот метод повторно сверяет план/manifest/trial/run ID, отклоняет повторную запись ячейки и принимает batch атомарно. Для observation фиксируются fingerprint snapshot ledger и число принятых outcome rows. Ledger в этой реализации ограничен текущей фазой/процессом; в checkpoint сохраняется fingerprint его snapshot, а не сам ledger. Это provenance trace, а не подписанный verifier certificate и не замена host-controlled signed evidence/anti-rollback storage.


### Независимость статистических выборок

Входной контракт теперь требует не только минимум 3 validation и 5 holdout пар, но и столько же различных seed в каждой фазе. Перед запуском runner дополнительно вызывает P23 `validateResearchGradeLearningExperimentPlan()` для holdout: минимум пять независимых seed и полное покрытие всех holdout task families. Повтор одного seed на разных сценариях больше не увеличивает искусственно размер выборки для confidence interval.


### P55 snapshot adapter

`createDevelopmentalMultiverseSessionFromP55()` consumes the public `P55State.forks` snapshot field and maps only active fork `id/style/status/deltas` into experiment variants. Rejected/replaced forks are ignored. It intentionally does **not** import P55 `actionBiases`, counters, last winner/applied IDs or any other runtime state. The baseline five-knob profile remains an explicit input, never inferred from historical action bias.


### Checkpoint continuity fix

После рестарта runner использует не повторно сгенерированные задачи, а сохранённый корпус: immutable scenario-task inputs, manifest, validation/holdout plans и полный snapshot P23 `VerifiedOutcomeLedger`. Checkpoint также привязывает environment, verifier и три host authority executable identities. Restore перепроверяет task IDs/trial IDs, split, seeds, fingerprints, prompt manifest, оба плана и ledger. Если конфигурация или authority не совпадают — запуск отклоняется. Это устраняет дрейф holdout prompts при рестарте.

P23 evaluator также фиксирует `evaluationScope` в момент создания. Последующая мутация исходного config не может переписать phase label уже выполненного evaluation.
