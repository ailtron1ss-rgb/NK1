# Project Problem Register — актуальная версия

## Решённые классы проблем

- version drift: canonical VERSION.json + package version;
- legacy leakage: canonical import graph не зависит от legacy/research;
- duplicate coordinators: legacy изолирован;
- fake autonomy metrics: causal lab и matched lesions;
- state corruption: atomic store + backup + migration;
- concurrent writes: single writer queue + process lock;
- fake local language: Gemini → KoboldCpp → deterministic fallback;
- device uncertainty: explicit Device Gate/preflight;
- runtime dependency drift: zero npm runtime dependencies + real lockfile;
- self-model/workspace/intrinsic/value components now have lesion paths;
- identity continuity anchors persist through restart;
- research evidence is separated from consciousness claims.

## Оставшиеся внешние риски

1. Реальный Android/Termux soak 24–168h.
2. Конкретный KoboldCpp/GGUF memory/thermal profile.
3. Longitudinal tests на неделях/месяцах.
4. Повторяемость causal lab на большем числе seeds и environments.
5. Научная неопределённость: никакая текущая метрика не доказывает субъективный опыт.
