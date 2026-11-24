# NEURO-KURISU B377 RECHECK — 2026-09-15

## Статус
CURRENT / B377

## Главная capability
Автономная арбитрация между уже известными internal goals по прогрессу, застою, стоимости ресурсов, конфликту и ownership.

## Доказательство
- две internal goals одновременно сохранены;
- current goal деградирует и переходит в paused;
- B365 самостоятельно выбирает альтернативную known goal без повторного goalAuthorship input;
- `totalSwitches >= 1`;
- OFF ecology: `totalSwitches = 0`;
- verified-only lifecycle; unverified outcome не создаёт switch/completion/successor;
- restart exact equality;
- 1000-cycle performance PASS.

## B365 ownership
B365 остаётся единственным canonical neural decision owner. Новый код расширяет `goalEcology`, не создаёт параллельный policy owner.

## Ограничения
Физический Android/Termux в текущем runner не сертифицирован. Functional/phenomenal consciousness не заявляется.
