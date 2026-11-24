# Neuro-Kurisu — PASS 09 extended: identity holdout + runtime hot-path closure

Дата: 2026-09-29

## Реальные изменения

### 1. Verified identity revision
`B284NeuralAutobiographicalIdentityCore` теперь имеет evidence-gated identity revision path:

`outcome evidence -> repeated evidence -> context holdout -> cooldown -> revision`.

Для внешнего/world evidence требуется подтверждённая и независимая поддержка. Для обычного simulation/runtime feedback существует отдельный provisional path `internalConsistency01`: он не превращает внутренний сигнал во внешнее доказательство, но позволяет сохранить долгосрочную адаптивность без мгновенной переписи identity от одного эпизода.

Оба пути имеют cooldown и ограниченную историю evidence. Низкоуровневый `reviseIdentity()` сохранён для диагностического API; обычный `OrganismCore.feedback()` использует evidence-gated path.

### 2. Multi-step imagined replay safety
`VerifiedSyntheticTrajectoryGate` блокирует прямое обучение canonical `actionReadout` из imagined trajectory. Траектория сначала становится pending hypothesis и может попасть в canonical executor только после реального outcome confirmation и holdout confirmation.

### 3. Runtime allocation reduction
`OrganismCore.feedback()` переиспользует рассчитанный `nextWorldContext01` и компактный world-vector в рамках одного outcome вместо повторного `b391ContextFromWorld(...)` для нескольких developmental owners.

`TemporalContinuityEngine.calendarContext()` кэширует exact timestamp result, уменьшая повторные `Date`/`Intl` вычисления при одном и том же времени.

### 4. Durable checkpoint closure
Сохраняется PASS 08 механизм content-hash deduplication в `FileStateStore`: идентичный payload не создаёт новую durable запись, исчезнувший state-файл восстанавливается записью заново.

## Verification

- `TYPECHECK=PASS`
- `P2870_VERIFIED_SYNTHETIC_PROMOTION=PASS`
- `P2871_IDENTITY_REVISION_HOLDOUT=PASS`
- `P2872_RUNTIME_IDENTITY_PROVISIONAL=PASS`
- B284 36-cycle core regression: PASS
- B284 260-cycle longitudinal regression: PASS
- `P2862`, `P2863`, `P2864`, `P2865`, `P2866`, `P2867`, `P2868`, `P2869`: PASS
- P2854 hierarchical/core isolated regression: PASS
- P2855 contextual-policy/integration/ablation: PASS
- smoke/restart/memory/replay: PASS
- architecture/ownership/forensics/hygiene/syntax/release-contract/full/brain/source/integrity/archive audits: PASS

## Ограничения

Full `OrganismRuntime` 100/500/1000 cycle device endurance всё ещё открыт. Native Android NEON/SIMD/NNAPI backend не объявляется реализованным без реального target-device benchmark. Тяжёлый `r12-upstream-replay-integration` не считается PASS.

## Engineering progress

Weighted integration backlog: **79.41%**. Это процент закрытия engineering integration backlog, не оценка сознания, AGI или subjective experience.
