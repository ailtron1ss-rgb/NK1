from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Sequence, Tuple
import random, time
import torch
import torch.nn.functional as F
from .neural_program_synth_v2 import NeuralProgramSynthesizerV2, Program, OPS, REGS
from .generalist_core import encode_text

@dataclass
class BatchProgramTrainReportV4:
    loss: float
    op_loss: float
    a_loss: float
    b_loss: float
    family_loss: float
    examples: int
    epochs: int
    steps: int
    batch_size: int
    wall_s: float
    samples_per_second: float
    family_mix_start: float
    family_mix_end: float
    masked_tokens: int

class NeuralProgramTrainerV4:
    """Verified-curriculum trainer with exact-length masking and family-conditioning schedule."""
    def __init__(self, model: NeuralProgramSynthesizerV2, seed: int = 4201, lr: float = 8e-4):
        self.model=model
        self.opt=torch.optim.AdamW(model.parameters(),lr=lr,weight_decay=1e-4)
        self.seed=int(seed); self.steps=0
        random.seed(self.seed); torch.manual_seed(self.seed)

    def _batch(self, rows: Sequence[Tuple[str,Program,int]], family_mix: float):
        device=next(self.model.parameters()).device; B=len(rows); L=self.model.max_len
        ids=[]; texts=[]; fam=[]; target=torch.zeros((B,L,3),dtype=torch.long,device=device); target[:,:,0]=14
        mask=torch.zeros((B,L),dtype=torch.bool,device=device)
        for i,(text,code,fid) in enumerate(rows):
            texts.append(str(text))
            ids.append(encode_text(text,length=24,vocab=self.model.vocab))
            fam.append(int(fid)%self.model.family_count)
            usable=list(code[:L])
            if not usable:
                usable=[(14,0,0)]
            for s,(op,a,b) in enumerate(usable):
                target[i,s]=torch.tensor([int(op)%OPS,int(a)%REGS,max(0,min(self.model.max_b-1,int(b)))],device=device)
                mask[i,s]=True
        ids=torch.stack(ids).to(device); fam=torch.tensor(fam,dtype=torch.long,device=device)
        prev=torch.zeros_like(target); prev[:,:,0]=14; prev[:,1:,:]=target[:,:-1,:]
        base=self.model.encode_text_batch(texts) if hasattr(self.model,'encode_text_batch') else self.model.text(ids).mean(1)
        family_logits=self.model.family_head(base)
        pred_weights=torch.softmax(family_logits,dim=-1)
        pred_fam=pred_weights @ self.model.family.weight
        gold_fam=self.model.family(fam)
        mix=float(max(0.0,min(1.0,family_mix)))
        fam_vec=((1.0-mix)*gold_fam + mix*pred_fam).unsqueeze(1)
        cond=base.unsqueeze(1)+fam_vec
        tok=self.model._token(prev.reshape(B*L,3)).view(B,L,-1)
        z=F.pad(tok,(0,self.model.hidden-tok.size(-1)))
        pos=self.model.pos(torch.arange(L,device=device)).unsqueeze(0)
        x=z+pos+cond
        causal=torch.triu(torch.full((L,L),float('-inf'),device=device),diagonal=1)
        h=self.model.norm(self.model.decoder(x,mask=causal))
        return {'op':self.model.op_head(h),'a':self.model.a_head(h),'b':self.model.b_head(h),
                'family_logits':family_logits,'op_y':target[:,:,0],'a_y':target[:,:,1],'b_y':target[:,:,2],
                'family_y':fam,'mask':mask}

    def fit(self, rows: Sequence[Tuple[str,Program,int]], epochs: int=16, batch_size: int=8,
            max_examples: int=512, family_weight: float=.20, family_mix_start: float=0.0,
            family_mix_end: float=0.75, shuffle_seed: int|None=None) -> BatchProgramTrainReportV4:
        data=list(rows)[:max_examples]
        if not data:
            return BatchProgramTrainReportV4(0,0,0,0,0,0,0,batch_size,0,0,family_mix_start,family_mix_end,0)
        rng=random.Random(self.seed if shuffle_seed is None else shuffle_seed); t0=time.perf_counter(); steps=0; masked=0
        last=(0,0,0,0,0)
        self.model.train()
        E=max(1,int(epochs))
        for epoch in range(E):
            progress=0.0 if E==1 else epoch/(E-1)
            mix=family_mix_start+(family_mix_end-family_mix_start)*progress
            order=list(range(len(data))); rng.shuffle(order)
            for start in range(0,len(order),max(1,batch_size)):
                batch=[data[i] for i in order[start:start+max(1,batch_size)]]
                out=self._batch(batch,mix); valid=out['mask']; count=int(valid.sum().item()); masked+=count
                op_all=F.cross_entropy(out['op'].reshape(-1,OPS),out['op_y'].reshape(-1),reduction='none').view_as(valid)
                a_all=F.cross_entropy(out['a'].reshape(-1,REGS),out['a_y'].reshape(-1),reduction='none').view_as(valid)
                b_all=F.cross_entropy(out['b'].reshape(-1,self.model.max_b),out['b_y'].reshape(-1),reduction='none').view_as(valid)
                denom=valid.sum().clamp_min(1)
                op_loss=(op_all*valid).sum()/denom; a_loss=(a_all*valid).sum()/denom; b_loss=(b_all*valid).sum()/denom
                family_loss=F.cross_entropy(out['family_logits'],out['family_y'])
                loss=op_loss+0.5*a_loss+0.5*b_loss+family_weight*family_loss
                self.opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(self.model.parameters(),1.0); self.opt.step()
                steps+=1; self.steps+=1
                last=tuple(float(x.detach()) for x in (loss,op_loss,a_loss,b_loss,family_loss))
        wall=time.perf_counter()-t0
        return BatchProgramTrainReportV4(last[0],last[1],last[2],last[3],last[4],len(data),E,steps,batch_size,wall,len(data)*E/max(wall,1e-9),family_mix_start,family_mix_end,masked)

    @staticmethod
    def save(path, model, report=None):
        path.parent.mkdir(parents=True,exist_ok=True)
        payload={'architecture':{'vocab':model.vocab,'hidden':model.hidden,'latent_dim':model.latent_dim,'max_len':model.max_len,'max_b':model.max_b,'layers':model.layers,'heads':model.heads,'family_count':model.family_count,'model_class':model.__class__.__module__+'.'+model.__class__.__name__},
                 'model':model.state_dict(),'report':asdict(report) if hasattr(report,'__dataclass_fields__') else report or {}}
        torch.save(payload,path)

    @staticmethod
    def load(path):
        blob=torch.load(path,map_location='cpu',weights_only=False); arch=dict(blob.get('architecture',{}))
        arch.setdefault('layers',2); arch.setdefault('heads',4); arch.setdefault('family_count',64)
        model_class=arch.pop('model_class',None)
        if model_class == 'core.nomega.neural_program_synth_v7.NeuralProgramSynthesizerV7':
            from .neural_program_synth_v7 import NeuralProgramSynthesizerV7
            model_cls=NeuralProgramSynthesizerV7
        else:
            model_cls=NeuralProgramSynthesizerV2
        model=model_cls(**arch); model.load_state_dict(blob['model'])
        return model,blob.get('report',{})
