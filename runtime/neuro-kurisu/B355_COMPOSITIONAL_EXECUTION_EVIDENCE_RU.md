# B355 Compositional Execution Evidence

Test: `tests/big-pass-355-compositional-program-execution.mjs`

Matched state was prepared with a verified B276 program and its execution cursor reset to zero.

PASS:
- program plan depth within 3–8
- execution ON selected the exact first primitive of the persisted plan
- execution ON advanced cursor `0 -> 1`
- execution OFF kept cursor at `0`
- constitutional/external gating remains in the OrganismCore path

Observed plan: `rest -> respond -> explore`.
