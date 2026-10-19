# Neuro-Kurisu — LEGACY REINTEGRATION REGISTER (34.43.0)

Цель документа — не потерять полезное из большого архива и одновременно не вернуть старую связанную архитектуру.

## Решение по категориям

| Категория | Решение | Причина |
|---|---|---|
| `public/live2d/Kurisu/*` | **ПЕРЕНЕСЕНО В CANONICAL** | Это реальные embodied-asset'ы пользовательского продукта: `.moc3`, texture, physics, expressions, motions. Их отсутствие лишало текущую ветку полноценного визуального аватара. |
| `public/live2d/viewer.html` | **ПЕРЕРАБОТАНО И ПЕРЕНЕСЕНО** | Старый viewer был рабочей точкой входа, но требует более безопасного origin-check и ограниченного FPS. Новый viewer оставляет fallback и снижает idle-стоимость. |
| `src/components/Live2DAvatar.tsx` | **REFERENCE ONLY** | Содержит полезную схему bridge/fallback/touch, но зависит от старой React/service архитектуры. Прямой импорт вернул бы legacy coupling. |
| `src/components/Avatar2D.tsx` | **REFERENCE ONLY** | Хорошие идеи adaptive FPS, micro-expression, gaze, lip-sync; прямое подключение дублировало нынешний public viewer и зависело от legacy services. |
| `MemoryInspector.tsx`, `BrainMonitorPanel.tsx` | **REFERENCE ONLY** | UI-представления полезны как идеи панели наблюдения, но legacy props/services больше не совпадают с canonical API. |
| Старые монолитные `NeuroComputationalCore`, `UnifiedNeuroOrganism`, `RecurrentNeuroCore`, `SpecialistSwarm` и похожие | **НЕ ПЕРЕНОСИТЬ В RUNTIME** | Исторические owner'ы. Возвращение создаёт дублирование canonical ownership и конфликт источников истины. |
| Старые `src/services/*` | **НЕ ПЕРЕНОСИТЬ В RUNTIME** | Многие были частью старого React/provider/LLM стека. Нужные идеи уже представлены canonical adapters/ports. |
| Старый `package.json`, Vite/React stack | **НЕ ПЕРЕНОСИТЬ** | Текущая phone/Termux ветка сознательно zero-runtime-dependency. Возврат крупных frontend dependencies ухудшает deployability и память телефона. |
| Старые install/bootstrap shell-скрипты | **НЕ ПЕРЕНОСИТЬ** | Версии и пути исторические; сохранять их исполняемыми означало бы риск запуска неактуальных сценариев. |
| Старые research/audit/change-log документы | **СОХРАНЕНО В HISTORY/REFERENCE** | Они нужны для эволюционной трассировки и предотвращения повторения уже исследованных направлений. Они не становятся runtime source. |
| Старые `public/self-study-manifest.json` и огромные archive manifests | **НЕ В RUNTIME** | Полезны как forensic history, но их объём и историческая структура не нужны организму во время работы. |

## Что конкретно перенесено

### Runtime assets
- `public/live2d/Kurisu/Kurisu.model3.json`
- `public/live2d/Kurisu/Kurisu.moc3`
- `public/live2d/Kurisu/Kurisu.4096/texture_00.png`
- `public/live2d/Kurisu/Kurisu.physics3.json`
- `public/live2d/Kurisu/Kurisu.cdi3.json`
- 7 expression assets
- 5 motion assets
- новый canonical `public/live2d/viewer.html`
- `public/live2d/PROVENANCE.json`

### Historical reference packet
Сохранены отдельные reference-файлы UI и ключевые исследовательские/Termux документы в `docs/history/reintegrated-legacy/`. Они не импортируются canonical TypeScript-кодом.

## Что намеренно НЕ переносилось

Не переносилась вся директория `legacy-original/`: она содержит 1348 legacy-only файлов в большом архиве. Большая часть — старые исходники/скрипты/история; runtime-перенос такого объёма не дал бы качества и создал бы второй организм рядом с новым.

Особенно не возвращаются старые параллельные ownership-графы памяти, cognition, personality, server и UI.

## Почему размер архива снова увеличится

Реальная Live2D-модель сама по себе тяжёлая: главная texture занимает несколько мегабайт, а `.moc3` — ещё несколько. Это ожидаемый рост размера и является **функционально оправданным**, в отличие от возврата всего legacy source tree.

## Инвариант

`src/organism` остаётся единственным canonical cognitive runtime. Исторические материалы не должны импортироваться в него. UI разговаривает с организмом через HTTP API; Live2D является embodiment renderer, а не cognitive owner.
