# Neuro-Kurisu 35.6.1 — B288 Full Brain Audit

Дата: 2026-09-12

## 1. Цель прохода

B288 выбран как архитектурный проход консолидации social/relationship ветви и усиления единого self/other neural loop. Критерий успеха — не количество новых файлов, а уменьшение конкурирующего владения одной функцией и появление одного канонического обучаемого состояния.

## 2. Главный результат

`B288SocialPredictiveSelfOtherBrain` теперь является canonical owner social-brain state.

Канонический цикл:

`self/world/goal/future-self/personality + person context → recurrent social neural dynamics → prediction → action/goal bias → real outcome → plasticity → personality evidence`

## 3. Консолидация дублей

Исторически пересекающиеся источники:

1. SocialMindKernel
2. SocialPredictiveNeuralSubstrate
3. SocialWorldModel
4. RelationshipSelf
5. LongTermSocialMind
6. SocialDevelopmentSystem
7. AutonomousRelationshipManager
8. AutonomousSocialInitiativeEngine
9. B287RelationshipValueDevelopmentCore

Все 9 имеют явный adapter path в B288. Synthetic consolidation test: `coverage01=1.0`, `deduplicatedSources=9`, exact restore PASS.

Старые модули НЕ удалялись механически: они имеют runtime callers. Они помечены compatibility-owner комментариями и должны удаляться только после behavioural/persistence/non-regression proof по правилам из `reports/B288_SOCIAL_DUPLICATE_CONSOLIDATION_MAP_RU.md`.

## 4. Neural reality check

### Реально реализовано и проверено кодом

- 32-dimensional recurrent latent per person;
- explicit recurrent synapses;
- eligibility traces;
- activity-dependent plasticity;
- neuromodulatory third-factor learning signal;
- excitatory/inhibitory internal state;
- short-term synaptic depression;
- contextual dendritic-like gates;
- person-specific value directions;
- hidden/context-conditioned action projections;
- neural ablation with recomputation;
- snapshot/migration persistence.

### Что НЕ следует называть биологически реалистичным

- membrane dynamics are simplified tanh/state equations;
- inhibitory neurons are abstracted units, not conductance-based cells;
- dendritic mechanism is contextual gating, not morphologically explicit dendrites;
- neuromodulation is a scalar learning factor, not explicit transmitter dynamics;
- social neural state is a computational model, not a demonstrated biological analogue.

## 5. Functional evidence

### Standalone

- 320 steps
- 320 learning updates
- 2 persons
- relationship differentiation: `0.31389196`
- action influence: `0.05451743`
- neural activity: `0.08201585`
- inhibitory balance: `0.50555018`
- respond-bias range across A/B/C: `0.02269481`
- exact snapshot restore: PASS

### Core

- 16 steps
- 16 learning updates
- 1 person
- neural activity: `0.00536449`
- inhibitory balance: `0.50086158`
- action bias: `0.00267667`
- neural lesion effect: `0.00026205`
- restart: PASS

### Migration/consolidation

- migration: PASS, 114121 bytes, 2 persons
- adapter coverage: `1.0`
- deduplicated sources: `9`
- legacy conflict: `0.15725`
- exact restore: PASS

## 6. Interpretation

B288 demonstrates real learned person-specific recurrent states and a controlled causal influence on social action bias. Differentiation is strong in multi-person synthetic tests, while direct Core action influence remains modest.

Therefore B288 is a canonical social-brain auxiliary owner, not yet an autonomous replacement of all historical social policy systems.

## 7. Release/audit evidence

- Typecheck: PASS
- Full project audit: PASS, 2172 files, 0 errors, 0 warnings
- Architecture: PASS, 1090 source / 371 canonical / 0 cycles / 0 legacy leakage
- Integrity: PASS
- Forensics: PASS, 2157 active files / no duplicates / no path markers
- Source hygiene: PASS
- Executable syntax: PASS, 738 JS / 4 SH / 186 JSON / 0 failures
- Release contract: PASS
- Lockfile: PASS
- Release source: PASS
- Doctor: PASS
- Brain audit: PASS, 371 organism files / 9 links

## 8. Remaining risks

1. Core one-person smoke does not test relation differentiation; hidden multi-person tests do.
2. Relationship → action effect remains intentionally low-weight.
3. Symbolic social ledgers still coexist; consolidation is staged, not complete deletion.
4. The neural model is computationally neural-like, not biophysical.
5. No B288 result is evidence for consciousness.

## 9. Next decision point

B289 should deepen the model of the other person across multiple timescales rather than add another relationship manager. The next improvement should aim for predictive beliefs about a specific other agent, uncertainty over those beliefs, counterfactual social outcomes and measurable impact on Kurisu's future goals and identity.

## 10. External comparison used in this pass

Architectural comparison was made with Brian2, Nengo, Norse, Leabra/Emergent, DreamerV3 and Generative Agents. The project deliberately imports ideas rather than external code. See `reports/B288_EXTERNAL_NEURAL_PROJECTS_AND_CODE_MAP_RU.md` and `reports/B288_PROJECT_POTENTIAL_AND_ROADMAP_RU.md`.
