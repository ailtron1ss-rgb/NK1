# WorkPass39 integration matrix — 2026-10-14

| System/layer | Canonical owner | Inputs | Output / connection | Integration status | Boundaries not to duplicate |
|---|---|---|---|---|---|
| Organism lifecycle/world/body | `OrganismCore` and existing body/world subsystems | runtime state, perception, homeostasis | per-cycle context and event stream | Integrated; real cycle covered | no second writable organism state |
| Emotion and feeling | `EmotionAppraisalEngine` plus feeling/interoception subsystem | body/homeostasis, appraisal and perception | emotion label, arousal, tendency, confidence, feeling intensity, body focus, mismatch | Connected to `affect` workspace signal | do not treat display emotion as proof of subjective feeling |
| Global workspace | `CognitiveNetworkBus` | specialist score/confidence/cost/evidence | bounded broadcast of selected specialists | confidence/energy-aware; input normalized | no second attention scheduler |
| Action candidate scoring | `OrganismCore` with `affectWorkspaceActionBias` | broadcast plus action/tendency compatibility | small capped candidate prior | integrated; P69 remains final arbiter | affect cannot bypass policy veto |
| Salience/perception | existing salience specialist + sensory-event source | novelty, surprise, perceptual evidence | one fused specialist signal | integrated with evidence preservation | no parallel salience state |
| Decision/policy | P69 / canonical arbiter | candidate scores and safety policies | final allowed/selected action | owner retained | no downstream module rewrites final decision |
| Side effects | `ActionGateway` | decision-bound invocation, idempotency key | durable execution receipt | inherited from WorkPass38 | no direct side-effect calls in cognition layer |
| Long-term memory | `MemoryOS2` | committed facts/events, provenance and temporal metadata | canonical writable facts and retrieval | sole writable memory owner remains | no Mem0/Chroma/Letta writable store added in parallel |
| External observations/trust | `ExternalObserverFabric`, `ExternalEvidenceTrust`, `EvidenceFirewall` | external outcomes/source identity | stable SHA-256 evidence; legacy identity preservation | integrated | do not silently reinterpret previous IDs |
| Self-model/social/entity projection | existing self-model and `KnownEntityDossier` readers | verified events/facts | bounded context for prompts and planning | map records owner/flow | no independent duplicate identity database |
| Research candidate promotion | existing research gates | provenance and labelled experiment evidence | promote / do not promote | retrieval candidate kept not-promoted (delta 0) | no self-promoting candidate |
| UI/diagnostics | Runtime Atlas + server API | read-only map and composed health | visual 14-system/22-flow map, health snapshot | API/UI linkage PASS | diagnostics do not become a second source of state |
| Historical source restoration | content-addressed SHA blobs + manifests | immutable historical bytes | verifiable recovery | 8,512/8,512 archive members and 10,427 snapshot members | do not point old snapshots at mutable active files |
| Local model inference | provider boundary under current runtime | provider capabilities, VRAM, latency and license | model response/tool proposal | not promoted this pass; target HW validation required | no bundled model weights or second agent runtime yet |

## Source review choices
- **Adopt patterns:** LangGraph's distinction between scoped checkpoints and long-term stores; OpenAI Agents SDK pre/post tool guardrails; DSPy-style metric/holdout gate; Mem0-style hybrid/temporal retrieval as a benchmark candidate; llama.cpp as an optional local inference provider; Microsoft Agent Framework as the current new-work direction compared with AutoGen maintenance mode.
- **Do not blindly import frameworks:** project already has OrganismCore, ActionGateway, MemoryOS2, P69, Runtime Atlas and adapters. Parallel orchestration or writable memory creates conflicting owners.
- **Network limitation:** outbound container DNS returned `EAI_AGAIN registry.npmjs.org`; actual upstream repositories were not cloned to this build. No claim is made that external source code was byte-level audited or downloaded. See `OPEN_SOURCE_INTEGRATION_REVIEW_WORKPASS39.md` for repository URLs and review boundaries.
