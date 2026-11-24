# Запуск Kurisu v17 на Android через Termux

## 1. Подготовка

```bash
pkg update && pkg upgrade -y
pkg install -y git nodejs-lts python clang make
termux-setup-storage
```

Проверь:

```bash
node -v
npm -v
python --version
```

## 2. Распаковка проекта

Если архив находится в `Download`:

```bash
mkdir -p ~/kurisu
cd ~/kurisu
unzip ~/storage/downloads/Kurisu_v17_Evolution_Android.zip
cd kurisu_v17_evolution/kurisu_webapp
```

Если название папки отличается, используй `find`:

```bash
find ~/kurisu -maxdepth 3 -name package.json
```

## 3. Установка зависимостей

```bash
npm install --no-audit --no-fund
```

## 4. Запуск для телефона

```bash
npm run dev -- --host 0.0.0.0 --port 3000
```

Открой в браузере телефона:

```text
http://127.0.0.1:3000
```

Если сервер запущен на другом интерфейсе, можно посмотреть адрес:

```bash
ip addr
```

## 5. Рекомендуемый режим среднего телефона

- начинать с SmolLM2 135M/360M;
- затем пробовать Qwen3 0.6B Q4F16;
- Phi-3.5 Mini считать экспериментальным тяжёлым режимом;
- одновременно держать загруженной только одну локальную модель;
- не запускать постоянный inference-loop;
- использовать idle/sleep только по событиям или редкому таймеру;
- при перегреве переключаться на template/cloud или более маленькую модель.

## 6. Локальная нейросеть

В интерфейсе включи Local Neural и выбери модель. В v17 добавлена защита по `navigator.deviceMemory`, когда браузер её предоставляет.

Каталог — только стартовая подборка. Custom model registry принимает Hugging Face repository ID, если репозиторий совместим с Transformers.js `text-generation` и содержит нужные ONNX-артефакты.

## 7. Проверка ядра без установки npm-зависимостей

```bash
npx tsc --noEmit --target ES2022 --module ESNext \
  --moduleResolution Bundler --lib ES2022,DOM --skipLibCheck \
  src/cognitive/*.ts src/brain/BrainOrchestrator.ts
```

Эта команда проверяет когнитивное ядро и оркестратор. Полный Vite build требует установленных зависимостей.

## 8. Если npm install зависает

На телефоне это часто связано с сетью/хранилищем. Попробуй:

```bash
npm cache verify
npm install --no-audit --no-fund --prefer-offline
```

Не удаляй проект сразу. Сначала посмотри:

```bash
df -h
free -h
```

## 9. Если браузер не открывает приложение

Проверь:

```bash
curl -I http://127.0.0.1:3000
```

и убедись, что Termux не был выгружен Android из памяти.

## 10. Важная граница

Termux является средой запуска Node/CLI. Само веб-приложение работает в браузере. Поэтому тяжёлый GGUF/llama.cpp backend в будущем будет отдельным provider, а не заменой текущему browser ONNX provider.
