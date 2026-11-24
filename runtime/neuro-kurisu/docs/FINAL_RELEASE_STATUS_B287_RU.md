
---

## B320 addendum — Mobile durability

B320 introduces `PersistenceDurabilityGovernor` and connects it to all known dirty-cycle checkpoint paths. It is verified by `npm run test:big-pass-320` plus typecheck, B317, and B318 regressions. The adaptive policy uses measured payload size/write latency together with battery, thermal and RAM pressure. It does not claim Android-device verification; that remains the purpose of B321 Device Reality Durability Gate.
