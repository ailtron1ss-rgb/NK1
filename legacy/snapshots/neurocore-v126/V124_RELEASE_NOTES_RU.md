# NeuroCore V124 — Memory / Truth

## Реальные изменения

- Удалён самореферентный `_self_supervised_target`.
- Default learning target теперь строится из фактически наблюдаемого `x[t+1]` и `goal[t+1]` через фиксированную не обучаемую проекцию.
- Проекция не содержит trainable parameters и не попадает в persistent `state_dict`, поэтому не создаёт вторую neural truth.
- Unified sparse memory read явно экспортируется из canonical spine/trunk и имеет отдельный intervention test.
- Добавлен настоящий key/value delayed-memory benchmark, где query содержит ключ, а payload доступен только из раннего cue.
- V106 compatibility tests удалены с current-поверхности и сохранены в `history/tests_v106_legacy`; legacy namespace не возвращён.

## Квалификация

- current tests: 82 PASS
- compileall: PASS
- verify_current: PASS
- checkpoint: 108/108
- decontamination: PASS
- executable stub suspects: 0
- sparse memory trainable gradient tensor coverage: 10/10
- direct sparse-state intervention effect: 0.000372 mean absolute latent delta

## End-to-end

На matched 3-seed / 32-step key/value benchmark sparse candidate показал средний query cosine 0.0326 против 0.0165 у dense baseline и среднее снижение loss 1.01% против 0.98%. Этого недостаточно для promotion: преимущество маленькое, а runtime cost остаётся существенным.

## Статус

`unified_sparse_associative_memory_v124`: CANDIDATE / NOT PROMOTED.

`data_grounded_predictive_target`: INTEGRATED.
