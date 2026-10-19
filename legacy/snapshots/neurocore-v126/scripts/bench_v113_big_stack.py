from __future__ import annotations
import argparse,json,time
from pathlib import Path
import torch
from neurocore.current import CurrentConfig, NeuroCoreCurrent, OrganismRuntimeCurrent, TemporalCreditConfig, ThreeFactorPlasticityConfig

def train_probe(seed, mode, length, steps):
    torch.manual_seed(seed)
    tc=TemporalCreditConfig(enabled=(mode not in {"single"}), mode=mode if mode!="single" else "single")
    cfg=CurrentConfig(trunk=CurrentConfig.mobile(9).trunk.__class__(temporal_credit=tc, online_plasticity=ThreeFactorPlasticityConfig(enabled=True)))
    m=NeuroCoreCurrent(cfg); m.train(); opt=torch.optim.AdamW([p for p in m.parameters() if p.requires_grad], lr=3e-4)
    rows=[]; t0=time.perf_counter()
    for _ in range(steps):
        x=torch.randn(1,length,9); g=torch.randn(1,length,8); y=torch.randn(1,length-1,20)
        out=m.forward_learning(x,g,target_latent_sequence=y); opt.zero_grad(set_to_none=True); out["loss"].backward(); opt.step()
        rows.append(float(out["loss"].detach()))
    return {"seed":seed,"mode":mode,"length":length,"steps":steps,"initial":rows[0],"final":rows[-1],"mean_last":sum(rows[-min(3,len(rows)):])/min(3,len(rows)),"seconds":time.perf_counter()-t0}

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--output",default="evidence/V113_BIG_STACK_BENCHMARK.json"); ap.add_argument("--lengths",default="16,32,64"); ap.add_argument("--steps",type=int,default=2); ap.add_argument("--seeds",default="0,1,2")
    args=ap.parse_args(); lengths=[int(x) for x in args.lengths.split(",")]; seeds=[int(x) for x in args.seeds.split(",")]
    data=[]
    for mode in ["single","dual","selective","cascade"]:
        for L in lengths:
            for s in seeds:
                data.append(train_probe(s,mode,L,args.steps))
    Path(args.output).write_text(json.dumps(data,indent=2))
    print(json.dumps(data,indent=2))
if __name__=="__main__": main()
