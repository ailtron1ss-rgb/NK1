# Полная инструкция: Kurisu v17.1 на среднем Android (Termux)

Автор правок: Grok (xAI). Цель — запуск без ПК.

## 0. Что должно быть на телефоне

- Termux (с F-Droid предпочтительно)
- Интернет для `npm install` и (опционально) облачных API / загрузки ONNX
- Свободно **≥ 2–3 ГБ** на диске под node_modules + модели
- Архив лежит в **Загрузках** (Downloads)

## 1. Termux: пакеты

```bash
pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts unzip
termux-setup-storage
```

Подтверди доступ к накопителю. Проверка:

```bash
node -v
npm -v
ls ~/storage/downloads/ | head
```

Нужен **Node ≥ 20** (nodejs-lts в Termux обычно ок).

## 2. Распаковка из Загрузок

```bash
mkdir -p ~/kurisu
cd ~/kurisu
unzip -o ~/storage/downloads/Kurisu_v17_1_TermuxReady.zip
```

Имя ZIP может отличаться — подставь своё:

```bash
ls ~/storage/downloads/Kurisu*.zip
unzip -o ~/storage/downloads/ИМЯ_АРХИВА.zip
```

Перейди в проект:

```bash
cd ~/kurisu/kurisu_v17_evolution/kurisu_webapp
# если путь другой:
find ~/kurisu -maxdepth 4 -name package.json
```

## 3. Установка зависимостей

```bash
cd ~/kurisu/kurisu_v17_evolution/kurisu_webapp
cp -n .env.example .env
npm install --no-audit --no-fund
```

Если зависает:

```bash
npm cache clean --force
npm install --no-audit --no-fund --prefer-offline
```

Если не хватает памяти — закрой Chrome/игры и повтори.

## 4. Запуск

```bash
npm run dev
```

Сервер слушает **0.0.0.0:3000** (уже в коде).

В **Chrome / Firefox** на телефоне:

```text
http://127.0.0.1:3000
```

Оставь Termux открытым (или Acquire WakeLock в уведомлении Termux).

## 5. Первый запуск в UI

1. Settings → вставь ключ **Gemini / Groq / OpenRouter** (хотя бы один) **или**
2. Включи **Local Neural** и модель **SmolLM2 135M** (самая лёгкая)
3. На среднем телефоне **не** грузи сразу Phi / большие модели
4. Вкладка **Мозг** — мониторинг маршрута

## 6. Типичные ошибки

| Симптом | Что делать |
|---------|------------|
| `vite` / JSX не собирается | В v17.1 добавлен `vite.config.ts` — нужна именно эта сборка |
| `EBADPLATFORM` / onnxruntime-node | Не ставь `@huggingface/transformers` в npm; local model только через CDN в браузере |
| Белый экран | `curl -I http://127.0.0.1:3000` в Termux; смотри лог npm |
| Termux «убит» | Restrict battery → без ограничений для Termux |
| npm install OOM | `node --max-old-space-size=2048 $(which npm) install --no-audit --no-fund` |
| Порт занят | `pkill -f "tsx server"` или другой порт в server.ts |

## 7. Остановка

В Termux: `Ctrl+C`.

## 8. Обновление архива

Не смешивай старый `node_modules` с новым major без чистки:

```bash
cd ~/kurisu/kurisu_v17_evolution/kurisu_webapp
rm -rf node_modules
npm install --no-audit --no-fund
```

## 9. Граница возможностей

Это когнитивная оболочка + LLM (cloud/local). Не «настоящее сознание», но непрерывность, сон, память, автономия и характер — да.
