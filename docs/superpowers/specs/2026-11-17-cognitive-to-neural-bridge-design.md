# OmeStro #31 — Cognitive-to-Neural Bridge

Date: 2026-11-17
Target: `workpass70-source`
Implementation branch: `aspect/cognitive-to-neural-bridge-20261117`
Status: first bounded runtime slice

## Intent

Project the existing NeuroCore organism state into a small, versioned, bounded control profile that reaches the existing `LanguageInvoker` boundary. The profile makes action, motivation, uncertainty, urgency, attention, remaining cognitive budget and cognitive mode available to the model adapter in machine-readable form rather than only as prompt prose.

## Goals

- Produce a deterministic 43-value feature vector: seven action indicators, five organism-state scalars, 23 read-only B365 neural/allostatic/self-model/goal-authorship signals, one neural-snapshot freshness channel, and seven cognitive-mode indicators.
- Normalize malformed/non-finite organism inputs, reject future or more-than-eight-tick-old neural snapshots, and clamp every numeric channel to [0, 1].
- Accept a B365 snapshot only when it carries a positive integer state version and tick and all 23 neural/allostatic/self-model/goal-authorship channels are finite normalized values. A partial snapshot is rejected as a whole; it is never blended with neutral-looking defaults.
- Revalidate the full provider hand-off: action and mode one-hots, mode-to-adapter hint, B365 version/provenance, tick-age arithmetic, freshness scalar, neutral unavailable-state encoding and all control bounds must agree.
- Apply bounded sampling controls (`temperature`, `maxTokens`) and attach the structured profile to `LanguageRequest`.
- Route both cognitive-proposal generation and user/autonomous language generation through the same bridge.
- Expose explicit adapter/steering intentions and record telemetry distinguishing request controls configured, llama.cpp template kwargs sent, and neural/activation controls not executed.
- Provide an immediate runtime kill switch; disabled mode leaves requests unchanged.

## Non-goals / anti-goals

- No model-weight edits, activation hooks, hidden-state patches, residual adapters, or claims of neuron-level steering.
- No forced provider/adapter switch: `adapterHint` is advisory. The local llama.cpp adapter may forward named channels through `chat_template_kwargs` only when `LLAMA_CPP_NK1_TEMPLATE_CONTROLS=1`; the selected Jinja template must explicitly consume them.
- No new LLM, runtime dependency, external process, or persistence schema migration.
- No learning from unverified feedback and no autonomous increase in resource budget.

## Approaches considered

1. Prompt-only prose: minimal risk, but leaves provider controls and machine-readable state disconnected.
2. Bounded control profile at the existing LanguageInvoker seam: chosen. It reuses the current runtime boundary, applies only bounded sampling parameters, and passes advisory metadata for future adapter-specific implementations.
3. Direct B365 activation/residual steering: deferred. The current provider contract has no verified activation/hidden-state API, so claiming this would be misleading and could make erroneous affect/motivation estimates disproportionately influential.

## Contract

- Actions: `respond | explore | verify | rest | reflect | wait | defer`.
- Modes: `reflex | shallow | retrieve | deep | simulate | defer | sleep`.
- Feature vector order: action one-hot (7), organism motivation/uncertainty/urgency/budget/attention (5), B365 prediction/plasticity/neuromodulation/sparsity/coherence/confidence/agreement/counterfactual/goal/entropy (10), B365 allostatic drive/arousal/exploration/preservation/reflection/social approach (6), B365 self agency/continuity/growth/identity conflict (4), B365 goal ownership/commitment/revision pressure (3), neural freshness (1), then cognitive mode one-hot (7). Total: 43.
- The output includes a stable feature-key schema, B365 state-version provenance/age, a mode-derived adapter hint, budget- and preservation-scaled sampling parameters, and steering intent channels capped at 0.15.
- When no valid B365 snapshot exists, B365 feature channels 12–34 use an explicit neutral sentinel (0.5), freshness is 0, and snapshot version/tick/age are null. The separate availability flag and source label must be honored by templates.
- `controlsConfigured` records that sampling parameters are configured on the request while adapter switching, activation steering and residual-block execution remain false. A separate provider receipt records only that llama.cpp template kwargs were sent, not that the template consumed them.
- Bridge defaults enabled; `RuntimeConfig.cognitiveToNeuralBridge.enabled=false` is the emergency bypass.

## Integration points

- Existing `OrganismState` and `OrganismGoal` from `core/types.ts`.
- Existing `CognitiveBudgetManager` snapshot and the already-computed `b365UnifiedNeuroCausalDiagnostics()` read-only signal snapshot exposed by `OrganismCore`; Runtime reuses its per-cycle B365 snapshot rather than running B365 a second time.
- Existing `LanguageRequest` / `LanguageInvoker` boundary; the local llama.cpp adapter's `chat_template_kwargs` opt-in adds an explicit template-variable route while non-local providers continue to receive supported sampling parameters and ignore unsupported neural controls.
- Existing `OrganismRuntime` proposal and response generation paths.

## Success evidence

Focused unit tests cover normalization, vector order, determinism, caps, kill switch/request preservation and malformed inputs. Runtime integration tests ensure both LanguageInvoker call paths attach the profile. Node 24 runtime typecheck and focused regressions must pass on the exact PR head. This bridge does not execute B365 updates or provider-specific activation changes. This is not evidence of improved model quality; real activation steering still requires a compatible provider adapter, capability negotiation, calibration, ablation and independent outcome measurements.
