# Курису v9.0 — Sprite Live + Brain

## Спрайты
32 кадра из твоих 4 листов (сетка 2×4: 1357/2468) в:
`public/sprites/sheet_*/`

Эмоции чата → `spriteEngine.resolveSpritePath` → нужный PNG.

## Запуск
```bash
cd /sdcard/kurisu_v9/kurisu_webapp
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1 --port 3000
```

Вкладка **Мозг** — monitor. Одежда — авто/ручная. Поиск — с разрешением.

Архитектура: не «одна нейросеть», а отделы (intent, memory, route, critique, embodiment, tools) + LLM как речевой кору.
