# Kurisu v15.1 — Cognitive Loop maintenance pass

## Added
- `PredictiveLoop`: prediction → observation → mismatch → calibration.
- Prediction trace persisted separately from chat history.
- Predictive hint included in the local neural context.
- Expanded local model registry: Qwen3 0.6B, Phi-3.5 Mini ONNX, TinyLlama 1.1B and experimental SmolLM2 1.7B.
- User-defined Hugging Face model repository IDs.
- Model-specific ONNX dtype selection (`q4`, `q4f16`, etc.).
- Detailed Android/Termux launch guide.
- v16 cognitive-loop roadmap for future AI maintainers.

## Safety/architecture
- Only one local model is loaded at a time.
- Prediction state is compact; no hidden chain-of-thought is persisted.
- Custom models must be compatible with Transformers.js text-generation and ONNX.
- GGUF is intentionally kept as a future separate llama.cpp provider.

## Validation
The standalone new modules were checked with TypeScript 5.8.3 using DOM/ES2020 libraries.
A full dependency install/build was not completed in the maintenance environment because `npm install` exceeded the environment time limit; therefore this release does not claim a full production build verification.
# CHANGELOG — v15.0.0

## Major cognitive upgrade

- Added `CognitiveKernel` with multi-factor state, global workspace, goals, uncertainty, prediction error, novelty, attention, agency, safety, fatigue and attachment.
- Integrated kernel observation into `BrainOrchestrator.plan()`.
- Integrated kernel state into model context packets.
- Integrated post-response metacognitive state updates.
- Added persistent compact cognitive state using localStorage.
- Added bounded reflection queue.
- Added Android-safe resource-aware cognitive ticking.

## Reliability fixes

- Commands now prefer the local neural backend instead of forcing the template responder when a neural model is enabled.
- Local neural model loading now respects the existing Android energy budget.
- Neural loads are counted against the daily load budget.
- Corrected Qwen local model repository to `onnx-community/Qwen2.5-0.5B-Instruct`.
- Expanded local neural prompt so the model answers the actual user request instead of defaulting to ultra-short generic responses.

## Documentation

- Added `AI_MAINTAINER.md`.
- Added `docs/COGNITIVE_KERNEL_V15.md`.
- Updated `START_HERE_RU.md`.


## v16.0.0 — Conscious Loop foundation
- Added bounded ConsciousLoop with competing cognitive candidates and ConsciousFrames.
- Added persistent grounded SelfModel with confidence/evidence tracking.
- Integrated both into BrainOrchestrator prompt context.
- Removed an accidental developer-specific social cue from the cognitive heuristic so first-run identity remains blank.
- Added Android/Termux v16 documentation and staged roadmap.
