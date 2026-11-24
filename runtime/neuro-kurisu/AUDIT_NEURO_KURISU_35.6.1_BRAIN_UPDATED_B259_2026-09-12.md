# Neuro-Kurisu 35.6.1 — обновлённый аудит после B259

Дата: 2026-09-12
Базовый архив: `Neuro_Kurisu_35.6.1_NEURO_DIGITAL_SUPERUPDATE_B242_B258_FINAL.zip`
Новый проход: `B259 — Canonical Neural Substrate`

## 1. Статус большого прохода

B259 реализован как первый шаг от набора раздельных когнитивных модулей к одному каноническому обучаемому recurrent-субстрату.

Реально добавлено:
- recurrent hidden state;
- изменяемые input/recurrent/action/readout/value параметры;
- temporal eligibility traces;
- outcome-driven parameter updates по prediction error;
- train/holdout separation;
- lesion instrumentation;
- persistent state + migration support;
- интеграция с P27 latent внутри реального `OrganismCore.autonomousHeartbeat` pipeline;
- restart-preservation test.

Важно: B259 НЕ объявляет систему сознательной, общей искусственной личностью или AGI. Он добавляет именно обучаемую нейронную основу и средства её проверки.

## 2. Реальные проверки после изменения

### Typecheck
`TYPECHECK=PASS mode=tsc`

### B259
`BIG_PASS_259_CANONICAL_NEURAL_SUBSTRATE`
- learningUpdates = 20
- trainPredictionError = 0.4306
- holdoutPredictionError = 0.3440
- holdoutDelta = +0.1560
- generalization = 0.6560
- lesionDrop = 0.0000203
- coreCycles = 8
- restartPreserved = true

Интерпретация: обучение параметров и перенос на holdout действительно наблюдаются. Lesion effect пока слишком мал, поэтому B259 нельзя считать доказанно recurrent-dominant. Это остаётся ближайшей задачей следующего прохода.

### B250–B258 regression
`BIG_PASS_250_258_NEURO_DIGITAL_SUPERUPDATE`
- cycles = 30
- sparseEdges = 150
- local credits = 30
- rewriteValidated = 30
- rewriteRollbacks = 0
- metaPrecision = 0.7993
- sensorTransfer = 0.4261
- phase = learn
- portability = 0.7583
- longitudinal episodes = 30
- compiler commits = 30
- restartPreserved = true

### Full project audit
- audit:full = PASS
- files = 1873
- canonicalFiles = 342
- legacySnapshotEntries = 0
- errors = 0
- warnings = 0

### Architecture
- sourceFiles = 943
- canonicalFiles = 342
- missing = 0
- cycles = 0
- legacyLeakage = 0

### Integrity
- PASS
- files = 1879
- release = 35.6.1
- core = 70.0.0-master-prompt-progress-engine
- schema = 127

### Source hygiene
- files = 1873
- errors = 0
- warnings = 0

### Release contract / source
- RELEASE_CONTRACT = PASS
- RELEASE_SOURCE = PASS
- ARCHIVE_MANIFEST = PASS, files = 2104
- ARCHIVE_MANIFEST verification = PASS; missing = 0; mismatches = 0; extra = 0

### Syntax audit
Общий скан `audit:syntax` в текущей среде не завершился в выделенный лимит времени. Это НЕ трактуется как PASS. Для B259 отдельная реальная загрузка выполняется через Node TypeScript stripping + runtime test, а общий typecheck проходит.

## 3. Найденная и исправленная проблема

Первый вариант B259 не переживал restart, потому что новое поле не проходило через migration layer. Тест показал `0 !== 8` после повторной инициализации.

Исправление:
1. Добавлено поле `canonicalNeuralSubstrate` в `OrganismSystemState`.
2. Добавлено поле в default persisted state.
3. Добавлено сохранение в checkpoint path.
4. Добавлен migration passthrough.
5. Добавлен restore path.
6. После исправления restart test проходит.

Это важно: проблема была обнаружена тестом, а не скрыта ослаблением assertion.

## 4. Текущая оценка мозговой ветви

Оценка после B259:
- архитектурная целостность: 95/100
- persistence/restart: 92/100
- evidence/audit infrastructure: 96/100
- cognitive orchestration: 85/100
- world-model architecture: 64/100
- trainable neural substrate: 49/100
- recurrent dynamics: 46/100
- causal learning: 60/100
- credit assignment: 43/100
- plasticity: 49/100
- sensorimotor closed loop: 45/100
- memory integration: 71/100
- self-model integration: 69/100
- agency integration: 66/100
- phone embodiment: 58/100
- consciousness empirical evidence: 8/100
- evidence coverage: 12/100

Общая brain-ветвь: ориентировочно 60/100 по инженерной готовности и 39/100 по глубине действительно обучаемого нейронного субстрата.

## 5. Главная проблема, которая остаётся

LesionDrop B259 ≈ 0.00002. Это хороший сигнал для инструментирования, но плохой сигнал для доказательства того, что recurrent state уже причинно необходим поведению.

Следовательно, нельзя объявлять B259 законченным мозгом.

## 6. Следующий крупный проход

B260 — Recurrent Causal Memory:
- связать B259 eligibility traces с эпизодической памятью;
- получить temporal credit через реальные delayed outcomes;
- сделать replay из пережитых эпизодов;
- сравнить online-only vs replay-trained;
- lesion memory path;
- test transfer на unseen contexts.

B261 — World Model 2:
- action-conditioned transition prediction;
- learned latent dynamics;
- uncertainty calibration;
- real observation vs simulator separation;
- counterfactual action rollouts из общего субстрата.

B262 — Closed-loop motor cognition:
- basal-ganglia selection как action interface, а не отдельный scoring island;
- cerebellar prediction error;
- sensorimotor consequence generation;
- real action -> external observation -> prediction error.

B263 — Self-model coupling:
- self latent становится частью recurrent state;
- learnable self-prediction;
- prediction of own action and own internal state transitions;
- explicit lesion test self-model.

B264 — Agency:
- causal ownership of action;
- intervention/ablation battery;
- delayed responsibility attribution;
- endogenous goal pressure -> action without prompt-trigger.

B265 — Memory consolidation / sleep:
- replay;
- consolidation;
- forgetting control;
- offline learning;
- wake/sleep comparative tests.

B266 — Structural plasticity:
- neurons/connections can grow/prune under evidence gate;
- transfer vs interference benchmark;
- rollback and lineage.

B267 — Brain-wide benchmark:
- train/holdout;
- cross-modal transfer;
- lesion;
- delayed recall;
- counterfactual generalization;
- restart;
- resource pressure;
- adversarial state perturbation.

## 7. Условие завершённости этой ветви

Мозговая ветвь не считается законченной по числу модулей.

Она считается materially complete только после доказательства закрытого causal loop:

`real observation → shared representation → recurrent state → prediction → memory/workspace/self-world coupling → action → external/internal outcome → prediction error → causal credit → plasticity → consolidation → measurable behavioural transfer`.

До выполнения этого условия consciousness/personhood claims остаются функциональными исследовательскими гипотезами, а не установленными фактами.
