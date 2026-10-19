from __future__ import annotations

"""Sustained Android/Termux benchmark with explicit measurement provenance."""
from pathlib import Path
from typing import Any, Callable, Dict
import gc
import os
import platform
import resource
import time
import json


class MobileRuntimeBenchmarkV2:
    VERSION = "1.15.0-mobile-v2"

    @staticmethod
    def _rss_mb() -> float:
        try:
            raw = float(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
            return raw / (1024 * 1024) if platform.system().lower() == "darwin" else raw / 1024.0
        except Exception:
            return -1.0

    @staticmethod
    def _battery_percent():
        for p in (Path("/sys/class/power_supply/battery/capacity"), Path("/sys/class/power_supply/BAT0/capacity")):
            try:
                return int(p.read_text().strip())
            except Exception:
                continue
        return None

    @staticmethod
    def _power_supply_metric(names):
        for name in names:
            p = Path(name)
            if not p.exists():
                continue
            try:
                return float(p.read_text().strip())
            except (OSError, ValueError, TypeError):
                continue
        return None

    @classmethod
    def _energy_snapshot(cls):
        return {
            "energy_now_uwh": cls._power_supply_metric(("/sys/class/power_supply/BAT0/energy_now", "/sys/class/power_supply/battery/energy_now")),
            "power_now_uw": cls._power_supply_metric(("/sys/class/power_supply/BAT0/power_now", "/sys/class/power_supply/battery/power_now")),
        }

    @staticmethod
    def _thermal_celsius():
        vals = []
        for p in Path("/sys/class/thermal").glob("thermal_zone*/temp"):
            try:
                vals.append(int(p.read_text().strip()) / 1000.0)
            except (OSError, ValueError, TypeError):
                continue
        return max(vals) if vals else None

    def run(self, fn: Callable[[], Any], *, warmup: int = 5, iterations: int = 50,
            backend: str = "python", precision: str = "fp32", cold_start: bool = False) -> Dict[str, Any]:
        for _ in range(max(0, int(warmup))):
            fn()
        gc.collect()
        before = {
            "rss_mb": self._rss_mb(),
            "battery_percent": self._battery_percent(),
            "thermal_c": self._thermal_celsius(),
            **self._energy_snapshot(),
        }
        samples = []
        for _ in range(max(1, int(iterations))):
            t = time.perf_counter()
            fn()
            samples.append((time.perf_counter() - t) * 1000.0)
        samples.sort()
        idx95 = min(len(samples) - 1, max(0, int(round(0.95 * (len(samples) - 1)))))
        idx99 = min(len(samples) - 1, max(0, int(round(0.99 * (len(samples) - 1)))))
        after = {
            "rss_mb": self._rss_mb(),
            "battery_percent": self._battery_percent(),
            "thermal_c": self._thermal_celsius(),
            **self._energy_snapshot(),
        }
        return {
            "version": self.VERSION,
            "measurement_class": "DEVICE_MEASURED" if ("ANDROID_ROOT" in os.environ or "TERMUX_VERSION" in os.environ) else "HOST_MEASURED",
            "device": platform.platform(),
            "machine": platform.machine(),
            "abi": os.environ.get("TARGET_ARCH") or os.environ.get("ANDROID_ABI"),
            "backend": backend,
            "precision": precision,
            "warmup": int(warmup),
            "iterations": int(iterations),
            "cold_start": bool(cold_start),
            "latency_ms": {
                "min": samples[0], "p50": samples[len(samples)//2], "p95": samples[idx95], "p99": samples[idx99], "max": samples[-1]
            },
            "before": before,
            "after": after,
            "delta_rss_mb": after["rss_mb"] - before["rss_mb"] if before["rss_mb"] >= 0 and after["rss_mb"] >= 0 else None,
        }

    def save(self, result: Dict[str, Any], name: str = "nomega_mobile_benchmark_v2.json") -> Path:
        path = Path(result.get("root", ".")) / "runtime" / name if result.get("root") else Path(name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        return path
