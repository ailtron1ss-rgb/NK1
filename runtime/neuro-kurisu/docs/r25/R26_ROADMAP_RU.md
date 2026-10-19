# R26 Roadmap

1. Матched benchmark hierarchical planner vs flat beam planner на идентичном held-out environment.
2. Отдельный downstream-retention benchmark для erase/write gating: измерять не только local weight drift, а последующую полезность воспоминания.
3. Расширить curvature-aware operator до diagonal+low-rank экспериментальной ветки и сравнить с текущей diagonal версией.
4. Добавить query-derived erase experiment как отдельную ablation lane; не помещать в canonical path до matched gain.
5. 3000+ cycle endurance на реальном Android/Termux устройстве.
6. Пересмотреть recurrent substrate только после положительного matched benchmark; отрицательный R24 результат остаётся promotion gate.
7. Повысить static semantic evidence coverage без автоматического присвоения VERIFIED.
