# NEURO-KURISU 35.6.1 — B264 FULL BRAIN AUDIT

Дата: 12 сентября 2026

## 0. Статус

Этот документ продолжает и перепроверяет B263 audit. Архив B263 был распакован, ключевые B259–B263 исходники и migration path проверены перед разработкой B264. B264 затем реализован и снова прогнан по regression/integration контуру.

Главная цель B264: превратить B263 causal intervention signal из аналитического механизма в реально обучаемую action policy.

## 1. Каноническая цепочка

`P27 latent -> B259 recurrent substrate -> B260 recurrent causal memory -> B261 unified world model -> B262 multi-timescale dynamics -> B263 action consequence causality -> B264 causal policy -> action -> observed consequence -> policy update -> replay -> holdout`

Это важный сдвиг: после B264 причинный слой больше не только оценивает мир, но участвует в выборе поведения.

## 2. Что изменено

### 2.1 B264CausalPolicyLearning

Новый обучаемый policy layer имеет:
- action-specific bias/value;
- context weights;
- causal intervention reward signal;
- uncertainty penalty;
- conservative policy re-ranking;
- outcome-driven policy update;
- replay;
- holdout evaluation;
- unseen-task evaluation;
- snapshot/restore.

### 2.2 Интеграция Core

B264 подключён:
- в candidate ranking перед constitutional arbitration;
- в real outcome learning после action consequence;
- в persistence;
- в StateMigrations;
- в public diagnostics/replay/holdout/unseen APIs.

Влияние специально ограничено небольшой корректировкой existing candidate score. Это предотвращает резкую замену всей существующей decision architecture одним новым модулем.

## 3. Фактические тесты

### 3.1 Synthetic causal-policy benchmark

- 364 decisions
- 353 policy updates
- policy reward: 0.79926
- non-causal baseline: 0.28000
- unseen-task improvement: +0.51926
- holdout gain: +0.47735
- replay gain: +0.00240
- post-replay policy gain metric: 0.15951
- restore preserved: PASS

Это сильный результат внутри контролируемого цифрового эксперимента, но не внешний world benchmark.

### 3.2 Real OrganismCore integration

- 68 decisions
- 44 policy updates
- causal mean reward: 0.38818
- baseline mean reward: 0.27769
- policy gain: +0.11049
- mean regret: 0.11326
- causal reliance: 0.14492
- replay rows: 10
- replay gain: +0.00856
- restart preserved: PASS

## 4. Regression chain

B259 canonical neural substrate — PASS.
B260 recurrent causal memory — PASS.
B261 unified world model — PASS.
B261 Core integration — PASS.
B262 world model — PASS.
B262 Core integration — PASS.
B263 real action causality — PASS.
B263 Core integration — PASS.
B264 causal policy benchmark — PASS.
B264 Core integration — PASS.

Примечание: один объединённый длинный regression command ранее достиг timeout среды на тяжёлом B262 Core этапе, поэтому PASS ниже основан на отдельном повторном запуске того же B262 Core test, который завершился PASS. Это не следует путать с «весь pipeline в одном процессе прошёл без timeout».

## 5. Release gates

Typecheck — PASS.
Architecture — PASS: 958 source files, 347 canonical files, 0 cycles, 0 legacy leakage.
Integrity — PASS: 1921 files.
Source hygiene — PASS: 1915 files, 0 errors, 0 warnings.
Forensics — PASS: 1900 active files, 0 empty, 0 duplicate content, 0 duplicate names, 0 path markers.
Release contract — PASS.
Lockfile — PASS.
Release source — PASS.
Doctor — PASS.
Archive manifest — PASS: 2146 files at manifest generation.
Archive verification — PASS.

Executable syntax full-tree audit — BLOCKED_BY_ENV_TIMEOUT. Команда не завершилась в лимит среды. Никакого PASS не заявляется.

Full historical audit — NOT CLAIMED PASS.

## 6. Найденные ошибки и исправления

### Migration gap

После первого B264 интеграционного запуска policy state не переживал restart. Причина — новый system field не был добавлен в StateMigrations.

Исправление: добавлен `causalPolicyLearningB264` в migration schema и projection.

Результат: полный Core round-trip — PASS.

### Type integration defects

Были обнаружены несовместимые имена ranking field (`uncertainty` vs `uncertainty01`) и неполный IntentCandidate contract. Исправлены до выпуска.

## 7. Что действительно стало лучше

1. Причинность теперь влияет на поведение, а не только наблюдается.
2. Policy обучается по фактическому outcome.
3. Есть replay.
4. Есть holdout.
5. Есть unseen-task benchmark.
6. Persistence всей новой цепочки сохранена.
7. Воздействие B264 специально ограничено, чтобы не разрушать governance/constitutional layers.

## 8. Что всё ещё плохо/недоказано

Главная слабость — causal policy пока обучается и оценивается в цифровой controlled environment.

Следующее утверждение пока НЕ доказано:

`causal policy -> real external action -> independently verified external consequence -> superior long-term behaviour`.

Также `causalReliance01=0.1449` в Core показывает, что новый policy пока использует causal signal умеренно. Это не проблема теста, а реальная архитектурная характеристика.

## 9. Оценки 1–100

| Компонент | B264 score |
|---|---:|
| Canonical neural substrate | 68 |
| Recurrent causal memory | 67 |
| Unified world model | 70 |
| Multi-timescale dynamics | 69 |
| Action consequence causality | 64 |
| Causal policy learning | 66 |
| Policy-to-consequence loop | 63 |
| Holdout transfer | 61 |
| Unseen-task transfer | 58 |
| Real external causality | 24 |
| Behavioural evidence | 61 |
| Replay | 70 |
| Persistence | 97 |
| Migration discipline | 95 |
| Architecture coherence | 86 |
| Test coverage of new branch | 73 |
| Full-tree verification | 49 |
| Scientific maturity | 60 |
| Brain branch engineering | 82 |
| Unified causal loop | 80 |

Эти цифры — инженерные оценки, а не научно стандартизированная шкала.

## 10. Прогресс цепочки

Ниже уже существует рабочая основа:

Observation 100%
-> P27 latent 100%
-> B259 recurrent learning 80%
-> B260 delayed memory 74%
-> B261 unified world model 75%
-> B262 multi-timescale dynamics 70%
-> B263 causal intervention 64%
-> B264 causal policy 63%
-> real external action 25%
-> long-horizon behavioural superiority 20%

Это не процент «готовности продукта». Это оценка зрелости каждого звена.

## 11. Главный вывод

B264 — первый pass, где causal model используется как upstream mechanism for policy selection and then receives downstream learning from the actual outcome.

До B264 цепочка была в основном:
`predict -> explain -> diagnose`.

Теперь она стала:
`predict -> select -> act -> observe -> learn policy`.

Это архитектурно значительно важнее добавления ещё одного независимого cognitive organ.

## 12. Следующий большой шаг

B265 должен не просто усиливать B264. Он должен решить три остающихся проблемы:

1. увеличить causal reliance без потери safety/governance;
2. провести long-horizon policy learning, где промежуточные действия изменяют последующие causal opportunities;
3. добавить independent counterfactual evaluator, чтобы policy не могла сама себе выставлять выигрыш.

Acceptance criterion B265:

`causal policy` должна превосходить `non-causal baseline` на unseen task families после multiple-step action sequences, причём evaluator должен быть независимым от policy learner.

## 13. Финальный вердикт

B264 — VERIFIED ENGINEERING PASS.

B264 — NOT a proof of general agency.
B264 — NOT a proof of consciousness.
B264 — NOT a proof of real-world autonomy.

Он является реальным крупным повышением причинной замкнутости мозга проекта.
