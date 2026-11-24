# Neuro-Kurisu — Brain Branch Release Status 189

Статусный документ для BIG PASS 189. Не считает функцию готовой только потому, что она существует в source tree.

## Правило доказательства

Implemented != Integrated != Executed != Verified != Long-horizon verified != Real-device verified.

Функция получает `VERIFIED` только при наличии воспроизводимого поведения и соответствующего evidence. Для temporal/physical/research функций требуются дополнительные gates.

## Изменения этого release pass

- удалён найденный дубликат `BRAIN_BRANCH_ANALYSIS_BASELINE_COPY_RU.md`;
- добавлен воспроизводимый brain release runner `scripts/run-brain-reality-release.sh`;
- добавлены npm profiles `test:brain:core` и `test:reality:brain-release`;
- сохранены B182–B188 как последовательная центральная brain-ветвь;
- добавлена единая точка запуска для повторной проверки центрального мозга и выбранных legacy gates.

## Brain sequence

B182 — Brain Substrate
B183 — Central Brain
B184 — Central Brain Fusion
B185 — Hippocampal Central Brain
B186 — Predictive Self + Agency
B187 — Recurrent Global Workspace
B188 — Metacognitive Neural

## Следующий крупный технический этап

B189 не объявляет новые brain capabilities завершёнными. Его назначение — сделать certification reproducible и начать массовое сокращение `UNVERIFIED` функций без score inflation.

Следующий brain capability pass: predictive interoception/allostasis, затем neuromodulatory plasticity, active perception, autonomous scientific loop и long-horizon life.
