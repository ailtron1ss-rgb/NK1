# Kurisu v15 — запуск на Android через Termux

Этот проект рассчитан на Android/Termux. UI запускается как локальный web-сервер и открывается в браузере телефона.

## 0. Что нужно

Рекомендуется:

- Android 11+
- Termux из актуального источника проекта, а не очень старый APK
- 4 ГБ RAM — минимум для оболочки и лёгких моделей
- 6–8 ГБ RAM — значительно комфортнее для локальной нейросети
- 3–5 ГБ свободного места для кэша/моделей

Полноценная локальная LLM не обязательна для запуска оболочки: без неё проект использует fallback-режим.

## 1. Установка Termux-пакетов

В Termux:

```bash
pkg update && pkg upgrade -y
pkg install -y git nodejs-lts python clang make
termux-setup-storage
```

Если `nodejs-lts` недоступен в твоём репозитории, используй доступный пакет `nodejs`.

## 2. Распаковка проекта

Если ZIP лежит в Download:

```bash
cd ~/storage/downloads
unzip Kurisu_v15_CognitiveKernel_Android.zip -d ~/kurisu
cd ~/kurisu/kurisu_webapp
```

Если `unzip` отсутствует:

```bash
pkg install -y unzip
```

## 3. Установка зависимостей

```bash
npm install
```

Первый запуск может занять некоторое время.

## 4. Запуск

```bash
npm run dev -- --host 127.0.0.1 --port 3000
```

Открой в браузере телефона:

```text
http://127.0.0.1:3000
```

Если порт занят:

```bash
npm run dev -- --host 127.0.0.1 --port 3010
```

и открой `http://127.0.0.1:3010`.

## 5. Быстрая проверка

В другом окне Termux можно проверить сервер:

```bash
curl -I http://127.0.0.1:3000
```

Остановка: `Ctrl+C`.

## 6. Production-сборка

```bash
npm run build
npm start
```

Для разработки удобнее `npm run dev`.

## 7. Локальная нейросеть

Открой:

**Настройки → Plugins → On-Device Neural LLM**

Включи локальную модель. Первая загрузка требует сети, потому что Transformers.js получает модель из Hugging Face/CDN. После кэширования браузер может использовать локальные копии, но **v15 не обещает полноценный автономный model-file runtime**.

### Почему это важно

Размер файла модели не равен требуемой RAM. ONNX-модель на 500–800 МБ может потребовать заметно больше памяти во время инференса.

На среднем Android начинай с:

1. SmolLM2 135M
2. SmolLM2 360M
3. Qwen2.5 0.5B
4. Qwen3 0.6B

Более крупные модели включай только после проверки температуры, скорости и свободной RAM.

## 8. Добавление своей модели

В Plugins есть поле:

```text
author/model
```

Можно добавить любой репозиторий, если он действительно совместим с Transformers.js `text-generation` и содержит необходимые ONNX-файлы.

Примеры совместимых репозиториев проверялись для v15:

- `onnx-community/Qwen3-0.6B-Instruct-ONNX`
- `onnx-community/Phi-3.5-mini-instruct-onnx-web`
- `onnx-community/TinyLlama-1.1B-Chat-v1.0-ONNX`

Не вставляй произвольный PyTorch/GGUF repository и не ожидай, что браузер сможет его запустить. GGUF — отдельный runtime-путь, например llama.cpp.

## 9. Если нужна настоящая GGUF-локалка

Следующий этап проекта должен добавить отдельный Android/Termux provider на базе llama.cpp.

Это позволит работать с гораздо более широким каталогом GGUF и не зависеть от browser/ONNX runtime.

Официальная документация llama.cpp содержит Android и OpenCL backend. OpenCL особенно интересен для некоторых Qualcomm Adreno; поддержка зависит от устройства и драйвера. См. актуальную документацию проекта: https://github.com/ggml-org/llama.cpp/blob/master/docs/backend/OPENCL.md

## 10. Энергосбережение

Не запускай бесконечный LLM-loop.

Правильная схема:

```text
user/event
   ↓
cheap cognitive tick
   ↓
need for cognition?
   ├─ no → idle
   └─ yes
        ↓
   select model
        ↓
   infer
        ↓
   consolidate
```

При высокой температуре лучше отключать фоновые эксперименты и большие модели.

## 11. Android + localhost

Если браузер не открывает страницу:

```bash
curl http://127.0.0.1:3000
```

Если `curl` работает, а браузер нет — проверь, что используется именно `127.0.0.1`, а не внешний IP.

## 12. Не закрывай Termux полностью

Android может выгрузить процесс из памяти. Для долгой работы лучше держать Termux в foreground/notification режиме и не запускать тяжёлую модель одновременно с большим количеством других приложений.

## 13. Архитектурная граница

v15 содержит:

- CognitiveKernel
- PredictiveLoop
- memory
- personality
- autonomous engine
- local ONNX model manager
- fallback templates

Но это ещё не «доказанное сознание». Это исследовательская когнитивная архитектура.
