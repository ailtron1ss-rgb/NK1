# NeuroCore

NeuroCore is the product identity for this standalone application branch. It combines the existing NK1 organism runtime, its web control surface, and the established integrations without creating parallel memory or action authorities.

## Current source baseline

- Source repository: `ailtron1ss-rgb/NK1`
- Baseline branch: `workpass70-source`
- Pinned commit: `3526f61814e19f1f10766f3b2385488eb04e3d2e`
- Branch tree: the full tracked upstream source tree, not a small launcher archive
- Product branch: `neurocore-unified/main`

The source tree contains 10,738 tracked files and 293,126,769 bytes (279.55 MiB). Historical/legacy material remains in the source baseline until its dependencies and provenance are mapped. It is not treated as active runtime merely because it exists.

## Runtime and application

The root package orchestrates the application and runtime. The web UI is under `app/`; the canonical organism runtime is under `runtime/neuro-kurisu/` for now, because renaming that path in one destructive sweep would break a large existing import graph. The visible product and HTTP health identity are NeuroCore. Internal legacy path migration is incremental and tested.

The app already uses the runtime API. The browser store calls `neuroApi`, which reads `/api/organism/ui-snapshot` and sends chat/sleep/wake actions to the backend. The backend owns the organism state and execution; the browser is a projection/control surface, not a second brain.

## Canonical memory ownership

There is one durable memory owner:

`OrganismCore → OrganismSystemFabric → MemorySubsystemRuntime → MemoryFabric → MemoryOS2`

`MemorySubsystemRuntime` constructs one `MemoryOS2` and injects that exact instance into `MemoryFabric`. The other memory structures are coordinated compatibility/read models, retrieval projections, temporal stores, or policy mechanisms. Do not create another durable memory store or bypass `MemoryFabric` for writes.

## Working commands (do not run until the build is marked ready)

- `npm run install:all` — install both app and runtime workspaces
- `npm run typecheck` — typecheck app and runtime
- `npm run test:neurocore` — integrated NeuroCore test gate and UI tests
- `npm run dev` — development orchestration
- `npm run start` — production start (requires the production build)

Pinned toolchain remains Node 24 and Python 3.11. Android/Termux acceptance is not yet claimed. These instructions are preserved for later; they are not a request to launch the app now.

## Evidence rules

A module count is not proof of working behaviour. Reports distinguish source-present, implemented, wired, locally tested, CI-tested, device-tested, and measured. No learning uplift, consciousness, autonomy, or mobile-readiness claim is made without the relevant evidence.

See `NEUROCORE_CONTROL/` for architecture, integration ledger, progress, decisions, and next work.
