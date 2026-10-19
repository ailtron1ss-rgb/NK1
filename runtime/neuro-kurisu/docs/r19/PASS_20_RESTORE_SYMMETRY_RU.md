# PASS20 — Restore Symmetry Gate

PASS20 закрепляет отдельный release-gate для проверки непрерывности persistence.

Проверяемый поток:

`live organism -> durable checkpoint -> new OrganismCore -> restore -> next cycle`

Regression охватывает 23 критических P48/P49/P51/P52/P53/P54/P55/P56/P58/P61/P63/P64/P67/P68/P71/P74/P76/P77/P78/P80/P81/P82/P84 state markers.

Также удалён второй дублирующий snapshot P84 в `PersistenceProjectionCoordinator`.

Результат: `PASS20_PERSISTENCE_RESTORE=PASS`, `tick=2->3`.
