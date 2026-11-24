# Release Notes B322

## Added
- `tests/big-pass-322-long-horizon-device-life.mjs`
- long-horizon endurance gate for P39 + ResearchGradeOrganismEngine
- bounded full `OrganismCore` cognitive pulse phase
- durable reload continuation check
- host-only resource stress phases

## Verified
- 240 endurance cycles
- 240 research-grade cycles
- 0 continuity gaps
- 6 full-core pulses
- p95 full-core pulse latency ~549 ms on current host
- learning continued after durable reload
- cognitive closure continued after durable reload
- typecheck PASS

## Important honesty rule

B322 is `HOST_LONG_HORIZON`, not Android certification. Physical device evidence remains governed by B321.
