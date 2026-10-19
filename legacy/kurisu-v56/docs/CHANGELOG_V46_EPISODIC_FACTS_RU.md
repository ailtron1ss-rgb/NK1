# v46 — Episodic memory + facts + interrupt (новые источники)

## Источники (не ST / не Replika)
- **Open-LLM-VTuber**: interrupt речи, непрерывный voice loop, история
- **Companion LTM research / MemoryBank-style**: session summary → episodes, fact extract
- **xMemory / layered memory ideas**: буфер реплик → episode summary → LTM

## Новое
- `brain/sessionEpisode.ts` — каждые ~6 реплик → summary в промпт + LTM
- `brain/factExtractor.ts` — факты о пользователе (имя, место, предпочтения)
- `services/speechInterrupt.ts` + кнопка **⏹ Стоп**
- Промпт: EPISODIC MEMORY блок

## Аудит
- 0 missing imports, 0 brace mismatch
