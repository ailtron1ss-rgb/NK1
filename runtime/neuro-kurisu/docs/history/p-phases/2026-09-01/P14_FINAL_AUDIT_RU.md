# P14 Final Audit

## Release
- Application: 6.0.0
- Organism Core: 15.0.0-embodied-perception
- State schema: 17

## Verified
- release contract
- lockfile and offline npm install
- strict typecheck
- executable/JSON syntax
- forensic hygiene
- architecture/import graph
- legacy snapshot integrity
- organism smoke/autonomy/restart
- identity/concurrency/memory/replay
- P7/P8/P9/P10/P11 regression
- P14 perception/migration/UI/server
- operational hardening

## P14 research
3 deterministic seeds demonstrate temporal sensor change detection, quiet stabilization after unchanged input, network change detection and resource-pressure detection.

## Known device-only gate
A physical Android soak remains the only verification that cannot be completed inside the development container: thermal behavior, process reclaim, permissions, actual sensor availability and local LLM runtime must be measured on the target phone.
