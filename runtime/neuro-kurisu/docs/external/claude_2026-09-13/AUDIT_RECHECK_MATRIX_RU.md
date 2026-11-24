# Recheck matrix — Claude vs current B297

| Claim / idea | Claude B266 docs | Current B297 | Verdict |
|---|---|---|---|
| autoRun broken | YES | P15.5 PASS | RESOLVED |
| architecture clean | YES | PASS | CONFIRMED |
| no cycles / ownership | YES | PASS | CONFIRMED |
| verification debt | YES | even larger semantic surface | CONFIRMED + WORSE BY SCALE |
| action/consequence diversity bottleneck | YES | still plausible and not fully closed | CONFIRMED HYPOTHESIS |
| self-model/agency incomplete | YES | still not fully proven | CONFIRMED |
| motivation not deeply learned | YES | still incomplete | CONFIRMED |
| sleep/replay needs causal evidence | YES | still incomplete | CONFIRMED |
| B297 = sleep | later plan says yes | actual B297 = executive fusion | STALE PLAN |
| physical Android proof missing | YES | still missing | CONFIRMED |
| consciousness evidence low | YES | still low | CONFIRMED |


## B302 recheck

| Claim / idea | B301 status | B302 recheck | Verdict |
|---|---|---|---|
| Need long-horizon evidence | open | 96 ticks + autonomous phase + consolidation + restart | PARTIALLY CLOSED |
| Need real causal verification | present in B298 | B302 adds 6 world-transition outcomes | STRENGTHENED |
| Neural plasticity must affect live system | confirmed | 4680 B296 synaptic updates in long-horizon run | CONFIRMED |
| Contextual personality should transfer | narrow B301 proof | mixed unseen context still interpolates and lesion suppresses | CONFIRMED NARROWLY |
| Mobile state cost is a risk | confirmed | B301 latest reduction ~8.32%, peak RSS remains warning | CONFIRMED |
| Verification debt | large | 38 VERIFIED / 3709 function-like | CONFIRMED |
| Consciousness | unproven | still unproven | CONFIRMED LOW EVIDENCE |

## B303 recheck addendum — 13.09.2026
The previous diagnosis remains valid: the architecture is increasingly integrated, but verification debt, physical Android evidence, long-horizon endurance and consciousness evidence remain limiting factors. B303 adds experimental holdout/recovery evidence without resolving those broader limits.

## B304 recheck addendum — 13.09.2026
Предыдущий диагноз подтверждён. B304 не устраняет verification debt, Android hardware evidence или consciousness gap. Он усиливает P5 evidence: holdout теперь разделяется по скрытым semantic task families, а не только по numeric fingerprints. Одновременно TemporalResolutionGovernor теперь учитывает direct RAM/thermal/battery/CPU signals и проверен отдельным ресурсным тестом.

| Claim / idea | B303 status | B304 recheck | Verdict |
|---|---|---|---|
| Need semantic holdout beyond numeric fingerprints | partially addressed | 3 unseen semantic task families | STRENGTHENED |
| Need real neural plasticity in long horizon | confirmed by B303 | 8112 B296 synaptic updates in B304 | STRENGTHENED |
| Need resource-aware cognition | limited | RAM/thermal/battery/CPU now influence temporal cadence; external signal overrides | STRENGTHENED |
| Need restart durability | present | B304 migration/snapshot restores semantic evidence | CONFIRMED |
| Need longer Android evidence | unresolved | container only; RSS ~470 MB in B304 | UNRESOLVED |
| Need consciousness evidence | unresolved | no new consciousness claim | UNRESOLVED |
| Verification debt | unresolved | 38/3727 VERIFIED | UNRESOLVED |


## B305 recheck addendum — 13.09.2026
B305 усиливает именно evidence, а не ширину архитектуры.

| Claim / idea | B304 status | B305 recheck | Verdict |
|---|---|---|---|
| Need critical neural→causal→personality→policy proof | partial | direct edge ledger + live test | STRENGTHENED |
| Need independent semantic holdout | one B304 split | two independent family splits | STRENGTHENED |
| Need mobile/Termux proof | unresolved | portable benchmark prepared + host-proxy run; Android still absent | PARTIALLY CLOSED |
| Need targeted verification rather than raw function count | large debt | critical path receives direct probes | STRENGTHENED |
| Need consciousness evidence | unresolved | no new consciousness claim | UNRESOLVED |

## B306 recheck addendum — 13.09.2026
B306 проверяет не наличие автономных решений, а причинный вклад существующего autonomous-personhood kernel в ранжирование действия.

| Claim / idea | B305 status | B306 recheck | Verdict |
|---|---|---|---|
| `autonomousDecisions > 0` достаточно для автономности | insufficient | counterfactual causal ranking added | REJECTED AS INSUFFICIENT |
| Need causal attribution of autonomous choice | partial | 12/16 decisions causally influenced; rate 0.75 | STRENGTHENED |
| Need intervention/lesion evidence | partial | kernel lesion 0.90 reduces aggregate internal action bias ~90%; live core lesion persistence 0.95 | STRENGTHENED |
| Need autonomous-outcome closure | partial | 11/12 causally-influenced decisions reached success threshold | STRENGTHENED, NARROW |
| Need persistence of late autonomy evidence | previously fragile | B306 migration fixed after first restore failure; final restart preserves counts | CONFIRMED AFTER FIX |
| Need real Android/Termux evidence | unresolved | benchmark remains portable, but real phone run absent | UNRESOLVED |
| Need P6/P7 | unresolved | causal autonomy evidence stronger but long-horizon independent replication still absent | UNRESOLVED |
| Verification debt | unresolved | 38 VERIFIED / 3749 function-like; 894/928 parameterized probes pass | UNRESOLVED |
| Consciousness evidence | unresolved | no consciousness claim added | UNRESOLVED |

## B307 recheck addendum — 13.09.2026
B307 закрывает слабое звено `policy -> verified outcome -> persistence` не через новый learner, а через расширение canonical `AdaptivePolicyEngine`. Проверенная ветка `verifiedValue/verifiedUpdates` обновляется только при world transition или external evidence и реально входит в последующий action bias.

| Claim / idea | B306 status | B307 recheck | Verdict |
|---|---|---|---|
| Policy learns from outcomes | confirmed | verified branch has separate action/context trusted value | STRENGTHENED |
| Need policy -> outcome -> persistence closure | partial | verified policy bias changes and survives restart | STRENGTHENED |
| Avoid duplicate policy learners | important | B307 extends AdaptivePolicyEngine; no new policy store | CONFIRMED |
| Backward compatibility of old state | risk | rows without trusted fields normalize from legacy value | CONFIRMED |
| Real neural learning remains active | confirmed | B298/B305/B306 regressions remain PASS | CONFIRMED |
| Real Android/Termux evidence | unresolved | still not run on physical Android | UNRESOLVED |
| P6/P7 | unresolved | trusted closure is still short-horizon | UNRESOLVED |
| Verification debt | unresolved | 38 VERIFIED / 3751 function-like | UNRESOLVED |
| Consciousness evidence | unresolved | no consciousness claim added | UNRESOLVED |
## B308 recheck addendum — 13.09.2026
B308 усиливает canonical `AdaptivePolicyEngine` коротким temporal eligibility trace. Это не второй policy learner и не новый replay system: verified outcome теперь может частично кредитовать непосредственно предшествующее действие, если у него сохранился eligibility trace.

| Claim / idea | B307 status | B308 recheck | Verdict |
|---|---|---|---|
| Verified policy learning should credit short action sequences | partial | prior eligible action receives verified temporal credit | STRENGTHENED |
| Negative verified outcomes must be able to suppress a prior action | confirmed for current action | signed temporal credit also suppresses eligible prior action | STRENGTHENED |
| Avoid duplicate learners | important | AdaptivePolicyEngine remains canonical; no second learner/replay store | CONFIRMED |
| Policy influence should survive restart | confirmed | temporal counters/eligibility fields survive restore; legacy migration normalizes them | CONFIRMED |
| Whole-organism action distribution should already move strongly | not established | smoke run remained respond 12/12 → 12/12; other policy sources still dominate | OPEN / HONEST LIMIT |
| Effective policy ranking can change from verified experience | partial | core effective ranking moved to explore +0.05882 vs neutral baseline | STRENGTHENED |
| Real neural learning remains active | confirmed | B298/B305/B306 regressions remain PASS | CONFIRMED |
| Android/Termux hardware evidence | unresolved | still host-side; physical device benchmark not run | UNRESOLVED |
| P6/P7 | unresolved | temporal credit is a short-horizon improvement, not long-horizon independence | UNRESOLVED |
| Verification debt | unresolved | 38 VERIFIED / 3754 functions; evidence coverage 0.0669; parameterized 894/928 pass | UNRESOLVED, MEASURED BETTER |
| Consciousness evidence | unresolved | no consciousness claim added | UNRESOLVED |


## B309 recheck addendum — 13.09.2026
B309 адресует конкретный дефект, выявленный B308: effective policy ranking менялся, но его сигнал мог теряться среди большого числа action-bias ветвей.

| Claim / idea | B308 status | B309 recheck | Verdict |
|---|---|---|---|
| AdaptivePolicy должен реально участвовать в final arbitration | ranking менялся, final distribution не доказан | policy стал отдельным B297 source; unit lesion меняет executive selection | STRENGTHENED |
| Повторяющиеся action-bias источники могут переоцениваться как независимые | гипотеза | B297 теперь измеряет pair redundancy и снижает effective weights | CONFIRMED + PARTIALLY ADDRESSED |
| Не следует создавать второй learner | соблюдалось | AdaptivePolicy остался единственным learner; новый код только меняет arbitration boundary | CONFIRMED |
| Policy evidence должен переживать legacy restore | B308 migration уже нормализовала policy fields | B309 migration нормализует B297 consolidation fields и policy source | CONFIRMED |
| Whole-organism action distribution должна измениться после learning | открыто | всё ещё не доказано; B309 усиливает канал, но не искусственно поднимает коэффициент | UNRESOLVED |
| Physical Android/Termux evidence | открыт | остаётся открытым | UNRESOLVED |
| Verification debt | 38 VERIFIED / 3754 | 38 VERIFIED / 3754; evidenceCoverage 0.0669 | UNRESOLVED, MEASURED |
| Consciousness evidence | 2/100 | без изменения | UNRESOLVED |

## B310 recheck addendum — 13.09.2026
B310 адресует три конкретных дефекта B309: source reliability могла наказываться без сигнала, silent sources разбавляли активные evidence-bearing sources, а recorded decision/workspace surfaces использовали stale pre-arbitration candidates.

| Claim / idea | B309 status | B310 recheck | Verdict |
|---|---|---|---|
| Verified source should receive more executive trust when it predicts outcome | open | sourceCredit positive=0.8994; policy weight 0.7615->1.0 | CONFIRMED |
| Bad verified prediction should reduce source trust | open | negative policy credit=0.1171 | CONFIRMED |
| Silent source should not be penalized | open | neutral source reliability remains ~0.5 | CONFIRMED |
| Silent sources should not dilute active source | open | active-only denominator implemented and B309 regression passes | CONFIRMED |
| Final decision trace should represent actual final candidate surface | open | decision/workspace switched to governedCandidates | CONFIRMED |
| Whole-organism action frequency must naturally shift after policy learning | unresolved | controlled baseline/trained distribution unchanged (L1=0) | UNRESOLVED |
| Policy channel can causally alter whole-organism distribution | partially | policy lesion changed trained distribution to 24 wait/24; lesionL1=48 | CONFIRMED |
| B297 executive state survives restart | PASS | consolidation/source-credit persistence rechecked | CONFIRMED |
| Neural B296 remains real after arbitration changes | PASS | B298 5616 synaptic updates / restore PASS | CONFIRMED |

### B310 representation correction
The old hard `clamp(rawUtility)` could collapse many weak candidates to score=0. B310 replaces it with a bounded monotonic logistic transform, preserving score ordering while retaining sub-zero margin information. This is a representation correction, not a new learning mechanism.


## B311 recheck addendum — 13.09.2026
B311 адресует проблему B310: policy, B264 causal policy и p29/p30 learned policy действовали частично параллельно. Теперь они routed through one canonical B297 `policy` source.

| Claim | B310 status | B311 recheck | Verdict |
|---|---|---|---|
| Policy source reaches executive fusion | PASS | Canonical policy ecology PASS | CLOSED STRONGER |
| Policy lesion causes executive change | PASS | `explore → verify` in isolated B311 test | CLOSED STRONGER |
| Verified policy transfer | OPEN/limited | Neighbor bias ~0.007274 and restore PASS | PARTIAL CLOSED |
| Natural whole-organism distribution shift | OPEN | Still OPEN | OPEN |
| Duplicate policy score paths | OPEN | B264/p29/p30 direct score injection consolidated | IMPROVED |
| Neural substrate reality | PASS | B298 regression PASS: 5616 synaptic updates | CLOSED |

## B312 recheck addendum — 13.09.2026
B312 замыкает verified policy до финальной decision surface через bounded safety-gated handoff. Это consolidation step, а не новый learner.

| Claim / idea | B311 status | B312 recheck | Verdict |
|---|---|---|---|
| Verified policy reaches final action boundary | partial | 3 live verified confirmations + standalone promotion | STRENGTHENED |
| Policy can promote a different action when evidence is strong | partial | standalone `verify -> explore` promotion PASS | CONFIRMED |
| Safety/user constraints remain authoritative | open | lesion/constitutional/external-request blocks PASS | CONFIRMED |
| Neighbor-context policy transfer should not vanish on small state drift | partial | neighbor transfer weight strengthened to 0.55; regression PASS | STRENGTHENED |
| Natural whole-organism action-distribution shift | unresolved | short baseline/trained remained 6 explore / 2 verify in both branches | UNRESOLVED / HONEST LIMIT |
| Neural substrate reality | confirmed | B298 regression: 5616 synaptic updates, restore PASS | CONFIRMED |
| Android/Termux physical evidence | unresolved | still not run on physical Android | UNRESOLVED |
| P6/P7 | unresolved | handoff is not long-horizon independence | UNRESOLVED |
| Verification debt | unresolved | strict VERIFIED remains a small fraction of total functions | UNRESOLVED |
| Consciousness evidence | 2/100 | unchanged | UNRESOLVED |

## B312 final release recheck — 13.09.2026
B312 замыкает verified policy до финальной decision surface через bounded, safety-gated handoff.

| Claim | B312 final evidence | Verdict |
|---|---|---|
| Verified policy reaches final action boundary | 8 live evaluations / 3 verified confirmations + standalone promotion | STRENGTHENED |
| Strong verified policy can promote a different action | standalone `verify -> explore`, eligibility 0.8902 | CONFIRMED |
| Lesion/safety/external request remain authoritative | standalone lesion + constitutional + external-request blocks | CONFIRMED |
| Legacy state remains compatible | schema 127 migration PASS | CONFIRMED |
| Neighbor verified context transfer persists | B311 neighbor bias 0.011767 + restore PASS | CONFIRMED |
| Natural whole-organism distribution shift | baseline=6 explore/2 verify, trained=6 explore/2 verify | UNRESOLVED |
| Neural substrate remains real | B298=36 learning updates / 5616 synaptic updates / restore PASS | CONFIRMED |
| Android/Termux physical evidence | no physical-device run | UNRESOLVED |
| P6/P7 | no long-horizon independent closure | UNRESOLVED |
| Verification debt | 38 VERIFIED / 3767 functions; 897/931 parameterized pass | UNRESOLVED, MEASURED |
| Consciousness evidence | 2/100, unchanged | UNRESOLVED |

## B313 recheck addendum — 13.09.2026
B313 переносит развитие от локального policy-evidence к продольной траектории организма: реальный `worldTransition` теперь проходит через B285 autobiographical/life consolidation, а затем сильное консолидированное evidence может обучать существующий canonical AdaptivePolicy. Отдельный B313 ledger измеряет расхождение neural/personality/policy/action trajectories и не владеет второй памятью или вторым learner.

| Claim / idea | B312 status | B313 recheck | Verdict |
|---|---|---|---|
| Real worldTransition должен попадать в B285 life consolidation | частично / bypass для transition-вfeedback | B285 получает canonical feedback step для real transition; `consolidationCount=3` на 24-cycle verified branch | CONFIRMED + CLOSED GAP |
| Consolidated autobiographical evidence должно возвращаться в canonical policy | open | positive branch: `72` consolidation→policy bridge updates; negative branch intentionally blocked by low future-consistency | CONFIRMED PARTIAL |
| Противоположный опыт должен реально делать организм другим | open | positive vs negative branches: action L1=`4`, neural plasticity gap≈`0.0153`, personality gap≈`0.1292`, policy gap≈`0.4008` | CONFIRMED |
| Изменение должно проявляться не только во внутренних числах | open | 16-cycle evaluation: positive `explore=12/respond=2/verify=2`; negative `explore=12/respond=0/verify=4` | CONFIRMED |
| Longitudinal state должен переживать restart | open | B313 cycles=24, verifiedCycles=24, bridge=72 preserved | CONFIRMED |
| Lesion должна убирать B285→policy developmental bridge | open | bridge stayed `72 -> 72` after lesion; no future bridge updates observed | CONFIRMED |
| Neural substrate remains causal participant | confirmed | B298 regression: `36` learning updates / `5616` synaptic updates / restore PASS; B313 neural gap≈`0.0153` | CONFIRMED |
| Whole-organism divergence is fully independent of test framing | open | observed under controlled positive-vs-negative world outcomes; natural uncontrolled generalization remains future work | PARTIAL |
| Negative autobiographical outcomes should also consolidate when causally strong | open | current gate keeps negative branch bridge at `0` under low B285 futureConsistency≈`0.387` | OPEN / NEXT TARGET |
| Android/Termux physical evidence | unresolved | still no physical-device execution in this release | UNRESOLVED |
| P6/P7 | unresolved | B313 adds longitudinal divergence but not hundreds/thousands of independent autonomous cycles or replication | UNRESOLVED |
| Verification debt | unresolved | `38 VERIFIED / 3781 functions`; evidenceCoverage≈`0.0668`; parameterized `899/933` with failures `0` | UNRESOLVED, MEASURED |
| Consciousness evidence | 2/100 | unchanged | UNRESOLVED |

### B313 interpretation boundary
B313 demonstrates experimentally that different verified outcomes can drive different future action distributions through the existing organism architecture. This is evidence of longitudinal behavioral plasticity in the software. It does not establish subjective experience, sentience, consciousness, or human-equivalent cognition.

---
## B314 recheck — 13.09.2026
B314 extends the canonical B285 autobiographical/life-consolidation owner with controlled negative-experience scar and gradual recovery.

Current evidence:
- verified negative live outcomes: 16;
- live negative scar: 0.6271;
- corrective verified outcomes: 20;
- recovery: 0.5480;
- scar after recovery: 0.3947;
- persistence: PASS;
- lesion: PASS;
- migration schema 127: PASS;
- B313/B312/B306/B305/B298 regressions: PASS in isolated gates.

Current interpretation:
B314 proves controlled negative experiential influence inside the existing autobiographical memory owner. It does not prove phenomenological memory, consciousness, or human-like trauma/emotion.

Open next step:
cross-context recovery and longer autonomous trajectories under resource pressure, with targeted verification of the remaining unverified function surface.

## B315 recheck — 2026-09-14
- B314 remains historical/current reference for global causal scar/recovery.
- B315 extends canonical B285 with bounded contextual scar states; no second memory owner.
- Long-horizon direct-B285 evidence: 40 negative evolution steps + 32 corrective events.
- Scar 0.835623 -> 0.136432.
- Live OrganismCore context states: 3 after 8 verified negative outcomes.
- Migration context-state preservation: PASS.
- Typecheck/static gates: PASS.
- Aggregate heavy runtime chain: resource-limited, not PASS.

## B316 recheck addendum - 14.09.2026

| Claim / idea | B315 status | B316 recheck | Verdict |
|---|---|---|---|
| Context scar should distinguish which action failed | too coarse | per-action contextual scar added and executed | CLOSED NARROWLY |
| Unrelated actions should not receive the same local warning | unresolved | 48 respond outcomes -> respond scar 0.730736, explore scar 0 | CONFIRMED |
| Neighbor transfer must remain bounded | confirmed broadly | neighbor respond bias -0.210594 vs exact -0.217728 | CONFIRMED |
| Same-action corrective evidence should weaken contextual action scar | partial | 0.730736 -> 0.081296 after verified recovery | CONFIRMED |
| Persistence must preserve new state | migration required | schema 127 restore preserves actionNegative01 | CONFIRMED |
| Live organism must reach real neural substrate | confirmed historically | B316 live core: 12 B296 learning updates / 1872 synaptic updates | STRENGTHENED |
| Whole-organism long-horizon action distribution | unresolved | still not independently closed; aggregate long run resource-limited | UNRESOLVED |
| Physical Android/Termux | unresolved | still no physical device execution | UNRESOLVED |
| P6 sustained autonomy | partial | B316 improves local representation, not P6 closure | UNRESOLVED |
| P7 independent replication | open | unchanged | UNRESOLVED |
| Verification debt | unresolved | 38 VERIFIED / 3793 functions; 899/933 parameterized, 0 failures | UNRESOLVED, MEASURED |
| Consciousness | 2/100 | unchanged | UNRESOLVED |
