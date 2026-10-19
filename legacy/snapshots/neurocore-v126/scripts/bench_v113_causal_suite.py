from __future__ import annotations
import json, sys, time
from dataclasses import replace
from pathlib import Path
import torch
import torch.nn.functional as F
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import (CurrentConfig, NeuroCoreCurrent, TemporalCreditConfig, ThreeFactorPlasticityConfig,
    EraseControlConfig, DeltaIntegratorConfig, UncertaintyWriteConfig)

def make_fast_cfg(mode='single', erase='key', efla=False, uncertainty=False, synergy=0.0, disagreement=False, seed=0):
    base=CurrentConfig.mobile(9)
    tc=replace(base.trunk.temporal_credit, enabled=(mode!='single'), mode=mode, normalize_trace=False,
               event_bank_capacity=4, event_similarity_threshold=0.50)
    op=replace(base.trunk.online_plasticity, enabled=True, modulatory_gate_enabled=False,
               eligibility_decay=0.92, learning_rate=0.25, fast_weight_decay=0.999)
    trunk=replace(base.trunk, temporal_credit=tc, online_plasticity=op,
                  erase_control=EraseControlConfig(mode=erase),
                  delta_integrator=DeltaIntegratorConfig(mode='efla_exact' if efla else 'euler'),
                  uncertainty_write=UncertaintyWriteConfig(enabled=uncertainty),
                  synergy_feedback_strength=synergy,
                  synergy_disagreement_gate=disagreement)
    return replace(base,trunk=trunk)

def temporal_influence(mode, length, seed):
    torch.manual_seed(seed); cfg=make_fast_cfg(mode=mode)
    m=NeuroCoreCurrent(cfg).eval(); x=torch.randn(1,length,9); g=torch.randn(1,length,8)
    target=F.normalize(torch.randn(1,20),dim=-1).expand(1,length-1,20).contiguous()
    out=m.forward_learning(x,g,target_latent_sequence=target)
    correction=(out['predictive']-out['predictive_base']).norm(dim=-1)[0]
    fw=m.spine.online_plasticity
    return {'mode':mode,'length':length,'seed':seed,'late_correction':float(correction[-1].detach()),'mean_post_first':float(correction[1:].mean().detach()),'fast_state_norm':float(fw.fast_weight.norm().detach())}

def event_isolation(seed):
    torch.manual_seed(seed)
    def run(mode):
        cfg=make_fast_cfg(mode=mode); m=NeuroCoreCurrent(cfg).eval(); fw=m.spine.online_plasticity
        a=F.normalize(torch.randn(1,64),dim=-1); b=F.normalize(torch.randn(1,64),dim=-1)
        ta=F.normalize(torch.randn(1,20),dim=-1); tb=F.normalize(torch.randn(1,20),dim=-1); z=torch.zeros_like(ta)
        for _ in range(6):
            pred=fw.apply(a,z); fw.update(a,pred,ta)
        for _ in range(6):
            pred=fw.apply(b,z); fw.update(b,pred,tb)
        pa=fw.apply(a,z); pb=fw.apply(b,z)
        return {'a_cos':float(F.cosine_similarity(pa,ta).item()),'b_cos':float(F.cosine_similarity(pb,tb).item()),
                'a_to_b_leak':float(F.cosine_similarity(pa,tb).item()),'b_to_a_leak':float(F.cosine_similarity(pb,ta).item())}
    return {'seed':seed,'single':run('single'),'event_bank':run('event_bank')}

def delayed_train(seed, mode='single', delay=16, steps=4, synergy=0.0, disagreement=False, erase='key', efla=False, uncertainty=False):
    torch.manual_seed(seed); cfg=make_fast_cfg(mode=mode, synergy=synergy, disagreement=disagreement, erase=erase, efla=efla, uncertainty=uncertainty)
    model=NeuroCoreCurrent(cfg).train(); opt=torch.optim.AdamW([p for p in model.parameters() if p.requires_grad],lr=cfg.trunk.learning_rate,weight_decay=1e-4)
    batch=4; time_steps=delay*4; x=torch.randn(batch,time_steps,9)
    for t in range(1,time_steps): x[:,t]=0.84*x[:,t-1]+0.55*x[:,t]
    teacher=torch.randn(9,20); target=[]
    for t in range(1,time_steps): target.append(F.normalize(x[:,max(0,t-delay)]@teacher,dim=-1))
    target=torch.stack(target,dim=1); losses=[]
    for _ in range(steps):
        out=model.forward_learning(x,torch.zeros(batch,time_steps,8),target_latent_sequence=target); opt.zero_grad(set_to_none=True); out['loss'].backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step(); losses.append(float(out['loss'].detach()))
    with torch.no_grad():
        eval_out=model.trunk.forward_sequence(x,torch.zeros(batch,time_steps,8)); pred=eval_out['predictive'][:,delay:-1]; tgt=target[:,delay:]; cos=float(F.cosine_similarity(pred,tgt,dim=-1).mean())
    return {'seed':seed,'mode':mode,'delay':delay,'steps':steps,'final_loss':losses[-1],'delayed_cosine':cos}

def combined(seed):
    return delayed_train(seed,mode='selective',delay=16,steps=4,synergy=0.35,disagreement=True,erase='qed_address',efla=True,uncertainty=True)

def main():
    rows=[]
    for mode in ('single','dual','selective','cascade','event_bank'):
        for length in (32,128,256):
            for seed in (0,): rows.append(temporal_influence(mode,length,seed))
    interference=[event_isolation(s) for s in (0,1)]
    delayed=[]
    for mode in ('single','dual','selective','cascade'):
        for seed in (0,1): delayed.append(delayed_train(seed,mode=mode,delay=16,steps=2))
    stack=[delayed_train(0,mode="selective",delay=16,steps=2,synergy=0.35,disagreement=True,erase="qed_address",efla=True,uncertainty=True), delayed_train(1,mode="selective",delay=16,steps=2,synergy=0.35,disagreement=True,erase="qed_address",efla=True,uncertainty=True)]
    erase=[]
    for mode in ('key','qed','address','qed_address'):
        erase.append(delayed_train(0,mode='single',delay=16,steps=1,erase=mode))
    integrator=[delayed_train(0,mode='single',delay=16,steps=1,efla=x) for x in (False,True)]
    uncertainty=[delayed_train(0,mode='single',delay=16,steps=1,uncertainty=x) for x in (False,True)]
    report={'version':113,'suite':'causal_memory_qualification','temporal_influence':rows,'event_interference':interference,
            'delayed_training':delayed,'composite_stack':stack,'erase_ablation':erase,'integrator_ablation':integrator,
            'uncertainty_ablation':uncertainty,
            'decision':'diagnostic_and_candidate_only; no candidate promoted automatically'}
    out=ROOT/'evidence'/'V113_CAUSAL_QUALIFICATION.json'; out.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n'); print(json.dumps(report,indent=2,ensure_ascii=False))
if __name__=='__main__': main()
