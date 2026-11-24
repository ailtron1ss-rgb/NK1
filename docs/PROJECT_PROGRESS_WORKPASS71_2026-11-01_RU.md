# NK1 Project Progress — WorkPass 71
Date: 2026-11-01
Canonical source branch: `workpass70-source`
Verified HEAD: `b5800365979c3736e8b69b630396e1022c2d41d8`
Official weighted roadmap score: **80.1% (unchanged)**

## Delivered
- Canonical UserModel explicit forgetting now flows through OrganismCore, including active-cycle write guard and durable checkpoint.
- OrganismRuntime exposes a serialized forget command.
- Authenticated `POST /api/organism/user-model/preferences` accepts `action: "forget"` only with explicit confirmation; the server owns provenance and only exposes the allowlisted `response.style` preference.
- Runtime restart regression proves the deleted preference does not reappear.
- HTTP integration regression proves record → correct → forget → fresh record.
- Dedicated CI now runs model, runtime-persistence and authenticated HTTP tests on `workpass70-source`.

## Verified evidence
- [Dedicated UserModel integrity workflow](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41288063190): PASS (all three test steps completed successfully).
- [WorkPass72–73 independent evidence and memory evaluation](https://github.com/ailtron1ss-rgb/NK1/actions/runs/41288063234): PASS.
- WorkPass79 cognitive runtime, unified organism runtime, core regression and browser affect coherence were still running when this scorecard was written; no PASS is claimed for them.

## Score discipline
The official weighted score remains **80.1%**. This pass completes one narrow lifecycle capability but does not establish independent retrieval uplift, full memory lifecycle across all stores, physical device/browser E2E, release readiness or long-duration autonomy. CI count and code volume are not independent progress.

## Remaining release gates
1. Independent RU/EN labelled memory holdout with positive retrieval uplift and multiple paired seeds.
2. Real browser audio/Live2D E2E and Android/Termux audio interruption/synchronization.
3. Real external provider/device postcondition, ACK-gap, restart and replay tests.
4. Clean-room installation, production app build, DB migration and rollback.
5. Manual license/path/model/dataset review before creating a new Release ZIP.
6. 24h minimum (72h recommended) soak with autonomous initiative and safety monitoring.
