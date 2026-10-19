# NEURO-KURISU 34.47.0 — BIG PASS 76 FINAL REPORT

## Суть прохода
Сверхпроход продолжил 34.46.0 и объединил три линии работы: mobile performance, реальный avatar/Live2D surface и сохранение исторических материалов без возврата конфликтующего legacy runtime.

## 1. Mobile long-horizon
- `TemporalResolutionGovernor` для mobile использует default full-pulse cadence 8 циклов, но немедленно повышает разрешение на external input, высокий pressure/prediction error/goal pressure/uncertainty и resource events.
- Quality/balanced режимы не потеряли прежнюю частоту.
- Micro-cycle не создаёт фиктивного cognitive decision.
- `mobile-horizon-5000.mjs`: PASS; ratio=0.945, firstMedianMs=0.12, lastMedianMs=0.11, p95=28.69, memory=122, micro=4358, pulses=642.
- `long-horizon-operational-1000.mjs`: PASS; ratio=1.415, p95=49.15.

## 2. Live2D / avatar
- Сохранён оригинальный quality asset: 4096×4096 texture.
- Добавлен verified mobile asset variant: 2048×2048 texture.
- Mobile model reuse-ит canonical moc3/physics/cdi/expressions/motions через relative references; отдельной дублирующей копии этих файлов нет.
- Viewer поддерживает `?profile=mobile|balanced|quality|auto`.
- Dashboard и standalone avatar используют `profile=auto`.
- Добавлен pointer interaction: верхняя часть avatar → TapHead, нижняя → TapBody.
- Добавлены UI controls для проверки expressions и профиля качества.
- `/api/embodiment/status` сообщает quality/mobile asset budgets.

### Asset budget
- quality texture file: 8,236,235 bytes.
- mobile texture file: 1,601,788 bytes.
- raw RGBA texture memory estimate: 4096²≈64 MiB vs 2048²≈16 MiB before mipmaps/driver overhead.

## 3. Legacy
Legacy archive re-audit: all candidate runtime surfaces were classified as INTEGRATE/ADAPT/REFERENCE/EXCLUDE-RUNTIME.

Integrated/adapted:
- real Live2D model, texture, physics, CDI, expressions, motions;
- avatar interaction pattern;
- Memory Inspector;
- selected observability/Termux patterns.

Reference/excluded:
- old React UI runtime;
- old organism cores;
- duplicate memory engines;
- obsolete provider graphs and bootstraps.

No legacy code imports exist from canonical `src/` runtime.

## 4. Quality and anti-self-deception
- No consciousness claim was strengthened by architecture alone.
- Micro-cycle is explicitly distinguished from full cognition.
- Mobile performance improvement is achieved through scheduling and asset specialization, not by disabling canonical cognition.
- 5000-cycle test is now PASS for the current mobile operational benchmark; physical Android hardware qualification is still separate and incomplete.

## 5. Verification
PASS:
- typecheck
- source hygiene (0 warnings)
- architecture
- core ownership
- release contract
- integrity
- forensics
- legacy audit
- Live2D integrity
- UI smoke
- P14 UI/static embodiment
- P14 embodiment
- P17 multimodal agent
- P22 phone reliability
- P74/P77 integration
- Experience Continuum
- cold compression
- temporal resolution
- mobile 1000/2000/5000 horizons

Browser rendering note: headless Chromium in the validation environment did not reliably complete the external Cubism CDN initialization, so browser-rendered visual PASS is not claimed. Static references, HTTP delivery and application interaction paths are verified. The real target Android device remains the authoritative visual/runtime qualification environment.

## 6. Remaining limits
- Physical Android qualification is incomplete.
- Current Live2D viewer still depends on external runtime CDN files; a fully offline/vendored runtime remains a future hardening target.
- Semantic sensorium is partly engineered.
- Developmental self, social mind and self-generated motives remain incomplete.
- Consciousness remains an open research question; no current component proves phenomenal experience.

## 7. Next high-value pass
Prioritize Unified Sensorium + autobiographical identity lineage + cognitive immune system, while preserving the mobile temporal governor. In parallel, investigate optional local/offline Cubism runtime packaging and perform actual Poco/Termux 1h/6h/24h soak tests.
