# NeuroCore

Основной репозиторий проекта NeuroCore. Репозиторий хранит release-процессы и отчёты; полное дерево исходников текущей рабочей базы доступно в ветке `workpass70-source`.

## Стратегический план

- [NK1 — Финальный мастер-план: 10 жизненно важных этапов к работающей цифровой личности](docs/MASTER_PLAN_NK1_RU.md)

## Актуальная сборка

- **Последний проверенный hotfix:** WorkPass70 Hotfix 1, 19 октября 2026.
- [Полный исходный архив в GitHub Releases](https://github.com/ailtron1ss-rgb/NK1/releases/tag/workpass70-hotfix1-2026-10-19)
- [Полное дерево исходников](https://github.com/ailtron1ss-rgb/NK1/tree/workpass70-source)
- [Отчёт WorkPass70 Hotfix 1](https://github.com/ailtron1ss-rgb/NK1/blob/workpass70-source/WORKPASS70_HOTFIX_1_REPORT_RU.md)
- [WorkPass71 validation run](https://github.com/ailtron1ss-rgb/NK1/actions/runs/39270770457)

SHA-256 полного архива:

```text
9effadfcf0d402b462dd9cf2fd5b5793742039c9260db80578be830952bf52eb  Neuro_Kurisu_WORKPASS70_HOTFIX1_2026-10-19.zip
```

## Исправления hotfix

- Графемная сегментация viseme timeline с сохранением UTF-16 offsets браузерного SpeechSynthesis.
- Корректная обработка combining marks, флагов, ZWJ emoji и последовательностей CR/LF/tab.
- Исправлена ошибка приоритета операторов в continuum-memory timescale score.
- Исправлены блокирующие ошибки UI typecheck и восстановлена успешная development-сборка приложения.

## Проверки

- Speech timeline: 11/11.
- App script regression suite: 229/229.
- App TypeScript check: PASS.
- App Vite development build: PASS.
- Runtime TypeScript check: PASS.
- Continuum timescale regression, speech interrupt gateway, Termux TTS concurrency, receipt reconciliation и organism smoke: PASS.

## Незакрытые release gates

Эта сборка — **implementation hotfix, не production-approved**. Не подтверждены production build вместе с миграцией БД, настоящий browser/Live2D E2E, синхронизация реального Android/Termux audio, независимый multi-seed retrieval uplift (текущий benchmark всё ещё показывает `recallDelta=0`), длительный soak и полный license review. Никаких выводов о субъективном сознании или общей интеллектуальной эффективности из этих тестов не делается.

## Следующий этап

Следующий крупный проход должен сосредоточиться на независимой оценке retrieval/learning: paired seeds, неизменяемый holdout, task success, regret, calibration, forgetting, catastrophic failures и ресурсная стоимость. Ничего не продвигать автоматически без устойчивого улучшения на независимом наборе.
