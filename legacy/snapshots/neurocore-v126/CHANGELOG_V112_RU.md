# CHANGELOG V112

- Найдена и исправлена реальная ошибка trainability preconditioner: normalized-key energy делала `rsqrt` равным ~2.828 при rank=8, после чего ceiling clamp=2.0 обнулял градиент `preconditioner_log_gain`.
- Preconditioner теперь нормируется относительно естественной энергии `1/rank`; при baseline gain=1 стартовая effective gain около 1, а learned gain получает ненулевой gradient.
- Добавлен dedicated learnability benchmark и invariant test.
- ABI 12 trunk / ABI 10 outer core; structure compatibility; schema 23, neural version 112.
- Остальные V111 changes сохранены: single-owner confidence, runtime/sequence parity, peer-consensus candidate.
