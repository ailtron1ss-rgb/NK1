# WorkPass47 — source adaptation review

**Date:** 2026-10-16  
**Canonical target:** WorkPass46 → WorkPass47 / runtime 35.68.0 / schema 225  
**Rule:** source archives are components/references, not alternative canonical runtimes. This pass makes one narrow code-level upstream adaptation instead of copying whole frameworks into the app.

## Actual code adaptation in this pass

### WILL — graded trait salience / two-channel trait influence

Source: `/Нейро Курису/Исходники/four.7z` → `will-main.zip` → `src/cognition/persona.prior.ts`, `src/cognition/faculties/persona.consolidator.ts`, `.TODO/TRAIT_SALIENCE_GRADED.md`, `.TODO/TRAIT_CHANNEL_A_EDGES.md`. The source ZIP's `will-main/LICENSE` is Apache License 2.0. The source pattern distinguishes numeric/autonomic trait influence from a language-facing self-observation and grades visibility by evidence, baseline deviation and limited prompt capacity.

**Integrated in Kurisu:**

- Reused the existing `B270NeuralGerminalOrganism` as the only owner of learnt numeric trait values/evidence and existing action bias.
- Added `language/GradedTraitSalience.ts`: pure deterministic adapter compares current values with the B270 neutral initial baseline, gates on evidence and minimum deviation, ranks trait shifts and projects only the top three using coarse language bands instead of volatile raw decimals.
- `OrganismCore.personalityTraitPromptContext()` reads current B270 state. Normal dialogue, autonomous dialogue and cognitive-proposal prompts receive that context.
- `KurisuCanonProfile.ts` remains the source of stable canonical traits. The adapter explicitly says learned tendencies do not replace the stable Kurisu identity.
- No B270 state schema changes, no extra persistence owner, no new persona engine, no wholesale WILL code copied. Implementation was written as an adapter around the existing Kurisu contracts.

## Inventory of uploaded external ZIP projects

The 4 `.7z` containers are stored in Library byte-preserving under `/Нейро Курису/Исходники/`. Their nested ZIP projects remain reference material; duplicate Letta snapshots are not independent projects.

| Container | Nested project | WorkPass47 disposition |
|---|---|---|
| `one.7z` | Agent0 | Candidate for bounded autonomous-loop ideas; no code copied this pass |
| `one.7z` | AutoGPT | Candidate for task/workspace patterns; do not copy `autogpt_platform/` without separate PolyForm Shield review |
| `one.7z` | Microsoft Agent Framework | Candidate for workflow/state transitions; no parallel runtime added |
| `one.7z` | AutoGen | Candidate for delegation patterns; no code copied this pass |
| `one.7z` | Chroma | Candidate for retrieval comparison only; current measured retrieval uplift is not sufficient to replace canonical memory |
| `two.7z` | DSPy | Candidate for prompt/optimizer experiments, isolated from production prompts until measured |
| `two.7z` | FAISS | Candidate vector-index comparator; no backend promotion without independent holdout |
| `two.7z` | Hermes Agent | Candidate skill/task lifecycle patterns; system/file changes must continue to use Kurisu permission gates |
| `two.7z` | Hyperon | Research candidate for symbolic/relational reasoning; not a second cognition owner |
| `two.7z` | Langroid | Candidate message/agent abstractions; no new agent runtime added |
| `three.7z` | Letta | Existing governance/source integration; duplicate archive is deduplicated conceptually, original kept intact |
| `three.7z` | llama.cpp | Existing local inference adapter is present; actual target-model inference remains unverified |
| `three.7z` | Mem0 | Candidate extraction/entity-link/temporal-memory techniques; MemoryOS2/MemoryFabric remain the canonical write/retrieval owner |
| `three.7z` | OpenAI Agents SDK | Candidate guardrail/trace ideas; tool/action ownership remains ActionGateway |
| `three.7z` | OpenClaw | Candidate gateway/skill ideas; no broad system integration without scoped permissions |
| `four.7z` | Hexis | Existing adaptation bridge; no duplicate runtime added |
| `four.7z` | PocketFlow | Candidate compact workflow patterns; no code copied this pass |
| `four.7z` | Letta (repeat) | Duplicate source snapshot, kept inside original source archive; not treated as an additional independent project |
| `four.7z` | Lumina | Existing adaptation bridge; memory/action ownership remains canonical |
| `four.7z` | OWL | Candidate for tool-use strategy review; explicit permission contracts remain required |
| `four.7z` | Superpowers | Candidate workflow/verification guidance for coding; no runtime dependency added |
| `four.7z` | WILL | Actual graded-trait/two-channel concept integration described above; other faculties are candidates for later gap-driven adaptation |

This inventory is a per-project disposition, not a claim that every line of all nested repositories has undergone manual semantic review. Existing source indices and full source archives preserve the navigation surface for deeper targeted integration.

## Current external primary references

- Live2D official Cubism Web SDK manual: https://docs.live2d.com/en/cubism-sdk-manual/cubism-sdk-for-web/ — SDK/Core boundaries and supported Web implementation surface.
- Live2D official lip-sync manual (updated 2026-01-29): https://docs.live2d.com/en/cubism-sdk-manual/lipsync/ — mouth parameters are driven by audio input, motion or other supplied signals; direct volume-driven mouth opening is possible when an audio-level source exists. Kurisu's current static speaking signal is not yet equivalent to audio-envelope or phoneme synchronization.
- Mem0 source documentation, graph memory: https://github.com/mem0ai/mem0/blob/main/docs/platform/features/graph-memory.mdx — entity-to-memory links and retrieval ranking are useful comparative patterns, but current Kurisu should reuse its canonical MemoryOS2/MemoryFabric instead of adding a second graph-memory owner.
- OpenAI Agents SDK guardrail documentation: https://github.com/openai/openai-agents-python/blob/main/docs/guardrails.md — a useful comparison for guarding tool input/output; in Kurisu all external side effects still need to route through its existing authorization and ActionGateway contracts.

## Open items from this pass

- Run dependency-installed Vite production build and actual browser E2E for idle-time autonomous dialogue, Live2D motions and chat acknowledgement/restart.
- Tie avatar mouth opening to an actual audio envelope/viseme stream if a supported audio output exposes one; do not infer phonemes from plain text or fake live TTS telemetry.
- Measure trait-adapter effects in controlled prompt comparisons and longitudinal dialog logs; passing the pure adapter contract test is not evidence that the model becomes more humanlike.
- Continue source integrations only after naming the gap, canonical owner, permissions/license implications and a repeatable behavior gain.
