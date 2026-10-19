from __future__ import annotations
import json, sys
from dataclasses import replace
from pathlib import Path
import torch
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import CurrentConfig, NeuroCoreCurrent, GradientArbitrationConfig

LOSSES=('memory_loss','predictive_loss','world_loss','spine_loss','self_loss','multiscale_loss','confidence_loss','temporal_loss')

def run(seed:int,strength:float,arbitrated:bool=False):
    torch.manual_seed(seed)
    base=CurrentConfig.mobile(9)
    cfg=replace(base,trunk=replace(base.trunk,synergy_feedback_strength=strength),gradient_arbitration=GradientArbitrationConfig(enabled=arbitrated))
    model=NeuroCoreCurrent(cfg).train()
    x=torch.randn(2,6,9); g=torch.randn(2,6,8); target=torch.randn(2,5,20)
    out=model.forward_learning(x,g,target_latent_sequence=target)
    losses={k:out[k] for k in LOSSES}
    info=model.gradient_arbitrator.inspect_conflicts(losses,model.named_parameters())
    return {'conflict_rate':info['conflict_rate'],'mean_cosine':info['mean_off_diagonal_cosine'],'pairs':info['conflict_pairs'],'selected_parameters':info['selected_parameters']}

rows=[]
for seed in (110,111,112):
    for strength in (0.0,0.35):
        rows.append({'seed':seed,'strength':strength,**run(seed,strength,False)})
report={'version':110,'benchmark':'objective_gradient_conflict_probe','rows':rows,'note':'single forward diagnostic; arbitration effect measured separately by V108 benchmark'}
(ROOT/'evidence'/'V110_GRADIENT_CONFLICT.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
