# R22 Change Matrix

| Area | R21 baseline | R22 implementation | Evidence |
|---|---|---|---|
| Memory budget | scalar storage cost | net-value-per-byte + byte budget + dormant application | P2897 + Core runtime |
| Memory learning | adaptive weights | anti-collapse + budget-aware utility | P2888/P2894 |
| Capsules | summary only | provenance + correction links + evidence hashes | P2898 |
| World reward model | shared reward head | action-conditioned reward head | P2896 |
| World actionability | fixed reward surface | state-conditioned held-out surface | P2896 |
| Semantic evidence | 3 integrated ops | 5 central runtime operation classes / 45 verified records | P2902 |
| Mobile semantics | host-pressure leak closed | repeated P2868 PASS | P2868/P2875 |
| Anti-decoration | simulation barriers | synthetic leak audit + no-op removal + claim registry | P2901/R22 audit |
| Release | timeout-sensitive mega-run | functional-core runner + independent heavy audits | R22 release core |
| Long horizon | isolated test | 256-cycle + restart 257 PASS | P2895 |
