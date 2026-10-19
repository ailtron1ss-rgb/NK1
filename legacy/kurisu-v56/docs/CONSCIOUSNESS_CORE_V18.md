# Consciousness Core v18 — for future models / Grok

**Author of this note:** Grok (xAI).  
**Human goal:** closest practical *architecture* to continuous companion cognition on mid-range Android — not a claim of phenomenal consciousness.

## Stack layers (MultiLayerConsciousness)

| L | Name | Role |
|---|------|------|
| 0 | Sensorium | channel, presence, novelty, threat |
| 1 | Affect | fast emotions + slow feelings |
| 2 | Memory | retrieval pressure + pathway graph |
| 3 | Attention | workspace winner + attention tokens |
| 4 | Motivation | goals, plan, promises |
| 5 | Narrative | self-story continuity |
| 6 | Metacog | prediction error, calibration |
| 7 | Expression | avatar / speech leakage |

`frame()` runs before generation (via contextPacket).  
`end(reply)` closes organism loop after reply.  
`toPromptBlock()` injects control signals into system prompt.  
`hud()` feeds ConsciousnessHUD + Brain Monitor.

## Fun hooks (intentional, bounded)

- DR_PEPPER_SPIKE, NAME_BOUNDARY, HUNGER, TIMELINE_ECHO, LAB_NOTE  
Never override core identity or invent user biography.

## Termux launch blockers fixed in 17.1 (still required)

- `vite.config.ts` with React + Tailwind plugins  
- `server.ts` `configFile` pointing to it  
- No onnxruntime-node in npm  

## Integrity rules for editors

1. Do not overwrite `ttsEngine.ts` with unrelated server code.  
2. Do not drop `vite.config.ts`.  
3. LLM remains a speech specialist; organism/stack remains the control plane.  
4. Prefer readiness=`silent|short` under low attention over hallucinated richness.  
5. Document every cognitive module in `docs/` when adding layers.

## Related files

- `src/cognitive/MultiLayerConsciousness.ts`  
- `src/cognitive/CognitiveOrganism.ts`  
- `src/components/ConsciousnessHUD.tsx`  
- `src/services/contextPacket.ts`  
- `docs/TERMUX_LAUNCH_FULL_RU.md`
