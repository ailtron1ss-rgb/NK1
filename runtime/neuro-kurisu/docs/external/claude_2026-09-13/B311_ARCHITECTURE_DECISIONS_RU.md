# B311 Architecture Decisions

## AD-1 Canonical policy ecology
AdaptivePolicy, p29/p30 learning arbitration and B264 causal policy share B297 `policy` as their canonical executive source.

## AD-2 No duplicate score injection
B264 causal ranking and p29/p30 learned policy no longer mutate candidate score independently before B297. Their policy contribution is routed through one source.

## AD-3 Bounded evidence gravity
Higher verified source credit can increase policy executive gain only above a trust threshold and under a fixed bound.

## AD-4 Neighbor-context transfer
Verified policy experience transfers only to context buckets within Hamming distance <=2 with weights 0.34/0.12. No separate state store.

## AD-5 No consciousness claim
All B311 evidence is computational/behavioral and does not establish subjective experience.
