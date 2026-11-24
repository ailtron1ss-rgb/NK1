#!/usr/bin/env python3
"""Reproducible Android/Termux benchmark runner for NΩ 1.15.

The script separates host measurements from real-device measurements and records
backend/precision, sustained latency percentiles, RSS, thermal and available
battery/power telemetry. Missing device telemetry is recorded as null rather than
fabricated.
"""
from __future__ import annotations

from pathlib import Path
import json
import os
import platform
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from core.nomega.runtime import NOmegaRuntime
from core.nomega.config import NOMEGAConfig
from core.nomega.mobile_runtime_benchmark_v2 import MobileRuntimeBenchmarkV2


def _run_text(cmd):
    try:
        p = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, timeout=5, check=False)
        if p.returncode == 0:
            return p.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return None
    return None


def _termux_battery():
    raw = _run_text(["termux-battery-status"])
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def _cold_import_samples(n=5):
    out=[]
    for _ in range(max(1, int(n))):
        t=time.perf_counter()
        subprocess.run([sys.executable, '-c', 'import core.nomega'], cwd=ROOT, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        out.append((time.perf_counter()-t)*1000.0)
    return out


def main() -> int:
    env = os.environ
    measurement_class = 'DEVICE_MEASURED' if ('ANDROID_ROOT' in env or 'TERMUX_VERSION' in env) else 'HOST_MEASURED'
    rt = NOmegaRuntime(ROOT, NOMEGAConfig.mobile())
    bench = MobileRuntimeBenchmarkV2()
    sustained = bench.run(
        lambda: rt.infer('add the first three values'),
        warmup=5,
        iterations=50,
        backend='nomega-python',
        precision='fp32',
        cold_start=False,
    )
    cold = _cold_import_samples(5)
    cold_sorted = sorted(cold)
    result = {
        'version': '1.15.0-mobile-v2',
        'measurement_class': measurement_class,
        'platform': platform.platform(),
        'machine': platform.machine(),
        'python': platform.python_version(),
        'termux_detected': 'TERMUX_VERSION' in env,
        'android_detected': 'ANDROID_ROOT' in env,
        'android_release': env.get('ANDROID_VERSION'),
        'target_arch': env.get('TARGET_ARCH') or env.get('ANDROID_ABI'),
        'device_model': _run_text(['getprop', 'ro.product.model']) if measurement_class == 'DEVICE_MEASURED' else None,
        'soc': _run_text(['getprop', 'ro.soc.manufacturer']) if measurement_class == 'DEVICE_MEASURED' else None,
        'cold_start_ms': {'samples': cold, 'p50': cold_sorted[len(cold_sorted)//2], 'p95': cold_sorted[min(len(cold_sorted)-1, int(round(.95*(len(cold_sorted)-1))))]},
        'sustained': sustained,
        'termux_battery': _termux_battery() if measurement_class == 'DEVICE_MEASURED' else None,
        'runtime_profile': rt.profile(),
        'note': 'Only DEVICE_MEASURED results from an Android/Termux run are valid as phone-performance claims.'
    }
    out = ROOT/'runtime'/'nomega_termux_benchmark_v2.json'
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
