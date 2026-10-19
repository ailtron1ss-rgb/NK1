# P2705 — крупный апгрейд

## Код

### 1. Нейронный substrate
- NeuralExperienceBranch поднят до state version 16.
- Добавлен EMA активности каждого нейрона.
- Добавлено bounded eligibility для recurrent и delay traces.
- Добавлен homeostatic synaptic scaling с малой амплитудой, сохраняющий относительную структуру обученных весов.
- Добавлена диагностика firing regime.
- Replay теперь сочетает priority и временное разнообразие.

### 2. Runtime / mobile
- В mobile-профиле consolidation cadence теперь адаптируется к V8 heap pressure: 48 циклов при нормальном давлении, 80 при повышенном, 128 при высоком.
- Добавлены mobileMaintenance diagnostics.
- Explicit/forced durable checkpoints не отключены.

## Проверки

- `npx tsc -p tsconfig.clean.json --noEmit` — PASS.
- `test:p2702:personality` — PASS.
- `test:p2703:global-workspace` — PASS.
- `test:p2705:neural-homeostasis` — PASS.
- `test:restart` — PASS.
- `test:smoke:mobile256` — PASS при расширенном лимите выполнения.
- Длинный `test:autonomy` остаётся незакрытой проблемой: наблюдается рост heap/замедление на десятках циклов. P2705 добавляет adaptive maintenance governor, но это не следует выдавать за полное решение.

## Что осталось

1. Довести long-horizon runtime до стабильного 80/200/500-cycle soak.
2. Перейти от эвристического eligibility к отдельному экспериментальному linear-memory online-credit branch, сравниваемому с текущим правилом.
3. Добавить факторные абляции P2705: no-homeostasis / no-bounded-eligibility / no-diverse-replay / all-on.
4. Уменьшить количество полных snapshot/structuredClone на mobile.
5. Поднять semantic function verification выше текущего низкого уровня.
