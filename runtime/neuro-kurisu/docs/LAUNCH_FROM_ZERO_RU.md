# Neuro-Kurisu Evolution 6.1.0 — запуск с нуля в Termux

## 1. Termux
Установите Termux и Termux:API из одного источника подписи.

```bash
pkg update -y && pkg upgrade -y
pkg install nodejs-lts npm unzip git curl coreutils bash -y
node --version
npm --version
termux-setup-storage
pkg install termux-api -y
```

Проверьте мосты:

```bash
command -v termux-battery-status
command -v termux-sensor
command -v termux-tts-speak
command -v termux-speech-to-text
command -v termux-wifi-connectioninfo
```

## 2. Проект
Поместите ZIP в `Internal storage/Download/`, затем:

```bash
mkdir -p ~/Neuro-Kurisu
cd ~/Neuro-Kurisu
ls -lh ~/storage/downloads
cp ~/storage/downloads/Neuro_Kurisu_Evolution_6.1.0_P15_LIFELONG_FINAL_2026-08-27.zip ./
unzip -q Neuro_Kurisu_Evolution_6.1.0_P15_LIFELONG_FINAL_2026-08-27.zip -d app
cd app
```

## 3. Чистая установка и проверки

```bash
npm ci
npm run doctor
npm run audit:syntax
npm run audit:forensics
npm run audit:architecture
npm run audit:contract
npm run test:identity-lock
npm run test:concurrency
npm run test:memory
npm run test:replay
npm run test:p15
npm run test:p15:migration
npm run release:audit
```

## 4. Запуск

```bash
npm start
```

Откройте `http://127.0.0.1:3000`.

Проверки API:

```bash
curl -s http://127.0.0.1:3000/api/health
curl -s http://127.0.0.1:3000/api/metrics
curl -s http://127.0.0.1:3000/api/organism/inspect
```

2D viewer:

`http://127.0.0.1:3000/avatar.html`

## 5. Долгий режим

Остановите обычный сервер через `Ctrl+C`, затем:

```bash
bash scripts/termux/supervisor.sh
```

## 6. Полный исследовательский пакет

```bash
npm run research:all
```

Не запускайте постоянный research loop на телефоне без необходимости: research использует больше CPU/диска, чем обычный organism loop.
