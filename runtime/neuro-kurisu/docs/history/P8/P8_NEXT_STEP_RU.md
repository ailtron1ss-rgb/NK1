# Следующий шаг — P9 World Model 2.0

P8 подготовил обучающий интерфейс; P9 должен превратить его в полноценную причинную модель мира.

## Что уже подготовлено
- `LearnedResidualWorldModel` учит action→outcome residuals и уже влияет на planner.
- `WorldModel2Contract.ts` определяет latent state, causal edges, transition hypotheses и future rollouts.
- provenance и source monitoring уже существуют в P8.

## Что будет сделано
1. latent world state encoder для текущего deterministic environment;
2. hybrid deterministic + learned residual transition model;
3. causal edge hypotheses с evidence/counterevidence;
4. probabilistic future rollouts;
5. uncertainty calibration;
6. regret из выбранной и альтернативных траекторий;
7. external evaluator и lesion/recovery tests;
8. planner будет выбирать по trajectory value, а не только по локальному reward.

Deterministic WorldEnvironment останется reference environment и fallback.
