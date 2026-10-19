# Motive Ecology — 34.53.0

Derived-only integration layer. No ownership of goals, identity, values, memory or actions.

Inputs:
- intrinsic drive signals;
- adaptive values;
- social trust/prediction error;
- developmental identity phase;
- self-consistency;
- cognitive conflict;
- uncertainty/prediction error;
- energy and goal pressure.

Outputs:
- epistemic, exploratory, competence, coherence, social, care, autonomy, homeostatic and responsibility pressures;
- dominant motive;
- motive conflict;
- value alignment;
- bounded action biases;
- reasons.

Safety:
- never executes actions;
- never mutates canonical state;
- carries `nonConsciousnessClaim=true`;
- uses existing planner/action gateway for final choice.
