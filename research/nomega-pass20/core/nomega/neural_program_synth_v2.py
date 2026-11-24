from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple
import random, math
import torch
import torch.nn as nn
import torch.nn.functional as F
from .generalist_core import encode_text

Program = List[Tuple[int,int,int]]
OPS=20; REGS=4; MAX_B=64; MAX_LEN=48

@dataclass
class ProgramTrainReportV2:
    loss: float
    op_loss: float
    a_loss: float
    b_loss: float
    examples: int
    epochs: int
    steps: int
    replay_events: int = 0
    replay_rows: int = 0
    replay_hook_errors: int = 0
    family_loss: float = 0.0

class ProgramAugmenterV2:
    """Structured augmentation: register renaming + NOPs + deterministic operand-preserving padding."""
    def __init__(self, seed:int=1901): self.rng=random.Random(seed)
    def rename(self, code:Program)->Program:
        perm=list(range(REGS)); self.rng.shuffle(perm); out=[]
        reg_ops_a={1,3,4,5,6,7,8,9,10,11,13,15,16,17,18,19}
        reg_ops_b={3,4,5,6,7,8,9,10,15,16,17,18,19}
        for op,a,b in code:
            if op in reg_ops_a: a=perm[a%REGS]
            if op in reg_ops_b: b=perm[b%REGS]
            out.append((int(op),int(a),int(b)))
        return out
    def augment(self, code:Program, n:int=4)->List[Program]:
        rows=[list(code)]
        for _ in range(max(0,n-1)):
            c=self.rename(code)
            if len(c)<MAX_LEN and self.rng.random()<0.65:
                i=self.rng.randrange(len(c)+1); c=c[:i]+[(0,0,0)]+c[i:]
            rows.append(c[:MAX_LEN])
        return rows

class NeuralProgramSynthesizerV2(nn.Module):
    """Transformer-backed program decoder. Small enough for mobile experiments, but uses cross-position attention."""
    def __init__(self,vocab:int=2048,hidden:int=64,latent_dim:int=64,max_len:int=48,max_b:int=64,layers:int=2,heads:int=4,family_count:int=64):
        super().__init__(); self.vocab=vocab; self.hidden=hidden; self.latent_dim=latent_dim; self.max_len=max_len; self.max_b=max_b; self.layers=layers; self.heads=heads; self.family_count=int(family_count)
        self.text=nn.Embedding(vocab,hidden); self.family=nn.Embedding(self.family_count,hidden); self.pos=nn.Embedding(max_len,hidden)
        self.op_emb=nn.Embedding(OPS,hidden//4); self.a_emb=nn.Embedding(REGS,hidden//4); self.b_emb=nn.Embedding(max_b,hidden-hidden//2)
        self.latent_proj=nn.Linear(latent_dim,hidden)
        self.family_head=nn.Linear(hidden,self.family_count)
        layer=nn.TransformerEncoderLayer(d_model=hidden,nhead=heads,dim_feedforward=hidden*3,batch_first=True,norm_first=False,activation='gelu')
        self.decoder=nn.TransformerEncoder(layer,num_layers=layers)
        self.op_head=nn.Linear(hidden,OPS); self.a_head=nn.Linear(hidden,REGS); self.b_head=nn.Linear(hidden,max_b)
        self.norm=nn.LayerNorm(hidden)
    def _condition_with_family(self,text:str,family_id:Optional[int]=0,latent:Optional[torch.Tensor]=None):
        ids=encode_text(text,length=24,vocab=self.vocab).unsqueeze(0)
        base=self.text(ids).mean(1)
        family_logits=self.family_head(base)
        if family_id is None:
            weights=torch.softmax(family_logits,dim=-1)
            fam_vec=weights @ self.family.weight
        else:
            fam_vec=self.family(torch.tensor([int(family_id)%self.family_count],device=ids.device))
        z=base+fam_vec
        if latent is not None:
            if latent.dim()==1: latent=latent.unsqueeze(0)
            z=z+self.latent_proj(latent.float().to(z.device))
        return z.unsqueeze(1), family_logits

    def condition(self,text:str,family_id:Optional[int]=0,latent:Optional[torch.Tensor]=None)->torch.Tensor:
        z,_=self._condition_with_family(text,family_id,latent)
        return z
    def _token(self,trip:torch.Tensor)->torch.Tensor:
        return torch.cat([self.op_emb(trip[:,0]),self.a_emb(trip[:,1]),self.b_emb(trip[:,2])],-1)
    def _embed_prev(self,prev:torch.Tensor, step:int, cond:torch.Tensor)->torch.Tensor:
        tok=self._token(prev)
        z=F.pad(tok,(0,self.hidden-tok.size(-1)))
        p=self.pos(torch.tensor([step],device=z.device)).view(1,1,-1)
        return z+p+cond
    def forward_teacher(self,text:str,code:Program,family_id:int=0,latent:Optional[torch.Tensor]=None)->Dict[str,torch.Tensor]:
        cond,family_logits=self._condition_with_family(text,family_id,latent); L=self.max_len; device=cond.device
        prev=torch.tensor([[14,0,0]],device=device,dtype=torch.long); xs=[]; oy=[]; ay=[]; by=[]
        for s in range(L):
            xs.append(self._embed_prev(prev,s,cond.squeeze(1)))
            if s<len(code): op,a,b=code[s]
            else: op,a,b=14,0,0
            oy.append(int(op)%OPS); ay.append(int(a)%REGS); by.append(max(0,min(self.max_b-1,int(b))))
            prev=torch.tensor([[oy[-1],ay[-1],by[-1]]],device=device,dtype=torch.long)
        x=torch.cat(xs,1); mask=torch.triu(torch.full((L,L),float('-inf'),device=device),diagonal=1)
        h=self.norm(self.decoder(x,mask=mask))
        return {'op':self.op_head(h),'a':self.a_head(h),'b':self.b_head(h),
                'op_y':torch.tensor(oy,device=device),'a_y':torch.tensor(ay,device=device),'b_y':torch.tensor(by,device=device)}

    def forward_scheduled(self,text:str,code:Program,family_id:int=0,teacher_forcing:float=1.0,latent:Optional[torch.Tensor]=None)->Dict[str,torch.Tensor]:
        """Train with inference-matched autoregressive prefixes.

        At each step the causal Transformer is evaluated on the complete prefix
        constructed so far. The next input token is then selected from either the
        ground-truth program token or the model prediction. This is intentionally
        more expensive than pure teacher forcing but matches deployment semantics.
        """
        cond,family_logits=self._condition_with_family(text,family_id,latent); L=self.max_len; device=cond.device
        prev=torch.tensor([[14,0,0]],device=device,dtype=torch.long); xs=[]; ops=[]; aas=[]; bbs=[]; oy=[]; ay=[]; by=[]
        tf=max(0.0,min(1.0,float(teacher_forcing)))
        for s in range(L):
            xs.append(self._embed_prev(prev,s,cond.squeeze(1)))
            x=torch.cat(xs,1)
            mask=torch.triu(torch.full((x.size(1),x.size(1)),float('-inf'),device=device),diagonal=1)
            h_seq=self.norm(self.decoder(x,mask=mask))
            h=h_seq[:,-1]
            op_logits=self.op_head(h); a_logits=self.a_head(h); b_logits=self.b_head(h)
            ops.append(op_logits); aas.append(a_logits); bbs.append(b_logits)
            if s<len(code): op,a,b=code[s]
            else: op,a,b=14,0,0
            y=(int(op)%OPS,int(a)%REGS,max(0,min(self.max_b-1,int(b))))
            oy.append(y[0]); ay.append(y[1]); by.append(y[2])
            use_teacher=(s==0) or (torch.rand((),device=device).item()<tf)
            if use_teacher:
                prev=torch.tensor([[y[0],y[1],y[2]]],device=device,dtype=torch.long)
            else:
                prev=torch.tensor([[int(op_logits.argmax(-1).item()),int(a_logits.argmax(-1).item()),int(b_logits.argmax(-1).item())]],device=device,dtype=torch.long)
        return {
            'op':torch.stack(ops,1),'a':torch.stack(aas,1),'b':torch.stack(bbs,1),'family_logits':family_logits,
            'op_y':torch.tensor(oy,device=device),'a_y':torch.tensor(ay,device=device),'b_y':torch.tensor(by,device=device)
        }

    @torch.no_grad()
    def score_program(self,text:str,code:Program,family_id:int=0,latent:Optional[torch.Tensor]=None)->float:
        out=self.forward_teacher(text,code,family_id,latent)
        lo=F.cross_entropy(out['op'].reshape(-1,OPS),out['op_y'])
        la=F.cross_entropy(out['a'].reshape(-1,REGS),out['a_y'])
        lb=F.cross_entropy(out['b'].reshape(-1,self.max_b),out['b_y'])
        return float(-(lo+0.5*la+0.5*lb).detach())

    @torch.no_grad()
    def generate_constrained(self,text:str,family_id:int=0,latent:Optional[torch.Tensor]=None,max_len:Optional[int]=None)->Program:
        """Neural-only constrained decoding over semantically valid TinyVM instructions.

        The network still produces the original factorized opcode/A/B distributions.
        We combine their log-probabilities and select only instruction triples that
        are legal under the TinyVM grammar. No executor, verifier or deterministic
        repair participates in inference.
        """
        from .neural_program_synth_v4 import InstructionVocabularyV1
        self.eval(); L=min(int(max_len or self.max_len), self.max_len); device=next(self.parameters()).device
        cond,_=self._condition_with_family(text,family_id,latent)
        vocab=InstructionVocabularyV1(max_b=self.max_b,max_len=L)
        token_op=torch.tensor([x[0] for x in vocab.tokens],device=device)
        token_a=torch.tensor([x[1] for x in vocab.tokens],device=device)
        token_b=torch.tensor([x[2] for x in vocab.tokens],device=device)
        prefix=torch.tensor([[[14,0,0]]],device=device,dtype=torch.long); generated=[]
        for step in range(L):
            xs=[self._embed_prev(prefix[:,i,:],i,cond.squeeze(1)) for i in range(prefix.size(1))]
            x=torch.cat(xs,dim=1); mask=torch.triu(torch.full((x.size(1),x.size(1)),float('-inf'),device=device),diagonal=1)
            h=self.norm(self.decoder(x,mask=mask))[:,-1]
            op=F.log_softmax(self.op_head(h),-1); a=F.log_softmax(self.a_head(h),-1); b=F.log_softmax(self.b_head(h),-1)
            joint=op[:,token_op]+a[:,token_a]+b[:,token_b]
            tid=int(joint.argmax(-1).item()); trip=vocab.tokens[tid]
            generated.append(tuple(map(int,trip)))
            if trip[0]==14: break
            prefix=torch.cat([prefix,torch.tensor([[list(trip)]],device=device,dtype=torch.long)],dim=1)
        if not generated or generated[-1][0]!=14:
            generated=generated[:max(1,L-2)]+[(13,0,0),(14,0,0)]
        return generated[:L]

    @torch.no_grad()
    def generate_constrained_beam(self,text:str,family_id:int=0,latent:Optional[torch.Tensor]=None,max_len:Optional[int]=None,beam_size:int=4)->Program:
        """Pure-neural beam search over the legal joint TinyVM instruction space."""
        from .neural_program_synth_v4 import InstructionVocabularyV1
        self.eval(); L=min(int(max_len or self.max_len), self.max_len); device=next(self.parameters()).device
        cond,_=self._condition_with_family(text,family_id,latent); vocab=InstructionVocabularyV1(max_b=self.max_b,max_len=L)
        token_op=torch.tensor([x[0] for x in vocab.tokens],device=device)
        token_a=torch.tensor([x[1] for x in vocab.tokens],device=device)
        token_b=torch.tensor([x[2] for x in vocab.tokens],device=device)
        beams=[([],0.0,False)]
        for step in range(L):
            expanded=[]
            for code,score,done in beams:
                if done:
                    expanded.append((code,score,done)); continue
                prefix=torch.tensor([[[14,0,0]]+[list(x) for x in code]],device=device,dtype=torch.long)
                xs=[self._embed_prev(prefix[:,i,:],i,cond.squeeze(1)) for i in range(prefix.size(1))]
                x=torch.cat(xs,dim=1); mask=torch.triu(torch.full((x.size(1),x.size(1)),float('-inf'),device=device),diagonal=1)
                h=self.norm(self.decoder(x,mask=mask))[:,-1]
                op=F.log_softmax(self.op_head(h),-1); a=F.log_softmax(self.a_head(h),-1); b=F.log_softmax(self.b_head(h),-1)
                joint=(op[:,token_op]+a[:,token_a]+b[:,token_b])[0]
                k=min(max(1,int(beam_size)),joint.numel()); vals,idxs=torch.topk(joint,k)
                for val,tid in zip(vals.tolist(),idxs.tolist()):
                    trip=tuple(map(int,vocab.tokens[int(tid)])); expanded.append((code+[trip],score+float(val),trip[0]==14))
            expanded.sort(key=lambda x:x[1]/max(1,len(x[0])),reverse=True); beams=expanded[:max(1,int(beam_size))]
            if beams and all(x[2] for x in beams): break
        best=max(beams,key=lambda x:x[1]/max(1,len(x[0]))) if beams else ([(13,0,0),(14,0,0)],-1e9,True)
        code=best[0]
        if not code or code[-1][0]!=14: code=code[:max(1,L-2)]+[(13,0,0),(14,0,0)]
        return code[:L]

    @torch.no_grad()
    def generate(self,text:str,family_id:int=0,latent:Optional[torch.Tensor]=None,max_len:Optional[int]=None)->Program:
        """Autoregressively decode with the full generated prefix at every step.

        The training path is causal and conditions position ``s`` on all previous
        tokens.  Generation must therefore preserve that same information flow;
        feeding only the last token creates a train/inference mismatch.
        """
        self.eval(); L=max_len or self.max_len; cond,_family_logits=self._condition_with_family(text,family_id,latent); device=cond.device
        generated=[]
        prefix=torch.tensor([[[14,0,0]]],device=device,dtype=torch.long)  # [batch,time,token] BOS sentinel
        for s in range(L):
            xs=[self._embed_prev(prefix[:,i,:],i,cond.squeeze(1)) for i in range(prefix.size(1))]
            x=torch.cat(xs,dim=1)
            mask=torch.triu(torch.full((x.size(1),x.size(1)),float('-inf'),device=device),diagonal=1)
            h=self.norm(self.decoder(x,mask=mask))[:,-1]
            op=int(self.op_head(h).argmax(-1).item()); a=int(self.a_head(h).argmax(-1).item()); b=int(self.b_head(h).argmax(-1).item())
            generated.append((op,a,b))
            if op==14: break
            tok=torch.tensor([[[op,a,b]]],device=device,dtype=torch.long)
            prefix=torch.cat([prefix,tok],dim=1)
        if not generated or generated[-1][0]!=14:
            generated=generated[:max(1,L-2)]+[(13,0,0),(14,0,0)]
        return generated[:L]

class NeuralProgramTrainerV2:
    def __init__(self,model:NeuralProgramSynthesizerV2,seed:int=1902,lr:float=8e-4):
        self.model=model; self.opt=torch.optim.AdamW(model.parameters(),lr=lr,weight_decay=1e-4); self.seed=seed; self.steps=0; random.seed(seed); torch.manual_seed(seed)
    def fit(self,rows:Sequence[Tuple[str,Program,int]],epochs:int=16,max_examples:int=128,hard_rows:Sequence[Tuple[str,Program,int]]|None=None,teacher_forcing_start:float=1.0,teacher_forcing_end:float=1.0, replay_controller=None, replay_provider=None, replay_max_items:int=8, replay_ranker=None, continual_strategy=None, continual_reference_rows:Sequence[Tuple[str,Program,int]]|None=None, continual_reference_max:int=8)->ProgramTrainReportV2:
        rows=list(rows); hard=list(hard_rows or [])
        if hard:
            rows = hard[:max_examples//2] + rows[:max_examples-len(hard[:max_examples//2])]
        random.Random(self.seed+self.steps).shuffle(rows); rows=rows[:max_examples]
        if not rows: return ProgramTrainReportV2(0,0,0,0,0,0,0)
        self.model.train(); last=ops=aas=bbs=0.0; famlosses=[]
        replay_events=0; replay_rows_total=0; replay_hook_errors=0
        reference_state={k:v.detach().clone() for k,v in self.model.state_dict().items()}
        if continual_strategy is not None and continual_reference_rows is not None and hasattr(continual_strategy, 'prepare'):
            continual_strategy.prepare(self.model, list(continual_reference_rows), max_examples=continual_reference_max)
        pending_replay=False
        total_epochs=max(1,epochs)
        for epoch in range(total_epochs):
            frac=epoch/max(1,total_epochs-1)
            tf=float(teacher_forcing_start + frac*(teacher_forcing_end-teacher_forcing_start))
            ls=[]; ol=[]; al=[]; bl=[]
            epoch_rows=list(rows)
            if pending_replay and replay_controller is not None and replay_provider is not None:
                try:
                    extra=list(replay_provider(max(1,int(replay_max_items))))
                    if replay_ranker is not None and extra:
                        extra=list(replay_ranker(self.model, epoch_rows[:2], extra, limit=max(1,int(replay_max_items))))
                    if extra:
                        # Fixed example budget: replay changes composition, not total step budget.
                        epoch_rows=(epoch_rows + extra)[:max_examples]
                        replay_events += 1; replay_rows_total += len(extra)
                except Exception as exc:
                    replay_hook_errors += 1
                    if hasattr(replay_controller, 'record_hook_error'):
                        replay_controller.record_hook_error(step=self.steps, error_type=type(exc).__name__)
                finally:
                    pending_replay=False
            for text,code,fid in epoch_rows:
                out=self.model.forward_scheduled(text,code,fid,teacher_forcing=tf) if tf < 0.999999 else self.model.forward_teacher(text,code,fid)
                lo=F.cross_entropy(out['op'].reshape(-1,OPS),out['op_y'])
                la=F.cross_entropy(out['a'].reshape(-1,REGS),out['a_y'])
                lb=F.cross_entropy(out['b'].reshape(-1,self.model.max_b),out['b_y'])
                # Early positions matter more; HALT tail is less informative.
                w=torch.ones_like(out['op_y'],dtype=torch.float32); w[max(0,len(code)):]=0.25
                l=(F.cross_entropy(out['op'].reshape(-1,OPS),out['op_y'],reduction='none')*w).mean()+0.5*la+0.5*lb
                if int(fid) >= 0 and out.get('family_logits') is not None:
                    fy=torch.tensor([int(fid)%self.model.family_count],device=out['family_logits'].device)
                    fl=F.cross_entropy(out['family_logits'],fy)
                    l=l+0.20*fl; famlosses.append(float(fl.detach()))
                if continual_strategy is not None and hasattr(continual_strategy, 'penalty'):
                    l = l + continual_strategy.penalty(self.model)
                self.opt.zero_grad(set_to_none=True); l.backward()
                if continual_strategy is not None and hasattr(continual_strategy, 'project'):
                    continual_strategy.project(self.model)
                torch.nn.utils.clip_grad_norm_(self.model.parameters(),1.0); self.opt.step(); self.steps+=1
                ls.append(float(l.detach())); ol.append(float(lo.detach())); al.append(float(la.detach())); bl.append(float(lb.detach()))
            last,ops,aas,bbs=map(lambda x:sum(x)/len(x),(ls,ol,al,bl))
            if replay_controller is not None and epoch >= 0:
                try:
                    delta=float(replay_controller.parameter_delta(self.model, reference_state))
                    decision=replay_controller.decide(step=self.steps, parameter_delta=delta, loss=last, uncertainty=0.0)
                    pending_replay=bool(decision.trigger)
                except Exception as exc:
                    replay_hook_errors += 1
                    if hasattr(replay_controller, 'record_hook_error'):
                        replay_controller.record_hook_error(step=self.steps, error_type=type(exc).__name__)
                    pending_replay=False
                reference_state={k:v.detach().clone() for k,v in self.model.state_dict().items()}
        fam_loss=sum(famlosses)/max(1,len(famlosses))
        return ProgramTrainReportV2(last,ops,aas,bbs,len(rows),total_epochs,self.steps,replay_events,replay_rows_total,replay_hook_errors,fam_loss)
    @staticmethod
    def save(path,model,report=None):
        payload={'architecture':{'vocab':model.vocab,'hidden':model.hidden,'latent_dim':model.latent_dim,'max_len':model.max_len,'max_b':model.max_b,'layers':model.layers,'heads':model.heads,'family_count':model.family_count},'model':model.state_dict(),'report':getattr(report,'__dict__',report or {})}
        path.parent.mkdir(parents=True,exist_ok=True); torch.save(payload,path)
    @staticmethod
    def load(path):
        blob=torch.load(path,map_location='cpu',weights_only=False); a=dict(blob['architecture']); a.setdefault('layers',2); a.setdefault('heads',4); a.setdefault('family_count',64); m=NeuralProgramSynthesizerV2(**a); m.load_state_dict(blob['model']); return m,blob.get('report',{})
