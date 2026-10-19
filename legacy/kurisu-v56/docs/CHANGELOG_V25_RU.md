# v25 — Synergy layer + документация для будущих ИИ

## Добавлено
- `src/synergy/GlobalState.ts` — единый снимок «я»
- `src/synergy/InternalClock.ts` — ось времени, hourly reflect
- `src/synergy/SynergyOrchestrator.ts` — приоритеты, feedback onPerceive/onAct, trait drift, streaming tick
- Промпт получает SYNERGY PRIORITIES + physical hour/online/tick
- `docs/FOR_FUTURE_AI_FULL_HISTORY_AND_MANDATE.md` — история, карта, мандат перепроверки

## Связность
emotion → priorities → prompt → reply → ACE tags → slow trait drift  
idle → internalClock → reflect/consolidate  
eventBus: user_message, kurisu_reply, hub_tick, low_attention
