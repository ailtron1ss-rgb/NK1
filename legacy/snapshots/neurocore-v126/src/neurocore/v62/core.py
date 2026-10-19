from __future__ import annotations
from typing import Any, Dict, Optional, Tuple
from dataclasses import dataclass
import math
from pathlib import Path
import torch
from torch import Tensor, nn
import torch.nn.functional as F
from neurocore.v61 import V61Config, mobile_v61_config, NeuralMemoryOSV61, NeuroWeaveV61, OrganismRuntimeV61, OrganismTrainerV61, RuntimeStateStoreV61
from neurocore.v60 import OrganismRuntimeV60
from neurocore.v60.core import _batch, _norm

@dataclass
class V62Config(V61Config):
    neural_memory_types_v62: int = 6
    neural_memory_type_dim_v62: int = 6
    neural_memory_typed_semantic_slots_v62: int = 10
    neural_memory_hopfield_steps_v62: int = 2
    neural_memory_hopfield_beta_v62: float = 6.0
    neural_memory_hopfield_residual_v62: float = 0.28
    neural_memory_energy_replay_weight_v62: float = 0.18
    neural_memory_consolidation_gate_v62: float = 0.58
    neural_memory_protection_v62: float = 0.12
    neural_memory_conflict_replay_weight_v62: float = 0.14
    neural_memory_replay_priority_floor_v62: float = 0.02
    neural_memory_state_version_v62: int = 1

def mobile_v62_config(raw_observation_dim: int = 9) -> V62Config:
    base = dict(mobile_v61_config(raw_observation_dim).__dict__)
    return V62Config(**base, neural_memory_types_v62=6, neural_memory_type_dim_v62=6,
        neural_memory_typed_semantic_slots_v62=10, neural_memory_hopfield_steps_v62=2,
        neural_memory_hopfield_beta_v62=6.0, neural_memory_hopfield_residual_v62=0.28,
        neural_memory_energy_replay_weight_v62=0.18, neural_memory_consolidation_gate_v62=0.58,
        neural_memory_protection_v62=0.12, neural_memory_conflict_replay_weight_v62=0.14,
        neural_memory_replay_priority_floor_v62=0.02, neural_memory_state_version_v62=1)

class CanonicalNeuralMemoryOSV62(NeuralMemoryOSV61):
    """Canonical V62 neural memory: typed traces + energy-based attractor refinement."""
    TYPE_NAMES=("episodic","semantic","procedural","autobiographical","prospective","social")
    def __init__(self,input_dim:int,*args,types:int=6,type_dim:int=6,typed_semantic_slots:int=10,
                 hopfield_steps:int=2,hopfield_beta:float=6.0,hopfield_residual:float=0.28,
                 energy_replay_weight:float=0.18,consolidation_gate:float=0.58,protection:float=0.12,
                 conflict_replay_weight:float=0.14,replay_priority_floor:float=0.02,**kwargs):
        super().__init__(input_dim,*args,**kwargs)
        self.types=max(2,int(types)); self.type_dim=max(2,int(type_dim)); self.typed_semantic_slots=max(2,int(typed_semantic_slots))
        self.hopfield_steps=max(1,int(hopfield_steps)); self.hopfield_beta=max(1.0,float(hopfield_beta)); self.hopfield_residual=max(0.,min(1.,float(hopfield_residual)))
        self.energy_replay_weight=max(0.,float(energy_replay_weight)); self.consolidation_gate=max(0.,min(1.,float(consolidation_gate))); self.protection=max(0.,min(.9,float(protection)))
        self.conflict_replay_weight=max(0.,float(conflict_replay_weight)); self.replay_priority_floor=max(0.,float(replay_priority_floor))
        h=max(12,self.hidden//2)
        self.type_embedding=nn.Parameter(torch.randn(self.types,self.type_dim)*.04)
        self.type_router=nn.Sequential(nn.Linear(self.key_dim+self.value_dim,h),nn.SiLU(),nn.Linear(h,self.types))
        self.typed_semantic_key=nn.Parameter(torch.randn(self.types,self.typed_semantic_slots,self.semantic_rank,self.key_dim)*.025)
        self.typed_semantic_value=nn.Parameter(torch.randn(self.types,self.typed_semantic_slots,self.semantic_rank,self.value_dim)*.025)
        self.typed_semantic_bias=nn.Parameter(torch.zeros(self.types,self.typed_semantic_slots))
        self.type_to_longterm=nn.Sequential(nn.Linear(self.key_dim+self.type_dim,h),nn.SiLU(),nn.Linear(h,self.value_dim))
        self.retrieval_temperature=nn.Parameter(torch.tensor(math.log(math.expm1(.12))))
        self.register_buffer('fast_type_probs',torch.zeros(self.fast_slots,self.types))
        self.register_buffer('typed_usage',torch.zeros(self.types,self.typed_semantic_slots))
        self.register_buffer('energy_trace',torch.zeros(self.fast_slots))
        self.register_buffer('memory_conflict_trace',torch.zeros(self.fast_slots))
        self.register_buffer('replay_energy',torch.zeros(self.replay_size))
        self.register_buffer('replay_conflict',torch.zeros(self.replay_size))
        self.register_buffer('typed_write_count',torch.zeros(self.types,dtype=torch.long))
    def _temp(self): return F.softplus(self.retrieval_temperature).clamp(.05,1.)
    def _type_probs(self,q,v=None):
        if v is None: v=q.new_zeros(q.shape[:-1]+(self.value_dim,))
        return F.softmax(self.type_router(torch.cat([q,v],-1)),dim=-1)
    def _hopfield_refine(self,q):
        valid=self.fast_valid.to(q)>.5
        if not bool(valid.any()): return q,q.new_zeros((q.size(0),1))
        keys=F.normalize(self.fast_keys.to(q),dim=-1); cur=F.normalize(q,dim=-1); energy=q.new_zeros((q.size(0),1))
        for _ in range(self.hopfield_steps):
            logits=self.hopfield_beta*(cur@keys.t()); logits=logits.masked_fill(~valid.view(1,-1),-50.)
            w=F.softmax(logits,dim=-1); attractor=F.normalize(w@keys,dim=-1)
            cur=F.normalize((1.-self.hopfield_residual)*cur+self.hopfield_residual*attractor,dim=-1)
            energy=-torch.logsumexp(logits,dim=-1,keepdim=True)/self.hopfield_beta
        orig_score=(q@keys.t()).max(dim=-1,keepdim=True).values
        refined_score=(cur@keys.t()).max(dim=-1,keepdim=True).values
        accept=refined_score>=orig_score
        final=torch.where(accept,cur,q)
        return final,energy
    def _typed_semantic_read(self,q,type_probs):
        keys=F.normalize(self.typed_semantic_key.to(q),dim=-1)
        scores=torch.einsum('bk,tsrk->btsr',q,keys); rank_w=F.softmax(scores/self._temp(),dim=-1)
        slot_scores=rank_w.mean(-1)+self.typed_semantic_bias.to(q).unsqueeze(0); slot_w=F.softmax(slot_scores/self._temp(),dim=-1)
        values=torch.einsum('btsr,tsrv->btsv',rank_w,self.typed_semantic_value.to(q)); typed_w=type_probs.unsqueeze(-1)*slot_w
        read=(typed_w.unsqueeze(-1)*values).sum((1,2)); flat=typed_w.reshape(q.size(0),-1); top=torch.topk(flat,k=min(2,flat.size(-1)),dim=-1).values
        conf=top[:,:1]-(top[:,1:2] if top.size(-1)>1 else 0.)
        return read,typed_w,conf
    def _typed_longterm(self,q,type_probs):
        tc=type_probs@self.type_embedding.to(q); return torch.tanh(self.type_to_longterm(torch.cat([q,tc],-1)))
    def forward(self,x:Tensor,*,update_autobiographical_state:bool=False)->Dict[str,Tensor]:
        xb=_batch(x); q0=self.query(xb)
        with torch.no_grad(): qh,energy=self._hopfield_refine(q0.detach())
        q=q0+(qh-q0).detach(); tp=self._type_probs(q)
        episode,fw,fc=self._fast_read(q); semantic,tw,sc=self._typed_semantic_read(q,tp); procedural=self._procedural_read(q); lt=self._typed_longterm(q,tp)
        auto=self.autobio_state.to(q).view(1,-1).expand(xb.size(0),-1); ar=torch.tanh(self.autobio_decoder(auto)); router=F.softmax(self.memory_router(torch.cat([q,lt],-1))/self.router_temperature,dim=-1)
        fused=self.read_projector(torch.cat([episode,semantic,lt,procedural,ar],-1)); mix=router[:,0:1]*episode+router[:,1:2]*semantic+router[:,2:3]*lt+router[:,3:4]*procedural+router[:,4:5]*ar; fused=fused+self.long_term_mix*mix
        if update_autobiographical_state:
            with torch.no_grad(): self.autobio_state.copy_(self.autobio_cell(torch.cat([episode.detach(),q.detach()],-1),self.autobio_state.to(q).view(1,-1)).detach().mean(0))
        rc=router.max(-1,keepdim=True).values-router.topk(k=min(2,router.size(-1)),dim=-1).values[:,1:2]
        conf=.28*fc+.22*sc+.18*rc+.16*torch.sigmoid(lt.norm(dim=-1,keepdim=True))+.16*torch.sigmoid(-energy)
        return {'read':fused,'fast_read':episode,'semantic_read':semantic,'long_term_read':lt,'procedural_read':procedural,'autobiographical_read':ar,'autobiographical_state':auto,'fast_weights':fw,'semantic_weights':tw,'fast_confidence':fc,'semantic_confidence':sc,'router':router,'route_confidence':rc,'confidence':conf,'query':q,'raw_query':q0,'hopfield_query':qh,'hopfield_energy':energy,'memory_type_probs':tp}
    def retrieve(self, query: Tensor) -> Dict[str, Tensor]:
        q = _batch(query)
        if q.size(-1) == self.input_dim:
            return self.forward(q)
        if q.size(-1) != self.key_dim:
            raise ValueError(f"V62 retrieve expects key_dim={self.key_dim} or input_dim={self.input_dim}, got {q.size(-1)}")
        q0 = F.normalize(q, dim=-1)
        qh, energy = self._hopfield_refine(q0)
        q = q0 + (qh - q0).detach()
        tp = self._type_probs(q)
        episode, fw, fc = self._fast_read(q)
        semantic, tw, sc = self._typed_semantic_read(q, tp)
        procedural = self._procedural_read(q)
        lt = self._typed_longterm(q, tp)
        auto = self.autobio_state.to(q).view(1,-1).expand(q.size(0),-1)
        ar = torch.tanh(self.autobio_decoder(auto))
        router = F.softmax(self.memory_router(torch.cat([q,lt],-1))/self.router_temperature, dim=-1)
        fused = self.read_projector(torch.cat([episode,semantic,lt,procedural,ar],-1))
        mix = router[:,0:1]*episode + router[:,1:2]*semantic + router[:,2:3]*lt + router[:,3:4]*procedural + router[:,4:5]*ar
        fused = fused + self.long_term_mix*mix
        rc = router.max(-1,keepdim=True).values - router.topk(k=min(2,router.size(-1)),dim=-1).values[:,1:2]
        conf = .28*fc + .22*sc + .18*rc + .16*torch.sigmoid(lt.norm(dim=-1,keepdim=True)) + .16*torch.sigmoid(-energy)
        return {'read':fused,'fast_read':episode,'semantic_read':semantic,'long_term_read':lt,'procedural_read':procedural,'autobiographical_read':ar,'autobiographical_state':auto,'fast_weights':fw,'semantic_weights':tw,'fast_confidence':fc,'semantic_confidence':sc,'router':router,'route_confidence':rc,'confidence':conf,'query':q,'raw_query':q0,'hopfield_query':qh,'hopfield_energy':energy,'memory_type_probs':tp}

    @torch.no_grad()
    def write(self,context:Tensor,target:Tensor,strength:float=1.,surprise:float=0.,memory_type:Optional[int]=None)->Dict[str,Tensor]:
        x=_batch(context); y=_batch(target)
        if x.size(-1)==self.input_dim: keys,vals=self.encode(x); probs=self._type_probs(keys,vals); rx=x
        elif x.size(-1)==self.key_dim: keys=F.normalize(x,dim=-1); vals=y; probs=torch.zeros(x.size(0),self.types,device=x.device,dtype=x.dtype); probs[:,0 if memory_type is None else int(memory_type)%self.types]=1.; rx=x.new_zeros((x.size(0),self.input_dim)); rx[:,:self.key_dim]=x
        else: raise ValueError(f'V62 write expects input_dim={self.input_dim} or key_dim={self.key_dim}, got {x.size(-1)}')
        slots=[]
        for b in range(x.size(0)):
            write_ctx = rx[b:b+1] if x.size(-1)==self.input_dim else keys[b:b+1]
            info=super().write(write_ctx,vals[b:b+1],strength=strength,surprise=surprise); slot=int(info['slot'].reshape(-1)[0].item()); p=probs[b]
            if memory_type is not None: p=F.one_hot(torch.tensor(int(memory_type)%self.types,device=p.device),self.types).to(p)
            p=p/(p.sum()+1e-8); self.fast_type_probs[slot].mul_(.15).add_(.85*p); t=int(self.fast_type_probs[slot].argmax().item()); self.typed_write_count[t]+=1
            gate=.55*strength+.45*surprise
            if gate>self.consolidation_gate:
                ts=int(p.argmax().item()); st=int(self.typed_usage[ts].argmin().item()); usage=float(self.typed_usage[ts,st].item()); alpha=.03/(1.+self.protection*usage); self.typed_semantic_key.data[ts,st,0].mul_(1.-alpha).add_(alpha*keys[b]); self.typed_semantic_value.data[ts,st,0].mul_(1.-alpha).add_(alpha*vals[b]); self.typed_usage[ts,st]=.99*self.typed_usage[ts,st]+1.
            slots.append(slot)
        q=F.normalize(keys,dim=-1); _,en=self._hopfield_refine(q)
        for i,s in enumerate(slots):
            conflict=1.-float(probs[i].max().item()); self.energy_trace[s]=.9*self.energy_trace[s]+.1*en[i,0]; self.memory_conflict_trace[s]=.9*self.memory_conflict_trace[s]+.1*conflict
            ri=(int(self.replay_cursor.item())-len(slots)+i)%self.replay_size; self.replay_energy[ri]=.9*self.replay_energy[ri]+.1*en[i,0]; self.replay_conflict[ri]=.9*self.replay_conflict[ri]+.1*conflict
        out=dict(info); out['slot']=x.new_tensor([[float(slots[-1])]]); out['memory_type_probs']=probs.mean(0,keepdim=True); return out
    def memory_loss(self,context,target):
        base=super().memory_loss(context,target); out=self.forward(context); attract=F.smooth_l1_loss(out['hopfield_query'],out['query'].detach()); ent=-(out['memory_type_probs']*out['memory_type_probs'].clamp_min(1e-7).log()).sum(-1).mean()/math.log(self.types); bal=(out['memory_type_probs'].mean(0)-1./self.types).pow(2).mean(); en=out['hopfield_energy'].mean(); total=base['loss']+.05*attract+.008*bal+.002*en+.002*(1.-ent); return {**base,'loss':total,'attractor':attract,'type_balance':bal,'energy':en,'type_entropy':ent}
    @torch.no_grad()
    def _replay_batch(self):
        valid=torch.nonzero(self.replay_valid>.5,as_tuple=False).flatten()
        if valid.numel()==0:return None
        pri=self.replay_priorities[valid].float(); extra=self.replay_energy[valid].float(); conflict=self.replay_conflict[valid].float(); score=(pri+self.energy_replay_weight*extra.abs()+self.conflict_replay_weight*conflict).clamp_min(self.replay_priority_floor); k=min(8,int(valid.numel())); top=min(max(2,k//3),k); chosen=valid[torch.topk(score,k=top).indices].tolist(); rem=[int(v.item()) for v in valid if int(v.item()) not in set(chosen)]; need=k-len(chosen)
        if need and rem: pos=torch.linspace(0,len(rem)-1,steps=min(need,len(rem))).round().long().tolist(); chosen.extend(rem[p] for p in pos)
        idx=torch.tensor(chosen[:k],device=self.replay_contexts.device,dtype=torch.long); return self.replay_contexts[idx],self.replay_targets[idx]
    @torch.no_grad()
    def decay(self): super().decay(); self.fast_type_probs.mul_(.997); self.energy_trace.mul_(.995); self.memory_conflict_trace.mul_(.995); self.replay_energy.mul_(.995); self.replay_conflict.mul_(.995); self.typed_usage.mul_(.999)
    def diagnostics(self):
        d=super().diagnostics(); d.update({'hopfield_energy_mean':self.energy_trace.mean().reshape(1,1),'memory_conflict_mean':self.memory_conflict_trace.mean().reshape(1,1),'typed_usage_mean':self.typed_usage.mean().reshape(1,1),'typed_writes':self.typed_write_count.sum().float().reshape(1,1)}); return d

class NeuroWeaveV62(NeuroWeaveV61):
    def __init__(self,cfg:Optional[V62Config]=None):
        cfg=cfg or V62Config(); super().__init__(cfg); c=cfg
        self.neural_memory_v61=CanonicalNeuralMemoryOSV62(input_dim=c.latent_dim_v46+c.d+c.memory_value_dim_v55+c.drive_dim_v57,key_dim=c.neural_memory_key_dim_v61,value_dim=c.neural_memory_value_dim_v61,fast_slots=c.neural_memory_fast_slots_v61,fast_rank=c.neural_memory_fast_rank_v61,semantic_slots=c.neural_memory_semantic_slots_v61,semantic_rank=c.neural_memory_semantic_rank_v61,hidden=c.neural_memory_hidden_v61,temperature=c.neural_memory_temperature_v61,fast_decay=c.neural_memory_fast_decay_v61,semantic_decay=c.neural_memory_semantic_decay_v61,replay_size=c.neural_memory_replay_size_v61,autobiographical_decay=c.neural_memory_autobio_decay_v61,procedural_decay=c.neural_memory_procedural_decay_v61,topk=c.neural_memory_topk_v61,long_term_hidden=c.neural_memory_long_term_hidden_v61,long_term_layers=c.neural_memory_long_term_layers_v61,long_term_mix=c.neural_memory_long_term_mix_v61,router_hidden=c.neural_memory_router_hidden_v61,router_temperature=c.neural_memory_router_temperature_v61,conflict_threshold=c.neural_memory_conflict_threshold_v61,types=c.neural_memory_types_v62,type_dim=c.neural_memory_type_dim_v62,typed_semantic_slots=c.neural_memory_typed_semantic_slots_v62,hopfield_steps=c.neural_memory_hopfield_steps_v62,hopfield_beta=c.neural_memory_hopfield_beta_v62,hopfield_residual=c.neural_memory_hopfield_residual_v62,energy_replay_weight=c.neural_memory_energy_replay_weight_v62,consolidation_gate=c.neural_memory_consolidation_gate_v62,protection=c.neural_memory_protection_v62,conflict_replay_weight=c.neural_memory_conflict_replay_weight_v62,replay_priority_floor=c.neural_memory_replay_priority_floor_v62)

class OrganismRuntimeV62(OrganismRuntimeV61):
    @torch.no_grad()
    def _make_internal_goal(self, obs: Tensor) -> Dict[str, Tensor]:
        out = super(OrganismRuntimeV60, self)._make_internal_goal(obs)
        latent = out['v58_temporal_latent']
        mem = self.model.neural_memory_v61.retrieve(latent)
        combined = _norm(out['memory_for_goal'] + self.model.cfg.neural_memory_scale_v60 * mem['read'])
        plastic_context = self._pending_v58.get('plastic_context')
        if plastic_context is not None:
            pc = plastic_context.to(obs).reshape(1, -1)
            m0 = self.model.cfg.latent_dim_v46 + self.model.cfg.d
            m1 = m0 + self.model.cfg.memory_value_dim_v55
            pc[:, m0:m1] = combined
            self._pending_v58['plastic_context'] = pc[0].detach().cpu()
        out.update({
            'memory_for_goal': combined,
            'v62_neural_memory_read': mem['read'],
            'v62_neural_memory_confidence': mem['confidence'],
            'v62_memory_type_probs': mem['memory_type_probs'],
            'v62_hopfield_energy': mem['hopfield_energy'],
            'v62_hopfield_query': mem['hopfield_query'],
        })
        self._pending_v60_memory_read = mem['read'][0].detach().cpu()
        self._pending_v62_type_probs = mem['memory_type_probs'][0].detach().cpu()
        self._pending_v62_hopfield_energy = mem['hopfield_energy'][0].detach().cpu()
        return out

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        out = super().step(observation, goal=goal)
        if getattr(self, "_pending_v62_type_probs", None) is not None:
            ref = out['v57_effective_goal']
            out['v62_memory_type_probs'] = self._pending_v62_type_probs.to(ref).reshape(1, -1)
            out['v62_hopfield_energy'] = self._pending_v62_hopfield_energy.to(ref).reshape(1, -1)
            out['v62_neural_memory_read'] = self._pending_v60_memory_read.to(ref).reshape(1, -1)
            self._pending_v62_type_probs = None
            self._pending_v62_hopfield_energy = None
        return out

class OrganismTrainerV62(OrganismTrainerV61): pass

class RuntimeStateStoreV62(RuntimeStateStoreV61):
    VERSION=2
    @classmethod
    def save(cls,path:Path,model:NeuroWeaveV62,trainer:Optional[OrganismTrainerV62]=None,runtime:Optional[OrganismRuntimeV62]=None):
        super().save(path,model,trainer,runtime); payload=torch.load(path,map_location='cpu',weights_only=False); payload['v62']={'state_version':1,'neural_memory_state':model.neural_memory_v61.state_dict(),'trainer_updates':int(getattr(trainer,'neural_memory_updates_v61',0)) if trainer else 0}; torch.save(payload,path)
    @classmethod
    def load(cls,path:Path,model:NeuroWeaveV62,trainer:Optional[OrganismTrainerV62]=None,runtime:Optional[OrganismRuntimeV62]=None):
        payload=torch.load(path,map_location='cpu',weights_only=False); model.load_state_dict(payload.get('model',payload),strict=False); sec=payload.get('v62'); src=sec.get('neural_memory_state') if sec else payload.get('v61',{}).get('neural_memory');
        if src: model.neural_memory_v61.load_state_dict(src,strict=False)
        if trainer: trainer.neural_memory_updates_v61=int((sec or {}).get('trainer_updates',0))
        if runtime is not None and 'runtime' in payload: runtime.load_state_dict(payload['runtime'])
        return payload
