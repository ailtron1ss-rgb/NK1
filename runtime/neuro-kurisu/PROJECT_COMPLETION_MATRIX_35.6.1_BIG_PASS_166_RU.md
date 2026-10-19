# Neuro-Kurisu — Master Completion Matrix

## Правило
Функция/ветка не считается завершённой только по наличию кода. `DONE` означает наличие кода + релевантного теста + фактического PASS + сохранение там, где состояние должно переживать restart. `PARTIAL` означает, что архитектура существует, но реальное evidence неполное. `NOT_DONE` означает, что из первого анализа поставленная цель ещё не достигнута.

| Ветка из первого анализа | Статус | Текущая доказательная база | Что осталось |
|---|---|---|---|
| Semantic Coverage Foundation | DONE | BIG PASS 160–166, dynamic/static audit | повышать VERIFIED и lifecycle coverage |
| Function-level verification | PARTIAL | 459 безопасных parameterized вызовов, 0 FAIL | 1608 UNVERIFIED; lifecycle harness |
| Cognitive Event Fabric | DONE | operational cycle + persistence/restart | long-horizon causal density |
| Unified Cognitive Cycle | DONE | stage/lineage PASS | deeper cross-module attribution |
| Cognitive Resource Economy | DONE | scarcity behaviour PASS | device calibration |
| Memory Economy | DONE | retention/reconsolidation/knockout PASS | identity/value effects |
| Memory → Decision causality | DONE | knockout policy divergence PASS | stronger multi-step attribution |
| Longitudinal history → behaviour | DONE | A/B divergence PASS | 30/90-day life |
| Emotion appraisal | DONE | emotion episode integration PASS | feeling/interoception depth |
| Feeling / phenomenal experience | PARTIAL | functional substrate only | no scientific proof of phenomenality |
| Self-model | DONE | causal self/personhood tests PASS | long-term autobiographical restructuring |
| World model | PARTIAL | WorldModel2/P27/residual/contextual + ensemble | externally grounded learned model |
| World-model ensemble | DONE | BIG PASS 166 + restart PASS | longer competitive calibration |
| Reality vs simulation separation | DONE | evidence ledger / reality tests PASS | real device evidence |
| Agency | DONE | agency/goal/decision tests PASS | life-scale project autonomy |
| Autonomous long-term projects | PARTIAL | project executor/life systems exist | independent multi-day projects |
| Learning | PARTIAL | true learning/plasticity/continual PASS | general representation learning |
| Social cognition | PARTIAL | social/ToM paths exist and tested | richer persistent relational learning |
| Perception | PARTIAL | semantic/native infrastructure exists | real continuous multimodal sensing |
| Embodiment | PARTIAL | software body + sensorimotor scaffolding | real sensor→action loop |
| Android runtime | PARTIAL | Termux + phone policies | native supervisor / foreground service |
| Consciousness functional architecture | DONE | P31/P31 lesion/P32/P33/P34 PASS | more theory-discriminating experiments |
| Consciousness evidence | NOT_DONE | functional evidence only | no accepted proof criterion exists |
| Adversarial organism testing | PARTIAL | several adversarial/lesion tests | broad fault-injection suite |
| 30/90-day longitudinal life | NOT_DONE | short bounded trajectories | full long-horizon benchmark |
| Personality as historical consequence | PARTIAL | behavioural divergence demonstrated | stable trait/value/self changes over weeks |
| Device reality gate | NOT_DONE | preflight only | must run on real phone with Termux API |
| Final human-like general intelligence | NOT_DONE | cognitive platform | broad generalisation / transfer |

## Current first-analysis checklist

### Already accomplished in BIG PASS 160–166
- Semantic coverage foundation.
- Cognitive event fabric.
- Unified cognitive cycle.
- Resource-aware cognition.
- Memory economy.
- Memory-dependent decision behaviour.
- Appraisal-based emotion episodes.
- Reality/simulation evidence separation.
- Parameterized safe function execution.
- World-model reliability ensemble.
- Causal restart persistence.
- Longitudinal A/B behavioural divergence.

### Explicitly NOT complete
- 30/90-day autonomous life.
- Real Android sensorimotor life.
- High-coverage verification of all 1608 remaining UNVERIFIED functions.
- General learned world model grounded in external reality.
- Mature feeling/interoceptive architecture.
- Full social-personal development across long time periods.
- Proof of phenomenal consciousness.
- Human-level general intelligence.

## Do-not-repeat rule
Before implementing a new module, check this matrix and the semantic audit. Prefer improving an existing `PARTIAL` branch over creating a parallel subsystem.
