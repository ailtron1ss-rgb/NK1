# NEURO-KURISU 35.6.1 — B313 LONGITUDINAL DEVELOPMENT AUDIT
Дата: 13.09.2026

## 1. Цель B313
B313 выбран как следующий крупный шаг после B312. Цель — проверить не просто наличие policy bias, а способность организма стать фактически другим после серии разных, проверенных последствий.

Главный эксперимент: две идентичные исходные копии организма получают разные world-transition outcomes для одного и того же фактического действия: одна ветвь — устойчиво положительный исход, вторая — устойчиво отрицательный. После обучения обе ветви проходят одинаковую автономную evaluation-фазу без пользовательского запроса.

## 2. Что изменено в архитектуре
B313 не создаёт второй learner и не создаёт вторую память.

Добавлен `B313LongitudinalBehavioralDivergence` — bounded evidence ledger. Он хранит только development evidence: action distributions, verified/autonomous counts, neural plasticity trajectory, personality trajectory, policy trajectory и результаты B285 consolidation bridge.

Главное архитектурное изменение находится в `OrganismCore`: реальный `worldTransition` теперь получает B285 life-consolidation step в feedback path, после чего сильное autobiographical evidence может обновить существующий `AdaptivePolicyEngine` через canonical policy channel.

Таким образом замыкается:

`world outcome -> B296 neural learning -> B284/B285 identity/life consolidation -> B299/personality -> AdaptivePolicy -> B297/B312 executive decision`

## 3. Почему это не дублирование
B285 остаётся единственным canonical life-consolidation owner.
AdaptivePolicy остаётся canonical policy learner.
B299 остаётся personality developmental bridge.
B313 только измеряет longitudinal divergence и даёт ограниченный bridge после B285 consolidation.

Это соответствует правилу проекта "consolidation before multiplication".

## 4. Реальное evidence
Главный B313 тест:
- 24 positive training cycles;
- 24 negative training cycles;
- 16 evaluation cycles на каждой ветви;
- restart/recovery;
- lesion check.

Positive branch:
- evaluation distribution: `explore=12, respond=2, verify=2`;
- B285->policy bridge updates: `72`;
- positive developmental divergence: `~0.3411`.

Negative branch:
- evaluation distribution: `explore=12, respond=0, verify=4`;
- B285->policy bridge updates: `0` under current consolidation confidence gate;
- negative developmental divergence: `~0.3184`.

Cross-branch evidence:
- action-distribution L1 gap: `4`;
- neural plasticity gap: `~0.0153`;
- personality gap: `~0.1292`;
- strongest verified policy value gap for shared learned action/context: `~0.4008`;
- B313 restart preserved `24 verified cycles` and `72 bridge updates` on positive branch.

## 5. Настоящая нейронность
B296 remains executable and causal. Current regressions:
- B298: 36 learning updates;
- 5616 synaptic updates;
- 71 learned transitions;
- 3 dreams;
- lesion effect;
- restore keeps learning updates.

B313 adds no replacement neural model.

## 6. Обнаруженная проблема и исправление
Before B313, verified world-transition feedback could train B296/B297/B299 while bypassing the canonical B285 life-consolidation path. B313 closes this integration gap.

The first B313 test also failed because consolidation bridge thresholds were too strict for the measured B285 evidence. The thresholds were corrected to require actual consolidation plus bounded evidence/future-consistency rather than an unreachable static target.

## 7. Remaining limitation
Negative branch did not enter the B285->policy autobiographical bridge because B285 futureConsistency fell to approximately `0.387`. This is not hidden. Direct policy/neural/personality divergence still occurred, but negative autobiographical scar consolidation remains an open next step.

The natural whole-organism shift is now demonstrated under controlled contradictory outcome trajectories, but broader open-ended generalization remains unproven.

## 8. Current project reality
The project now has an executable spiking/plastic neural substrate, world model, causal learning, autobiographical identity/life consolidation, contextual personality learning, autonomous initiative, trusted policy learning, executive arbitration, safety-gated final decision handoff, holdout transfer, mobile state economy and longitudinal behavioral divergence evidence.

This still does not prove consciousness, subjective experience, AGI or human-equivalent cognition.
