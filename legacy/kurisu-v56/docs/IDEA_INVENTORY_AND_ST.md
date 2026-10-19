# Idea inventory (chat) + SillyTavern synthesis — v44

## Animations (честный ответ)
- **Да, частично:** Live2D motions Idle / TapHead / TapBody; expression map; **lip-sync pulse** при TTS; зоны касания.
- **Нет:** полный кастомный риг с нуля, физика волос отдельно, 60fps cinematic — зависит от модели `.moc3` и Cubism runtime в WebView.

## SillyTavern → что внедрили в Neuro-Kurisu

| ST feature | Mobile port | Status |
|------------|-------------|--------|
| World Info / Lorebook | `brain/worldInfo.ts` keyword inject | DONE |
| Character Card V2 | `brain/characterCard.ts` | DONE |
| Regex on AI output | `services/regexHygiene.ts` | DONE |
| TTS | Web Speech + pitch | already |
| Live2D | viewer + texture fallback | already |
| Token counter | TokenStatusBar | already |
| Quick Reply | UI phrases | already |
| Authors Note / sticky | dailyPlan + promises | partial |
| STscript / Flowchart | — | DEFERRED (heavy) |
| Image gen / caption | — | DEFERRED |
| Group chat | — | N/A single companion |
| Full extension marketplace | — | N/A |

## Идеи чата: добавлено vs нет

### Добавлено (накопительно v17–v44)
- Модульный мозг, ACE, драйвы, synergy, sentiment
- Offline templates + identity («кто ты», «жива?»)
- Live2D + texture + touch + lip pulse
- Gemini cascade 2.0-flash, token meter
- Память LTM/STM, deep canon seed
- World Info + Character Card + regex hygiene
- Самоанализ / NFH с approve (не silent code rewrite)
- HUD эмоций, дневник, канон UI

### Не добавлено / ограничено телефоном
- Полная самоперепись исходников на устройстве без approve
- Встроенная 700MB LLM в ZIP
- Room/SQLite native как в Kotlin 2-main
- SillyTavern extension host целиком
- Камера→эмоции, погода как постоянный input
- «Сознание» в философском смысле (только архитектура поведения)

## Синергия пайплайна
user → WorldInfo+Card+Drives+Sentiment+Memory → LLM/template → regexHygiene → TTS/lips → avatar touch/emotion
