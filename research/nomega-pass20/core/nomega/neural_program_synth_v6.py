from __future__ import annotations
from typing import Dict, Optional, Sequence, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F

from .neural_program_synth_v2 import NeuralProgramSynthesizerV2, Program, OPS, REGS
from .task_spec_v1 import FAMILY_ORDER


class NeuralProgramSynthesizerV6(NeuralProgramSynthesizerV2):
    """Hierarchical decoder: opcode first, then operands conditioned on opcode."""
    version = "hierarchical-opcode-conditioned-v6"

    def __init__(self, vocab: int = 2048, hidden: int = 64, latent_dim: int = 64,
                 max_len: int = 48, max_b: int = 64, layers: int = 2, heads: int = 4,
                 family_count: int = len(FAMILY_ORDER)):
        super().__init__(vocab=vocab, hidden=hidden, latent_dim=latent_dim, max_len=max_len,
                         max_b=max_b, layers=layers, heads=heads, family_count=family_count)
        self.op_condition = nn.Embedding(OPS, hidden)
        self.operand_norm = nn.LayerNorm(hidden)

    def _heads(self, h: torch.Tensor, op_ids: torch.Tensor):
        ctx = self.operand_norm(h + self.op_condition(op_ids))
        return self.op_head(ctx), self.a_head(ctx), self.b_head(ctx)

    def forward_teacher(self, text: str, code: Program, family_id: int = 0, latent: Optional[torch.Tensor] = None):
        cond, family_logits = self._condition_with_family(text, family_id, latent)
        L = self.max_len; device = cond.device
        prev = torch.tensor([[14,0,0]], device=device, dtype=torch.long)
        xs=[]; op_logits=[]; a_logits=[]; b_logits=[]; oy=[]; ay=[]; by=[]
        for s in range(L):
            xs.append(self._embed_prev(prev,s,cond.squeeze(1)))
            y = code[s] if s < len(code) else (14,0,0)
            op,a,b = int(y[0])%OPS, int(y[1])%REGS, max(0,min(self.max_b-1,int(y[2])))
            oy.append(op); ay.append(a); by.append(b)
            prev=torch.tensor([[op,a,b]],device=device,dtype=torch.long)
        x=torch.cat(xs,1); mask=torch.triu(torch.full((L,L),float('-inf'),device=device),diagonal=1)
        h=self.norm(self.decoder(x,mask=mask))
        op_y=torch.tensor(oy,device=device)
        ol,al,bl=self._heads(h,op_y)
        return {'op':ol,'a':al,'b':bl,'family_logits':family_logits,
                'op_y':op_y,'a_y':torch.tensor(ay,device=device),'b_y':torch.tensor(by,device=device)}

    def forward_scheduled(self,text:str,code:Program,family_id:int=0,teacher_forcing:float=1.0,latent:Optional[torch.Tensor]=None):
        cond,family_logits=self._condition_with_family(text,family_id,latent); L=self.max_len; device=cond.device
        prev=torch.tensor([[14,0,0]],device=device,dtype=torch.long); xs=[]; ops=[]; aas=[]; bbs=[]; oy=[]; ay=[]; by=[]
        tf=max(0.0,min(1.0,float(teacher_forcing)))
        for s in range(L):
            xs.append(self._embed_prev(prev,s,cond.squeeze(1)))
            x=torch.cat(xs,1); mask=torch.triu(torch.full((x.size(1),x.size(1)),float('-inf'),device=device),diagonal=1)
            h_seq=self.norm(self.decoder(x,mask=mask)); h=h_seq[:,-1]
            if s<len(code): y=code[s]
            else: y=(14,0,0)
            op,a,b=int(y[0])%OPS,int(y[1])%REGS,max(0,min(self.max_b-1,int(y[2])))
            probe_op=self.op_head(h)
            used_op=op if (s==0 or torch.rand((),device=device).item()<tf) else int(probe_op.argmax(-1).item())
            ol,al,bl=self._heads(h,torch.tensor([used_op],device=device))
            ops.append(ol.squeeze(0)); aas.append(al.squeeze(0)); bbs.append(bl.squeeze(0)); oy.append(op); ay.append(a); by.append(b)
            next_op=op if (s==0 or torch.rand((),device=device).item()<tf) else int(probe_op.argmax(-1).item())
            next_a=int(al.argmax(-1).item()) if next_op==used_op else a
            next_b=int(bl.argmax(-1).item()) if next_op==used_op else b
            prev=torch.tensor([[next_op,next_a,next_b]],device=device,dtype=torch.long)
        return {'op':torch.stack(ops,1),'a':torch.stack(aas,1),'b':torch.stack(bbs,1),'family_logits':family_logits,
                'op_y':torch.tensor(oy,device=device),'a_y':torch.tensor(ay,device=device),'b_y':torch.tensor(by,device=device)}

    @torch.no_grad()
    def generate(self,text:str,family_id:int=0,latent:Optional[torch.Tensor]=None,max_len:Optional[int]=None)->Program:
        self.eval(); L=min(int(max_len or self.max_len),self.max_len); cond,_=self._condition_with_family(text,family_id,latent); device=cond.device
        generated=[]; prefix=torch.tensor([[[14,0,0]]],device=device,dtype=torch.long)
        for s in range(L):
            xs=[self._embed_prev(prefix[:,i,:],i,cond.squeeze(1)) for i in range(prefix.size(1))]
            x=torch.cat(xs,1); mask=torch.triu(torch.full((x.size(1),x.size(1)),float('-inf'),device=device),diagonal=1)
            h=self.norm(self.decoder(x,mask=mask))[:,-1]
            op_logits=self.op_head(h); op=int(op_logits.argmax(-1).item())
            _,a_logits,b_logits=self._heads(h,torch.tensor([op],device=device))
            a=int(a_logits.argmax(-1).item()); b=int(b_logits.argmax(-1).item()); trip=(op,a,b)
            generated.append(trip)
            if op==14: break
            prefix=torch.cat([prefix,torch.tensor([[[op,a,b]]],device=device,dtype=torch.long)],1)
        if not generated or generated[-1][0]!=14:
            generated=generated[:max(1,L-2)]+[(13,0,0),(14,0,0)]
        return generated[:L]


class NeuralProgramTrainerV6:
    def __init__(self, model: NeuralProgramSynthesizerV6, seed: int = 5601, lr: float = 8e-4):
        self.model=model; self.seed=seed; self.steps=0; torch.manual_seed(seed)
        self.opt=torch.optim.AdamW(model.parameters(),lr=lr,weight_decay=1e-4)

    def fit(self, rows: Sequence[Tuple[str,Program,int]], epochs:int=16, max_examples:int=128, teacher_forcing_start:float=1.0, teacher_forcing_end:float=0.5):
        import random
        data=list(rows)[:max_examples]; self.model.train(); last=None
        rng=random.Random(self.seed)
        for epoch in range(max(1,epochs)):
            rng.shuffle(data); frac=epoch/max(1,epochs-1); tf=teacher_forcing_start+frac*(teacher_forcing_end-teacher_forcing_start)
            for text,code,fid in data:
                out=self.model.forward_scheduled(text,code,fid,teacher_forcing=tf)
                w=torch.ones_like(out['op_y'],dtype=torch.float32); w[max(0,len(code)):]=0.25
                lo=(F.cross_entropy(out['op'].reshape(-1,OPS),out['op_y'],reduction='none')*w).mean()
                la=F.cross_entropy(out['a'].reshape(-1,REGS),out['a_y'])
                lb=F.cross_entropy(out['b'].reshape(-1,self.model.max_b),out['b_y'])
                fy=torch.tensor([int(fid)%self.model.family_count],device=out['family_logits'].device)
                lf=F.cross_entropy(out['family_logits'],fy)
                loss=lo+0.5*la+0.5*lb+0.2*lf
                self.opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(self.model.parameters(),1.0); self.opt.step(); self.steps+=1; last=float(loss.detach())
        return {'loss':last or 0.0,'steps':self.steps,'examples':len(data),'epochs':max(1,epochs)}
