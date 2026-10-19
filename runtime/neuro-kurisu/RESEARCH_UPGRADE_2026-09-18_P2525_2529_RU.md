# Research Upgrade 2026-09-18 — What should improve Neuro Kurisu next

## Confirmed useful directions

### 1. Eligibility traces / online SNN learning

2026 Nature Communications work supports the use of locally maintained eligibility traces with delayed reward modulation. This is already integrated into P2526.

### 2. Learnable synaptic and axonal delays

2026 work on three-factor delay learning provides a direct research basis for making temporal delays trainable instead of fixed hyperparameters. Integrated experimentally in P2526-T.

### 3. Metaplasticity from uncertainty

The MESU line of work suggests that synaptic uncertainty can regulate how aggressively a continual learner changes its parameters. Integrated as a lightweight non-Bayesian approximation.

### 4. CfC / liquid dynamics

A closed-form continuous-time micro-core is a promising candidate for the next slow-dynamics branch because it may capture continuous temporal dynamics with less solver overhead than ODE-style implementations.

### 5. Selective SSM

A small selective SSM is a promising candidate for long-range memory, but it must compete against the current slow-memory branch on the same benchmark rather than being added blindly.

### 6. Replay and consolidation

Replay should become event-driven and uncertainty/surprise weighted, with a separate offline consolidation mode. This is more useful than simply increasing the replay buffer size.

## Potential benefit of combining methods

The gains from literature cannot be multiplied or summed honestly because the experiments, tasks and architectures differ. A realistic expectation is that the strongest benefit comes from removing bottlenecks one by one:

**sensor representation → temporal credit → delay representation → uncertainty-controlled plasticity → long-memory state → replay/consolidation → world-model grounding.**

This sequence attacks different failure modes, so it is more promising than stacking several predictors that all solve the same subproblem.

## Experiments that should decide future architecture

A. current sparse SNN vs SNN + delays;

B. current slow memory vs CfC micro-core;

C. current slow memory vs selective SSM;

D. FIFO replay vs priority replay;

E. fixed plasticity vs uncertainty-guided plasticity;

F. immediate reward vs delayed reward at 1/3/5/10 ticks;

G. restart after 100/1,000/10,000 steps;

H. in-distribution vs family-shifted transitions;

I. actual Android thermal/RAM benchmark.

The architecture should advance only where an ablation produces measurable improvement.
