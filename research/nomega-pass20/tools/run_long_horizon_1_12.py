from __future__ import annotations
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from core.nomega.long_horizon_development_benchmark_v1 import LongHorizonDevelopmentBenchmarkV1


def main():
    repo=Path(__file__).resolve().parents[1]
    with TemporaryDirectory(prefix='nomega_long_horizon_1_12_') as td:
        root=Path(td)
        b=LongHorizonDevelopmentBenchmarkV1(root,seed=12061,hidden=8)
        out=b.run_compact(cycles=2,initial_epochs=1,guided_epochs=1,max_examples=2)
    out['status']='research-only'
    path=repo/'runtime'/'long_horizon_1_12_compact.json'; path.write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8'); print(json.dumps(out,indent=2))

if __name__=='__main__': main()
