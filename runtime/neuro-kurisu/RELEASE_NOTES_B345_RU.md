# Release Notes B345

B345: Learned Consequence Rehearsal.

Организм теперь использует накопленные исходы прошлых действий как bounded pre-action estimate перед новым выбором. Сигнал активируется только при достаточном количестве samples, confidence и малой разнице между кандидатами.

Изменены:
- `B299CausalPersonalityDevelopmentLoop.ts`
- `DecisionActionPipeline.ts`
- `OrganismCore.ts`
- B345 tests
- package.json test scripts

Проверки:
- typecheck PASS
- B338/B339/B340/B341/B343/B344 regressions PASS
- B345 unit PASS
- B345 Core runtime PASS
- architecture PASS
- integrity PASS
- syntax PASS
- release contract PASS

Known OPEN:
- B342 live unseen-context Core holdout
- long-horizon 80–120+ developmental closure
- Android/Termux device proof
