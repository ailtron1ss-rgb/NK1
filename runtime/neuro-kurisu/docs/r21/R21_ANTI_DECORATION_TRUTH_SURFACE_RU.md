# Neuro-Kurisu 35.35.0 / R21 — Anti-Decoration & Truth-Surface Closure

## Что исправлено

1. Полностью удалён misleading `NoopOperationalJournal`. Runtime и тесты используют `BoundedOperationalJournal` напрямую.
2. Capability registry теперь различает `implemented`, `runtime-available`, `device-verified`, `simulation-only`, `unavailable`, `experimental` и хранит evidence/owner.
3. Simulation capabilities больше явно не выглядят как внешняя реальность: `world.simulation` маркируется `simulation-only`.
4. `RealityShadowBridge` получил явные `lane` и `promotionEligible`; predictive sandbox не может ошибочно считаться grounded-world promotion source.
5. Добавлены P2901 truth-surface checks и статический anti-decoration audit.

## Проверка

- typecheck PASS
- P2901 runtime claim truth PASS
- P2901 static anti-decoration PASS
- P2868 mobile semantic equivalence PASS
- P2875 host-pressure isolation PASS
- P2876 mobile diagnostic hotpath PASS
- P2870 verified synthetic trajectory gate PASS
- P2887–P2894 PASS
- architecture/hygiene/forensics/syntax/contract/release-source PASS

## Что НЕ объявляется production-grounded

Simulation, counterfactuals, shadow worlds и research experiments остаются полезными вычислительными механизмами, но не получают автоматически external/device evidence и не должны использоваться как доказательство реального внешнего события.
