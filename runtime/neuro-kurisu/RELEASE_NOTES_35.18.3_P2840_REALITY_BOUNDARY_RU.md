# Neuro/Kurisu 35.18.3 — P2840 Reality Boundary

Дата: 2026-09-20

## Главная цель

Устранить остаточный leakage симуляционного мира в canonical runtime и ограничить силу обучения уровнем фактического evidence.

## Реальные изменения кода

- `WorldEnvironment.simulate()` — чистая predictive shadow simulation без изменения canonical state.
- `WorldEnvironment.commit()` — идемпотентный commit уже рассчитанного transition.
- `RealityShadowBridge` — arbitration между predictive shadow и authoritative external outcome; external outcome удерживает shadow state, simulation fallback коммитит его.
- `RealityLearningGate` — evidence-weighted learning: отдельно ограничиваются neural update, world-model update, memory promotion и identity update.
- `OrganismRuntime` переведён на pure shadow → embodiment → reality arbitration → conditional world commit.
- Слабые actuator receipts не получают ту же силу обучения, что независимо подтверждённые последствия.
- Высокий shadow↔reality divergence автоматически поднимает требование дополнительного active perception в следующем цикле.
- Новые состояния persistent в `OrganismSystemState`.
- Independently observed external outcomes теперь также записываются в `PerceptualEvidenceCompiler`, чтобы следующий cognitive cycle видел их как grounded evidence, а не только как audit ledger.

## Что это исправляет

До P2840 predictive `WorldEnvironment.step()` менял canonical world state ещё до получения результата реального действия. Даже при external-first source это могло незаметно продвинуть внутренний world timeline.

После P2840:

`prediction -> pure shadow -> external action -> outcome arbitration -> [commit shadow OR hold shadow] -> learning`

## Verification

- `npm run typecheck` — PASS.
- `npm run test:p2840` — PASS.
- P2840 boundary integration: PASS.
- Verified external world tick isolation: PASS.
- Simulation commit idempotency: PASS.
- Evidence-weighted learning ordering: PASS.

## Remaining limitation

Без физического Android/Termux устройства локальный runner не может доказать реальную внешнюю причинность TTS/camera/device actuation. Для этого требуется hardware certification.
