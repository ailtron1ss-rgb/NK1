# B294 — повторная проверка аудита перед B295

Дата: 2026-09-13

## Почему документ был перепроверен

Предыдущий B294 master-аудит объявлял host mobile 1000-cycle gate PASS с p95 144.80 ms. При новом запуске тем же текущим harness на той же среде длинный gate стал нестабилен и отдельные повторы доходили до ~197 ms/timeout. Поэтому старый PASS нельзя переносить в новый выпуск как вечную истину.

## Исправленная политика evidence

Исторический B294 result сохраняется как historical observation. Для B295 статус длинного host mobile gate теперь: `UNRESOLVED_HOST_VARIABILITY`, пока одна и та же команда не даст воспроизводимый результат на чистом окружении и, отдельно, на целевом Android/Termux устройстве.

Это не означает, что B294 функционально сломан. Короткие mobile и operational horizons, typecheck, smoke, restart, concurrency, UI, server, Live2D и structural audits продолжают проходить.

## Результат

Старый документ не удаляется. Он остаётся историческим evidence snapshot. Этот recheck является более свежей правдой для release decisions B295+.
