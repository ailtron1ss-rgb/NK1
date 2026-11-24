# Kurisu Mobile 2.2 — исправление Android/Termux

## Почему предыдущая версия ломалась

Предыдущая версия имела прямую npm-зависимость `@huggingface/transformers`. При установке в Termux npm строил дерево зависимостей с `onnxruntime-node`, а этот пакет не предоставляет Android-бинарники. Поэтому npm завершался с `EBADPLATFORM` и сообщением `Actual os: android`.

## Что изменено

- `@huggingface/transformers` удалён из `package.json`.
- В локальном AI-движке больше нет статического npm-import этого пакета.
- Transformers.js загружается **только в браузере и только после включения локальной нейросети** через ESM CDN.
- В браузере используется ONNX Runtime Web: WebGPU, если доступен, иначе WASM.
- Node/Express/Vite больше не пытаются установить Android-несовместимый `onnxruntime-node`.
- Обычный запуск проекта не требует скачивания локальной модели.

## Запуск в Termux

```bash
cd ~/projects/kurisu_mobile_v2/kurisu_webapp
npm install
npm run lint
npm run dev -- --host 127.0.0.1 --port 3000
```

Открыть в браузере:

`http://127.0.0.1:3000`

## Важно про локальную модель

При первом включении локального AI браузер скачает Transformers.js и модель с Hugging Face/CDN. Это не происходит во время `npm install`.

Если WebGPU доступен, движок пытается использовать его. Иначе используется WASM. WebGPU является экспериментальным/неодинаково поддерживаемым API, поэтому WASM остаётся обязательным fallback.

## Ограничения

Локальная SmolLM2 135M — компактная модель для мобильного режима. Она заметно слабее облачных моделей. Для сложных задач лучше использовать Gemini/OpenRouter/Groq/Together, если настроен API.
