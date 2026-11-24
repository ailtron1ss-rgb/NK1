# B364 — Sensorimotor Life / Evidence

## Цель
Преобразовать Brick 6 из одной только долгой жизни в реальную embodied branch: тело должно быть источником наблюдения и отдельным исполнителем действия, а система не должна считать host/process telemetry Android hardware.

## Реализация
- `EmbodiedActionExecutor` added as canonical gate for selected internal actions.
- `explore/verify/wait/inspect/defer/respond` проверяют реальные Termux capabilities; отсутствующая capability возвращает `unavailable`.
- `rest` имеет реальный software-body effect — переход в sleep state — без выдачи fake device evidence.
- Action result persists in `facets.embodiment.embodiedAction` and survives restart.
- RealityEvidenceLedger receives `device-observation` only for executed actions backed by `android-termux`; host results stay `derived`.
- Camera is opt-in via `NEURO_ALLOW_AUTONOMOUS_CAMERA=1`; отсутствие permission/capability never creates a successful result.

## Tests
### B364_SENSORIMOTOR_REALITY_GATE_PASS
Host source: `node-host`. `explore` returned `unavailable`, reality class `derived`; no false hardware success. `rest` returned `executed`, changed `awake=true→false`, and persisted through restart.

### B364_BODY_HOMEOSTASIS_CAUSAL_PASS
Nominal action `explore`; critical-body action `rest`. Candidate score L1=`0.718368`; rest lift=`0.252293`.

### B364_RUNTIME_EMERGENCY_CHECKPOINT_PASS
Critical resource event triggered one durable checkpoint; new core restored tick `1`.

### B364_LONG_HORIZON_PERSISTENCE_PASS
1000 operational ticks with restart continuity. P39 and P54 both reached `1000`; 60 thermal and 60 battery stress events were observed. 40 full cognitive pulses and 960 micro-cycles reduced host cost while preserving temporal evidence.

## Strict interpretation
B364 does NOT prove physical Android embodiment because the current environment has no live Termux Android capability. It proves the software boundary and causal body-state path without pretending host data is hardware data.
