# Neuro-Kurisu — Глубокий аудит B298 / Closed-Loop Learning

Дата: 2026-09-13
База: архив `Neuro_Kurisu_35.6.1_B297_AUDITED_CLAUDE_INTEGRATED_2026-09-13.zip`
Новый проход: B298 — Closed-Loop Neural Learning / Action Ownership / Reality-Gated Dream Evidence

## 1. Цель прохода

Этот проход не добавляет очередной декоративный «орган мозга». Он закрывает конкретный разрыв, найденный в предыдущем аудите:

`реальный world transition -> outcome -> neural learning -> persistent state -> changed future behaviour`

Одновременно введены два контрольных слоя:

1. `ActionOwnershipGraph` — показывает, где и когда после B297 меняются оценки действий.
2. Evidence-derived `MicroDreamEngine` — удалена фиксированная уверенность `.32`.

## 2. Главный обнаруженный дефект предыдущей версии

До B298 значительная часть причинно-нейронной learning chain находилась внутри ветки `if (!outcome.worldTransition)`. Нормальный `OrganismRuntime` передаёт `worldTransition` для каждого моделируемого embodied-цикла. Следовательно, обычная жизнь организма могла выполняться, а B261-B264/B293-B297 не получать того же outcome-learning пути.

Это было архитектурным разрывом между «организм умеет учиться в тесте» и «организм учится в своей нормальной жизни».

B298 добавляет отдельный runtime learning bridge для настоящего `worldTransition`:

- B261 world model train;
- B262 multi-timescale dynamics train;
- B263 real action causality observation;
- B264 causal policy outcome;
- B293 self/world prediction learning;
- B296 neural personality-agency learning;
- B297 executive reliability learning;
- B294 causal neural outcome closure.

На мобильном профиле тяжёлая causal bridge часть выполняется с stride 4, чтобы не превращать каждый телефонный тик в полный offline-training pass. B296 остаётся лёгким и обновляется на каждом подходящем world outcome.

## 3. B296: реальная нейронность в живом контуре

### До B298

Standalone B296 учился: `384 cycles -> 48 learningUpdates`.

Но прошлый аудит зафиксировал, что обычный `OrganismCore` давал `40 cycles -> 0 learningUpdates`.

### После B298

Новый closed-loop test:

- 36 live cycles;
- 36 B296 learning updates;
- 36 learning-eligible cycles;
- 0 suppressed cycles;
- 5616 synaptic updates;
- learning gate около `0.89` в финале;
- изменение action-readout подтверждено lesion-проверкой;
- state restore сохранил learningUpdates.

Это принципиально более сильное доказательство, чем standalone PASS.

## 4. Что считается «реальным нейро» здесь

B296 содержит исполняемый компактный recurrent spiking substrate:

- 32 нейрона;
- membrane state;
- thresholds;
- refractory state;
- pre/post traces;
- sparse recurrent synapses;
- eligibility traces;
- reward/error/causal neuromodulation;
- synaptic plasticity;
- action-specific learned readout;
- structural maintenance;
- lesion mechanism.

Это не биологический мозг и не доказательство сознания. Корректный термин: **малый исполняемый plastic spiking neural substrate, встроенный в жизнь искусственного организма**.

## 5. Улучшение learning rule

B296 больше не использует только бинарную идею `learningEnabled`.

Введён непрерывный `learningRate01`.

Полоса работы:

`learningGate = 0.12 + 0.88 * cognitiveBudget01`

после clamp `[0,1]`.

Это устраняет искусственный обрыв:

`budget .179 -> ноль обучения`

и превращает пластичность в ресурсно-зависимую величину.

Такой механизм ближе к реальному homeostatic/neuromodulated learning: при низком ресурсе организм учится медленнее, а не внезапно перестаёт обучаться вообще.

## 6. MicroDreamEngine: удалена конкретная декоративная константа

В предыдущем коде было:

`confidence: .32`

B298 заменяет это evidence-derived confidence.

Новая confidence зависит от:

- world-model prediction confidence;
- prediction uncertainty;
- memory evidence;
- novelty;
- детерминированного seed-based variation.

В live-run получены разные confidence, например:

`0.6756`, `0.6108`, `0.5444`.

Следовательно, confidence больше не является одной постоянной цифрой для всех сновидений.

Следующий уровень доказательства всё ещё нужен: доказать, что dream/replay изменяет последующее поведение, а не только значение confidence.

## 7. Action Ownership Graph

Проблема B297 не была решена простым заявлением «B297 — единственный исполнитель».

В реальном pipeline после B297 остаются изменения в:

`B291 -> P31 -> P64 -> governance -> repair`

B298 не скрывает это, а измеряет.

Новый `ActionOwnershipGraph` записывает checkpoints:

`b297-pre`
`b297-post`
`b291-post`
`p31-post`
`p64-post`
`governance-post`
`final`

В 36-tick live run:

- ownership cycles: 36;
- post-B297 mutations: 38;
- mutation after finalization: 0.

Следствие: финальный владелец пока определяется как `governance-finalization`, а B297 — как executive fusion/arbitration seam.

Это честнее и инженерно полезнее, чем называть B297 универсальным final action owner.

## 8. Что объединять сейчас, а что не трогать

Не следует механически сливать B269/B270/B280/B296/B297. У них разные роли:

- B269 — spiking/plastic substrate;
- B270 — germinal self/personality substrate;
- B280 — multi-area circuit;
- B296 — компактный personality/agency plastic nucleus;
- B297 — executive fusion.

Их можно объединять только на уровне общего learning protocol и provenance, а не уничтожать как один класс.

Безопасное объединение B298:

`world outcome -> common learning bridge -> multiple neural owners -> persistence -> evidence graph`.

Это уменьшает разрыв между органами без потери функциональной специализации.

## 9. Phone-first оптимизация

Средний Android/Termux остаётся целевой средой.

Поэтому новый подход:

- B296 — каждый подходящий тик;
- тяжёлые B261-B264 — stride 4 на mobile;
- persistence остаётся snapshot-based;
- большие Python/JAX/Brian2/Norse зависимости не добавляются в основной runtime;
- внешние neural frameworks используются как научные reference/source pools, а не как тяжёлые runtime dependencies.

## 10. Verification results

### Пройдено

`CLEAN_ARCHITECTURE=PASS`

`CLEAN_INTEGRITY=PASS`

`SOURCE_HYGIENE errors=0 warnings=0`

`FORENSICS=PASS duplicateContent=0 duplicateNames=0`

`RELEASE_CONTRACT=PASS`

`SYNTAX_JSON=PASS`

`parameterized probe: 914 attempted / 880 passed / 0 failed`

`semantic coverage: 3672 total / 38 VERIFIED / 839 INTEGRATION_ONLY / 259 UNSAFE_TO_AUTO_RUN / 2536 UNVERIFIED`

`verifiedRate01=0.0103`

`evidenceCoverage01=0.0675`

### B298 closed-loop gate

PASS:

- live B296 learning;
- synaptic update count > 0;
- world model learns real runtime transitions;
- dream confidence varies;
- action ownership graph runs;
- no mutation after declared finalization;
- B296 state restore preserves learning count;
- lesion suppresses B296 readout influence.

## 11. Что всё ещё не доказано

Не считается закрытым:

- consciousness;
- human-level self-model;
- open-ended autonomous motivation;
- long-term personality development over weeks;
- physical Android endurance;
- external-world physical agency;
- generalized causal superiority after unseen interventions;
- dream/replay causal effect on next-day behaviour;
- structural self-modification of the architecture itself.

## 12. Strict progress V3

`P0` existence

`P1` execution

`P2` canonical integration

`P3` persistence

`P4` lesion/causal intervention

`P5` unseen-context transfer

`P6` longitudinal change of future behaviour

`P7` independent replication

For neural personality, anything below P6 remains developmental, not mature.

## 13. Updated scorecard

| Area | Previous | B298 |
|---|---:|---:|
| Architecture | 96 | 96 |
| Persistence | 95 | 95 |
| Neural substrate | 70 | 73 |
| Neural integration | 61 | 72 |
| World model | 68 | 70 |
| Causal identification | 55 | 59 |
| Policy learning | 64 | 66 |
| Executive integration | 67 | 68 |
| Action ownership | 45 | 58 |
| Self-model | 48 | 49 |
| Agency | 50 | 52 |
| Motivation | 46 | 47 |
| Personality learning | 52 | 60 |
| Memory/replay | 63 | 63 |
| Structural plasticity | 24 | 25 |
| Closed-loop embodiment | 38 | 49 |
| Long-horizon autonomy | 28 | 28 |
| Physical Android evidence | 25 | 25 |
| Consciousness evidence | 2 | 2 |
| **Overall organism functional maturity** | **44** | **48** |

Это не означает, что организм на 48% «создан». Это означает, что 48/100 — моя строгая оценка функциональной зрелости по текущему доказательству.

## 14. Следующий большой шаг

Следующий проход должен быть не новым анатомическим органом.

Приоритет:

`B299 — Causal Personality Development Loop`

Он должен доказать, что накопленная neural plasticity не только меняет веса, но и:

`experience -> policy change -> self-model change -> repeated preference -> stable personality trajectory`

с lesion/restart/unseen-family/longitudinal evidence.
