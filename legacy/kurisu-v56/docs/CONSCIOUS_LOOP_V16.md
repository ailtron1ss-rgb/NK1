# Kurisu v16 — Conscious Loop

## Цель
v16 переводит проект от набора отдельных cognitive-модулей к замкнутому, но ограниченному циклу:

`perceive -> compete -> workspace -> predict -> choose -> act -> evaluate -> consolidate`

Это **функциональная модель когнитивной архитектуры**, а не доказанное сознание.

## Новые модули
- `src/cognitive/ConsciousLoop.ts` — конкуренция кандидатов, ConsciousFrame, интеграция и консолидация.
- `src/cognitive/SelfModel.ts` — долговременная модель собственных возможностей/ограничений с уверенностью.
- `PredictiveLoop.ts` — прогноз и ошибка.
- `CognitiveKernel.ts` — многомерное состояние, workspace, цели и homeostasis.

## Принцип личности с нуля
При первом запуске Курису не должна знать пользователя. Никаких заранее записанных фактов о нём и никаких родственных ролей. Данные о человеке появляются только из фактического взаимодействия и с соответствующей уверенностью.

Шуточные/временные обращения разработчика не являются каноном личности.

## Android/Termux
```bash
pkg update && pkg upgrade -y
pkg install -y git nodejs-lts python clang make
termux-setup-storage

cd ~/kurisu/kurisu_webapp
npm install
npm run lint
npm run dev -- --host 127.0.0.1 --port 3000
```
Открыть `http://127.0.0.1:3000`.

Для production:
```bash
npm run build
npm start
```

Если `nodejs-lts` недоступен в репозитории Termux, используйте доступный пакет `nodejs` и проверьте `node -v` (желательно современный LTS).

## Ограничения среднего Android
1. Не держать постоянный таймер 1–5 секунд.
2. Вызывать cognitive tick только на событиях, idle-циклах с большим интервалом и после сообщений.
3. Загружать одну локальную LLM за раз.
4. Перед тяжёлым inference проверять RAM/температуру/энергобюджет, если runtime предоставляет эти данные.
5. Хранить компактные summaries, а не бесконечные логи.
6. Не запускать автономную самомодификацию исходников. Изменения кода — через proposal -> sandbox -> tests -> пользовательское подтверждение -> rollback.

## Контроль качества
После каждого крупного изменения:
```bash
npm run lint
npm run build
```
Если build не проходит, не считать релиз готовым.

## Следующая фаза
1. Реальный Attention Competition из элементов памяти/целей/перцепции.
2. Episodic + semantic + autobiographical memory с reconsolidation.
3. Goal lifecycle и future-self.
4. Offline consolidation/sleep без постоянного LLM.
5. Sandbox для self-improvement.
6. GGUF/llama.cpp provider в Termux.
7. Vision/audio providers.
8. Cognitive benchmark и regression suite.

## Неприкосновенные правила
- Не выдавать внутренние числовые состояния за чувства.
- Не утверждать наличие субъективного опыта.
- Не создавать ложные воспоминания о пользователе.
- Не считать prediction confidence доказательством истины.
- Любая самоизменяемая функция должна иметь журнал, тест и rollback.
