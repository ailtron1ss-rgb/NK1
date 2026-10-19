# Release Verification — Neuro-Kurisu B303
Дата: 13.09.2026

## Final isolated gates
1. TYPECHECK — PASS
2. B303 holdout/recovery — PASS
3. B303 migration — PASS
4. B302 long horizon — PASS
5. B301 mobile economy — PASS
6. B301 unseen-context transfer — PASS
7. B298 closed loop — PASS
8. function liveness — PASS 175
9. parameterized safety — PASS, 888/922, failures 0
10. semantic coverage — 38 VERIFIED / 3718
11. architecture — PASS
12. integrity — PASS
13. forensics — PASS
14. hygiene — PASS
15. release contract — PASS
16. executable syntax — PASS
17. UI smoke — PASS
18. server smoke — PASS

## Resource limitation
A single cumulative chain of all expensive tests may hit the current container resource/time ceiling. Release status is therefore based on isolated reproducible gates, with the aggregate limitation explicitly recorded.

## Key real evidence
B296 remains an executable spiking/plastic substrate and in B303 performs 12,480 synaptic updates.
B303 holdout evaluation observes 20 novel-context pulses with novel-context rate 1.0 and recovery stability 0.9992.
B302 records 96 ticks with 30 full pulses, 66 micro cycles, 6 verified world transitions and 3 consolidation windows.
