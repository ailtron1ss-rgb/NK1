from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List, Sequence, Tuple, Optional
import random
import torch
import torch.nn as nn
import torch.nn.functional as F

from .generalist_core import encode_text

Program = List[Tuple[int, int, int]]
OPS = 20
REGS = 4
MAX_B = 64
MAX_LEN = 48

@dataclass
class NeuralProgramTrainReport:
    loss: float
    op_loss: float
    a_loss: float
    b_loss: float
    examples: int
    epochs: int
    steps: int = 0

class ProgramAugmenterV1:
    """Semantics-preserving register renaming + safe NOP injection."""
    def __init__(self, seed: int = 18):
        self.rng = random.Random(seed)

    def rename_registers(self, code: Program) -> Program:
        perm = list(range(REGS)); self.rng.shuffle(perm)
        out=[]
        for op,a,b in code:
            op,a,b=int(op),int(a),int(b)
            if op in (1,2,8,9,10,11,12,13,15,16,17,18,19):
                a = perm[a % REGS]
            # b is a register for these ops; LOAD/STORE use tape index.
            if op in (3,4,5,6,7,10,15,17,18,19):
                b = perm[b % REGS]
            out.append((op,a,b))
        return out

    def inject_nops(self, code: Program, rate: float = 0.10) -> Program:
        out=[]
        for ins in code:
            if self.rng.random() < rate and len(out) < MAX_LEN-1:
                out.append((0,0,0))
            out.append(tuple(ins))
        return out[:MAX_LEN]

    def augment(self, code: Program, n: int = 4) -> List[Program]:
        rows=[list(map(tuple,code))]
        for _ in range(max(0,n-1)):
            c=self.rename_registers(code)
            c=self.inject_nops(c, rate=0.12)
            rows.append(c)
        return rows

class _FamilyEncoder(nn.Module):
    def __init__(self, vocab: int, hidden: int):
        super().__init__()
        self.emb=nn.Embedding(vocab, hidden)
        self.norm=nn.LayerNorm(hidden)
        self.proj=nn.Sequential(nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, hidden))
    def forward(self, ids: torch.Tensor) -> torch.Tensor:
        z=self.norm(self.emb(ids).mean(1))
        return self.proj(z)

class NeuralProgramSynthesizerV1(nn.Module):
    """Compact autoregressive program generator conditioned on task text and optional latent state."""
    def __init__(self, vocab: int = 2048, hidden: int = 96, latent_dim: int = 96,
                 max_len: int = MAX_LEN, max_b: int = MAX_B):
        super().__init__()
        self.vocab=vocab; self.hidden=hidden; self.latent_dim=latent_dim; self.max_len=max_len; self.max_b=max_b
        self.cond=_FamilyEncoder(vocab, hidden)
        self.latent_proj=nn.Linear(latent_dim, hidden)
        self.op_emb=nn.Embedding(OPS, hidden//3)
        self.a_emb=nn.Embedding(REGS, hidden//3)
        self.b_emb=nn.Embedding(max_b, hidden - 2*(hidden//3))
        self.decoder=nn.GRUCell(hidden + hidden//3 + hidden//3 + (hidden - 2*(hidden//3)), hidden)
        self.op_head=nn.Linear(hidden, OPS)
        self.a_head=nn.Linear(hidden, REGS)
        self.b_head=nn.Linear(hidden, max_b)

    def condition(self, text: str, latent: Optional[torch.Tensor] = None) -> torch.Tensor:
        ids=encode_text(text, length=32, vocab=self.vocab).unsqueeze(0)
        z=self.cond(ids)
        if latent is not None:
            if latent.dim()==1: latent=latent.unsqueeze(0)
            z=z + self.latent_proj(latent.to(z.device).float())
        return z

    def forward_teacher(self, text: str, code: Program, latent: Optional[torch.Tensor]=None) -> Dict[str, torch.Tensor]:
        h=self.condition(text,latent)
        bos=torch.tensor([[14,0,0]],device=h.device,dtype=torch.long)  # HALT as inert BOS token
        prev=bos
        ops=[]; aa=[]; bb=[]
        op_y=[]; a_y=[]; b_y=[]
        for step in range(self.max_len):
            opi,ai,bi=prev[:,0],prev[:,1],prev[:,2]
            inp=torch.cat([h,self.op_emb(opi),self.a_emb(ai),self.b_emb(bi)],-1)
            h=self.decoder(inp,h)
            ops.append(self.op_head(h)); aa.append(self.a_head(h)); bb.append(self.b_head(h))
            if step < len(code):
                y=code[step]; op, a, b=int(y[0])%OPS,int(y[1])%REGS,max(0,min(self.max_b-1,int(y[2])))
            else:
                op,a,b=14,0,0
            prev=torch.tensor([[op,a,b]],device=h.device,dtype=torch.long)
            op_y.append(op); a_y.append(a); b_y.append(b)
        return {
            'op':torch.stack(ops,1), 'a':torch.stack(aa,1), 'b':torch.stack(bb,1),
            'op_y':torch.tensor(op_y,device=h.device), 'a_y':torch.tensor(a_y,device=h.device), 'b_y':torch.tensor(b_y,device=h.device),
        }

    @torch.no_grad()
    def generate(self, text: str, latent: Optional[torch.Tensor]=None, max_len: Optional[int]=None, top_k: int = 3) -> Program:
        self.eval(); L=max_len or self.max_len
        h=self.condition(text,latent)
        prev=torch.tensor([[14,0,0]],device=h.device,dtype=torch.long)
        code=[]
        for _ in range(L):
            inp=torch.cat([h,self.op_emb(prev[:,0]),self.a_emb(prev[:,1]),self.b_emb(prev[:,2])],-1)
            h=self.decoder(inp,h)
            op_logits=self.op_head(h); a_logits=self.a_head(h); b_logits=self.b_head(h)
            k=min(max(1, int(top_k)), OPS); op=int(torch.topk(op_logits, k=k, dim=-1).indices[0, 0])
            a=int(a_logits.argmax(-1).item()); b=int(b_logits.argmax(-1).item())
            if op==14:
                code.append((14,0,0)); break
            code.append((op,a,b)); prev=torch.tensor([[op,a,b]],device=h.device,dtype=torch.long)
        if not code or code[-1][0]!=14:
            code=code[:max(1,L-1)]+[(13,0,0),(14,0,0)]
        return [tuple(x) for x in code[:L]]


    @torch.no_grad()
    def generate_beam(self, text: str, latent: Optional[torch.Tensor]=None, max_len: Optional[int]=None, beam_size: int=4) -> List[Program]:
        """Small bounded beam search over instruction triples.
        Scores log-probability of op/a/b jointly and terminates on HALT."""
        self.eval(); L=max_len or self.max_len; beam_size=max(1,int(beam_size))
        h0=self.condition(text,latent)
        beams=[([],h0,torch.tensor([[14,0,0]],device=h0.device,dtype=torch.long),0.0,False)]
        for _ in range(L):
            nxt=[]
            for code,h,prev,score,done in beams:
                if done:
                    nxt.append((code,h,prev,score,done)); continue
                inp=torch.cat([h,self.op_emb(prev[:,0]),self.a_emb(prev[:,1]),self.b_emb(prev[:,2])],-1)
                nh=self.decoder(inp,h)
                lp_op=F.log_softmax(self.op_head(nh),-1); lp_a=F.log_softmax(self.a_head(nh),-1); lp_b=F.log_softmax(self.b_head(nh),-1)
                ko=min(3,OPS); ka=min(2,REGS); kb=min(4,self.max_b)
                vo,io=torch.topk(lp_op,ko,dim=-1); va,ia=torch.topk(lp_a,ka,dim=-1); vb,ib=torch.topk(lp_b,kb,dim=-1)
                combos=[]
                for oi,opscore in zip(io[0].tolist(),vo[0].tolist()):
                    for ai,ascore in zip(ia[0].tolist(),va[0].tolist()):
                        for bi,bscore in zip(ib[0].tolist(),vb[0].tolist()):
                            combos.append((opscore+ai and 0.0, oi, ai, bi, float(opscore+ascore+bscore)))
                combos.sort(key=lambda x:x[-1],reverse=True)
                for _,op,aa,bb,sc in combos[:beam_size*2]:
                    ncode=code+[(op,aa,bb)]
                    ndone=(op==14) or len(ncode)>=L
                    np=torch.tensor([[14 if op==14 else op,0 if op==14 else aa,0 if op==14 else bb]],device=h.device,dtype=torch.long)
                    nxt.append((ncode,nh,np,score+sc,ndone))
            nxt.sort(key=lambda x:x[3],reverse=True); beams=nxt[:beam_size]
            if all(b[4] for b in beams): break
        out=[]
        for code,_,_,_,_ in sorted(beams,key=lambda x:x[3],reverse=True):
            c=code[:L]
            if not c or c[-1][0]!=14: c=c[:max(1,L-2)]+[(13,0,0),(14,0,0)]
            out.append(c)
        return out

class NeuralProgramTrainerV1:
    def __init__(self, model: Optional[NeuralProgramSynthesizerV1]=None, seed: int=19, lr: float=3e-4):
        torch.manual_seed(seed); random.seed(seed)
        self.model=model or NeuralProgramSynthesizerV1(); self.opt=torch.optim.AdamW(self.model.parameters(),lr=lr,weight_decay=1e-4); self.steps=0

    def fit(self, rows: Sequence[Tuple[str,Program]], epochs: int=8, max_examples: int=128) -> NeuralProgramTrainReport:
        last=op_loss=a_loss=b_loss=0.0
        if len(rows) > max_examples:
            rows=random.sample(list(rows), max_examples)
        n=len(rows)
        if not rows: return NeuralProgramTrainReport(0.,0.,0.,0.,0,0,0)
        self.model.train()
        for _ in range(max(1,epochs)):
            losses=[]; ops=[]; aas=[]; bbs=[]
            order=list(rows); random.shuffle(order)
            for text,code in order:
                out=self.model.forward_teacher(text,code)
                lo=F.cross_entropy(out['op'].reshape(-1,OPS),out['op_y'])
                la=F.cross_entropy(out['a'].reshape(-1,REGS),out['a_y'])
                lb=F.cross_entropy(out['b'].reshape(-1,self.model.max_b),out['b_y'])
                loss=lo+0.6*la+0.6*lb
                self.opt.zero_grad(set_to_none=True); loss.backward(); torch.nn.utils.clip_grad_norm_(self.model.parameters(),1.0); self.opt.step()
                losses.append(float(loss.detach())); ops.append(float(lo.detach())); aas.append(float(la.detach())); bbs.append(float(lb.detach())); self.steps+=1
            last=sum(losses)/len(losses); op_loss=sum(ops)/len(ops); a_loss=sum(aas)/len(aas); b_loss=sum(bbs)/len(bbs)
        return NeuralProgramTrainReport(last,op_loss,a_loss,b_loss,n,max(1,epochs),self.steps)

    @staticmethod
    def save(path, model, report: Optional[NeuralProgramTrainReport]=None):
        payload={'architecture':{'vocab':model.vocab,'hidden':model.hidden,'latent_dim':model.latent_dim,'max_len':model.max_len,'max_b':model.max_b},'model':model.state_dict(),'report':None if report is None else report.__dict__}
        path.parent.mkdir(parents=True,exist_ok=True); torch.save(payload,path)

    @staticmethod
    def load(path, map_location='cpu'):
        blob=torch.load(path,map_location=map_location,weights_only=False); model=NeuralProgramSynthesizerV1(**blob['architecture']); model.load_state_dict(blob['model']); return model,blob
