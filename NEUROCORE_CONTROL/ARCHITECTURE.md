# NeuroCore — active architecture

## Product layers

1. **Application surface — `app/`**
   React + TanStack Router + Vite UI. The organism store hydrates from the backend and routes chat, sleep, wake, and refresh through the API client. Avatar renderers consume backend body/affect/motor projections; they do not own cognitive decisions.
2. **HTTP boundary — `runtime/neuro-kurisu/src/server/server.mjs`**
   Owns the process, API routes, request policy, local model adapters, startup and shutdown.
3. **Runtime host — `runtime/neuro-kurisu/src/organism/core/OrganismRuntime.ts`**
   Configures one `OrganismCore`, serializes operations, owns runtime clocks, operational journal, continuity ledger, and clean shutdown.
4. **Organism core — `runtime/neuro-kurisu/src/organism/core/OrganismCore.ts`**
   Canonical orchestration and state authority. Delegates subsystem ownership to `OrganismSystemFabric` and persistence to its established persistence runtime.
5. **Subsystem composition — `OrganismSystemFabric`**
   Owns self, governance, memory, world, embodiment, agency, and evidence/research subsystem runtimes. Core getters delegate to these owners.
6. **Language provider boundary**
   `OpenAICompatibleLocalChatProvider` supports an OpenAI-compatible local endpoint (e.g. llama.cpp); provider configuration is optional and runtime policy controls whether it is active.

## Memory owner graph

```
OrganismRuntime
  └─ OrganismCore
      └─ OrganismSystemFabric
          └─ MemorySubsystemRuntime
              ├─ MemoryOS2                 canonical durable memory store
              ├─ EventLog
              ├─ MultiTimescaleMemory
              ├─ MemorySubstrateCoordinator
              ├─ UnifiedMemorySystem
              ├─ P62MemoryFabric
              ├─ SemanticMemoryGraph
              └─ MemoryFabric              sole lifecycle/write coordinator
                  ├─ encode → MemoryOS2
                  ├─ retrieve → MemoryOS2
                  ├─ maintenance/projections → coordinated read models
                  └─ idempotent mutation receipts / event lineage
```

The same instances are injected into `MemoryFabric`; a new store is not created inside it. The new regression `tests/neurocore-memory-single-owner.mjs` asserts these identity relationships and the `OrganismSystemFabric` composition path.

## Cognitive and action flow

- `OrganismRuntime` delegates each message/step to the Core.
- `OrganismCore` orchestrates observation, memory retrieval, world/self state, decision, action and learning.
- `UnifiedCognitiveCycle` enforces stage contracts and completeness.
- `ActionGateway` remains the single action execution/permission/idempotency boundary.
- Persistence and recovery remain owned by the existing Core/runtime persistence components; do not add a second checkpoint writer.

## Embodiment

The application has a real Three.js scene path and VRM/GLB loading/rig adapters, along with the Live2D and legacy 2D presentation paths. Avatar state is driven by backend emotion, motor intent, body channels and animation projections. The current default procedural fallback is not yet accepted as the final anatomically detailed body requested for NeuroCore. The complete skeleton/IK/muscle articulation and phone performance path remain explicit open engineering work; do not represent a fallback mesh as a finished humanoid body.

## Identity migration

User-visible product identity is **NeuroCore**. Runtime service health is `service: neurocore`; the prior service name is returned only as `legacyService` during migration. The old source directory and internal store names remain temporarily for import compatibility and are not the product name. Move them only with a repository-wide import migration and passing tests.
