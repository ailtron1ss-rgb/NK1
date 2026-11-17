# OmeStro #31 — Cognitive-to-Neural Bridge

Date: 2026-11-17
Target: `workpass70-source`
Implementation branch: `aspect/cognitive-to-neural-bridge-20261117`
Status: first bounded runtime slice

## Intent

Project the existing NeuroCore organism state into a small, versioned, bounded control profile that reaches the existing `LanguageInvoker` boundary. The profile makes action, motivation, uncertainty, urgency, attention, remaining cognitive budget and cognitive mode available to the model adapter in machine-readable form rather than only as prompt prose.

## Goals

- Produce a deterministic 19-value feature vector: seven action indicators, five scalar organism features, and seven cognitive-mode indicators.
- Normalize malformed/non-finite values and clamp every numeric channel to [0, 1].
- Apply bounded sampling controls (`temperature`, `maxTokens`) and attach the structured profile to `LanguageRequest`.
- Route both cognitive-proposal generation and user/autonomous language generation through the same bridge.
- Expose explicit adapter/steering intentions and record telemetry distinguishing hints from controls actually applied.
- Provide an immediate runtime kill switch; disabled mode leaves requests unchanged.

## Non-goals / anti-goals

- No model-weight edits, activation hooks, hidden-state patches, residual adapters, or claims of neuron-level steering.
- No forced provider/adapter switch: `adapterHint` is advisory until a provider explicitly supports it.
- No new LLM, runtime dependency, external process, or persistence schema migration.
- No learning from unverified feedback and no autonomous increase in resource budget.

## Approaches considered

1. Prompt-only prose: minimal risk, but leaves provider controls and machine-readable state disconnected.
2. Bounded control profile at the existing LanguageInvoker seam: chosen. It reuses the current runtime boundary, applies only bounded sampling parameters, and passes advisory metadata for future adapter-specific implementations.
3. Direct B365 activation/residual steering: deferred. The current provider contract has no verified activation/hidden-state API, so claiming this would be misleading and could make erroneous affect/motivation estimates disproportionately influential.

## Contract

- Actions: `respond | explore | verify | rest | reflect | wait | defer`.
- Modes: `reflex | shallow | retrieve | deep | simulate | defer | sleep`.
- Feature vector order: action one-hot (7), then motivation, uncertainty, urgency, remaining budget, attention (5), then mode one-hot (7).
- The output includes a mode-derived adapter hint, bounded sampling parameters, and steering intent channels capped at 0.15.
- `controlsApplied` records that sampling parameters are applied while adapter switching, activation steering and residual-block execution remain false.
- Bridge defaults enabled; `RuntimeConfig.cognitiveToNeuralBridge.enabled=false` is the emergency bypass.

## Integration points

- Existing `OrganismState` and `OrganismGoal` from `core/types.ts`.
- Existing `CognitiveBudgetManager` snapshot exposed by `OrganismCore`.
- Existing `LanguageRequest` / `LanguageInvoker` boundary.
- Existing `OrganismRuntime` proposal and response generation paths.

## Success evidence

Focused unit tests cover normalization, vector order, determinism, caps, kill switch/request preservation and malformed inputs. Runtime integration tests ensure both LanguageInvoker call paths attach the profile. Node 24 runtime typecheck and focused regressions must pass on the exact PR head. This first slice is not evidence of improved model quality; future activation steering requires a compatible provider contract, calibration, ablation and independent outcome measurements.
