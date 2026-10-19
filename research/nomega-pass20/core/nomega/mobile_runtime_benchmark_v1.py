from __future__ import annotations

"""Device-side benchmark harness for Termux/Android or desktop.

The harness measures the process that actually runs the workload. It never
converts desktop numbers into fake phone claims; Android reports are marked as
DEVICE_MEASURED only when executed on-device.
"""

from pathlib import Path
from statistics import median
from typing import Callable, Dict, Sequence, Any
import gc, os, platform, resource, time, json

class MobileRuntimeBenchmarkV1:
    VERSION='1.9.9'
    def __init__(self, root: Path):
        self.root=Path(root)

    @staticmethod
    def _rss_mb()->float:
        try:
            usage=resource.getrusage(resource.RUSAGE_SELF)
            # Linux reports KiB; macOS reports bytes. Termux/Linux is the target.
            raw=float(usage.ru_maxrss)
            if platform.system().lower()=='darwin': return raw/(1024*1024)
            return raw/1024.0
        except Exception:
            return -1.0

    def run(self, fn: Callable[[], Any], *, warmup:int=2, iterations:int=8)->Dict[str,Any]:
        for _ in range(max(0,int(warmup))): fn()
        gc.collect()
        samples=[]; rss0=self._rss_mb()
        for _ in range(max(1,int(iterations))):
            t=time.perf_counter(); fn(); samples.append((time.perf_counter()-t)*1000.0)
        samples.sort()
        p50=samples[len(samples)//2]; p95=samples[min(len(samples)-1,max(0,int(round(0.95*(len(samples)-1)))))]
        return {
            'version':self.VERSION,
            'measurement_class':'DEVICE_MEASURED' if 'ANDROID_ROOT' in os.environ or 'TERMUX_VERSION' in os.environ else 'HOST_MEASURED',
            'platform':platform.platform(),
            'python':platform.python_version(),
            'iterations':len(samples),
            'latency_ms':{'p50':p50,'p95':p95,'min':samples[0],'max':samples[-1]},
            'rss_mb_after':self._rss_mb(),
            'rss_mb_before':rss0,
            'delta_rss_mb':self._rss_mb()-rss0,
        }

    def save(self, result:Dict[str,Any], name:str='nomega_mobile_benchmark_v1.json')->Path:
        path=self.root/'runtime'/name; path.parent.mkdir(parents=True,exist_ok=True); path.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8'); return path
