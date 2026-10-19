# Neuro-Kurisu 7.1.0 — запуск на POCO M7 Pro 5G с нуля

## 1. Подготовка

Установи Termux и Termux:API из одного источника подписи. Положи ZIP в `Internal storage/Download/`.

## 2. Одна установка

В Termux вставь целиком:

```bash
termux-setup-storage
pkg update -y
pkg upgrade -y
pkg install nodejs-lts npm unzip curl coreutils bash -y
pkg install termux-api -y
mkdir -p "$HOME/Neuro-Kurisu"
rm -rf "$HOME/Neuro-Kurisu/app"
unzip -q "$HOME/storage/downloads/Neuro_Kurisu_Evolution_7.1.0_P21_COGNITIVE_RESILIENCE_POCO.zip" -d "$HOME/Neuro-Kurisu/app"
cd "$HOME/Neuro-Kurisu/app"
npm ci --ignore-scripts
```

## 3. Запуск

```bash
cd "$HOME/Neuro-Kurisu/app"
export NEURO_PHONE_MODE=true
export NEURO_INTERVAL_MS=30000
npm start
```

Открыть: `http://127.0.0.1:3000`

## 4. Проверка

```bash
curl -s http://127.0.0.1:3000/api/health; echo
curl -s http://127.0.0.1:3000/api/metrics; echo
curl -s http://127.0.0.1:3000/api/organism/time; echo
curl -s http://127.0.0.1:3000/api/organism/resilience; echo
```

## 5. Общение

Открой интерфейс и используй чат. Закрывать и снова запускать Termux можно в любое время. Не нужно вручную задавать дату или время: P20 Temporal Continuity восстанавливает wall-clock gap по сохранённому состоянию.

## 6. Автономный тест устройства

```bash
cd "$HOME/Neuro-Kurisu/app"
NK_DURATION_HOURS=24 node scripts/device-long-run.mjs
```

Для 72 и 168 часов поменяй число часов. Не считай эти прогоны заменой реального Android lifecycle validation: OEM battery management и Android background restrictions остаются фактором устройства.
