from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Sequence, Tuple
import random, time
import torch
import torch.nn.functional as F
from .neural_program_synth_v2 import NeuralProgramSynthesizerV2, Program, OPS, REGS
from .generalist_core import encode_text

@dataclass
class BatchProgramTrainReportV3:
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

class NeuralProgramTrainerV3:
    """Vectorized supervised/grounded trainer.

    The old trainer performs one Transformer forward/backward pass per row. V3
    batches rows into a single causal pass, preserves the same targets, and adds
    an auxiliary family-semantic loss when family IDs are available. This is an
    engineering optimization first; it does not alter the verification standard.
    """
    def __init__(self, model: NeuralProgramSynthesizerV2, seed: int = 2401, lr: float = 8e-4):
        self.model=model; self.opt=torch.optim.AdamW(model.parameters(),lr=lr,weight_decay=1e-4)
        self.seed=seed; self.steps=0; random.seed(seed); torch.manual_seed(seed)

    def _batch(self, rows: Sequence[Tuple[str,Program,int]]):
        device=next(self.model.parameters()).device; B=len(rows); L=self.model.max_len
        ids=[]; fam=[]; target=torch.zeros((B,L,3),dtype=torch.long,device=device); target[:,:,0]=14
        for i,(text,code,fid) in enumerate(rows):
            ids.append(encode_text(text,length=24,vocab=self.model.vocab))
            fam.append(int(fid)%self.model.family_count)
            for s,(op,a,b) in enumerate(code[:L]):
                target[i,s]=torch.tensor([int(op)%OPS,int(a)%REGS,max(0,min(self.model.max_b-1,int(b)))],device=device)
        ids=torch.stack(ids).to(device); fam=torch.tensor(fam,dtype=torch.long,device=device)
        prev=torch.zeros_like(target); prev[:,:,0]=14; prev[:,1:,:]=target[:,:-1,:]
        base=self.model.text(ids).mean(1)
        family_logits=self.model.family_head(base)
        weights=torch.softmax(family_logits,dim=-1); fam_vec=weights @ self.model.family.weight
        cond=(base+fam_vec).unsqueeze(1)
        tok=self.model._token(prev.reshape(B*L,3)).view(B,L,-1)
        z=F.pad(tok,(0,self.model.hidden-tok.size(-1)))
        pos=self.model.pos(torch.arange(L,device=device)).unsqueeze(0)
        x=z+pos+cond
        mask=torch.triu(torch.full((L,L),float('-inf'),device=device),diagonal=1)
        h=self.model.norm(self.model.decoder(x,mask=mask))
        return {'op':self.model.op_head(h),'a':self.model.a_head(h),'b':self.model.b_head(h),'family_logits':family_logits,
                'op_y':target[:,:,0],'a_y':target[:,:,1],'b_y':target[:,:,2],'family_y':fam}

    def fit(self, rows: Sequence[Tuple[str,Program,int]], epochs: int = 16, batch_size: int = 8,
            max_examples: int = 128, family_weight: float = .20, shuffle_seed: int | None = None) -> BatchProgramTrainReportV3:
        data=list(rows)[:max_examples]
        if not data: return BatchProgramTrainReportV3(0,0,0,0,0,0,0,batch_size,0,0)
        rng=random.Random(self.seed if shuffle_seed is None else shuffle_seed); t0=time.perf_counter(); last=(0,0,0,0,0); steps=0
        self.model.train()
        for _ in range(max(1,epochs)):
            order=list(range(len(data))); rng.shuffle(order)
            for start in range(0,len(order),max(1,batch_size)):
                batch=[data[i] for i in order[start:start+max(1,batch_size)]]
                out=self._batch(batch)
                B,L,_=out['op'].shape
                        # Do not train on synthetic HALT padding after the real program terminates.
                # Otherwise the decoder learns an immediate-HALT shortcut and collapses at inference.
                valid=torch.zeros_like(out['op_y'],dtype=torch.bool)
                for bi in range(B):
                    row=out['op_y'][bi]
                    halt=(row==14).nonzero(as_tuple=False)
                    end=int(halt[0].item())+1 if halt.numel() else L
                    valid[bi,:end]=True
                op_all=F.cross_entropy(out['op'].reshape(-1,OPS),out['op_y'].reshape(-1),reduction='none').view(B,L)
                a_all=F.cross_entropy(out['a'].reshape(-1,REGS),out['a_y'].reshape(-1),reduction='none').view(B,L)
                b_all=F.cross_entropy(out['b'].reshape(-1,self.model.max_b),out['b_y'].reshape(-1),reduction='none').view(B,L)
                denom=valid.float().sum().clamp_min(1.0)
                op_loss=(op_all*valid.float()).sum()/denom
                a_loss=(a_all*valid.float()).sum()/denom
                b_loss=(b_all*valid.float()).sum()/denom
                family_loss=F.cross_entropy(out['family_logits'],out['family_y'])
                loss=op_loss+0.5*a_loss+0.5*b_loss+family_weight*family_loss
                self.opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(self.model.parameters(),1.0); self.opt.step()
                steps+=1; self.steps+=1; last=tuple(float(x.detach()) for x in (loss,op_loss,a_loss,b_loss,family_loss))
        wall=time.perf_counter()-t0
        return BatchProgramTrainReportV3(last[0],last[1],last[2],last[3],last[4],len(data),max(1,epochs),steps,batch_size,wall,len(data)*max(1,epochs)/max(wall,1e-9))

    @staticmethod
    def behavior_anchor_loss(current_logits, frozen_logits, mask=None, lambda_anchor: float = 0.0):
        """Optional functional anchor regularizer for online adaptation."""
        if lambda_anchor <= 0:
            return current_logits.sum() * 0.0
        if mask is None:
            mask = torch.ones(current_logits.shape[:-1], dtype=torch.bool, device=current_logits.device)
        mask = mask.bool()
        if not bool(mask.any()):
            return current_logits.sum() * 0.0
        current = F.log_softmax(current_logits[mask], dim=-1)
        frozen = F.softmax(frozen_logits[mask], dim=-1)
        return float(lambda_anchor) * F.kl_div(current, frozen, reduction='batchmean')

    @staticmethod
    def save(path, model, report=None):
        path.parent.mkdir(parents=True,exist_ok=True)
        payload={'architecture':{'vocab':model.vocab,'hidden':model.hidden,'latent_dim':model.latent_dim,'max_len':model.max_len,'max_b':model.max_b,'layers':model.layers,'heads':model.heads,'family_count':model.family_count},'model':model.state_dict(),'report':asdict(report) if hasattr(report,'__dataclass_fields__') else report or {}}
        torch.save(payload,path)

    @staticmethod
    def load(path):
        blob = torch.load(path, map_location='cpu', weights_only=False)
        arch = dict(blob.get('architecture', {}))
        arch.setdefault('layers', 2)
        arch.setdefault('heads', 4)
        arch.setdefault('family_count', 64)
        model = NeuralProgramSynthesizerV2(**arch)
        model.load_state_dict(blob['model'])
        return model, blob.get('report', {})
