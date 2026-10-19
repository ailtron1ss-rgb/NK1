# AI COMPLIANCE SPEC — Neuro-Kurisu v22
**For future models / Grok / maintainers. Verify every checkbox against the repo.**

Author of this document: Grok (xAI).  
Human goal: Makise Kurisu companion on mid-range Android (Termux + browser), Neuro-sama-like initiative, Steins;Gate personality.

## How to verify
1. Unzip project → `kurisu_v17_evolution/kurisu_webapp`
2. Grep / open files listed in “Evidence”
3. Mark status: DONE | PARTIAL | DEFERRED | N/A

---

## 1. COGNITIVE ARCHITECTURE

| Spec item | Status | Evidence |
|-----------|--------|----------|
| Personality traits (play, intellect, chaos, empathy, sarcasm) | DONE | `src/cognitive/NeuroEngine.ts` `DEFAULT_TRAITS` + localStorage |
| Cognitive frames Play/Strategy/Chaos/Social/Learn | DONE | `NeuroEngine.pickFrame` + `promptBlock` |
| Emotional vector + decay ~0.02/min | DONE | `loadEmotions` decay toward baseline |
| Decision loop on user input | DONE | `neuroEngine.decide` called from `contextPacket.buildContextPacket` |
| Memory STM/LTM ranked | PARTIAL | `memoryEngine.retrieveRanked` — not SQLite FTS5 (browser localStorage/JSON) |
| Night consolidation | PARTIAL | `sleepCycle.ts` multi-stage, not SQLite |
| Sentiment/intent lightweight | DONE | rule-based in NeuroEngine (no TFLite — RAM budget) |
| Post-process speech vs actions | DONE | `responseHygiene.ts` + `critiqueAndFix` |
| Multi-layer stack | DONE | `MultiLayerConsciousness.ts` L0–L7 |

**Deferred by design (mobile):** TFLite intent classifier, SQLite FTS5 vector DB, MNN local 4-bit embed in APK.

---

## 2. LLM & TOKENS

| Spec item | Status | Evidence |
|-----------|--------|----------|
| Cloud Gemini + fallbacks | DONE | `chatService.callGemini` model chain; default 2.0-flash |
| Groq / OpenRouter / Together | DONE | `providerConfig.ts` |
| Token meter + UI bar | DONE | `tokenMeter.ts`, `TokenStatusBar.tsx` |
| Auto-switch cloud→cloud→local | DONE | `chatService` + `tokenMeter.pickNextCloud` + event `kurisu-model-switch` |
| Local ONNX via Transformers.js CDN | PARTIAL | `neuralLocalEngine.ts` — download on demand, not embedded in ZIP |
| Embed 600–800MB model in archive | DEFERRED | Would break mid-range storage/Termux UX; user downloads once |

---

## 3. AVATAR Live2D

| Spec item | Status | Evidence |
|-----------|--------|----------|
| Live2D model assets | DONE | `public/live2d/Kurisu/*` (moc3, texture, exp, motions) |
| Viewer + cubism4 path | DONE | `public/live2d/viewer.html` |
| Texture never-empty fallback | DONE | `Live2DAvatar.tsx` + viewer fallback img |
| Emotion → expression messages | PARTIAL | postMessage `kurisu_expression` + EXP_MAP; full 20 blendshape rig DEFERRED |
| Idle motions | PARTIAL | Idle motion if runtime loads |
| Touch regions → unique LLM reaction | PARTIAL | Touch handler exists; still partly template; neuro expression linked |
| Lip-sync visemes | DEFERRED | Web Speech has no reliable viseme stream on Android Chrome |

---

## 4. VOICE

| Spec item | Status | Evidence |
|-----------|--------|----------|
| TTS dialogue only | DONE | `speechOnlyForTTS` |
| Voice on/off | DONE | `VoiceControls` + `kurisu_voice_on` |
| Push-to-talk STT | DONE | Web Speech API in `VoiceControls` |
| Always-on <500ms call | PARTIAL | PTT only; always-on drains battery on mid phones |
| Separate breath SFX for *actions* | DEFERRED | Actions text-only |

---

## 5. INITIATIVE & THOUGHTS

| Spec item | Status | Evidence |
|-----------|--------|----------|
| Proactive messages | PARTIAL | `autonomousEngine` + App subscription |
| Thought bubble toggle | DONE | `thoughtsOn` + `ThoughtBubbleOverlay` |
| Neuro thought trace live | DONE | event `kurisu-neuro-thought` → bubbles |
| Typewriter fade 5s | PARTIAL | overlay exists; polish CSS optional |

---

## 6. PERFORMANCE

| Spec item | Status | Evidence |
|-----------|--------|----------|
| No onnxruntime-node in npm | DONE | package.json clean |
| vite.config.ts present | DONE | Termux JSX fix |
| Lazy neural load | DONE | ensureLoaded on user action |
| RAM under 1.5GB guaranteed | N/A | Depends on chosen local model size |

---

## 7. REMOVALS

| Spec item | Status | Evidence |
|-----------|--------|----------|
| No location/walk RPG in prompt | DONE | contextPacket system rules |
| Outfit UI demoted | PARTIAL | primary avatar is Live2D; outfit picker gated |

---

## 8. SELF-UPGRADE

| Spec item | Status | Evidence |
|-----------|--------|----------|
| User-approved proposals | PARTIAL | SelfOptimization / code export paths from earlier versions |
| Rollback one-tap | PARTIAL | StateVault / snapshots where present |

---

## 9. UI

| Spec item | Status | Evidence |
|-----------|--------|----------|
| Token bar | DONE | TokenStatusBar |
| Mic button | DONE | VoiceControls |
| Chat persistence | DONE | `kurisu_chat_v1` |
| Russian UI | PARTIAL | most panels RU |

---

## 10. MUST NOT REGRESS

- [ ] Never ship without `vite.config.ts`
- [ ] Never overwrite `ttsEngine.ts` with unrelated code
- [ ] Never default Gemini to 2.5-flash for new free keys
- [ ] Never answer with only `*action*` (hygiene + prompt)
- [ ] Never claim true phenomenal consciousness in user-facing copy

---

## Honest remaining gaps (future work)

1. SQLite FTS5 memory (Capacitor/Android shell) vs localStorage limits  
2. Embedded GGUF/llama.cpp sidecar in Termux (not browser WASM)  
3. Full Live2D param continuous drive + lip-sync  
4. Capacitor APK packaging  
5. True always-on voice with VAD  

When extending, prefer **NeuroEngine.decide → prompt → hygiene → TTS speech-only** pipeline integrity over new decorative tabs.
