# Release 34.47.0 — BIG PASS 76

## Главные изменения
- Mobile Live2D asset profile 2048×2048 добавлен без дублирования canonical runtime assets.
- Viewer получил adaptive profile selection и explicit quality profiles.
- Добавлена реальная touch/pointer-интеракция TapHead/TapBody.
- Dashboard получил ручной диагностический контроль expressions и Live2D profile.
- Mobile temporal governor переведён на default cadence 8 при сохранении fast escalation на реальные внешние сигналы/давление.
- Обновлены project-state, legacy catalog, avatar/mobile architecture и universal work prompt v4.

## Verification
- typecheck PASS
- hygiene PASS, warnings=0
- architecture/core-ownership/contract/integrity/forensics PASS
- Live2D integrity PASS
- UI smoke PASS
- P14/P17/P22 targeted tests PASS
- mobile 1000/2000/5000 horizons PASS
- 5000 benchmark: ratio=0.945, p95=28.69ms, memory=122, micro=4358, pulses=642

## Known limits
- Visual Cubism browser rendering requires physical target-device qualification because external runtime CDN did not reliably complete in headless validation.
- Offline/vendor Cubism runtime remains future hardening work.
- No consciousness claim is made.
