# v50 — Unified Consciousness

## Суть
`cognitive/UnifiedConsciousness.ts` — единый workspace-тик:
emotionAffect + feeling dynamics + personality + relationship + dialogue plan +
episodic hints + debt + stones count → один prompt-блок «единый субъект».

После ответа: afterReply (долг, эпизод, replyMemory, fatigue).

## 10 прогонов самопроверки

1. **Связаны ли эмоции?** — onUserMessage + tick + dominant feel → да  
2. **Чувства живут во времени?** — warmth/tension/curiosity/fatigue в localStorage → да  
3. **Память в сознании?** — episodic hints в workspace → да  
4. **Личность?** — personalityCore / livingPersona → да  
5. **Отношения?** — applyInteraction + summaryForPrompt → да  
6. **Диалог-план?** — intent/must в unified → да  
7. **Камни/контракт?** — остаются отдельными блоками + счётчик stones → да (без двойного огромного копипаста)  
8. **Автономия/долг?** — debt slice + drives в других блоках → да  
9. **Ошибки API?** — registerInteraction→applyInteraction, observeUser→onUserMessage → исправлено  
10. **Что ещё?** — HUD строка hudLine(); дальше: эмоциональная запись в LTM gate, UI индикатор dominant feel  

## Аудит
0 missing imports, 0 brace mismatch
