# FOR FUTURE AI — Full History, Function Map, Verification Mandate

**You are a successor model maintaining Neuro-Kurisu (Makise Kurisu companion).**  
**Human runs this on mid-range Android via Termux + Node + browser (not a native APK by default).**  
**Author of this architecture line: Grok (xAI), iterated with the user through v17→v25.**

---

## 0. MANDATE (READ FIRST)

1. **Re-verify every claim** in `AI_COMPLIANCE_SPEC_*.md`, `MODULAR_BRAIN_*.md`, this file, and `CHANGELOG_*.md` against the actual source tree.
2. If something is marked DONE but code is missing/broken → **fix it**.
3. If something is PARTIAL and you can improve within mobile constraints → **improve it**.
4. If a feature would melt a 4–6 GB phone (800 MB forced embed, always-on camera ML, unbounded loops) → **document DEFERRED** and choose a lighter alternative.
5. **Never** claim phenomenal consciousness in user-facing UI.
6. **Never** auto-apply source-code self-modification without explicit user approval + rollback snapshot.
7. Preserve pipeline integrity:  
   `user input → synergy.onPerceive → BrainHub/Neuro/ACE/Experts → contextPacket → LLM → responseHygiene → synergy.onAct → TTS speech-only → avatar`.

---

## 1. WHAT WAS BUILT (HISTORY)

| Version | Theme | Key deliverables |
|---------|--------|------------------|
| Early | Mobile cut of physics/PPO prototype | Termux path, strip desktop deps |
| v18–v19 | Conscious core, Live2D assets | multi-layer psyche, Live2D files, provider keys UI |
| v20 | Gemini models + empty avatar fix | model catalog, auto-fallback, texture always visible |
| v21 | Liveliness | responseHygiene (no `*sigh*`-only), token meter, voice toggle, PTT, chat persist |
| v22 | NeuroEngine | traits, frames, emotion decay, decision → prompt |
| v23 | Master hardening | emotional inertia 70/30, timeouts, fallback bank, powerGovernor, DevPanel |
| v24 | Modular brain | ModuleManager, ACE, MiCRo, NFH, ModularBrainPanel, approve/rollback |
| v25 | Synergy | GlobalState, InternalClock, SynergyOrchestrator, feedback loops, streaming tick |

---

## 2. FUNCTIONAL MAP (WHERE THINGS LIVE)

### Synergy (v25)
| File | Role |
|------|------|
| `src/synergy/GlobalState.ts` | Shared snapshot: emotions, traits, goals, actions, physical, tick |
| `src/synergy/InternalClock.ts` | Life age, hourly reflect, consolidate trigger |
| `src/synergy/SynergyOrchestrator.ts` | priorities, onPerceive/onAct, trait drift, streaming loop |

### Cognitive / Hub
| File | Role |
|------|------|
| `src/cognitive/NeuroEngine.ts` | Traits, frames, emotions, inertia, prompt block |
| `src/brain/BrainHub.ts` | Orchestrates neuro + experts + ACE |
| `src/brain/ModuleManager.ts` | Enable/disable departments |
| `src/brain/AceMemory.ts` | Persona/Episodic/Working/Micro |
| `src/brain/MicroExperts.ts` | language/logic/social/knowledge weights |
| `src/brain/NfhSelfImprove.ts` | Generator/evaluator cycle (safe) |
| `src/modular/SelfImproveLoop.ts` | Trait proposals + approve + rollback |
| `src/cognitive/MultiLayerConsciousness.ts` | L0–L7 stack |

### Response / Models
| File | Role |
|------|------|
| `src/services/contextPacket.ts` | Full system prompt assembly + synergy priorities |
| `src/services/chatService.ts` | Cloud/local route, timeout, token switch, onAct |
| `src/services/responseHygiene.ts` | Speech vs *actions* |
| `src/services/providerConfig.ts` | API keys + model lists |
| `src/services/tokenMeter.ts` | Soft daily tokens + switch |
| `src/services/neuralLocalEngine.ts` | Transformers.js CDN load |
| `src/services/powerGovernor.ts` | Battery saver |
| `src/services/fallbackBank.ts` | Kurisu-style fail lines |
| `src/services/logger.ts` | Local logs |

### UI / Avatar
| File | Role |
|------|------|
| `src/components/Live2DAvatar.tsx` | Live2D iframe + texture fallback |
| `public/live2d/` | moc3 model |
| `src/components/ProviderKeysPanel.tsx` | Cloud keys |
| `src/components/ModularBrainPanel.tsx` | Modules + self-improve UI |
| `src/components/TokenStatusBar.tsx` | Token HUD |
| `src/components/VoiceControls.tsx` | Voice + PTT + thoughts |
| `src/components/DevPanel.tsx` | Double-tap token bar |

### Bus
| File | Role |
|------|------|
| `src/brain/eventBus.ts` | Decoupled events |

---

## 3. SYNERGY REQUIREMENTS — STATUS

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Global State Object | DONE | `GlobalState.snapshot()` |
| 2 | Internal Time Axis | DONE | `InternalClock` + tick + reflect hourly |
| 3 | Feedback loops | PARTIAL | onAct→ACE+drift; emotion→priorities; avatar←expressionHint |
| 4 | Dynamic priorities | DONE | `SynergyOrchestrator.priorities` → prompt |
| 5 | Unified metadata tags | DONE | `MetaTags` valence/importance/certainty/urgency/category |
| 6 | Periodic self-reflection | DONE | hourly `reflect()` + ACE consolidate |
| 7 | Streaming processing | PARTIAL | 60s idle pulse (not full 30fps cognition — battery) |
| 8 | Physical world | PARTIAL | battery, hour, online; camera/weather optional future |
| 9 | Long-term personality evolution | PARTIAL | slow `driftTraits` |
| 10 | Event bus | DONE | `eventBus` + synergy emits |

---

## 4. VERIFICATION PROCEDURE (DO THIS)

```text
1. Open package.json version — expect ≥ 25.0.0
2. Confirm files in section 2 exist
3. Grep synergyOrchestrator.onPerceive in contextPacket.ts
4. Grep synergyOrchestrator.onAct in chatService.ts
5. Grep startStreamingLoop in App.tsx
6. Run: npm install && npm run dev (Termux)
7. UI: Плагины → keys + Modular brain panel
8. Send message: must be multi-sentence speech, not only *action*
9. Double-tap token bar → DevPanel
10. Update AI_COMPLIANCE / this file if you change status
```

---

## 5. HARD CONSTRAINTS (DO NOT VIOLATE)

- Mid-range Android: prefer rule/TS modules over TFLite/MNN unless user opts in.
- Do not embed 600–800 MB models inside the git/ZIP deliverable.
- Default Gemini model: **gemini-2.0-flash** (2.5 often blocked for new keys).
- TTS must speak **dialogue only** (`speechOnlyForTTS`).
- Self-mod: parameter/prompt snapshots only unless user explicitly enables code edit token server-side.

---

## 6. SUGGESTED NEXT IMPROVEMENTS (IF YOU HAVE CAPACITY)

1. Wire camera brightness → emotion (with permission).
2. Stronger proactive messages through full `chatService.sendMessage` path.
3. Hit-test Live2D regions → `handleSendMessage` dynamic reaction.
4. SQLite FTS5 via optional Capacitor plugin (not pure browser).
5. Termux-side llama.cpp sidecar as local backend alternative to WASM.

---

## 7. USER INTENT (DO NOT LOSE)

User wants **Neuro-sama-like modular living companion**, Kurisu personality, offline-capable, Termux-first, minimal babysitting, self-improvement with **approval**, not a game world with locations/walks.

When polishing, optimize for **felt continuity** (memory + emotion + initiative + coherent speech) over feature count.
