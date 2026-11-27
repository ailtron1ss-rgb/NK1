# NeuroCore — установка и первый запуск в Termux на POCO M7 Pro 5G

**Целевая среда:** Android / Termux, ARM64, телефон среднего класса.  
**Ветка:** `neurocore-unified/main`.  
**Toolchain проекта:** Node.js 24.x, npm ≥ 10.8, Python 3.11.x. Точные требования закреплены в `.nvmrc` и `.python-version`.

> **Статус на 27.11.2026:** это инструкция для отдельного checkout продуктовой ветки. Она не является доказательством успешной установки на устройстве: Android/Termux acceptance ещё не пройден. Не удаляй и не переименовывай существующие папки NK1/NKOne. Установка ниже создаёт отдельный каталог `~/NK1-NEUROCORE`.

## 1. Установить базовые пакеты

Открой Termux и выполни:

```bash
pkg update -y && pkg upgrade -y
pkg install git curl python nodejs-lts -y
```

Проверь версии:

```bash
node -v
npm -v
python3 --version
```

Требуется:
- Node.js **24.x** (не Node 22/26);
- npm **10.8.0 или новее**;
- Python **3.11.x**.

Node pin: `24` в `.nvmrc`. Python pin: `3.11` в `.python-version`. Если установленная версия не совпадает, **не продолжай установку**: сначала переключи Node через свой NVM на 24.x и установи отдельный Python 3.11. Скрипты старта намеренно откажутся запускать другой toolchain. Наличие пакета `nodejs-lts` само по себе не гарантирует нужную major-версию.

## 2. Получить отдельную копию проекта

```bash
cd "$HOME"
git clone --branch neurocore-unified/main --single-branch https://github.com/ailtron1ss-rgb/NK1.git NK1-NEUROCORE
cd "$HOME/NK1-NEUROCORE"
git status --short
git branch --show-current
```

Последняя команда должна показать `neurocore-unified/main`. Это отдельная продуктовая ветка; не клонируй её поверх своего рабочего дерева NK1.

## 3. Установить зависимости

```bash
npm run install:all
npm run doctor
```

`install:all` устанавливает lockfile-зависимости для двух рабочих областей: `app` и `runtime/neuro-kurisu`. Не удаляй lock-файлы и не запускай `npm install` отдельно в случайных подпапках.

Если установка падает на native binary / compiler / unsupported platform, сохрани последние 100 строк ошибки. Не обходи ошибку установкой случайных версий пакетов: Termux пока не входит в подтверждённые CI-платформы.

## 4. Запустить интегрированное приложение в режиме разработки

Сначала используй dev-режим, не production quickstart:

```bash
cd "$HOME/NK1-NEUROCORE"
npm run dev
```

Запуск поднимает три сервиса:
- интерфейс: `http://127.0.0.1:8080/`;
- когнитивное runtime: `http://127.0.0.1:3310/health`;
- research bridge: `http://127.0.0.1:8765/health`.

Открой на том же телефоне:

```text
http://127.0.0.1:8080/
```

Для проверки в другой вкладке Termux (пока первая сессия работает):

```bash
curl -fsS http://127.0.0.1:3310/health
curl -fsS http://127.0.0.1:8765/health
```

Остановка всех трёх процессов: `Ctrl+C` в сессии запуска. Dev-сервер использует loopback для runtime/research APIs; не выставляй эти порты в публичную сеть.

## 5. Production quickstart — только после прохождения CI

Когда exact-head CI и локальный smoke на устройстве будут PASS, можно использовать:

```bash
npm run quickstart
```

Он проверяет pinned toolchain, при необходимости устанавливает зависимости, собирает production UI, запускает doctor и затем поднимает gateway. Это тяжелее dev-режима и на телефоне может потребовать больше RAM и времени. В текущем состоянии проекта не используй его как замену проверке `npm run dev`.

## 6. Если что-то сломалось

Собери диагностический вывод:

```bash
node -v
npm -v
python3 --version
git status --short
git rev-parse HEAD
npm run doctor
```

Для отчёта приложи полный текст первой ошибки и последние 100 строк вывода установки/запуска. Не отправляй содержимое `.env`, ключи, токены или личные данные из `.super-state`.

## 7. Текущие ограничения

- CI на GitHub не заменяет запуск на Android: реальный Termux ещё не проверен.
- Нет подтверждённых замеров RAM, нагрева, расхода батареи и длительной работы на POCO.
- Локальная LLM не запускается автоматически; провайдер подключается отдельно к loopback llama.cpp после проверки конфигурации.
- Не считать 3D-тело, voice, модельный inference или автономное поведение принятыми на телефоне, пока они не проверены на устройстве.
