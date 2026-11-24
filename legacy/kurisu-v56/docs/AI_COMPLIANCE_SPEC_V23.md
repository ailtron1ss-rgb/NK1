# AI COMPLIANCE SPEC — Neuro-Kurisu v23
**Verify this file against the repo. Status: DONE | PARTIAL | DEFERRED | N/A**

Maintainer note (Grok/xAI): Mid-range Android Termux+browser constraints override desktop-scale ideals (no 800MB embed in ZIP, no TFLite required).

## Spec map (Master Prompt)

### 1 Cognitive
| Item | Status | Path |
|------|--------|------|
| Traits | DONE | `cognitive/NeuroEngine.ts` |
| Frames | DONE | same |
| Emotion + decay 0.02/min | DONE | `loadEmotions` |
| Emotional inertia 70/30 | DONE | `blend()` in bumpEmotions |
| Decision loop | DONE | `decide()` ← `contextPacket` |
| Memory ranked | PARTIAL | memoryEngine (not SQLite FTS5) |
| TFLite intent | DEFERRED | rule-based intent (RAM) |

### 2 LLM
| Item | Status | Path |
|------|--------|------|
| Gemini primary + fallbacks | DONE | chatService + providerConfig |
| Token bar + auto-switch | DONE | tokenMeter, TokenStatusBar |
| Local ONNX download | PARTIAL | neuralLocalEngine CDN |
| Embed Q4 in ZIP | DEFERRED | size |

### 3 Avatar
| Item | Status | Path |
|------|--------|------|
| Live2D + texture fallback | DONE | public/live2d, Live2DAvatar |
| Full param rig + lip-sync | DEFERRED | runtime limits |
| Touch reactions | PARTIAL | handleTouchBodyPart + neuro expr |

### 4 Voice
| Item | Status | Path |
|------|--------|------|
| Speech-only TTS | DONE | responseHygiene |
| Toggle + PTT | DONE | VoiceControls |
| SSML nuances | DEFERRED | Web Speech limited |

### 5 Initiative / thoughts
| Item | Status | Path |
|------|--------|------|
| Proactive engine | PARTIAL | autonomousEngine |
| Neuro thought bubbles | DONE | kurisu-neuro-thought |
| Thinking pause 0.4–1.8s | DONE | App + thinkingDelayMs |

### 6 Performance
| Item | Status | Path |
|------|--------|------|
| Power governor battery | DONE | powerGovernor.ts |
| Prefer skip neural on low bat | PARTIAL | chatService route guard |
| Cloud timeout 12s | DONE | withTimeout |

### 7 Stability
| Item | Status | Path |
|------|--------|------|
| Fallback bank | DONE | fallbackBank.ts |
| Logger + export | DONE | logger.ts, DevPanel |
| Live2D→texture degrade | DONE | Live2DAvatar |

### 8 Human liveliness
| Item | Status | Path |
|------|--------|------|
| Inertia, fillers in prompt | DONE | NeuroEngine promptBlock |
| Self-reflection hints | PARTIAL | prompt RULES |

### 9 UI
| Item | Status | Path |
|------|--------|------|
| Token bar, mic, thoughts | DONE | components |
| Dev panel (double-tap token bar) | DONE | DevPanel.tsx |

### 10 Must not regress
- vite.config.ts present
- no action-only replies (hygiene)
- Gemini default not 2.5-flash for new keys
- ttsEngine intact

## Better alternatives chosen (vs pure spec)
- Rule-based sentiment/intent instead of TFLite (stable on 4–6GB without native deps)
- Transformers.js CDN instead of MNN/TFLite APK path (fits Termux web)
- Soft daily token estimate instead of provider billing APIs (no universal quota API)
