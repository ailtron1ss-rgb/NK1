# Release 35.6.3

## Neural Residency & Real-Life Benchmark

Крупный апдейт нейронно-когнитивной ветви.

### Добавлено
- B349 late neural residency.
- persistent residency diagnostics.
- backward-compatible normalization новых B349 полей.
- B350 long-horizon mobile benchmark.
- реальный performance evidence в документации.

### Проверено
- B349 standalone PASS.
- B349 Core integration PASS.
- B350 20-cycle mobile PASS.
- snapshot/restore PASS.
- integrity PASS.

### Честные ограничения
120-cycle mobile holdout не пройден в контрольном окне.
В 8-cycle mobile benchmark B349 learningUpdates=0 из-за cadence, поэтому этот тест не используется как доказательство long-horizon neural learning.
