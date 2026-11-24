# P2702 Open-Source / Experimental Scan — 2026-09-19

## Найдено
1. **BindsNET/bindsnet** — SNN simulation in PyTorch; repository metadata shows activity through 2026-09-16. Полезно как reference для STDP/synapse/simulation, но Python/PyTorch stack не подходит как прямой мобильный runtime dependency.
2. **giansha/Global-Workspace-Agents** — создан в 2026, multi-agent architecture inspired by Global Workspace Theory. Полезно для следующего P2703 как архитектурный эксперимент, но не доказательство сознания.
3. **infer-actively/pymdp** — Active Inference for MDP; repository metadata shows updates on 2026-09-19. Полезно для будущего bounded active-inference controller, но прямой Python import противоречит текущему zero-runtime-dependency/mobile профилю.
4. **spikingjelly / snnTorch / Norse** — зрелые SNN ecosystems; полезны для сравнительных экспериментов и формул, но копирование целых frameworks создаст дублирование P2701.

## Решение
В P2702 перенесён не внешний framework, а компактный механизм persistent personality dynamics: protected invariants + plastic adaptive traits + values + self uncertainty + relationship trust + contradiction + continuity + outcome-driven adaptation.

Следующий экспериментальный кандидат: P2703 bounded global workspace, где personality state станет одним из competing broadcast sources наряду с perception, memory, world model, goals и action candidates.
