# WorkPass74 — локальное распознавание речи Whisper.cpp в NK1

## Что встроено

NK1 получает опциональный входной канал речи:

`микрофон браузера → MediaRecorder → Web Audio downmix/resample → WAV PCM16 mono 16 kHz → NK1 API → локальный whisper.cpp → проверенный текст в поле чата → явная отправка в OrganismRuntime`.

Кнопка микрофона в ChatPanel ограничивает одну запись 30 секундами. Браузер декодирует полученный MediaRecorder blob и пересэмплирует его через `OfflineAudioContext` в mono 16 kHz. В runtime разрешён только PCM16 RIFF/WAVE с одним каналом, частотой 16 kHz и максимальным окном 60 секунд; жёсткий лимит тела — около 2 MB.

API: `POST /api/organism/speech/transcribe`, Content-Type `audio/wav`, тело — WAV bytes. Endpoint требует стандартную авторизацию NK1. Он возвращает `{ ok, provider, text, language, durationSeconds, latencyMs, segments }`.

**Распознанный текст не отправляется в чат автоматически.** Он помещается в поле ввода для проверки и редактирования пользователем. Только отдельное действие «Отправить» передаёт текст в `runtime.step()`. STT не записывает аудиофайл, не пишет transcript в MemoryOS2 и не меняет learning state.

## Почему sidecar, а не C++ addon внутри Node

Поставленный источник whisper.cpp содержит Native C/C++ API, Node addon demo и самостоятельный HTTP server. Для Android/Termux sidecar проще изолировать от Node ABI, NDK и сборки npm native addons. NK1 общается с ним только по `127.0.0.1`; конфигурация с произвольным hostname/IP, HTTPS/proxy URL, credentials, query/hash или другим path завершается ошибкой конфигурации. Без переменной окружения провайдер выключен и runtime продолжает запускаться.

## Сборка на Android / Termux

1. Распакуйте поставленный `whisper.cpp-1.9.5.zip` локально, например в `$HOME/src/whisper.cpp-1.9.5`. Исходники намеренно не копируются целиком в NK1: архив содержит тысячи файлов и собственную CMake/GGML сборку.
2. Установите инструменты Termux:

```bash
pkg update
pkg install cmake clang make
```

3. Соберите сервер. По умолчанию используется мультиязычная модель `tiny` для меньшей нагрузки на телефон:

```bash
export WHISPER_CPP_SOURCE_DIR="$HOME/src/whisper.cpp-1.9.5"
bash runtime/neuro-kurisu/scripts/build-whisper-cpp-termux.sh
```

Для более качественного, но более тяжёлого варианта:

```bash
WHISPER_CPP_MODEL=base bash runtime/neuro-kurisu/scripts/build-whisper-cpp-termux.sh
```

Скрипт включает CPU-only portable build, отключает GPU/OpenMP/FFmpeg и использует два параллельных job для сборки и два inference-потока по умолчанию, чтобы не перегружать CPU/термальный бюджет телефона. Это безопасная базовая сборка, а не утверждение о максимальной скорости конкретного устройства.

4. Запустите whisper-server в отдельной Termux-сессии, привязав его только к loopback:

```bash
"$WHISPER_CPP_SOURCE_DIR/build-nk1-termux/bin/whisper-server" \
  --host 127.0.0.1 --port 8081 \
  --model "$WHISPER_CPP_SOURCE_DIR/models/ggml-tiny.bin" \
  --language auto --threads 2 --no-gpu
```

5. Запустите NK1 с настройкой:

```bash
NK1_WHISPER_CPP_URL=http://127.0.0.1:8081/inference
```

Для модели `base` замените путь на `ggml-base.bin`. Не публикуйте порт 8081 на LAN/интернет и не меняйте provider URL на удалённый host: adapter намеренно допускает только loopback.

## Контракт и защита

- Только `audio/wav`; никакого произвольного файлового пути, shell-команды или multipart parsing из браузера.
- WAV должен быть mono PCM16 16 kHz, с корректными RIFF/chunk lengths; 100 ms минимум, 60 s максимум.
- Максимум 2,000,044 bytes, максимум один активный inference job; второй получает `whisper-provider-busy`.
- Запрос к sidecar ограничен таймаутом; disconnect браузера отменяет inference через AbortSignal.
- В sidecar отправляются только файл и фиксированные параметры `language=auto`, `response_format=verbose_json`, `temperature=0`; whisper.cpp 1.9.5 server defaults `no_context=true` and this field is not configurable through its multipart handler.
- Текст и сегменты проходят ограничение длины/количества и проверку временных границ.
- В runtime не логируются WAV bytes и transcript; provider snapshot содержит только счётчики/latency/host.
- Не настроенный провайдер отвечает 503 `whisper-provider-not-configured`, а не делает вид, что распознавание работает.

## Исходник и лицензия

Интеграция проверена по предоставленному архиву `whisper.cpp-1.9.5.zip`, SHA-256:

`7a7a73071939f16bc028ad2f713f16f26e37afb6cc155d0f19e3d65705d2b1d9`.

В архиве присутствует MIT LICENSE (ggml authors, 2023–2026). NK1 использует внешний бинарный sidecar и его документированный `POST /inference` multipart контракт; код whisper.cpp в репозиторий NK1 не копируется. Модельные веса скачиваются отдельно скриптом upstream; сверяйте происхождение и условия использования выбранной модели. Для аудиовхода необходимо разрешение микрофона браузером и secure context (HTTPS либо localhost).

## Пока не считается доказанным

- На этом этапе автоматизированы WAV codec/provider boundary и CI-проверки; реальный Android microphone → Termux → whisper-server E2E, латентность, RAM/CPU и качество распознавания на русском пока не измерены на физическом телефоне.
- Нужен отдельный device soak по 10/30/60 секунд, pause/noise, cancel/disconnect, повторному старту сервера и низкому заряду/термальным ограничениям.
- Текстовое распознавание — не speaker identity и не подтверждение личности говорящего.
