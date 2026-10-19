# Kurisu Neuro v27 — итоговая валидация

## Архитектура
- CoreEnhancementHub: routines, déjà-vu, emotional contagion, private control scratch, daily review.
- HybridBrain: rules + local neural + cloud with energy-aware routing.
- LivingPersona: slow trait evolution and adaptive communication rhythm.
- MemoryEngine: semantic-ish retrieval + Ebbinghaus-style forgetting + emotional retention + confidence/meaning/actions metadata.
- NeuralPathwayGraph: associative memory links.
- EmergentBehaviorEngine: rare creative/dream impulses without permanent inference.
- Existing ACE, self-improvement, Live2D, TTS, autonomous and module systems preserved.

## Safety / resource model
- No new npm dependencies.
- No permanent LLM background loop.
- Local model remains opt-in.
- Private cognitive buffer stores compact control signals, not hidden chain-of-thought.
- Code self-evolution remains proposal/approval/backup/test/rollback.

## Static checks performed in this build
- 114 source files were present in v26 before modifications.
- All v27-added files were reviewed for strict TypeScript compatibility patterns.
- `package.json` contains no onnxruntime-node dependency.
- No new runtime dependency was introduced.
- Full `npm install` + `tsc` could not be completed inside the build sandbox because dependency installation exceeded the sandbox time limit; run `npm install` then `npm run lint` in Termux as the authoritative environment check.
