# Termux / Android — v26

## Чистая установка

```bash
cd ~/projects
rm -rf kurisu_mobile_v2
unzip ~/storage/downloads/Kurisu_Mobile_v2_Android_FIXED_v2.zip
cd ~/projects/kurisu_mobile_v2/kurisu_webapp
npm install
npm run lint
npm run dev -- --host 127.0.0.1 --port 3000
```

Открыть:

```text
http://127.0.0.1:3000
```

## Если старый `node_modules` остался

```bash
rm -rf node_modules package-lock.json
npm install
```

## Важно

Не устанавливать вручную:

```text
onnxruntime-node
```

Android-версия не должна иметь этот пакет в npm dependency tree.

Не переносить `node_modules` на `/sdcard`.

## Локальная модель

Сначала приложение работает без локальной модели.

Затем в настройках включается Local Neural.

Для 4+ ГБ RAM по умолчанию используется SmolLM2 360M. Для менее мощного устройства выбирается 135M.

Первичная загрузка модели требует сети. После этого браузер может использовать свой кэш, но полноценный гарантированный offline-cache больших весов зависит от браузера.

## Self-coding

Не включать self-code apply на production.

Для development:

```bash
export NODE_ENV=development
export KURISU_CODE_EDIT_TOKEN='придумай-длинный-случайный-токен'
npm run dev -- --host 127.0.0.1 --port 3000
```

Self-code pipeline сначала создаёт backup и проверяет TypeScript. При ошибке патч откатывается.

## Проверка

Всегда сначала:

```bash
npm run lint
```

Только потом:

```bash
npm run dev -- --host 127.0.0.1 --port 3000
```
