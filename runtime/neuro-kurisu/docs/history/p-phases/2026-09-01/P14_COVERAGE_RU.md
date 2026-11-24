# P14 — покрытие архитектурных требований

| Требование | Статус | Реализация |
|---|---|---|
| Event-driven perception | ✅ | `PerceptionEngine` |
| Temporal change detection | ✅ | sensor baseline + thresholds |
| Salience routing | ✅ | `PerceptionRouter` |
| Android body feedback | ✅ | `EmbodimentRuntime` |
| Battery/thermal/RAM/CPU | ✅ | `AndroidEmbodimentBridge` |
| Network change | ✅ | Wi-Fi capability + delta detection |
| On-demand camera | ✅ | `termux-camera-photo`, privacy-by-default |
| External event ingress | ✅ | `/api/organism/event` |
| Perception API | ✅ | `/api/organism/perception` |
| UI perception surface | ✅ | dashboard + camera control |
| Schema migration | ✅ | `16 -> 17` |
| Phone-safe capability probing | ✅ | 60s capability cache |
| Continuous cognitive integration | ✅ | perception → pressure/network/GWS/world/agency |

P14 соответствует документу в части embodiment/perception. Полноценное мультимодальное learned vision сознательно оставлено для следующего слоя: сначала нужны реальные sensor traces и безопасный mobile inference budget.
