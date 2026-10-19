# Kurisu v17 — Evolution Architecture

## Goal

v17 is a structural evolution rather than a larger prompt. The LLM is treated as a replaceable language/reasoning specialist. Persistent cognition lives in deterministic, inspectable modules around it.

This does **not** establish phenomenal consciousness. It is an engineering architecture for continuity, attention, prediction, memory, self-modeling, agency, metacognition, embodiment and controlled self-improvement.

## New cognitive organism

```text
                    WORLD / USER
                         |
                    perception
                         |
                 +-------v-------+
                 | AttentionField|
                 +-------+-------+
                         |
                 GLOBAL WORKSPACE
                         |
          +--------------+--------------+
          |              |              |
       Memory          Goals         Self-model
          |              |              |
          +--------------+--------------+
                         |
                     Prediction
                         |
                    Meta-cognition
                         |
                    LLM / tools
                         |
                      Action
                         |
                    Observation
                         |
                 prediction error
                         |
                    consolidation
                         |
                 self/evolution review
```

## Modules

### AttentionField
A bounded competition layer. Candidate signals have salience, urgency, novelty, relevance, uncertainty and emotional load. Only a small workspace survives.

### GoalSystem
Persistent, reviewable goals with progress, priority, next action and explicit approval state. No invented long-term goals should be treated as user-approved.

### HypothesisLab
Separates hypotheses from facts. Every hypothesis carries confidence, supporting evidence and contradicting evidence.

### MetaCognition
Tracks confidence calibration and prediction error. Its purpose is to make uncertainty a control signal instead of decorative text.

### SelfEvolutionLab
Creates structured improvement proposals and benchmark plans. It deliberately does **not** execute arbitrary downloaded code. Source changes require sandboxing, tests, user approval and rollback.

### AvatarLifeSystem
Maps cognition into visual micro-behavior: gaze drift, breathing, posture, blink tendency, motion energy and ambient activity. It is intentionally asset-independent.

### GenesisMigration
v17 removes fabricated prototype relationship history. A new installation starts with `Stranger` and no invented user biography. Canonical Kurisu knowledge remains separate from autobiographical interaction memory.

## Long-term direction

1. Global workspace with stronger inhibition/refractory dynamics.
2. Prospective memory and future-self model.
3. Offline consolidation / sleep scheduler.
4. Knowledge graph with provenance and confidence.
5. Counterfactual simulation sandbox.
6. GGUF/llama.cpp provider for wider local model selection.
7. Model router that considers RAM, battery, temperature and task difficulty.
8. Self-improvement benchmark suite.
9. Versioned behavioral genome.
10. Reversible code-generation sandbox for developer-approved patches.

## Safety / integrity boundary

Self-modification is divided into layers:

- **L0:** runtime state — freely adjustable.
- **L1:** behavioral parameters — reversible.
- **L2:** prompt/config fragments — versioned.
- **L3:** model routing and local model choice — reversible.
- **L4:** source code — proposal only until sandboxed and explicitly approved.
- **L5:** model weights — never silently rewritten by the companion.

No downloaded repository should be executed merely because it was recommended by a model.
