# OmeStro #31 — Cognitive-to-Neural Bridge

Date: 2026-11-17
Target: `workpass70-source`
Implementation branch: `aspect/cognitive-to-neural-bridge-20261117`
Status: hardened bounded runtime slice; Draft PR #922. Code/test snapshot `873b19af12e39ad2bcc0b27ed722916477d203e0` passed Node 24 runtime typecheck and all five bridge-specific checks; the broader unified workflow was cancelled during later general regression steps.

## Intent

Project the existing NeuroCore organism state into a small, versioned, bounded control profile that reaches the existing `LanguageInvoker` boundary. The profile makes action, motivation, uncertainty, urgency, attention, remaining cognitive budget and cognitive mode available to the model adapter in machine-readable form rather than only as prompt prose.

## Goals

- Produce a deterministic 43-value feature vector: seven action indicators, five organism-state scalars, 23 read-only B365 neural/allostatic/self-model/goal-authorship signals, one neural-snapshot freshness channel, and seven cognitive-mode indicators.
- Normalize malformed/non-finite organism inputs, reject future or more-than-eight-tick-old neural snapshots, and clamp every numeric channel to [0, 1].
- Accept a B365 snapshot only when it uses the canonical schema constant from `B365DiagnosticsSchema.ts` (currently v14), has a valid tick, and all 23 neural/allostatic/self-model/goal-authorship channels are finite normalized values. The B365 core and bridge share this one constant; older/newer unknown versions and partial snapshots are rejected as a whole.
- Revalidate the full provider hand-off: action and mode one-hots, mode-to-adapter hint, B365 version/provenance, tick-age arithmetic, freshness scalar, neutral unavailable-state encoding and all control bounds must agree.
- Apply bounded sampling controls (`temperature`, `maxTokens`) and attach the structured profile to `LanguageRequest`.
- Route both cognitive-proposal generation and user/autonomous language generation through the same bridge.
- Expose explicit adapter/steering intentions and record telemetry distinguishing request controls configured, llama.cpp template kwargs sent, and neural/activation controls not executed.
- Bind every local-provider receipt to a runtime-session request ID and SHA-256 fingerprint of the exact validated profile. Reject stale/mismatched receipts and suppress duplicate accounting using a bounded 512-entry replay ledger. The fingerprint correlates payloads; it is not a provider-authentication mechanism.
- When the provider reports bounded token usage, measure prompt/completion/total tokens against the configured cognitive max-token budget. Track observations, missing/invalid usage, mean/max budget utilization and budget overruns; never infer model-quality uplift from token counts.
- Provide an immediate runtime kill switch; disabled mode leaves requests unchanged.
- Expose authenticated read-only diagnostics at `GET /api/organism/cognition/neural-bridge/diagnostics`, including projection/bypass counts, B365 snapshot provenance, provider hand-offs and explicit non-execution of activation/residual steering.

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
- `controlsConfigured` records that sampling parameters are configured on the request while adapter switching, activation steering and residual-block execution remain false. A provider receipt carries the per-request correlation ID, SHA-256 profile fingerprint and schema; the runtime validates all three and deduplicates replayed receipts. It records only successful kwargs hand-off, not template consumption.
- Bridge defaults enabled; `RuntimeConfig.cognitiveToNeuralBridge.enabled=false` is the emergency bypass.

## Integration points

- Shared `B365DiagnosticsSchema.ts` contract, consumed by both B365 state/diagnostics and the bridge so schema version cannot drift independently.
- Existing `OrganismState` and `OrganismGoal` from `core/types.ts`.
- Existing `CognitiveBudgetManager` snapshot and the already-computed `b365UnifiedNeuroCausalDiagnostics()` read-only signal snapshot exposed by `OrganismCore`; Runtime reuses its per-cycle B365 snapshot rather than running B365 a second time.
- Existing `LanguageRequest` / `LanguageInvoker` boundary; the local llama.cpp adapter's `chat_template_kwargs` opt-in adds an explicit template-variable route while non-local providers continue to receive supported sampling parameters and ignore unsupported neural controls.
- Existing `OrganismRuntime` proposal and response generation paths.
- The existing server authorization middleware and an authenticated read-only diagnostics endpoint; no prompt, user-memory or raw neural snapshot payload is exposed.

## Success evidence

Focused unit tests cover normalization, vector order, determinism, caps, kill switch/request preservation and malformed inputs. Runtime integration tests ensure both LanguageInvoker call paths attach the profile. Node 24 runtime typecheck and focused regressions must pass on the exact PR head. This bridge does not execute B365 updates or provider-specific activation changes. This is not evidence of improved model quality; real activation steering still requires a compatible provider adapter, capability negotiation, calibration, ablation and independent outcome measurements.
