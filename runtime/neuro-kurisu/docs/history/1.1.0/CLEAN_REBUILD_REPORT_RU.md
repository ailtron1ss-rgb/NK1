# Neuro-Kurisu Clean Rebuild 1.1 — полный отчёт

Дата: 2026-08-25

## 1. Решение
Проект пересобран с нуля поверх P3 как clean-room architecture. Старый проект не удалён: полный snapshot из 1350 файлов сохранён в `legacy-original/`, но canonical runtime его не импортирует.

## 2. Старый baseline
- Snapshot: 1350 файлов.
- Reachable surface от server/UI entrypoints: 457 файлов.
- Root `package.json`: 440+ verify/alias scripts.
- Multiple `brain`, `cognitive`, `neurocore`, `architecture`, `synergy` layers.
- Нет `package-lock.json`.

Эта сложность была основным источником drift: исторические версии, duplicate abstractions, stale tests и разные runtime paths могли расходиться.

## 3. Новый canonical project
Canonical tree:

```text
src/
  organism/
    core/
    world/
    cognition/
    memory/
    body/
    language/
    persistence/
  server/
public/
scripts/
tests/
research/
legacy-original/
```

### Runtime responsibility
Только `OrganismRuntime` выполняет переход состояния. Он последовательно связывает тело, мир, homeostasis, goals, prediction, decision, workspace, memory, feedback и persistence.

### LLM responsibility
LLM не выбирает действие и не является source of will. `LanguageOrgan` получает cognitive cycle и selected action и превращает его в язык. Backend выбирается отдельно через `fetch`: KoboldCpp или Gemini.

### Android responsibility
`AndroidEmbodimentBridge` является адаптером. При отсутствии Termux:API система не притворяется, что датчики доступны: она явно деградирует к host/simulated telemetry.

## 4. Package-lock — проблема решена
Первоначальная идея создать fake registry/подделать lockfile была отклонена как небезопасная.

Вместо этого dependency surface был сокращён до нуля. Новый server использует Node stdlib, UI — vanilla browser APIs, LLM — native `fetch`. Поэтому `npm install --package-lock-only --offline` смог создать настоящий lockfile v3 без registry. Затем `npm ci --offline` прошёл и не создал `node_modules`.

npm документирует, что `npm ci` требует существующий lockfile и устанавливает именно зафиксированное dependency tree; lockfile предназначен для воспроизводимости. См. официальную документацию npm.

## 5. Проверки
- `package-lock`: valid v3, zero external packages.
- canonical source import audit: 0 missing imports.
- runtime dependency: 0 npm packages.
- architecture: 0 canonical → legacy leaks, 0 runtime import cycles.
- smoke: PASS.
- autonomy: PASS.
- restart persistence: PASS.
- server health: PASS.
- server chat decision path: PASS.
- syntax audit: PASS for canonical TS/MJS surface.

## 6. Что не является solved автоматически
Device Gate остаётся отдельной реальной проверкой. Контейнер не может подтвердить физический Android thermal/battery/process-reclaim behaviour и локальный KoboldCpp/GGUF runtime. Это не дефект clean architecture, но обязательный deployment gate.

## 7. Что делать дальше
1. На телефоне один раз выполнить `npm ci` и `npm run release:audit`.
2. Подключить Termux:API и KoboldCpp/local GGUF.
3. Выполнить 24h → 72h → 168h soak.
4. Сохранять event log, prediction errors, goal evolution, self-model accuracy и state integrity.
5. Только после устойчивого Device Gate возвращаться к consciousness research.

## 8. Следующий научный этап
После стабильного deployment следующая цель — не новые coordinator modules, а controlled experiments: value evolution, intrinsic experiment generation, self-model lesion, workspace lesion, world-model lesion, longitudinal identity and causal evidence.
