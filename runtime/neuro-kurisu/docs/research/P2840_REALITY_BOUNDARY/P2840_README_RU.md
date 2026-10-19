# P2840 — Reality Boundary

P2840 is the next architectural step after P2836.

The central invariant is that predictive state and observed reality are different evidence classes.

### Runtime

`perception -> plan -> shadow simulation -> external action -> grounding -> learning`

The shadow transition is pure. It is committed only when the external outcome is unavailable.

### Learning

`verified external evidence > weak external receipt > simulation`

The ordering applies separately to neural update, world-model update, memory promotion and identity promotion.

### Future work

The next major step is to connect independently observed phone/camera outcomes back into the grounded world model so that an external primary cycle not only avoids shadow contamination but also produces a persistent external world-state update.
