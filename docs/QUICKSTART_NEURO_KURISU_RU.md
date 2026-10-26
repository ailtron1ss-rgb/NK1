# Neuro Kurisu — единый запуск приложения и когнитивного runtime

Этот Compose запускает **полный React-интерфейс, канонический Neuro-Kurisu runtime и единый reverse proxy**. Браузер обращается к UI и когнитивному API через один origin; запросы `/api/organism`, `/api/research` и `/api/health` направляются в канонический runtime. Состояние организма и встроенная PGlite-БД приложения сохраняются в отдельных Docker volumes.

## Требования

Docker Engine и Docker Compose v2. Node.js на хосте не нужен — образы строятся и работают внутри Node.js 24.

## Запуск

Из корня репозитория:

```sh
cp .env.example .env
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 240
docker compose ps
docker compose logs -f neuro-kurisu neuro-kurisu-app gateway
```

Открой **http://127.0.0.1:8080**. Проверка шлюза: `http://127.0.0.1:8080/healthz`. Проверка канонического runtime через тот же origin: `http://127.0.0.1:8080/api/health`; в ответе поле `ready` должно быть `true`.

Порт по умолчанию доступен только на локальном компьютере. Не публикуй runtime-порт напрямую. Токен `NEURO_API_TOKEN` используется только между Caddy и runtime и автоматически передаётся шлюзом; при изменении `NK1_BIND_ADDR` сначала замени демонстрационный токен на длинный случайный секрет и настрой внешнюю аутентификацию/TLS.

## Модель и голос

Интерфейс и когнитивный runtime запускаются без внешнего API-ключа. Для генеративного диалога настрой провайдера в `.env` — например `GEMINI_API_KEY`, `LLAMA_CPP_URL` или `KOBOLD_URL`. Для llama.cpp/Kobold на хосте используй адрес `http://host.docker.internal:<порт>`. Доступность речи, Live2D и камеры зависит от установленных моделей, ассетов и оборудования; они не становятся настроенными автоматически.

## Память и перезапуск

- Состояние организма хранится в volume `neuro-kurisu-state`.
- Данные встроенной PGlite-БД приложения хранятся отдельно в `neuro-kurisu-app-db`.
- `docker compose down` останавливает контейнеры и сохраняет данные.
- **`docker compose down -v` удаляет все named volumes**, включая состояние организма, app-БД и конфигурационные данные Caddy; используй только для намеренного сброса.

## Запуск без Docker

Для runtime отдельно: `npm ci --prefix runtime/neuro-kurisu`, затем `HOST=127.0.0.1 PORT=3310 npm start --prefix runtime/neuro-kurisu`.

Для React-приложения: `npm ci --prefix app`, затем `npm run typecheck --prefix app` и `npm run build --prefix app`. Обычная сборка сохраняет preset Vercel; Docker использует standalone Node preset.

## Проверка

CI устанавливает обе lockfile, выполняет app/runtime TypeScript, production-сборку React UI, когнитивные/обучающие/шлюзовые контракты, smoke сервера, безопасности и рестарта. Затем он строит все контейнеры и проверяет UI, health endpoint и фактическое соединение UI → runtime через same-origin API. Это не доказывает настройку внешних LLM, голосовых моделей, camera/Live2D ресурсов или независимую производительность обучения.
