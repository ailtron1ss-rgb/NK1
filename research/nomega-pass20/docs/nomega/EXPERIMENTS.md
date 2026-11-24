# NΩ experiments

| ID | Hypothesis | Metric | Failure condition |
|---|---|---|---|
| E01 | learned routing improves quality/compute | verified solve rate per compute unit | no gain over fixed routing |
| E02 | memory-to-program improves repeat-task latency | latency + cache hit rate | cache adds cost without gain |
| E03 | verifier-guided generation reduces false answers | false-positive rate | no reduction |
| E04 | recurrent latent workspace improves multi-step tasks | accuracy at fixed FLOPs | no improvement |
| E05 | distilled sparse experts beat dense baseline on mobile | quality / watt | worse at equal energy |

Experimental ideas are hypotheses until measured.
