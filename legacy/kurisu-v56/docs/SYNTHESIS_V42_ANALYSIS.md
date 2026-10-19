# Synthesis v42 — Archive analysis & integration

## Scores vs Neuro-Kurisu baseline (Termux mid-range goal = 10 ideal)

| Archive | Score | Why |
|---------|------|-----|
| **Neuro_Kurisu_v41_1_TS_FIXED** | **9/10** | Full modular brain, Live2D web, cloud+local, synergy, hygiene, TS fixes. Baseline of truth for Android/Termux browser. |
| **2-main (Gemini native Kotlin)** | **6.5/10 for our stack** | Strong *ideas*: 5 drives, PrivateCognition, L1–L3 memory model, sentiment→TTS/Live2D, autonomy initiative, Room DB. **Native APK** — not runnable in Termux Node as-is. Algorithms portable; UI/DB/Live2D native not. |
| **Assistant archive** | **N/A** | Not uploaded. |

## What was taken from 2-main (adapted to TS)

| Idea | Status | Where |
|------|--------|--------|
| 5 Autonomy Drives | DONE | `src/cognitive/AutonomyDrives.ts` |
| Drive-based spontaneous speech | DONE | `App.tsx` idle loop |
| PrivateCognition structure | DONE | `src/cognitive/PrivateCognition.ts` → thought events |
| Sentiment → mood + pitch/rate | DONE | `src/services/sentimentKurisu.ts` + TTS + prompt |
| Curiosity queue | DONE | `src/cognitive/CuriosityQueue.ts` |
| L1–L3 SQLite/Room | DEFERRED | Browser: ACE + ranked memory already; sql.js optional later |
| Native Live2D / haptics | DEFERRED | Web Live2D + texture already; Vibration API optional |
| Full Kotlin CognitiveEngine | DEFERRED | Parallel to BrainHub/Neuro — not a rewrite |

## What was NOT merged (would become каша or break phone)

- Gradle/Compose/Room stack as dependency
- Hardcoded proactive lines only (kept as drive *fallback*, still prefer LLM path)
- Claiming 15ms neural hybrid without real NPU path

## Own additions this pass

- Prompt blocks: AUTONOMY DRIVES + SENTIMENT + CURIOSITY
- Dialogue updates drives after each reply
- TTS multiplies pitch/rate from last sentiment

## Seven verification passes (summary)

1. Import graph of new modules → resolve OK  
2. v41.1 TS fixes still present (body, PersonalityMap, main import, powerGovernor, Avatar2D)  
3. contextPacket order: sentiment before prompt usage  
4. chatService updates drives post-reply  
5. App idle uses checkInitiative without blocking visibility/battery guards  
6. No new relative import holes  
7. Docs score table honest about native vs web  

## Future AI

Re-check this file + `FOR_FUTURE_AI_FULL_HISTORY_AND_MANDATE.md`. Prefer drive/sentiment/cognition coherence over new decorative tabs.
