from __future__ import annotations
import json, time
from pathlib import Path
import torch
from neurocore.current import CausalTrunk, CausalTrunkConfig, UnifiedSparseMemoryConfig

torch.set_num_threads(1)
ROOT=Path(__file__).resolve().parents[2]

def run(batch:int, iters:int=20):
    cfg=CausalTrunkConfig(unified_sparse_memory=UnifiedSparseMemoryConfig(enabled=True,slots_per_subkey=32,topk_per_subkey=2,write_slots_per_step=2))
    model=CausalTrunk(cfg).eval()
    x=torch.randn(batch,9); g=torch.randn(batch,8); state=model.reset_state(batch,x.device,x.dtype); prev=torch.zeros(batch,20)
    for _ in range(3):
        o=model.forward_step(x,g,state,prev,force_deep=False); state=o["state"]; prev=o["latent"]
    t=time.perf_counter()
    for _ in range(iters):
        o=model.forward_step(x,g,state,prev,force_deep=False); state=o["state"]; prev=o["latent"]
    return (time.perf_counter()-t)/iters*1000

rows={str(b):run(b) for b in (8,32,64,128)}
out=ROOT/"evidence"/"V126_SPARSE_RUNTIME.json"
out.write_text(json.dumps({"batch_ms":rows,"note":"V126 functional sparse-delta state update; compare absolute latency against the environment, not a universal speed claim."},indent=2),encoding="utf-8")
print(json.dumps(rows,indent=2))
