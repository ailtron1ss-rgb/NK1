# NEURO-KURISU — BIG PASS 54
## Реальная связка Perception → Evidence → Grounded World → Prediction

Версия релиза: **34.25.0**

### Цель

Превратить существующие perception/evidence/world-model компоненты в одну проверяемую цепочку. Проход не заявляет полноценное компьютерное зрение или человеческое понимание. Он создаёт инженерный bridge, который принимает структурированное perception как гипотезы/наблюдения, сохраняет provenance и передаёт получившееся grounded world state в world-model/prediction слой.

### Что изменено

- Добавлен `GroundedWorldState` как runtime-owner внутри `WorldSubsystemRuntime`.
- P41 semantic entities/relations/events объединяются с внешним `WorldContext`.
- Evidence получает эпистемический статус: observed / model-output / derived / conflict / unresolved.
- Наблюдаемая информация может попасть в world facts как `observed-*`; model-output не повышается автоматически до observed truth и маркируется как `hypothesis-*`.
- World objects получили необязательные `confidence01`, `evidenceKind`, `sourceId`.
- `P27NeuralWorldFoundation` теперь учитывает не только плотность объектов/событий, но и компактный hash-based semantic signature мира при фиксированной размерности; это дешёвый mobile-compatible representation layer, а не нейросетевой vision encoder.
- `OrganismCore` использует grounded world state при наличии реального world/vision/audio/text signal. Без сигнала synthetic world context не создаётся каждый цикл.
- P27 post-outcome training использует последний grounded latent как prior и grounded world context для следующего состояния.
- Добавлен `/api/organism/world-grounding`.
- Добавлен `tests/big-pass-54-world-grounding.mjs`.

### Почему это синергетически полезно

До прохода разные уровни знали друг о друге лишь частично:

`P41 → PerceptualEvidence`, `WorldModel2 → WorldContext`, `P27 → отдельные encoding calls`.

Теперь появился общий путь:

`raw observation → P41 → evidence/provenance → GroundedWorldState → WorldModel2/P27 → prediction → outcome → learning`.

Это снижает риск, что один и тот же perceptual факт будет независимо переизобретаться несколькими подсистемами.

### Mobile-подход

Grounding выполняется только при наличии сигнала. Derived state materialизуется с текущими bounded limits. Внутри bridge применены Map-based lookup вместо вложенных `find()` там, где это влияло на hot path.

### Научная честность

`model-output` не считается доказанным наблюдением. Наличие entity/relation в P41 означает структурированную интерпретацию входа, а не человеческое semantic understanding. Полноценная semantic vision/audio model остаётся следующим этапом.

### Проверки

- TypeScript: PASS
- architecture: PASS
- core ownership: PASS
- source hygiene: PASS
- release contract: PASS
- source truth: PASS
- API routes: PASS
- BIG PASS 53 regression: PASS
- BIG PASS 54 world grounding: PASS
- server smoke: PASS
- restart persistence: PASS
- P41 truthfulness/native/temporal: PASS
- P42–P44 integration: PASS
- P50/P51/P52: PASS
- identity/replay/portable boundary/security: PASS
- 250 operational cycles: PASS
- 500 warm operational cycles: PASS

1000-cycle benchmark в этом runtime не использовался как release-gate: контрольный 34.24.0 также не завершился в доступном окне исполнения. Поэтому это не приписывается однозначно изменениям BIG PASS 54.
