# NΩ 1.18.0 neural substrate research

This directory records research inputs and measured experiments for the 1.18.0-dev
neural-substrate branch. The biological terminology describes computational
abstractions, not claims of biological equivalence.

## Architecture added

- `neural_substrate_v1.py`: compartmental E/I microcircuit, dendritic branches,
  apical teaching, fast/slow synapses, eligibility traces, homeostasis,
  local three-factor plasticity, structural plasticity and a glia-like resource state.
- `neural_dendritic_adapter_v1.py`: local fast-synapse/context adapter with an
  LMS-like online rule; no backpropagation through the adaptation trajectory.
- `neural_predictive_coding_v1.py`: bounded local latent relaxation driven by
  reconstruction mismatch.
- `neural_astrocyte_memory_v1.py`: sparse context-memory/controller layer with
  calcium-like dynamics and neural gain control.
- `neural_program_synth_v11.py`: E/I substrate backend.
- `neural_program_synth_v12.py`: predictive + E/I backend.
- `neural_program_synth_v13.py`: predictive + E/I + astrocyte-memory backend.
- `neural_route_policy_v1.py`: budget-aware selection between fast and deep neural paths.

## Promotion rule

None of V11/V12/V13 is promoted to the governed production release. They remain
research-only until verified execution improves under matched compute and passes
independent holdout/adversarial/HVM evidence.

## Why

The deepest stack currently improves semantic-family routing, but the measured
verified-program rate remains 0.0 on the matched benchmark. The project therefore
needs better coupling between neural representations and executable program synthesis,
not only more biological mechanisms.
