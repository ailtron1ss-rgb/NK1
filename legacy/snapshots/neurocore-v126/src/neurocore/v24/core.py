from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict, Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v23 import NeuroWeaveV23, V23Config, V23State


@dataclass
class V24State:
    base: V23State
    proprioception: Tensor
    interoception: Tensor
    embodiment_trace: Tensor
    event_keys: Tensor
    event_values: Tensor
    event_scores: Tensor
    event_age: Tensor
    event_active: Tensor
    skill_context: Tensor
    identity_anchor: Tensor
    continuity_ema: Tensor
    predictive_uncertainty: Tensor
    horizon_budget: Tensor
    action_commitment: Tensor
    developmental_focus: Tensor
    life_clock: Tensor


@dataclass
class V24Config:
    d: int = 16
    hidden: int = 32
    action_dim: int = 4
    modalities: int = 3
    proprio_dim: int = 4
    intero_dim: int = 4
    event_capacity: int = 32
    event_decay: float = 0.985
    event_write_threshold: float = 0.20
    identity_decay: float = 0.997
    continuity_decay: float = 0.96
    uncertainty_decay: float = 0.94
    horizon_count: int = 4
    max_horizon: int = 8
    commitment_decay: float = 0.90
    developmental_decay: float = 0.95
    prediction_weight: float = 1.0
    retention_weight: float = 0.15
    continuity_weight: float = 0.10
    embodiment_weight: float = 0.12
    agency_weight: float = 0.10
    skill_weight: float = 0.10
    event_weight: float = 0.08
    retrieval_weight: float = 0.10


class EmbodimentAdapterV24(nn.Module):
    """Maps optional exteroceptive, proprioceptive and interoceptive signals into one latent."""
    def __init__(self, d: int, hidden: int, proprio_dim: int, intero_dim: int, action_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(2*d + proprio_dim + intero_dim + action_dim + 3, hidden), nn.SiLU(),
            nn.Linear(hidden, d)
        )
        self.conf = nn.Sequential(nn.Linear(proprio_dim + intero_dim + action_dim + 3, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, z: Tensor, proprio: Tensor, intero: Tensor, action: Tensor,
                reward: Tensor, risk: Tensor, presence: Tensor) -> Tuple[Tensor, Tensor]:
        if proprio.ndim != 2 or intero.ndim != 2:
            raise ValueError("proprio/intero must be [B,D]")
        p = torch.cat([proprio, intero, action, reward, risk, presence], -1)
        delta = torch.tanh(self.net(torch.cat([z, z.detach(), p], -1)))
        confidence = torch.sigmoid(self.conf(p))
        return delta, confidence


class EventLedgerV24(nn.Module):
    """Learn salience for bounded autobiographical events; storage is persistent state only."""
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.score = nn.Sequential(nn.Linear(4*d + 5, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.key = nn.Linear(d, d)
        self.value = nn.Linear(d, d)

    def forward(self, z: Tensor, identity: Tensor, goal: Tensor, action: Tensor,
                prediction_error: Tensor, novelty: Tensor, reward: Tensor,
                agency: Tensor, confidence: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        action_proj = F.pad(action, (0, z.size(-1)-action.size(-1))) if action.size(-1) < z.size(-1) else action[..., :z.size(-1)]
        x = torch.cat([z, identity, goal, action_proj, prediction_error, novelty, reward, agency, confidence], -1)
        s = torch.sigmoid(self.score(x))
        k = F.normalize(self.key(z), dim=-1, eps=1e-5)
        v = torch.tanh(self.value(z))
        return s, k, v


class EventRetrieverV24(nn.Module):
    """Reads bounded autobiographical events and produces a causal memory context."""
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.query = nn.Sequential(nn.Linear(2*d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.temperature = nn.Parameter(torch.tensor(0.7))

    def forward(self, z: Tensor, goal: Tensor, keys: Tensor, values: Tensor, active: Tensor) -> Tuple[Tensor, Tensor]:
        q = F.normalize(self.query(torch.cat([z, goal], -1)), dim=-1, eps=1e-5)
        k = F.normalize(keys, dim=-1, eps=1e-5)
        logits = (q.unsqueeze(1) * k).sum(-1) / self.temperature.clamp_min(0.08)
        logits = logits.masked_fill(active.squeeze(-1) < 0.5, -20.0)
        weights = F.softmax(logits, dim=-1)
        ctx = (weights.unsqueeze(-1) * values).sum(1)
        return ctx, weights


class SparseSkillComposerV24(nn.Module):
    """Small bank of composable skill vectors. Only selected skill logits contribute."""
    def __init__(self, d: int, hidden: int, action_dim: int, slots: int = 6, top_k: int = 2):
        super().__init__()
        self.slots = slots; self.top_k = top_k
        self.prototypes = nn.Parameter(torch.randn(slots, d) * 0.05)
        self.router = nn.Sequential(nn.Linear(2*d + 6, hidden), nn.SiLU(), nn.Linear(hidden, slots))
        self.action = nn.Linear(d, action_dim)

    def forward(self, z: Tensor, goal: Tensor, needs: Tensor, novelty: Tensor, uncertainty: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        q = torch.cat([z, goal, needs, novelty, uncertainty], -1)
        logits = self.router(q)
        k = min(self.top_k, self.slots)
        vals, idx = torch.topk(logits, k=k, dim=-1)
        weights = F.softmax(vals, dim=-1)
        selected = self.prototypes[idx]
        skill = (selected * weights.unsqueeze(-1)).sum(-2)
        return skill, idx, F.softmax(logits, dim=-1)


class LongHorizonPredictorV24(nn.Module):
    """Compact latent dynamics model trained against observed future latents."""
    def __init__(self, d: int, hidden: int, action_dim: int, horizon: int):
        super().__init__()
        self.horizon = horizon
        self.step = nn.Sequential(nn.Linear(d + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.uncertainty = nn.Sequential(nn.Linear(d + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def rollout(self, z: Tensor, action: Tensor, horizon: Optional[int] = None) -> Tuple[Tensor, Tensor]:
        h = self.horizon if horizon is None else horizon
        cur = z
        preds=[]; uncs=[]
        for _ in range(h):
            delta = torch.tanh(self.step(torch.cat([cur, action], -1)))
            cur = F.normalize(cur + 0.35 * delta, dim=-1, eps=1e-5)
            u = torch.sigmoid(self.uncertainty(torch.cat([cur, action], -1)))
            preds.append(cur); uncs.append(u)
        return torch.stack(preds, 1), torch.stack(uncs, 1)


class ContinuityArbiterV24(nn.Module):
    """Separates stable identity from fast state while exposing a continuity observable."""
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.anchor = nn.Sequential(nn.Linear(3*d + 2, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.gate = nn.Sequential(nn.Linear(2*d + 2, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, z: Tensor, identity: Tensor, event_summary: Tensor,
                novelty: Tensor, uncertainty: Tensor, age: Tensor,
                action_commitment: Tensor, developmental_focus: Tensor) -> Tuple[Tensor, Tensor]:
        a = torch.tanh(self.anchor(torch.cat([z, identity, event_summary, novelty, uncertainty], -1)))
        g = torch.sigmoid(self.gate(torch.cat([z, identity, novelty, age], -1)))
        target = (1-g)*a + g*identity
        continuity = torch.exp(-(target-identity.detach()).pow(2).mean(-1, keepdim=True))
        return target, continuity


class DevelopmentalSchedulerV24(nn.Module):
    """Chooses one compact developmental focus from observable capability gaps."""
    def __init__(self, d: int, hidden: int, slots: int = 6):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(24, hidden), nn.SiLU(), nn.Linear(hidden, slots))

    def forward(self, capability: Tensor, needs: Tensor, uncertainty: Tensor, novelty: Tensor,
                learning_pressure: Tensor, continuity: Tensor, event_recall: Tensor) -> Tuple[Tensor, Tensor]:
        x = torch.cat([capability, capability.detach(), capability*0 + continuity, needs,
                       uncertainty, novelty, learning_pressure, continuity, event_recall], -1)
        logits = self.net(x)
        return F.softmax(logits, -1), logits


class NeuroWeaveV24(nn.Module):
    """V24 Frontier MAX: embodied-ready, event-memory, long-horizon and continuity loop on top of V23."""
    def __init__(self, cfg: Optional[V24Config] = None):
        super().__init__(); c=cfg or V24Config(); self.cfg=c
        self.core = NeuroWeaveV23(V23Config(d=c.d, hidden=c.hidden, action_dim=c.action_dim,
                                            modalities=c.modalities))
        self.embodiment = EmbodimentAdapterV24(c.d,c.hidden,c.proprio_dim,c.intero_dim,c.action_dim)
        self.ledger = EventLedgerV24(c.d,c.hidden)
        self.retriever = EventRetrieverV24(c.d,c.hidden)
        self.skills = SparseSkillComposerV24(c.d,c.hidden,c.action_dim)
        self.future = LongHorizonPredictorV24(c.d,c.hidden,c.action_dim,c.horizon_count)
        self.continuity = ContinuityArbiterV24(c.d,c.hidden)
        self.development = DevelopmentalSchedulerV24(c.d,c.hidden)
        self.action_fuser = nn.Sequential(nn.Linear(c.d + c.action_dim + 4, c.hidden), nn.SiLU(), nn.Linear(c.hidden,c.action_dim))

    def initial_state(self,b:int,device=None,dtype=None)->V24State:
        base=self.core.initial_state(b,device=device,dtype=dtype); c=self.cfg
        z=lambda *shape: torch.zeros(b,*shape,device=device,dtype=dtype)
        return V24State(
            base=base, proprioception=z(c.proprio_dim), interoception=z(c.intero_dim), embodiment_trace=z(c.d),
            event_keys=z(c.event_capacity,c.d), event_values=z(c.event_capacity,c.d),
            event_scores=z(c.event_capacity,1), event_age=z(c.event_capacity,1), event_active=z(c.event_capacity,1),
            skill_context=z(c.d), identity_anchor=z(c.d), continuity_ema=torch.ones(b,1,device=device,dtype=dtype),
            predictive_uncertainty=torch.zeros(b,1,device=device,dtype=dtype), horizon_budget=torch.full((b,1),0.5,device=device,dtype=dtype),
            action_commitment=z(c.action_dim), developmental_focus=torch.zeros(b,6,device=device,dtype=dtype), life_clock=z(1),
        )

    def _write_event(self,state,key,value,score):
        age=state.event_age + 1
        scores=state.event_scores*state.event_active
        empty=(state.event_active.squeeze(-1) < 0.5)
        has_empty=empty.any(dim=1)
        first_empty=empty.float().argmax(dim=1)
        worst=torch.argmin(scores.squeeze(-1),dim=1)
        target=torch.where(has_empty, first_empty, worst)
        # If no empty slot, overwrite lowest score only when new score is competitive.
        k=state.event_keys.clone(); v=state.event_values.clone(); s=state.event_scores.clone(); a=age.clone(); act=state.event_active.clone()
        for b in range(k.size(0)):
            j=int(target[b].item()); old=float(s[b,j,0].item()); new=float(score[b,0].item())
            if bool(empty[b,j].item()) or new >= old:
                k[b,j]=key[b].detach(); v[b,j]=value[b].detach(); s[b,j]=score[b].detach(); a[b,j]=0; act[b,j]=1
        return k,v,s,a,act

    def step(self,x:Tensor,state:V24State,goal:Optional[Tensor]=None,action:Optional[Tensor]=None,
             modalities:Optional[Tensor]=None,presence:Optional[Tensor]=None,proprioception:Optional[Tensor]=None,
             interoception:Optional[Tensor]=None,commit_memory:bool=True):
        b=x.size(0); c=self.cfg
        p=state.proprioception if proprioception is None else proprioception
        i=state.interoception if interoception is None else interoception
        if presence is None:
            pm=torch.ones(b,1,device=x.device,dtype=x.dtype)
        else:
            pm=presence
            while pm.ndim>2:
                pm=pm.mean(-1)
            if pm.ndim==1:
                pm=pm.unsqueeze(-1)
            pm=pm.mean(-1,keepdim=True) if pm.size(-1)>1 else pm
        out23,base_state=self.core.step(x,state.base,goal=goal,action=action,modalities=modalities,presence=presence,commit_memory=commit_memory)
        z=out23['latent_v23'];
        unc=out23['uncertainty'].to(z.dtype); nov=out23['novelty'].to(z.dtype); conf=out23['confidence'].to(z.dtype)
        reward=out23.get('actual_reward_v22',torch.zeros(b,1,device=z.device,dtype=z.dtype)).to(z.dtype)
        risk=out23.get('actual_risk_v22',torch.zeros_like(reward)).to(z.dtype)
        needs=out23['needs_v23'].to(z.dtype); goal0=out23['persistent_goal_v23'].to(z.dtype)
        prior=out23['chosen_action_v23'] if action is None else action
        emb_delta,emb_conf=self.embodiment(z,p,i,prior,reward,risk,pm)
        embodiment_latent=F.normalize(z + 0.20*emb_delta,dim=-1,eps=1e-5)
        ek,ev,es,ea,eactive=state.event_keys,state.event_values,state.event_scores,state.event_age,state.event_active
        memory_context,memory_weights=self.retriever(embodiment_latent,goal0,ek,ev,eactive)
        cognitive_latent=F.normalize(embodiment_latent + 0.18*memory_context,dim=-1,eps=1e-5)
        skill,skill_idx,skill_probs=self.skills(cognitive_latent,goal0,needs,nov,unc)
        skill_action=torch.tanh(self.skills.action(skill))
        budget=out23['compute_budget_v22'].to(z.dtype)
        fused_action=torch.tanh(self.action_fuser(torch.cat([cognitive_latent,skill_action,budget,conf,unc,nov],-1)))
        gate=(0.30+0.70*budget)*conf*(1-unc).clamp(0,1)
        chosen=prior if action is not None else torch.tanh((1-gate)*prior+gate*fused_action)
        event_score,key,value=self.ledger(z,out23['autobiographical_v23'],goal0,chosen,out23['temporal_error'],nov,reward,out23['agency_utility_v23'],conf)
        event_score=event_score.clamp(0,1)
        for bidx in range(b):
            if float(event_score[bidx,0].item())>=c.event_write_threshold:
                tmp_state=V24State(state.base,state.proprioception,state.interoception,state.embodiment_trace,ek,ev,es,ea,eactive,state.skill_context,state.identity_anchor,state.continuity_ema,state.predictive_uncertainty,state.horizon_budget,state.action_commitment,state.developmental_focus,state.life_clock)
                ek,ev,es,ea,eactive=self._write_event(tmp_state,key,value,event_score)
        active_scores=es*eactive
        denom=active_scores.sum(1).clamp_min(1e-5)
        event_summary=(ev*active_scores).sum(1)/denom
        ident,continuity=self.continuity(cognitive_latent,out23['autobiographical_v23'],event_summary,nov,unc,state.life_clock,state.action_commitment, state.developmental_focus.mean(-1,keepdim=True))
        ident=F.normalize(c.identity_decay*state.identity_anchor+(1-c.identity_decay)*ident,dim=-1,eps=1e-5)
        cont_ema=c.continuity_decay*state.continuity_ema+(1-c.continuity_decay)*continuity.detach()
        preds,pred_unc=self.future.rollout(cognitive_latent,chosen)
        horizon_budget=((1-unc)*(1-nov)+0.5*conf).clamp(0,1)
        horizon_budget=c.uncertainty_decay*state.horizon_budget+(1-c.uncertainty_decay)*horizon_budget.detach()
        predictive_unc=pred_unc.mean(1)
        commitment=c.commitment_decay*state.action_commitment+(1-c.commitment_decay)*chosen.detach()
        dev_candidate,dev_logits=self.development(out23['capability_ema_v23'],needs,unc,nov,out23['learning_pressure_v23'],cont_ema,event_score)
        dev_focus=c.developmental_decay*state.developmental_focus+(1-c.developmental_decay)*dev_candidate.detach()
        emb_trace=0.92*state.embodiment_trace+0.08*embodiment_latent.detach()
        ns=V24State(base=base_state,proprioception=p.detach(),interoception=i.detach(),embodiment_trace=emb_trace,
                    event_keys=ek,event_values=ev,event_scores=es,event_age=ea,event_active=eactive,
                    skill_context=skill.detach(),identity_anchor=ident.detach(),continuity_ema=cont_ema,
                    predictive_uncertainty=predictive_unc.detach(),horizon_budget=horizon_budget,
                    action_commitment=commitment,developmental_focus=dev_focus,life_clock=state.life_clock+1)
        base_state.context=z.detach()
        out=dict(out23); out.update({
            'latent_v24':embodiment_latent,'embodiment_delta_v24':emb_delta,'embodiment_confidence_v24':emb_conf,'embodiment_trace_v24':emb_trace,
            'skill_context_v24':skill,'skill_indices_v24':skill_idx,'skill_probs_v24':skill_probs,'skill_action_v24':skill_action,
            'chosen_action_v24':chosen,'event_score_v24':event_score,'event_key_v24':key,'event_value_v24':value,'event_summary_v24':event_summary,'memory_context_v24':memory_context,'memory_weights_v24':memory_weights,'memory_key_bank_v24':ek,'memory_active_bank_v24':eactive,'cognitive_latent_v24':cognitive_latent,
            'event_active_v24':eactive,'identity_anchor_v24':ident,'continuity_v24':continuity,'continuity_ema_v24':cont_ema,
            'future_latents_v24':preds,'future_uncertainty_v24':pred_unc,'predictive_uncertainty_v24':predictive_unc,
            'horizon_budget_v24':horizon_budget,'action_commitment_v24':commitment,'developmental_focus_v24':dev_candidate,'developmental_focus_state_v24':dev_focus,
            'developmental_logits_v24':dev_logits,'life_clock_v24':ns.life_clock,
        })
        return out,ns

    def forward(self,x:Tensor,state:Optional[V24State]=None,goal:Optional[Tensor]=None,goal_sequence:Optional[Tensor]=None,
                modality_sequence:Optional[Tensor]=None,presence_sequence:Optional[Tensor]=None,
                proprioception_sequence:Optional[Tensor]=None,interoception_sequence:Optional[Tensor]=None,
                commit_memory:bool=True)->Dict[str,Tensor]:
        if x.ndim!=3 or x.size(-1)!=self.cfg.d: raise ValueError('x must be [B,T,D]')
        st=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            g=goal_sequence[:,t] if goal_sequence is not None else goal
            m=modality_sequence[:,t] if modality_sequence is not None else None
            p=presence_sequence[:,t] if presence_sequence is not None else None
            pr=proprioception_sequence[:,t] if proprioception_sequence is not None else None
            ir=interoception_sequence[:,t] if interoception_sequence is not None else None
            o,st=self.step(x[:,t],st,goal=g,modalities=m,presence=p,proprioception=pr,interoception=ir,commit_memory=commit_memory)
            rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0] if torch.is_tensor(rows[0][k])}|{'_final_state':st}

    def training_loss_parts(self,out:Dict[str,Tensor],target:Optional[Tensor]=None):
        z=out['latent_v24']; primary=z.new_zeros(()); aux=z.new_zeros(())
        if z.size(1)>1:
            h=min(self.cfg.max_horizon,z.size(1)-1)
            pred_losses=[]; unc_losses=[]
            for offset in range(h):
                valid_t = z.size(1) - offset - 1
                preds_h = out['future_latents_v24'][:, :valid_t, offset]
                targets_h = z[:, offset+1:offset+1+valid_t].detach()
                pred_losses.append(F.smooth_l1_loss(preds_h, targets_h))
                unc_target = (preds_h - targets_h).pow(2).mean(-1,keepdim=True).sqrt().detach().clamp(0,1)
                unc_losses.append(F.smooth_l1_loss(out['future_uncertainty_v24'][:, :valid_t, offset], unc_target))
            pred_loss = torch.stack(pred_losses).mean()
            uncertainty_loss = torch.stack(unc_losses).mean()
            embodiment_target=(out['latent_v23']-out['embodiment_trace_v24'].detach() if 'embodiment_trace_v24' in out else out['latent_v23']).detach()
            emb_loss=F.smooth_l1_loss(out['embodiment_delta_v24'],(out['latent_v24']-out['latent_v23']).detach())
            emb_conf_target=(out['confidence']*(1-out['uncertainty']).clamp(0,1)).detach()
            emb_conf_loss=F.smooth_l1_loss(out['embodiment_confidence_v24'],emb_conf_target)
            continuity_loss=1-out['continuity_v24'].mean()
            retention=(out['confidence']*(1-out['uncertainty']).clamp(0,1)).detach()
            event_target=(out['novelty']+out['temporal_error']).clamp(0,1).detach()
            event_loss=F.smooth_l1_loss(out['event_score_v24'],event_target)
            key_target=F.normalize(out['latent_v23'].detach(),dim=-1,eps=1e-5)
            event_key_loss=(1-(out['event_key_v24']*key_target).sum(-1,keepdim=True)).mean()
            event_value_loss=F.smooth_l1_loss(out['event_value_v24'],torch.tanh(out['latent_v23']).detach())
            q_target=F.normalize(out['latent_v23'].detach(),dim=-1,eps=1e-5).unsqueeze(2)
            k_bank=F.normalize(out['memory_key_bank_v24'].detach(),dim=-1,eps=1e-5)
            retrieval_target=(q_target*k_bank).sum(-1)
            retrieval_target=torch.softmax(retrieval_target.masked_fill(out['memory_active_bank_v24'].squeeze(-1)<0.5,-20.0),dim=-1)
            retrieval_loss=F.kl_div(out['memory_weights_v24'].clamp_min(1e-7).log(),retrieval_target, reduction='batchmean')
            skill_entropy=-(out['skill_probs_v24'].clamp_min(1e-7)*out['skill_probs_v24'].clamp_min(1e-7).log()).sum(-1).mean()
            dev_target=(out['learning_pressure_v23'].mean(-1,keepdim=True)+out['novelty']).clamp(0,1).detach()
            dev_loss=F.mse_loss(out['developmental_focus_v24'].mean(-1,keepdim=True),dev_target)
            action_stability=F.mse_loss(out['action_commitment_v24'][:,1:],out['chosen_action_v24'][:,:-1].detach())
            primary=self.cfg.prediction_weight*(pred_loss+0.15*uncertainty_loss)
            aux=self.cfg.embodiment_weight*(emb_loss+0.5*emb_conf_loss)+self.cfg.continuity_weight*continuity_loss+self.cfg.retention_weight*F.mse_loss(out['continuity_v24'],retention)+self.cfg.event_weight*(event_loss+0.5*event_key_loss+0.5*event_value_loss)+self.cfg.retrieval_weight*retrieval_loss+self.cfg.skill_weight*0.03*skill_entropy+self.cfg.agency_weight*action_stability+0.08*dev_loss
        if target is not None and target.shape==z[:,-1].shape: primary=primary+0.25*F.mse_loss(z[:,-1],target)
        return primary,aux

    def training_loss(self,out,target=None):
        a,b=self.training_loss_parts(out,target); return a+b


class OrganismTrainerV24:
    def __init__(self,model:NeuroWeaveV24,lr:float=1e-3,max_norm:float=1.0):
        self.model=model; self.max_norm=max_norm
        mods=[model.embodiment,model.ledger,model.retriever,model.skills,model.future,model.continuity,model.development,model.action_fuser]
        self.params=[p for m in mods for p in m.parameters()]
        allowed={id(p) for p in self.params}
        for p in model.parameters():
            if id(p) not in allowed:
                p.requires_grad_(False)
        self.optimizer=torch.optim.AdamW(self.params,lr=lr,weight_decay=1e-4)
    def step(self,x,target=None,**kwargs):
        self.model.train(); self.optimizer.zero_grad(set_to_none=True)
        out=self.model(x,commit_memory=False,**kwargs); loss=self.model.training_loss(out,target)
        loss.backward(); torch.nn.utils.clip_grad_norm_(self.params,self.max_norm); self.optimizer.step()
        return loss.detach(),out
