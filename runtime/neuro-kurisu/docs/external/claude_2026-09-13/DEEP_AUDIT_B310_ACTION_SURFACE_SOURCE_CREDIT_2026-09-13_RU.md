# Neuro-Kurisu B310 — глубокий аудит: Action Surface + Evidence-Weighted Source Credit
Дата: 13.09.2026

## 1. Цель этапа
B310 продолжает B309 и не добавляет новый generic learner. Главная цель — сделать executive/action path более правдивым и обучаемым:
1) подтверждённый исход должен повышать доверие к источнику, который действительно давал предсказательный сигнал;
2) источник без сигнала не должен наказываться как ошибочный;
3) активный источник не должен терять силу только потому, что в fusion существует много молчащих источников;
4) persisted decision trace и workspace должны отражать фактическую финальную поверхность кандидатов, а не ранний stale snapshot;
5) слабые/отрицательные utility-кандидаты не должны схлопываться в один score=0.

## 2. Перепроверка B309
B309 подтвердил canonical policy source в B297 и bounded redundancy suppression. Его нерешённая проблема: learned policy ranking менялся, но весь organism action distribution не был доказан как изменяющийся.

B310 подтвердил, что проблема была частично связана не только с силой policy, но и с качеством arbitration representation:
- все 11 sources ранее входили в fusion denominator даже при нулевом сигнале;
- `recordOutcome` мог снижать reliability молчащего source;
- final decision/workspace сохраняли `candidates`, а не актуальный `governedCandidates`.

## 3. B310 изменения
### 3.1 Evidence-weighted source credit
В `B297ExecutiveNeuralFusion` добавлены persisted `sourceCredit` и `sourceCreditUpdates`.

Verified/independent/autonomous evidence усиливает learning rate source credit. Credit зависит от согласования направления source signal с направлением фактического outcome.

Ключевой safety rule: source без meaningful signal (`abs(signal)<=.015`) не получает отрицательного reliability update. Это исправляет обнаруженный в ходе B310 саморегуляционный дефект.

### 3.2 Active-source denominator
Только sources с meaningful signal входят в weighted fusion denominator. Silent sources остаются частью state/diagnostics, но не разбавляют активный evidence-bearing signal.

### 3.3 Utility floor repair
Ранний utility aggregation больше не делает monotonic `clamp(rawUtility)` с жёстким floor 0. Используется bounded monotonic logistic transform. Это сохраняет ordering и даёт слабым кандидатам различимые scores вместо одинакового `0`.

### 3.4 Truthful decision surface
`OrganismCore` теперь записывает в decision trace и workspace актуальные `governedCandidates`, а не исходный stale `candidates`.

Это важно для последующего causal audit: recorded decision surface теперь соответствует поверхности, на которой действительно происходила поздняя arbitration.

### 3.5 Persistence
B297 executive fusion state теперь обновляется в persisted system projection на каждом cognitive pulse. Это намеренное исключение из более редкого mobile cadence: состояние небольшое, а потеря source-credit/consolidation evidence после snapshot была бы хуже небольшой стоимости.

Migration preservation для `sourceCredit` и `sourceCreditUpdates` добавлена отдельно.

## 4. Реальное evidence
### B310 source-credit test
- positive verified policy credit: 0.899399
- negative verified policy credit: 0.117082
- neutral policy effective weight: 0.761472
- trained policy effective weight: 1.0
- silent source reliability остаётся около 0.5
- 24 source-credit updates
- live OrganismCore feedback update: 1
- migration marker: 19 updates, policy credit 0.84, preserved

### Whole-organism controlled comparison
Две ветки стартуют с одного initial snapshot.

Baseline, 24 cycles:
- explore 11
- verify 13

Policy-trained, 24 cycles:
- explore 11
- verify 13

L1 distribution shift: 0.

Это НЕ failure B310. Это честно фиксирует, что в данном нейтральном сценарии learned policy пока не перестроила частоту уже доминирующих действий.

Однако финальная candidate surface изменилась:
- first score L1 shift: 0.008500
- rest score shift: +0.008500
- trained policy bias for rest: +0.088549
- trained policy bias for explore: -0.087078

Policy lesion на той же trained branch:
- trained distribution: 24 explore
- policy-lesioned distribution: 24 wait
- lesion L1: 48

Это causal evidence того, что policy channel действительно способен менять whole-organism action distribution при вмешательстве, хотя сам natural learning в выбранном нейтральном сценарии ещё не вызывает смены распределения.

## 5. Neural reality recheck
B298 after B310:
- 36 learning updates
- 5616 synaptic updates
- 71 learned world transitions
- 3 dreams
- lesion effect
- restore learningUpdates=36

B306 after B310:
- 16/16 eligible autonomous decisions
- 14/16 causally influenced
- causal influence rate 0.875
- causal success rate 0.92857
- autonomous-personhood lesion remains effective

B304 semantic holdout:
- 128 ticks
- 52 full / 76 micro
- 36 training pulses
- 16 holdout pulses
- 3 unseen training families / 3 holdout families
- novel holdout family rate 1.0
- transfer 0.66096
- B296 8112 synaptic updates

## 6. Mobile state evidence
B301 recheck after B310:
- compaction before: 4,682,063 bytes
- after: 4,294,017 bytes
- saved: 388,046 bytes
- saving fraction: 0.08288
- B296: 24 learning updates / 3744 synaptic updates
- full restart: PASS

Это host/runtime evidence с mobile profile, а не доказательство реального Android hardware.

## 7. Critical contradiction
B310 обнаружил важный architectural truth:
`policy influence != guaranteed action-frequency shift`.

Policy уже причинно влияет на final distribution under lesion, но естественная обученная политика в одном нейтральном сценарии не изменила частоту действий.

Следующий этап должен исследовать arbitration competition и контекстные margins, а не просто увеличивать policy coefficient.

## 8. Honest limitations
- physical Android/Termux run отсутствует;
- P6 long-horizon autonomy остаётся частичным;
- P7 independent replication отсутствует;
- semantic VERIFIED coverage остаётся низкой;
- consciousness evidence не повышается: computational coupling не является доказательством subjective experience.

## 9. Engineering judgement
B310 — реальный шаг развития, потому что он исправляет representation/persistence bugs в центральном action path и добавляет evidence-weighted learning к уже существующему canonical executive fusion.

Главное правило сохраняется: не считать наличие класса доказательством работающей функции; evidence должен идти через live execution, causal intervention, persistence и regression.
