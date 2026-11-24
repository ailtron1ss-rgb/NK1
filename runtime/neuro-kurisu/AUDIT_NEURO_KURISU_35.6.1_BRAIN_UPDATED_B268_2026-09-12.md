# NEURO-KURISU 35.6.1 — B268 FULL BRAIN AUDIT

Дата: 2026-09-12
Основа: B267 verified release archive

## 1. Перепроверка B267
Перед разработкой B268 повторно сверены:
- B267 audit;
- B267 source;
- OrganismCore outcome path;
- StateMigrations;
- B264 causal policy;
- B265 independent evaluator;
- B266 hidden-family evaluator.

Главный вывод перепроверки: B267 уже обнаруживает режимный сдвиг и переключает arbitration, но не имел полноценного механизма контролируемого изменения собственной обучаемой policy с независимым commit/revert.

## 2. B268 — цель
Создать реальный self-improvement loop, который не оптимизирует reward любой ценой.

Новая цепь:
`regime signal -> hypothesis -> baseline shadow -> bounded policy mutation -> independent hidden evaluation -> paired gain + win rate + robustness -> commit/revert -> persisted history`

## 3. Новый компонент
`src/organism/cognition/B268CausalSelfExperimentLab.ts`

Основные элементы:
- `B268ExperimentSpec`;
- `B268ExperimentResult`;
- `commit / hold / revert`;
- shadow baseline;
- mutation of B264 policy snapshot;
- paired hidden-family comparison;
- robustness-drop guard;
- delayed-reward comparison;
- persistent experiment ledger;
- rollback pressure;
- independent evaluation helper.

## 4. Реальная интеграция
B268 встроен в:
- OrganismCore;
- B264 causal policy state;
- B263 causal intervention model;
- B266 hidden-task family environments;
- StateMigrations;
- persisted system state;
- cognition barrel exports.

B268 не мутирует live policy до окончания независимого сравнения. При `commit` trial snapshot становится новым B264 state. При `revert` сохраняется старый snapshot.

## 5. Standalone proof
### Approved experiment
- baseline mean return = 0.4650
- trial mean return = 0.51875
- paired gain = +0.05375
- win rate = 1.000
- robustness drop = 0.0100
- decision = COMMIT
- confidence = 0.9171

### Rejected experiment
- baseline mean return = 0.4650
- trial mean return = 0.3925
- paired gain = -0.0725
- win rate = 0
- robustness drop = 0.1000
- decision = REVERT
- confidence = 0.2281

## 6. OrganismCore proof
### Experiment 1 — accepted
Target action: `reflect`

- baseline mean return = 0.1763685
- trial mean return = 0.1964886
- paired gain = +0.0201201
- win rate = 0.625
- robustness baseline = 0.8550
- robustness trial = 0.8308333
- robustness drop = 0.0241667
- delayed reward baseline = 0.1658254
- delayed reward trial = 0.1777456
- decision = COMMIT

### Experiment 2 — rejected
Target action: `verify`

- baseline mean return = 0.1964886
- trial mean return = 0.2196598
- paired gain = +0.0231712
- win rate = 0.500
- robustness baseline = 0.8308333
- robustness trial = 0.7694924
- robustness drop = 0.0613409
- delayed reward baseline = 0.1777456
- delayed reward trial = 0.2154856
- decision = REVERT

Ключевой факт: второй trial давал больше среднего reward, но был отвергнут из-за потери robustness. После revert B264 state совпал с состоянием после первого approved commit.

## 7. Почему это сильнее предыдущих проходов
B267 мог обнаружить проблему в мире.
B268 добавляет проверяемую внутреннюю адаптацию:
1. формируется гипотеза;
2. существующий policy сохраняется как shadow baseline;
3. создаётся ограниченное изменение;
4. baseline и trial проходят одну и ту же hidden environment;
5. сравниваются paired outcomes;
6. проверяется robustness;
7. только после gate принимается commit;
8. иначе выполняется rollback.

Это уже не просто self-scoring и не просто learning update.

## 8. Regression
Отдельно перепроверены:
- B265 standalone / migration / Core — PASS;
- B266 standalone / migration / Core — PASS;
- B267 standalone / migration / Core — PASS;
- B268 standalone / Core — PASS.

Ранее выполненные B259-B264 suite были также запущены в текущем regression batch до timeout. Сам объединённый mega-run B259-B268 не считается PASS из-за timeout среды; это не используется как evidence PASS.

## 9. Full release gates
PASS:
- Typecheck;
- Full executable syntax: 641 JS / 4 SH / 164 JSON / 0 failures;
- Full project audit: 1946 files / 351 canonical / 0 errors / 0 warnings;
- Architecture: 973 source files / 351 canonical / 0 cycles / 0 missing / 0 legacy leakage;
- Integrity: 1952 files / schema 127;
- Source hygiene: 1946 files / 0 errors / 0 warnings;
- Forensics: 1931 active files / empty 0 / duplicate content 0 / duplicate names 0 / path markers 0 / stale markers 0;
- Release contract;
- Release source;
- Doctor.

## 10. Strict scores
| Component | 1-100 |
|---|---:|
| Canonical neural substrate | 56 |
| Recurrent causal memory | 55 |
| Unified world model | 58 |
| Multi-timescale dynamics | 60 |
| Action causality | 63 |
| Causal policy | 68 |
| Independent evaluation | 74 |
| Hidden-task generalization | 61 |
| Regime-shift detection | 69 |
| Uncertainty handling | 67 |
| Active information | 63 |
| Adaptive exploration/verification | 66 |
| Self-experimentation | 71 |
| Commit/revert safety | 78 |
| Long-horizon behaviour | 57 |
| Delayed reward | 60 |
| Adversarial robustness | 55 |
| Persistence | 97 |
| Migration discipline | 96 |
| Release engineering | 96 |
| Scientific evidence quality | 71 |
| Brain branch engineering | 90 |
| Brain scientific maturity | 71 |

## 11. Критические ограничения
B268 всё ещё зависит от:
- заранее определённого интерфейса policy mutation;
- заранее определённых hidden task families;
- цифровой среды;
- независимого evaluator interface.

Не доказаны:
- open-world self-directed science;
- новая causal ontology без заранее заданных представлений;
- physical agency;
- consciousness;
- AGI.

## 12. Следующий большой шаг
B269 должен подняться на уровень `model self-improvement`:

`regime shift -> causal hypothesis -> mutate world-model/credit mechanism -> independent evaluation -> commit/revert -> replay -> re-test`

Особенно важно разрешать изменение не только policy bias/context weights, но ограниченного подмножества predictive dynamics / temporal credit parameters, сохраняя независимый shadow baseline и rollback.

## 13. Итог
B268 — VERIFIED ENGINEERING PASS.
Он превращает brain branch из адаптивной policy system в систему, которая умеет проводить ограниченные внутренние эксперименты над собственным policy, принимать подтверждённые улучшения и откатывать улучшения, которые повышают reward ценой неприемлемой потери robustness.
