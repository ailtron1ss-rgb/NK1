# B307 Architecture Decisions
Дата: 13.09.2026

## Решение 1
Не создавать новый B307 learner. Расширять AdaptivePolicyEngine.

Причина: существующий policy engine уже является canonical decision learner; второй policy store создал бы дублирование.

## Решение 2
Разделить обычное value learning и trusted verified closure.

Причина: world/external confirmed outcomes должны иметь отдельный evidence channel.

## Решение 3
Сохранить schema 127.

Причина: поля additive и могут быть backward-compatible нормализованы на чтении.

## Решение 4
Проверять не только счётчик verified updates, но и реальный bias shift.

Причина: наличие ledger само по себе не доказывает влияние на future policy.
