# Neuro-Kurisu v4.1 — запуск в Termux

## 1. Подготовка
```bash
pkg update && pkg upgrade
pkg install nodejs-lts git unzip
node -v
npm -v
```
Требуется Node.js 20+.

## 2. Установка
```bash
cd ~/kurisu_neuro_v40/kurisu_webapp
npm install
```
В проекте **нет `onnxruntime-node`**: локальная нейросеть работает через браузерный Transformers.js и WASM/WebGPU, поэтому старая ошибка `EBADPLATFORM` на Android не должна возникать.

## 3. Проверка
```bash
npm run lint
npm run build
```

## 4. Запуск
```bash
npm run dev
```
Открой адрес, который напечатает Vite/Express (обычно `http://127.0.0.1:3000`).

## 5. Профили
- `performance` — 30 FPS, локальная модель разрешена.
- `balanced` — 25 FPS, тяжёлые фоновые операции ограничены.
- `powersave` — 15 FPS, фоновые операции отключены.

## Важно про локальную модель
Не пытайтесь устанавливать `onnxruntime-node` в Termux: npm правильно считает его неподдерживаемым для Android. В этой версии native Node ONNX не нужен.

## Самоулучшение
Курису может анализировать разрешённый набор исходников и предлагать изменения. Перед изменением исходников создаётся backup. Автоматическое выполнение произвольного кода намеренно запрещено.
