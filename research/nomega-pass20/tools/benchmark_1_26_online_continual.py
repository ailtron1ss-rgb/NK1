from __future__ import annotations
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path: sys.path.insert(0,str(ROOT))
from typing import Sequence
import json, math, random, statistics, tempfile
import torch
import torch.nn as nn
import torch.nn.functional as F

from core.nomega.online_stream_monitor_v1 import OnlineStreamMonitorV1
from core.nomega.neural_interference_monitor_v1 import NeuralInterferenceMonitorV1
from core.nomega.neural_plasticity_monitor_v1 import NeuralPlasticityMonitorV1
from core.nomega.continual_replay_policy_v2 import ContinualReplayPolicyV2
from core.nomega.replay_partition_registry_v2 import ReplayPartitionRegistryV2
from core.nomega.online_adaptation_transaction_v1 import OnlineAdaptationTransactionV1
from core.nomega.restart_equivalence_verifier_v1 import RestartEquivalenceVerifierV1

STRATEGIES=('naive','static_replay','adaptive_replay','adaptive_replay_anchor','adaptive_replay_anchor_interference')
FAMILY_ORDER=('sum3','xor3','mul2','sub_offset')

class TinyContinualNet(nn.Module):
    def __init__(self, hidden=24):
        super().__init__(); self.net=nn.Sequential(nn.Linear(3,hidden),nn.Tanh(),nn.Linear(hidden,1))
    def forward(self,x): return self.net(x)

def _seed(seed:int):
    random.seed(seed); torch.manual_seed(seed)

def _task_fn(family:str, x:torch.Tensor)->torch.Tensor:
    if family=='sum3': return x[:,0:1]+x[:,1:2]+x[:,2:3]
    if family=='xor3': return (((x[:,0]>0).float()+2*(x[:,1]>0).float()+4*(x[:,2]>0).float()).fmod(2.0)).unsqueeze(1)
    if family=='mul2': return x[:,0:1]*x[:,1:2]
    if family=='sub_offset': return x[:,0:1]-x[:,1:2]+0.25
    raise ValueError(family)

def _data(family:str, seed:int, n:int=24):
    g=torch.Generator().manual_seed(seed); x=torch.randn(n,3,generator=g); y=_task_fn(family,x); return x,y

def _evaluate(model, family, seed, n=24):
    model.eval(); x,y=_data(family,seed,n)
    with torch.no_grad(): loss=F.mse_loss(model(x),y).item()
    return {'loss':float(loss),'score':float(1.0/(1.0+loss))}

def _grad_vector(model, loss):
    model.zero_grad(set_to_none=True); loss.backward(retain_graph=True)
    vec=[]
    for p in model.parameters(): vec.extend((p.grad.detach().flatten().cpu().tolist() if p.grad is not None else [0.0]*p.numel()))
    model.zero_grad(set_to_none=True)
    return vec

def _snapshot_bundle(model,opt):
    return {'model':{k:v.detach().cpu().clone() for k,v in model.state_dict().items()},'optimizer':opt.state_dict()}

def _restore_bundle(model,opt,bundle):
    model.load_state_dict(bundle['model']); opt.load_state_dict(bundle['optimizer'])

def _train_steps(model,opt,x,y,steps,teacher=None,anchor_weight=0.0):
    model.train(); last=0.0
    for _ in range(steps):
        pred=model(x); loss=F.mse_loss(pred,y)
        if teacher is not None and anchor_weight>0:
            with torch.no_grad(): frozen=teacher(x)
            loss=loss+anchor_weight*F.mse_loss(pred,frozen)
        opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step(); last=float(loss.detach())
    return last

def build_report(seed:int, strategy:str, families:Sequence[str]|None=None):
    if strategy not in STRATEGIES: raise ValueError(strategy)
    families=list(families or FAMILY_ORDER); _seed(seed)
    root=Path(tempfile.mkdtemp(prefix='nomega126-bench-'))
    registry=ReplayPartitionRegistryV2(root); policy=ContinualReplayPolicyV2(); stream=OnlineStreamMonitorV1(window=8,micro_uncertainty=.2,adapt_uncertainty=.5,quarantine_uncertainty=.95); interference=NeuralInterferenceMonitorV1(); plasticity=NeuralPlasticityMonitorV1();
    model=TinyContinualNet(); opt=torch.optim.AdamW(model.parameters(),lr=0.025)
    memories=[]; pre_scores={}; phase_reports=[]; rollbacks=0; total_steps=0
    # Immutable held-out rows are registered once and never mutated.
    holdout_rows=[]
    for idx,f in enumerate(families): holdout_rows.append({'key':f'holdout:{f}:{seed}','partition':'holdout','family':f,'semantic_group':f,'verified':True})
    registry.register(holdout_rows,'holdout',f'bench-{seed}')
    for idx,family in enumerate(families):
        x_train,y_train=_data(family,seed+idx*101,n=24); eval_before={fam:_evaluate(model,fam,seed+idx*101) for fam in families[:idx+1]}
        if idx==0: pre_scores=eval_before.copy()
        fresh=TinyContinualNet(); fresh_opt=torch.optim.AdamW(fresh.parameters(),lr=0.025); fresh_loss=_train_steps(fresh,fresh_opt,x_train,y_train,steps=12)
        teacher=None
        replay_rows=[]
        anchor_keys=set()
        if strategy!='naive' and memories:
            if strategy=='static_replay': replay_rows=memories[:8]
            else:
                replay_rows=policy.rank(memories,current_family=family,anchor_keys={m['key'] for m in memories if m.get('anchor')},max_items=8)
            if strategy in {'adaptive_replay_anchor','adaptive_replay_anchor_interference'}:
                teacher=TinyContinualNet(); teacher.load_state_dict(model.state_dict()); teacher.eval()
                anchor_keys={m['key'] for m in memories if m.get('anchor')}
        tx=OnlineAdaptationTransactionV1(root,model,opt,budget=16)
        tx.begin({'phase':family,'strategy':strategy,'seed':seed})
        conflict_rate=0.0
        veto=False
        if memories and strategy.endswith('interference'):
            current_loss=F.mse_loss(model(x_train),y_train); new_grad=_grad_vector(model,current_loss)
            anchor_grad=[]
            for m in memories[:2]:
                xa,ya=m['x'],m['y']; anchor_grad.append(_grad_vector(model,F.mse_loss(model(xa),ya)))
            diag=interference.analyze([new_grad],anchor_grad); conflict_rate=diag['conflict_rate']; veto=conflict_rate>=0.75
        # Merge replay before current batch for replay strategies.
        if replay_rows:
            rx=torch.cat([r['x'] for r in replay_rows],dim=0); ry=torch.cat([r['y'] for r in replay_rows],dim=0); train_x=torch.cat([x_train,rx],dim=0); train_y=torch.cat([y_train,ry],dim=0)
        else: train_x,train_y=x_train,y_train
        if not veto:
            _train_steps(model,opt,train_x,train_y,steps=12,teacher=teacher,anchor_weight=.15 if teacher is not None else 0.0)
        post={fam:_evaluate(model,fam,seed+families.index(fam)*101) for fam in families[:idx+1]}
        new_gain=post[family]['score']-eval_before[family]['score']
        retention_drop=max((eval_before[f]['score']-post[f]['score']) for f in eval_before if f!=family) if idx>0 else 0.0
        ood=_evaluate(model,family,seed+5000+idx)
        # Fresh-control gain is measured with equal optimizer steps.
        fresh_score=1.0/(1.0+float(F.mse_loss(fresh(x_train),y_train).detach()))
        incumbent_gain=new_gain
        restart_bundle={'outputs':{'family':family,'score':post[family]['score']},'metrics':{'score':post[family]['score']}}
        verifier=RestartEquivalenceVerifierV1(root)
        ckpt=root/f'model_{idx}.pt'; torch.save({'model':model.state_dict(),'optimizer':opt.state_dict()},ckpt)
        verifier.capture(ckpt,restart_bundle)
        reloaded=TinyContinualNet(); blob=torch.load(ckpt,map_location='cpu',weights_only=False); reloaded.load_state_dict(blob['model']); reloaded.eval()
        with torch.no_grad(): reloaded_score=float(1.0/(1.0+F.mse_loss(reloaded(_data(family,seed+families.index(family)*101)[0]),_data(family,seed+families.index(family)*101)[1]).item()))
        restarted_bundle={'outputs':{'family':family,'score':reloaded_score},'metrics':{'score':reloaded_score}}
        restart_ok=verifier.verify(restarted_bundle)['ok']
        metrics={'new_gain':float(new_gain),'retention_drop':float(retention_drop),'ood_drop':0.0,'interference_veto':bool(veto),'restart_ok':bool(restart_ok),'steps':12}
        if strategy=='naive': gate={'status':'commit'}
        else: gate={'status':tx.evaluate(metrics,thresholds={'min_new_gain':-1.0,'max_retention_drop':.30,'max_ood_drop':.25})}
        if gate['status']=='rollback': rollbacks+=1
        total_steps+=12
        for j in range(min(4,len(x_train))): memories.append({'key':f'{family}:{idx}:{j}:{seed}','family':family,'semantic_group':f'{family}:{j%3}','x':x_train[j:j+1].detach().clone(),'y':train_y[j:j+1].detach().clone(),'verified':True,'anchor':True,'uncertainty':float(abs(new_gain)),'transfer_to_current':0.1,'reward':post[family]['score'],'confidence':post[family]['score'],'recency':1.0})
        phase_reports.append({'family':family,'new_task_gain':float(new_gain),'verified_new_gain':float(new_gain),'retention_drop':float(retention_drop),'fresh_control_gain':float(fresh_score-0.5),'plasticity_gap':float((fresh_score)-(post[family]['score'])),'conflict_rate':float(conflict_rate),'rollback':gate['status']=='rollback','restart_equivalence':restart_ok,'steps':12,'stream_mode':stream.decide()['mode']})
        stream.next_phase(); stream.observe({'uncertainty':abs(new_gain)+.1,'reward':post[family]['score'],'novelty':0.0})
    retention=float(1.0-max((p['retention_drop'] for p in phase_reports),default=0.0))
    plasticity_gap=float(statistics.fmean(p['plasticity_gap'] for p in phase_reports))
    return {'seed':int(seed),'strategy':strategy,'phases':phase_reports,'retention':retention,'plasticity_gap':plasticity_gap,'rollbacks':int(rollbacks),'restart_equivalence':all(p['restart_equivalence'] for p in phase_reports),'compute_steps':int(total_steps),'families':families}

def run(seed:int=41,strategy:str='adaptive_replay_anchor_interference',families:Sequence[str]|None=None)->dict:
    return build_report(seed,strategy,families)

if __name__=='__main__':
    result={'strategies':{s:[run(seed,s) for seed in (41,43,47)] for s in STRATEGIES}}
    print(json.dumps(result,indent=2,default=str))
