# B288 — Canonical Social Predictive Brain Architecture

## 1. Purpose

B288 is the canonical social/relationship neural coordinator for Neuro-Kurisu.
It does not claim biological equivalence. Its purpose is to consolidate historically overlapping social subsystems into one person-specific recurrent predictive state and to create a direct bridge to self, goals, personality and action.

## 2. Core state

Each person has:

- recurrent latent state (32D);
- previous latent state;
- excitatory/inhibitory activity pools;
- recurrent synapses;
- contextual synapses;
- action weights;
- value directions;
- eligibility traces;
- short-term synaptic state;
- trust/warmth/predictability/boundary/commitment;
- interaction and repair history;
- uncertainty and prediction error.

## 3. Input context

The canonical social brain receives:

`self latent + world latent + goal vector + future-self + personality vector + relationship latent`

The resulting mixed context drives recurrent neural dynamics.

## 4. Learning loop

`context → recurrent social state → prediction → action/goal bias → real outcome → prediction error → local plasticity + eligibility → replay → personality evidence`

## 5. Consolidation architecture

B288 receives snapshots from nine historical sources. It performs low-weight consensus projection into the canonical person state and measures:

- adapter coverage;
- legacy conflict;
- canonical ownership.

The older modules remain adapters until retirement criteria are met.

## 6. Behavioural bridge

B288 contributes auxiliary action and goal biases. It does not replace B264/B265 policy/evaluator layers yet because direct Core social-action effect remains modest.

## 7. Evidence

Standalone multi-person test:
- 320 steps;
- 320 learning updates;
- differentiation 0.31389196;
- neural activity 0.08201585;
- action influence 0.05451743.

Core test:
- 16 steps;
- 16 updates;
- action bias 0.00267667;
- lesion 0.00026205;
- restart PASS.

Consolidation test:
- coverage 1.0;
- 9 deduplicated sources;
- legacy conflict 0.15725;
- restore PASS.

## 8. Retirement policy

A legacy module is not deleted until behavioural equivalence, hidden-task non-regression, persistence equivalence, and caller analysis are all completed.
