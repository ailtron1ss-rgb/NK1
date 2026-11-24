from __future__ import annotations
import json,time,sys
from pathlib import Path
import torch
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import CurrentConfig,CausalTrunkConfig,NeuroCoreCurrent

def run(rank):
    base=CurrentConfig.mobile(9); cfg=CurrentConfig(trunk=CausalTrunkConfig(spine_rank=rank,spine_topk=min(3,rank)))
    m=NeuroCoreCurrent(cfg).eval(); x=torch.randn(1,16,9); g=torch.randn(1,16,8)
    for _ in range(2): m.trunk.forward_sequence(x,g)
    t0=time.perf_counter(); reps=5
    with torch.no_grad():
      for _ in range(reps): out=m.trunk.forward_sequence(x,g)
    ms=(time.perf_counter()-t0)*1000/reps
    params=sum(p.numel() for p in m.parameters()); state_elems=rank*rank
    return {'rank':rank,'topk':min(3,rank),'params':params,'state_elements':state_elems,'state_bytes_fp32':state_elems*4,'forward_ms_B1_T16':ms,'latent_norm':float(out['latent'][:,-1].norm())}
rows=[run(r) for r in (8,12,16,24,32)]
report={'version':113,'benchmark':'capacity_scaling','rows':rows,'note':'CPU reference; directional only, not device-specific mobile performance'}
(ROOT/'evidence'/'V113_CAPACITY_SCALING.json').write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps(report,indent=2))
