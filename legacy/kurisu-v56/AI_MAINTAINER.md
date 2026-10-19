# AI Maintainer Contract — Kurisu v17

Read this before modifying the project.

## Mission

Build a persistent Android-friendly companion architecture that can approximate increasingly rich functional cognition while staying honest about what has and has not been demonstrated.

## First principles

1. The LLM is a specialist, not the entire mind.
2. Persistent state must be inspectable and versioned.
3. Facts, hypotheses, memories and narrative interpretations are different data types.
4. A new user relationship starts from zero.
5. Attention is bounded.
6. Confidence is not truth.
7. Autonomous behavior must be rate-limited on Android.
8. Self-modification must be reversible.
9. Never execute arbitrary downloaded code merely because an LLM requested it.
10. Prefer deterministic cheap algorithms before invoking a larger model.

## Architecture

`CognitiveKernel` provides broad homeostasis and factors.

`ConsciousLoop` provides compact cycle frames.

`CognitiveOrganism` coordinates v17 subsystems:

- AttentionField
- GoalSystem
- HypothesisLab
- MetaCognition
- SelfEvolutionLab
- AvatarLifeSystem
- SelfModel
- PredictiveLoop

`BrainOrchestrator` remains the application-level gateway.

## Android rule

No permanent high-frequency cognition loop. Use event-driven ticks, bounded timers, sleep/idle consolidation and one local model at a time.

## Self-programming rule

The companion can propose source changes, create benchmark plans and record results. It must not silently rewrite or execute production code.

## Model rule

The browser ONNX provider is intentionally limited. Future GGUF/llama.cpp integration should be a separate provider. Do not fake GGUF support by pretending an arbitrary GGUF repository is a Transformers.js ONNX model.

## Validation

At minimum run:

```bash
npx tsc --noEmit --target ES2022 --module ESNext \
  --moduleResolution Bundler --lib ES2022,DOM --skipLibCheck \
  src/cognitive/*.ts src/brain/BrainOrchestrator.ts
```

If dependencies are installed, also run `npm run lint` and `npm run build`.

## Next target

The next major release should implement:

1. prospective memory;
2. stronger inhibition/refractory attention;
3. knowledge graph + provenance;
4. offline consolidation scheduler;
5. counterfactual sandbox;
6. GGUF/llama.cpp provider;
7. benchmark runner with versioned results.


## v17.1 Termux launch integrity (Grok)

- Always ship `vite.config.ts` with `@vitejs/plugin-react` and `@tailwindcss/vite`.
- `server.ts` createViteServer must set `configFile` to that file in middleware mode.
- Do not reintroduce `onnxruntime-node` or npm `@huggingface/transformers` on Android.
- Prefer LiveAvatar/Avatar2D; Avatar3D is a thin wrapper — do not force three.js on mid phones.
- Primary install path: user Downloads → `~/storage/downloads/*.zip` → `~/kurisu/.../kurisu_webapp`.
