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

The default application mode is the built-in Three.js articulated body. The current branch defines 61 `THREE.Bone` nodes (60 movable bone pivots), 60 joint-limit records, and 99 separate part/muscle/clothing/face meshes parented to the bone hierarchy. It uses the existing NK1 18-particle / 17-segment constraint solver as its motion source. Absolute particle landmarks place the torso, neck, head, shoulders, hands and hip pivots; two-link IK solves both arms to wrist targets and both legs to ankle targets. Finger joints, head/eye/mouth expression, body channels and external VRM/GLB replacement are connected. The 3D body is a segmented bone-parented mesh rig, not yet a continuously skinned deformable surface. Full anatomical fidelity, contact/collision, gait, fine muscle deformation, and Android frame/RAM acceptance remain open. Test files have been added but are not yet reported as executed on this branch.

## Identity migration

User-visible product identity is **NeuroCore**. Runtime service health is `service: neurocore`; the prior service name is returned only as `legacyService` during migration. The old source directory and internal store names remain temporarily for import compatibility and are not the product name. Move them only with a repository-wide import migration and passing tests.
