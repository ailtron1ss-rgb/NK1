from __future__ import annotations

"""Matched benchmark for the canonical executable spine v2."""
from pathlib import Path
import json
import statistics
import time

from core.nomega.executable_spine_v2 import ExecutableSpineV2

CASES = [
    ("add the first three values", {"a": 4, "b": 7, "c": 9, "expected": 20}),
    ("xor the first three values", {"a": 4, "b": 7, "c": 9, "expected": 10}),
    ("multiply the first two values", {"a": 6, "b": 7, "expected": 42}),
]


def run(root: Path, seeds=(11, 23, 41)):
    rows=[]
    for seed in seeds:
        spine=ExecutableSpineV2(root,seed=seed,max_candidates=6)
        for prompt,ctx in CASES:
            t=time.perf_counter(); out=spine.run(prompt,ctx); elapsed=(time.perf_counter()-t)*1000
            rows.append({
                "seed":seed,
                "prompt":prompt,
                "verified":bool(out.get("verified")),
                "answer":out.get("answer"),
                "family":out.get("family"),
                "candidate_source":out.get("candidate_source"),
                "confidence":float(out.get("confidence",0)),
                "contract_status":out.get("contract",{}).get("status"),
                "evidence_score":float(out.get("contract",{}).get("evidence_score",0)),
                "latency_ms":elapsed,
                "attempts":int(out.get("contract",{}).get("attempts",0)),
            })
    rates=[float(r["verified"]) for r in rows]
    return {
        "version":"1.20.0-dev",
        "benchmark":"executable-spine-v2-matched",
        "cases":len(rows),
        "verified_rate":sum(rates)/len(rates),
        "mean_confidence":statistics.mean(r["confidence"] for r in rows),
        "mean_evidence":statistics.mean(r["evidence_score"] for r in rows),
        "mean_latency_ms":statistics.mean(r["latency_ms"] for r in rows),
        "rows":rows,
    }


if __name__ == "__main__":
    root=Path(__file__).resolve().parents[1]
    result=run(root)
    out=root/"runtime"/"executable_spine_v2_benchmark.json"
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding="utf-8")
    print(json.dumps({k:v for k,v in result.items() if k!="rows"},indent=2,ensure_ascii=False))
