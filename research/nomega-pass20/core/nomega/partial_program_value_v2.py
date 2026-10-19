from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import json, random, time, math
import torch
import torch.nn as nn
import torch.nn.functional as F

from .program_contract_v1 import ProgramContractV1, Program
from .execution_trace_v1 import trace_tinyvm_v1

@dataclass(frozen=True)
class ValuePredictionV2:
    success_probability: float
    remaining_progress: float
    repairability: float
    expected_cost: float
    uncertainty: float
    def to_dict(self): return asdict(self)

@dataclass(frozen=True)
class ValueFitReportV2:
    version: str
    samples: int
    ensemble: int
    loss: float
    uncertainty_mean: float
    inference_ms: float
    checkpoint: str
    def to_dict(self): return asdict(self)

class _ValueNetV2(nn.Module):
    def __init__(self, dim:int, hidden:int=64):
        super().__init__()
        self.backbone=nn.Sequential(nn.Linear(dim,hidden),nn.ReLU(),nn.Linear(hidden,hidden//2),nn.ReLU())
        self.heads=nn.ModuleDict({
            'success':nn.Linear(hidden//2,1),'progress':nn.Linear(hidden//2,1),
            'repair':nn.Linear(hidden//2,1),'cost':nn.Linear(hidden//2,1),
        })
    def forward(self,x):
        h=self.backbone(x)
        return self.heads['success'](h).squeeze(-1),self.heads['progress'](h).squeeze(-1),self.heads['repair'](h).squeeze(-1),self.heads['cost'](h).squeeze(-1)

class PartialProgramValueV2:
    VERSION='partial-program-value-v2'
    FAMILY_COUNT=64
    def __init__(self, root:Path, seed:int=9721, ensemble:int=3):
        self.root=Path(root); self.seed=int(seed); self.ensemble_n=max(2,int(ensemble)); self.contract=ProgramContractV1()
        self.obs=[]; self.models=[]; self.last_inference_ms=0.0
        self._dim=20+8+13+self.FAMILY_COUNT
        self.checkpoint=self.root/'runtime'/'partial_program_value_v2.pt'; self.dataset_path=self.root/'runtime'/'partial_program_value_dataset_v2.jsonl'; self.meta_path=self.root/'runtime'/'partial_program_value_meta_v2.json'
        self._load()
    def _features(self,code:Program,family_id:int)->List[float]:
        code=[tuple(map(int,x)) for x in code]; hist=[0.0]*20; ra=[0.0]*4; rb=[0.0]*4
        for op,a,b in code: hist[op%20]+=1; ra[a%4]+=1; rb[b%4]+=1
        n=max(1,len(code)); hist=[x/n for x in hist]; ra=[x/n for x in ra]; rb=[x/n for x in rb]; c=self.contract.check(code)
        scalars=[min(1.0,len(code)/48),c.score,c.reachable_instructions/max(1,len(code)),float(c.halt_reachable),(code[-1][0]%20)/19.0 if code else 0.0,sum(hist[i] for i in (1,2)),sum(hist[i] for i in (3,4,5,6,7,15,16,17,18,19)),sum(hist[i] for i in (11,12)),sum(hist[i] for i in (1,2)),float(c.halt_reachable),float(c.runnable),min(1.0,len(code)/96),0.0]
        fam=[0.0]*self.FAMILY_COUNT
        if 0<=int(family_id)<self.FAMILY_COUNT:fam[int(family_id)]=1.0
        return hist+ra+rb+scalars+fam
    def observe(self,family_id:int,code:Program,target:float,*,progress:Optional[float]=None,repairability:Optional[float]=None,cost:Optional[float]=None,source:str='execution')->int:
        code=[tuple(map(int,x)) for x in code]
        if not code:return 0
        row={'family_id':int(family_id),'code':[list(x) for x in code],'success':float(max(0,min(1,target))),'progress':float(max(0,min(1,target if progress is None else progress))),'repairability':float(max(0,min(1,target if repairability is None else repairability))),'cost':float(max(0,1.0 if cost is None else cost)),'source':source}
        key=json.dumps(row['code'],sort_keys=True)
        if any(o['family_id']==row['family_id'] and json.dumps(o['code'],sort_keys=True)==key and abs(o['success']-row['success'])<1e-6 for o in self.obs):return 0
        self.obs.append(row); return 1
    def fit(self,*,epochs:int=24,batch_size:int=32,lr:float=7e-4)->Optional[ValueFitReportV2]:
        if len(self.obs)<24:return None
        t0=time.perf_counter(); rows=list(self.obs[-4000:]); rng=random.Random(self.seed+len(rows)); rng.shuffle(rows)
        x=torch.tensor([self._features(r['code'],r['family_id']) for r in rows],dtype=torch.float32)
        ys=torch.tensor([r['success'] for r in rows],dtype=torch.float32); yp=torch.tensor([r['progress'] for r in rows],dtype=torch.float32); yr=torch.tensor([r['repairability'] for r in rows],dtype=torch.float32); yc=torch.tensor([min(1.0,float(r['cost'])/96.0) for r in rows],dtype=torch.float32)
        self.models=[]; losses=[]
        for m in range(self.ensemble_n):
            torch.manual_seed(self.seed+401*m+len(rows)); model=_ValueNetV2(self._dim); opt=torch.optim.AdamW(model.parameters(),lr=lr,weight_decay=1e-4); idx=[rng.randrange(len(rows)) for _ in rows]; bx=x[idx]; targets=(ys[idx],yp[idx],yr[idx],yc[idx]); last=0.0
            for _ in range(max(1,int(epochs))):
                perm=torch.randperm(len(bx))
                for j in range(0,len(bx),max(1,int(batch_size))):
                    k=perm[j:j+batch_size]; a,b,c,d=model(bx[k]); loss=F.smooth_l1_loss(torch.sigmoid(a),targets[0][k])+F.smooth_l1_loss(torch.sigmoid(b),targets[1][k])+F.smooth_l1_loss(torch.sigmoid(c),targets[2][k])+F.smooth_l1_loss(torch.sigmoid(d),targets[3][k]); opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step(); last=float(loss.detach())
            self.models.append(model.eval()); losses.append(last)
        with torch.no_grad():
            aa=torch.stack([torch.sigmoid(m(x)[0]) for m in self.models]); unc=float(aa.std(0).mean())
        self._save(); rep=ValueFitReportV2(self.VERSION,len(rows),len(self.models),sum(losses)/len(losses),unc,0.0,str(self.checkpoint)); self.meta_path.parent.mkdir(parents=True,exist_ok=True); self.meta_path.write_text(json.dumps(rep.to_dict(),indent=2)); return rep
    @torch.no_grad()
    def predict(self,family_id:int,code:Program)->ValuePredictionV2:
        if not self.models:return ValuePredictionV2(0.0,0.0,0.0,float(len(code)),1.0)
        t0=time.perf_counter(); x=torch.tensor([self._features(code,family_id)],dtype=torch.float32); vals=torch.stack([torch.sigmoid(torch.stack(m(x),dim=0)) for m in self.models],dim=0); mean=vals.mean(0); unc=float(vals[:,0].std()) if vals.shape[0]>1 else 0.0; self.last_inference_ms=(time.perf_counter()-t0)*1000
        p=[float(z) for z in mean]; return ValuePredictionV2(p[0],p[1],p[2],max(0.0,p[3]*96.0),max(0.0,unc))
    def should_enable(self,*,expected_verifier_savings:float)->bool:
        return float(expected_verifier_savings)>max(1.0,self.last_inference_ms)
    def _save(self):
        self.checkpoint.parent.mkdir(parents=True,exist_ok=True); self.dataset_path.parent.mkdir(parents=True,exist_ok=True)
        self.dataset_path.write_text('\n'.join(json.dumps(x,sort_keys=True) for x in self.obs[-5000:])+'\n',encoding='utf-8')
        torch.save({'version':self.VERSION,'dim':self._dim,'models':[m.state_dict() for m in self.models]},self.checkpoint)
    def _load(self):
        if self.dataset_path.exists():
            try:self.obs=[json.loads(x) for x in self.dataset_path.read_text().splitlines() if x.strip()]
            except Exception:self.obs=[]
        if self.checkpoint.exists():
            try:
                b=torch.load(self.checkpoint,map_location='cpu',weights_only=False)
                if b.get('version')==self.VERSION and int(b.get('dim',-1))==self._dim:
                    self.models=[]
                    for s in b.get('models',[]):
                        m=_ValueNetV2(self._dim); m.load_state_dict(s); self.models.append(m.eval())
            except Exception:self.models=[]
