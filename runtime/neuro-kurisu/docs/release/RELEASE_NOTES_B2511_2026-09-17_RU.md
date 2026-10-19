# Neuro-Kurisu 35.6.53 — B2511 Active Epistemic Experimentation

## Суть релиза

B2511 добавляет в организм отдельный причинно проверяемый контур активного эпистемического выбора: система оценивает не только непосредственную полезность действия, но и ожидаемую информацию, стоимость, риск, неопределённость, homeostatic pressure и устойчивость предсказания.

Цель — сделать поведение вида `не знаю -> выгодно получить информацию -> проверка/исследование -> уменьшение неопределённости -> более точное действие` измеряемым и интегрированным в runtime.

## Реальные изменения

### B2511ActiveEpistemicExperimentController
- action-conditioned expected information gain;
- uncertainty/hypothesis-entropy pressure;
- risk-aware epistemic bias;
- resource/thermal budget gating;
- action-specific learned information values;
- verified-outcome learning;
- causal lesion;
- sample-efficiency metric;
- bounded action influence;
- persistent state + diagnostics.

### ActivePerceptionNeuralSubstrate — исправление причинности обучения
`rank()` теперь сохраняет именно тот recurrent hidden state, который породил prediction. До исправления состояние возвращалось к предыдущему hidden state, поэтому `observeGain()` мог обновлять веса не по представлению, которое реально использовалось для ранжирования.

## Интеграция

Новый слой проходит через `OrganismCore` перед финальной action arbitration и после реального outcome. Его bias ограничен и умножается на epistemic efficiency, поэтому B2511 не получает неограниченную власть над executive policy.

## Эксперименты

### Hidden-rule holdout
- 1200 шагов;
- скрытое правило меняется каждые 60 шагов;
- до verification предсказания двух альтернатив специально сделаны близкими;
- verification снижает неопределённость и открывает последующее корректное действие.

Результаты:
- baseline reward: `774.0`;
- B2511 reward: `1116.8`;
- relative gain: `+44.289%`;
- baseline correct: `600/1200`;
- B2511 correct: `1180/1200`;
- verification actions: `20`;
- learning updates: `1200`;
- causal effect: `0.1416`;
- sample efficiency: `0.3814`.

### Active perception learning holdout
- 300 samples;
- validated model: `true`;
- model MAE: `0.0871`;
- baseline MAE: `0.3200`;
- advantage: `0.2329`.

## Ограничения

Hidden-rule эксперимент — контролируемый synthetic holdout, а не доказательство общей интеллектуальной способности. Физический embodied benchmark на Android пока не проведён.
