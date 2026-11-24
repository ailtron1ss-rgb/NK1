# RELEASE NOTES — Neuro-Kurisu 35.6.1 BIG PASS 169

## Крупный pass

BIG PASS 169 переводит несколько уже существующих cognitive subsystems в более проверяемые executable paths без создания дублирующих Memory/World/Self systems.

### Добавлено
- `ActivePerceptionExecutor` — active perception request lifecycle.
- `WorldCausalCalibration` — prediction/outcome/intervention/observation calibration.
- `SelfModelValidationEngine` — independent self-prediction accuracy/evidence layer.
- `FailureRecoveryCertification` — checkpoint hash + restore/tamper certification.
- persistence/migration/core integration для новых состояний.
- BIG PASS 169 core/restart/recovery tests.
- first-analysis recheck, progress report и master test matrix.

### Реальное evidence
- BIG PASS 169 core integration: PASS.
- restart: PASS.
- active perception request + execution: PASS.
- world calibration: PASS.
- self-model validation: PASS.
- recovery/tamper detection: PASS.
- parameterized safe probe: 470 PASS / 0 FAIL.
- typecheck/architecture/integrity/forensics/hygiene/release-source/lock/brain: PASS.

### Ограничение
Aggregate audit wrapper не считается PASS при timeout orchestration. Реальный Android sensorium не объявлен готовым без теста на самом устройстве.
