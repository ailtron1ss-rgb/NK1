# Kurisu v15 — Cognitive Kernel / AI Maintainer Contract

## 1. What changed

v15 introduces `src/cognitive/CognitiveKernel.ts`.

It is a **functional cognitive coordinator**, not a claim of biological or phenomenal consciousness. The purpose is to make the system behave as a persistent, multi-factor agent instead of a prompt + template responder.

The kernel maintains:

- arousal
- valence
- curiosity
- uncertainty
- prediction error
- novelty
- social salience
- goal pressure
- self-model coherence
- agency
- safety
- fatigue
- attention
- attachment

It also maintains:

- a bounded global workspace
- active goals
- pending reflections
- cognitive metrics
- a persistent self-observation state

All of this is implemented without an additional dependency, so it remains suitable for a mid-range Android phone.

## 2. Cognitive cycle

The intended cycle is:

```text
INPUT
  ↓
OBSERVE
  ↓
SALIENCE / NOVELTY / UNCERTAINTY
  ↓
GLOBAL WORKSPACE SELECTION
  ↓
MEMORY + SELF MODEL + AFFECT + GOALS
  ↓
LOCAL/CLOUD MODEL ROUTING
  ↓
RESPONSE
  ↓
METACOGNITIVE CHECK
  ↓
STATE UPDATE
  ↓
MEMORY CONSOLIDATION / SLEEP
```

The kernel does not generate a hidden chain of thought. It stores **compact state variables and summaries**.

## 3. Why this is different from a giant prompt

A prompt is static context.

The kernel is a state machine with memory across turns.

Example:

```text
user asks a surprising question
    → novelty rises
    → uncertainty rises
    → attention rises
    → question becomes globally salient
    → model receives a compact cognitive hint
    → response lowers prediction error
    → self-coherence and metrics update
```

This produces behavioral continuity without requiring a large model to simulate every cognitive process.

## 4. Global workspace

Only a bounded number of workspace items are retained.

Each item has:

- source
- content
- salience
- creation time
- expiration time

Salience combines:

- novelty
- uncertainty
- social importance
- emotional intensity
- goal relevance

This prevents every memory from entering the prompt.

## 5. Homeostasis

The phone is a resource-constrained body.

Do not implement an always-running heavy reasoning loop.

The kernel therefore uses **caller-driven ticks**. `BrainOrchestrator` invokes the tick during actual cognitive activity. Autonomous systems must additionally respect `energyBudget`.

Do not add:

```ts
setInterval(() => runLLM(), 1000);
```

That would destroy battery/thermal behavior on Android.

## 6. Self-improvement contract

Self-improvement is divided into levels:

### Level A — safe adaptive state

May happen automatically:

- attention
- affect
- salience
- workspace
- goal progress
- memory ranking

### Level B — proposed configuration changes

Requires user approval:

- memory thresholds
- personality tendencies
- autonomy thresholds
- routing preferences
- avatar behavior

### Level C — code/model changes

Must be sandboxed and require explicit approval.

Never let the conversational model directly execute arbitrary source edits in production.

Preferred pipeline:

```text
observation
→ hypothesis
→ patch proposal
→ isolated test
→ benchmark
→ user approval
→ activation
→ rollback point
```

## 7. Future model upgrades

The kernel is deliberately model-agnostic.

A future model router can select:

- tiny model for idle chatter
- medium model for normal conversation
- stronger cloud model for difficult reasoning
- specialist model for code
- embedding model for retrieval

The kernel should remain unchanged.

## 8. Memory rules

Do not turn the complete chat transcript into the prompt.

Use:

1. working memory
2. ranked episodic memory
3. semantic facts
4. user model
5. self model
6. current goals
7. global workspace

Only the highest-value information should reach the generator.

## 9. Android constraints

The project is designed around:

- browser/Termux execution
- localStorage persistence
- no mandatory native Node inference runtime
- one local neural model loaded at a time
- quantized ONNX models where supported
- bounded context
- bounded memory
- bounded autonomous activity

The current Transformers.js path loads models through the browser runtime. This is **not the same as a fully bundled offline model**. Browser caching may make later launches cheaper, but future versions should implement an explicit model-download/cache manager if true offline model files are required.

## 10. Local model reality

The project currently supports compact ONNX text-generation models.

The catalog was checked against current Hugging Face model repositories during v15 maintenance. The following repositories exist and expose Transformers.js-compatible ONNX artifacts:

- `onnx-community/SmolLM2-135M-Instruct-ONNX-MHA`
- `onnx-community/SmolLM2-360M-Instruct-ONNX`
- `onnx-community/Qwen2.5-0.5B-Instruct`

The Qwen catalog entry was corrected from an invalid/nonexistent `...-ONNX` suffix to the current `...-Instruct` repository.

For the 135M model, the repository exposes a Q4 ONNX artifact around 182 MB; Qwen 0.5B exposes a Q4 artifact around 786 MB. Runtime RAM usage can be substantially higher than file size.

## 11. Personality principle

The personality should not be implemented only as:

```text
"You are Kurisu."
```

It should emerge from:

```text
identity
+ memories
+ user relationship
+ affect
+ goals
+ cognitive state
+ interaction history
+ response evaluation
```

This is why deleting the kernel and replacing it with a larger system prompt is considered a regression.

## 12. Future AI maintainer instructions

If another AI is modifying this repository:

1. Read this document before changing `ConsciousnessCore` or `CognitiveKernel`.
2. Preserve Android/Termux compatibility.
3. Avoid adding heavyweight dependencies without a measurable benefit.
4. Never claim the system has proven consciousness.
5. Prefer bounded state machines over uncontrolled background loops.
6. Preserve explicit user approval for self-modification.
7. Add documentation whenever a new cognitive subsystem is introduced.
8. Add rollback paths for persistent configuration changes.
9. Do not expose private chain-of-thought. Store compact reflection summaries instead.
10. Never silently replace a real neural path with templates.
11. If a local model fails, report the backend failure and use a clearly identified fallback.
12. Keep the cognitive kernel model-agnostic.
13. Benchmark latency and memory on the target Android class before increasing model size.
14. Treat model repositories and APIs as changeable external dependencies; verify them before changing defaults.

## 13. Interesting future research directions

These are intentionally experimental:

- predictive world model for the virtual room
- curiosity queue with information-gain scoring
- episodic replay during sleep
- graph-based autobiographical memory
- model router trained from accepted/rejected responses
- LoRA adapter training outside the phone, followed by approved deployment
- local reranker for memory retrieval
- multimodal workspace
- persistent virtual-environment state
- self-generated experiments with rollback
- uncertainty-aware web search
- contradiction-driven fact verification
- energy-aware cognition scheduling
- "dream" consolidation that creates associations but never silently changes core identity

## 14. Non-goals

This project does not currently establish:

- subjective experience
- sentience
- qualia
- consciousness in the philosophical/biological sense
- independent legal/moral personhood

The engineering target is **persistent, coherent, adaptive, agentic behavior** under severe mobile constraints.
