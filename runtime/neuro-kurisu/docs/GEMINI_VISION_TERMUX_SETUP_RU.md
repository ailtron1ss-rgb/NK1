# Gemini Vision — Termux / phone setup

## Безопасный режим по умолчанию
Vision backend выключен, даже если `GEMINI_API_KEY` существует. Это предотвращает случайные API-вызовы от фоновой камеры.

## Включение
```sh
export GEMINI_API_KEY='YOUR_KEY'
export GEMINI_VISION_ENABLED=1
export GEMINI_VISION_MODEL='gemini-3.8-flash'
export GEMINI_VISION_TIMEOUT_MS=12000
export GEMINI_VISION_MAX_IMAGE_BYTES=8000000
npm start
```

На Android/Termux рекомендуется оставлять `capture-if-useful` route вместо постоянного camera polling.

## Что делает backend
1. Получает JPEG только после resource/EVC gate или явного camera action.
2. Передаёт inline image data в Gemini multimodal request.
3. Требует JSON semantic output.
4. Валидирует/ограничивает objects, relations, events и confidence.
5. Передаёт результат в P41.
6. Без retention удаляет временный файл после backend completion.

Gemini image understanding поддерживает inline base64 image input; официальная документация также указывает общий лимит около 20 MB для inline request, поэтому Neuro-Kurisu использует более строгие 8 MB. citeturn857408search0turn857408search1

## Научная граница
Наличие Gemini Vision backend означает наличие external semantic perception pathway. Это не означает human-level vision, autonomous understanding, AGI или consciousness. Все model outputs сохраняются как `model-output` evidence с confidence/provenance.

## Как проверить
```sh
curl http://127.0.0.1:3000/api/organism/sensorium/status
curl http://127.0.0.1:3000/api/metrics
```

Ожидаемый `visionEnabled=true` означает только, что backend зарегистрирован и готов к вызову; успешный semantic result появляется после реального camera analysis.
