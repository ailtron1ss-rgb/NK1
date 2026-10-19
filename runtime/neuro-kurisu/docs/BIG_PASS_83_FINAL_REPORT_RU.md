# NEURO-KURISU — BIG PASS 83 FINAL REPORT

Release: **34.56.0** · schema **109**

## Main change
Closed a previously concrete causal gap: verified runtime consequences now enter the canonical developmental trajectory and can influence later action selection through a bounded, evidence-gated carry-over. No duplicate organism/policy truth owner was introduced.

## Real changes
1. Extended `IdentityTrajectoryEngine` to trajectory version 2 with bounded action/outcome carry-over.
2. Integrated the trajectory signal into existing `OrganismCore` action scoring and feedback.
3. Added schema-109 migration handling.
4. Added paired divergence and persistence/reload tests using real `OrganismCore`.
5. Added adversarial counterevidence reversal test.
6. Updated current pointers/manifests/release docs while keeping 34.55.0 historical documents intact.

## Causal evidence
Two identical real runtimes received opposite outcome histories for the same selected action. Under matched future contexts, the decisions diverged in **4/8** contexts. Stored action carry-over separated to approximately **+0.085 / -0.055** in the paired run. The learned state survived persistence/reload.

## Important tuning
Path-dependence accumulation was deliberately reduced: after the same 8-event histories it is approximately **0.50**, versus approximately **0.79** in the first implementation. Behavioral divergence remained 4/8. This reduces the risk that a few experiences permanently dominate behavior.

## Legacy
INTEGRATE: current canonical Live2D assets/mobile texture.
ADAPT: compatible voice/diagnostic interaction mechanisms.
REFERENCE: historical UI/research/cognition implementations.
EXCLUDE-RUNTIME: old organism/memory/world/cognition runtimes.

## Scientific honesty
The result demonstrates a functional causal path-dependent behavior mechanism under controlled intervention. It does **not** demonstrate consciousness, phenomenology, self-awareness, or human-equivalent cognition.

## Remaining qualification gaps
10k+ mobile horizon remains UNRESOLVED; no physical Android soak qualification is claimed. Deep learned semantic representation, intrinsic motivation, social development and causal consciousness-candidate experiments remain incomplete.
