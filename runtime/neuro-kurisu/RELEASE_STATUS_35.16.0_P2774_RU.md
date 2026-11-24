# Release Status — 35.16.0 / P2774

Статус: **research-release / validated engineering increment / archive-ready**.

## Доля работы прохода
- production code: **85%**
- tests/validation: **10%**
- research/docs/release: **5%**

## Реально внедрено
- model-time replay scheduler;
- forgetting-aware replay debt;
- episodic trace compaction;
- recurrence-aware semantic consolidation;
- resource-aware replay budget;
- integration в NeuralExperienceBranch;
- persistence;
- research record и source index.

## Подтверждённые тесты на текущем проходе
- P2774 model-time replay: PASS
- P2760 continuum memory: PASS
- P2750 core/interference/fallback/mobile-compaction: PASS
- P2742 causal: PASS

## Ограничения
Критические P2716/P2708/mobile/smoke/server и static audits после последних code/metadata изменений отдельно перепроверены; перед упаковкой остаётся только финальная regeneration manifest после добавления audit evidence.

## Ключевой mobile debt
Host organism smoke ранее доходил до ~650+ MB RSS. P2774 сознательно использует bounded traces и resource-aware replay, но физический Android/Termux benchmark по конкретному телефону остаётся обязательным.


## Финальные evidence
- P2774: PASS — 420 outcomes, modelTime=277.709, compaction=356, consolidation=402, replaySamples=120, restart=420.
- P2750/P2760/P2742/P2734/P2726/P2720: PASS отдельными чистыми процессами.
- P2716 deep/continual/promotion: PASS.
- P2708 deep/continual/long: PASS.
- P2724 mobile endurance: PASS — 1500 cycles / 750 outcomes / max growth 28.6 MB / restartOk=1.
- organism smoke/server smoke: PASS.
- full static audit: PASS.
