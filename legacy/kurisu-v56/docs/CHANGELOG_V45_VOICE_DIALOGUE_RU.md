# v45 — Осмысленный диалог + голосовой диалог в реальном времени

## Компаньоны (Replika / Nomi / Neuro-sama-like) → что взяли
- Непрерывный голосовой цикл: слух → ответ → речь → снова слух
- Barge-in: отмена TTS при новом входе в цикл
- Качество реплик: блок DIALOGUE QUALITY в промпте
- Память + World Info + Character Card (из v44) остаются

## Новое
- `services/voiceConversation.ts`
- `VoiceControls`: кнопка **📞 Диалог** (continuous) + **🎤 Разово** (PTT)
- TTS onStart/onEnd → isSpeaking + lip-sync
- Аудит импортов/скобок: 0 missing, 0 brace mismatch

## Ограничения Android WebView
- Нужен Chrome (webkitSpeechRecognition)
- Разреши микрофон сайту http://127.0.0.1:3000
- Латентность = STT + сеть LLM + TTS (не <500ms как у коммерческих call API)
