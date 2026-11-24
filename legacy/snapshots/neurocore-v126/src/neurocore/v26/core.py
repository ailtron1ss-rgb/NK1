from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Dict, Tuple
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v25 import NeuroWeaveV25, V25Config, V25State


def _scalar_like(x: Tensor, value: float = 0.0) -> Tensor:
    return x.new_full((x.size(0), 1), value)


@dataclass
class V26State:
    base: V25State
    neural_memory: Tensor       # [B,D,D]
    memory_uncertainty: Tensor  # [B,1]
    transition_state: Tensor    # [B,D]
    correction_state: Tensor    # [B,D]
    experiment_state: Tensor    # [B,3] explore/exploit/verify
    invariant_state: Tensor     # [B,D]
    life_clock: Tensor          # [B,1]
    stable_anchor: Tensor       # [B,D]


@dataclass
class V26Config:
    d: int = 16
    hidden: int = 32
    action_dim: int = 4
    modalities: int = 3
    proprio_dim: int = 4
    intero_dim: int = 4
    event_capacity: int = 32
    skill_slots: int = 8
    top_k: int = 2
    memory_lr: float = 0.08
    memory_decay: float = 0.995
    memory_uncertainty_decay: float = 0.95
    transition_decay: float = 0.92
    correction_gain: float = 0.20
    correction_decay: float = 0.90
    anchor_decay: float = 0.996
    verify_decay: float = 0.93
    experiment_temperature: float = 0.7
    primary_weight: float = 1.0
    memory_weight: float = 0.12
    predictive_weight: float = 0.14
    invariant_weight: float = 0.10
    experiment_weight: float = 0.08
    mobile_variant: bool = False


class NeuralMemoryV26(nn.Module):
    """Compact test-time associative memory inspired by neural long-term memory.
    Uses a bounded matrix state and an explicit delta-rule update. The matrix is state, not weights.
    """
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.q = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.v = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.rate = nn.Sequential(nn.Linear(2*d + 2, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.unc = nn.Sequential(nn.Linear(2*d + 2, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, z: Tensor, state: Tensor, novelty: Tensor, uncertainty: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        q = F.normalize(self.q(z), dim=-1, eps=1e-5)
        v = self.v(z)
        read = torch.bmm(q.unsqueeze(1), state).squeeze(1)
        context = torch.cat([z, read, novelty, uncertainty], -1)
        rate = torch.sigmoid(self.rate(context)).clamp(0.01, 0.30)
        pred_err = (v - read).pow(2).mean(-1, keepdim=True).sqrt().clamp(0, 2)
        u = torch.sigmoid(self.unc(context))
        outer = torch.bmm(q.unsqueeze(2), v.unsqueeze(1))
        new_state = state * 0.995 + rate.unsqueeze(-1) * (outer - torch.bmm(q.unsqueeze(2), read.unsqueeze(1)))
        # Hard spectral-ish bound via row/value scaling, cheap on mobile.
        row_norm = new_state.norm(dim=-1, keepdim=True).clamp_min(1.0)
        new_state = new_state / row_norm.clamp_min(1.0)
        return read, new_state, pred_err


class TransitionEnsembleV26(nn.Module):
    """Three cheap transition rules: gated recurrent, delta-like, and predictive residual.
    A learned router selects a convex mixture; all operators are tiny and share the same latent width.
    """
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.gated = nn.GRUCell(d, d)
        self.delta_in = nn.Linear(d, d)
        self.delta_gate = nn.Linear(2*d, d)
        self.residual = nn.Sequential(nn.Linear(2*d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.osc_phase = nn.Linear(d, max(1,d//2))
        self.osc_router = nn.Sequential(nn.Linear(2*d + 2, hidden), nn.SiLU(), nn.Linear(hidden, 4))
        self.next_proj = nn.Linear(d, d)

    def forward(self, z: Tensor, state: Tensor, action: Tensor, uncertainty: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        a = action if action.size(-1) == state.size(-1) else F.pad(action, (0, state.size(-1)-action.size(-1)))[:, :state.size(-1)]
        g = self.gated(z, state)
        delta = state + torch.tanh(self.delta_in(z)) * torch.sigmoid(self.delta_gate(torch.cat([state,z],-1)))
        res = state + self.residual(torch.cat([state,z],-1))
        phase = torch.tanh(self.osc_phase(z))
        osc = state.clone()
        if osc.size(-1) >= 2:
            pairs = osc[..., :2*(phase.size(-1))].reshape(osc.size(0), phase.size(-1), 2)
            c, s = phase.cos(), phase.sin()
            x0, x1 = pairs[...,0], pairs[...,1]
            rot0 = c*x0 - s*x1; rot1 = s*x0 + c*x1
            osc = osc.clone(); osc[..., :2*phase.size(-1)] = torch.stack([rot0,rot1],-1).reshape(osc.size(0),-1)
            osc = osc + 0.15*torch.tanh(self.delta_in(z))
        w = F.softmax(self.osc_router(torch.cat([z,state,uncertainty, a[..., :1]], -1)), dim=-1)
        nxt = w[:,0:1]*g + w[:,1:2]*delta + w[:,2:3]*res + w[:,3:4]*osc
        return F.normalize(self.next_proj(nxt), dim=-1, eps=1e-5), nxt, w


class ActiveExperimenterV26(nn.Module):
    """Chooses an internal experiment mix from uncertainty, novelty and predicted utility.
    Outputs a proposal vector; execution remains outside this module so it is easy to ablate.
    """
    def __init__(self, d: int, hidden: int, action_dim: int):
        super().__init__()
        self.policy = nn.Sequential(nn.Linear(2*d + 5, hidden), nn.SiLU(), nn.Linear(hidden, 3))
        self.action_probe = nn.Sequential(nn.Linear(d + 3, hidden), nn.SiLU(), nn.Linear(hidden, action_dim))

    def forward(self, workspace: Tensor, self_model: Tensor, uncertainty: Tensor, novelty: Tensor,
                boundary: Tensor, confidence: Tensor, needs: Tensor) -> Tuple[Tensor, Tensor]:
        need = needs.mean(-1, keepdim=True)
        logits = self.policy(torch.cat([workspace,self_model,uncertainty,novelty,boundary,confidence,need],-1))
        probs = F.softmax(logits, dim=-1)
        probe = torch.tanh(self.action_probe(torch.cat([workspace,probs],-1)))
        return probs, probe


class MemoryAlgorithmRouterV26(nn.Module):
    """Selects among three cheap memory views: associative read, transition trace, and stable anchor.
    The router is content/context conditioned and exposes the mixture for ablation.
    """
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.router = nn.Sequential(nn.Linear(3*d + 3, hidden), nn.SiLU(), nn.Linear(hidden, 3))
        self.gate = nn.Sequential(nn.Linear(d + 3, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, z: Tensor, assoc: Tensor, transition: Tensor, anchor: Tensor, uncertainty: Tensor, novelty: Tensor, confidence: Tensor) -> Tuple[Tensor, Tensor]:
        logits = self.router(torch.cat([z, assoc, transition, uncertainty, novelty, confidence], -1))
        weights = F.softmax(logits, dim=-1)
        mixed = weights[:,0:1]*assoc + weights[:,1:2]*transition + weights[:,2:3]*anchor
        gate = torch.sigmoid(self.gate(torch.cat([mixed, uncertainty, novelty, confidence], -1)))
        return gate*mixed + (1-gate)*z, weights


class PlanCacheV26(nn.Module):
    """Compact memory-grounded plan cache. It proposes a short latent plan from retrieved evidence and current goal.
    Designed to approximate memory-as-plans without repeatedly carrying full history.
    """
    def __init__(self, d: int, hidden: int, horizon: int = 3):
        super().__init__(); self.horizon=horizon
        self.step = nn.Sequential(nn.Linear(2*d + 2, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.score = nn.Sequential(nn.Linear(d + 2, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, z: Tensor, memory: Tensor, goal: Tensor, uncertainty: Tensor) -> Tuple[Tensor, Tensor]:
        cur = z + 0.25*memory
        plans=[]; scores=[]
        for k in range(self.horizon):
            inp=torch.cat([cur,goal,uncertainty,cur.new_full((cur.size(0),1),float(k+1)/self.horizon)],-1)
            cur=F.normalize(cur+torch.tanh(self.step(inp)),dim=-1,eps=1e-5)
            plans.append(cur); scores.append(torch.sigmoid(self.score(torch.cat([cur,uncertainty,cur.new_full((cur.size(0),1),float(k+1)/self.horizon)],-1))))
        return torch.stack(plans,1), torch.stack(scores,1)


class PredictiveCorrectionV26(nn.Module):
    """Predictive-coding style error correction: explicit prediction error is fed back into latent."""
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.pred = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.correct = nn.Sequential(nn.Linear(2*d, hidden), nn.SiLU(), nn.Linear(hidden, d))

    def forward(self, z: Tensor, previous_prediction: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        pred = self.pred(z)
        err = previous_prediction - z
        corr = torch.tanh(self.correct(torch.cat([z, err],-1)))
        return pred, err, corr


class InvariantMonitorV26(nn.Module):
    """Learns a slowly moving anchor and reports deviation from it."""
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.project = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.score = nn.Sequential(nn.Linear(2*d, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, z: Tensor, anchor: Tensor) -> Tuple[Tensor, Tensor]:
        candidate = F.normalize(self.project(z), dim=-1, eps=1e-5)
        deviation = (candidate - anchor).pow(2).mean(-1, keepdim=True).sqrt()
        score = torch.sigmoid(self.score(torch.cat([z, anchor],-1)))
        return candidate, (deviation + score).clamp(0,2)


class NeuroWeaveV26(nn.Module):
    """V26 frontier: neural fast memory + algorithm ensemble + predictive correction + active experimentation + identity invariants.
    The goal is not to claim consciousness; all new mechanisms are experimentally testable and bounded.
    """
    def __init__(self, cfg: Optional[V26Config] = None):
        super().__init__()
        c = cfg or V26Config(); self.cfg = c
        self.core = NeuroWeaveV25(V25Config(
            d=c.d, hidden=c.hidden, action_dim=c.action_dim, modalities=c.modalities,
            proprio_dim=c.proprio_dim, intero_dim=c.intero_dim,
            event_capacity=c.event_capacity, skill_slots=c.skill_slots, top_k=c.top_k))
        self.memory = NeuralMemoryV26(c.d,c.hidden)
        self.transitions = TransitionEnsembleV26(c.d,c.hidden)
        self.corrector = PredictiveCorrectionV26(c.d,c.hidden)
        self.experimenter = ActiveExperimenterV26(c.d,c.hidden,c.action_dim)
        self.invariant = InvariantMonitorV26(c.d,c.hidden)
        self.memory_router = MemoryAlgorithmRouterV26(c.d,c.hidden)
        self.plan_cache = PlanCacheV26(c.d,c.hidden,horizon=3)
        self.capability_head = nn.Sequential(nn.Linear(3*c.d + 3, c.hidden), nn.SiLU(), nn.Linear(c.hidden, 4))

    def initial_state(self,b:int,device=None,dtype=None)->V26State:
        base = self.core.initial_state(b,device=device,dtype=dtype); d=self.cfg.d
        return V26State(
            base=base,
            neural_memory=torch.zeros(b,d,d,device=device,dtype=dtype),
            memory_uncertainty=torch.ones(b,1,device=device,dtype=dtype)*0.5,
            transition_state=torch.zeros(b,d,device=device,dtype=dtype),
            correction_state=torch.zeros(b,d,device=device,dtype=dtype),
            experiment_state=torch.full((b,3),1/3,device=device,dtype=dtype),
            invariant_state=torch.zeros(b,d,device=device,dtype=dtype),
            life_clock=torch.zeros(b,1,device=device,dtype=dtype),
            stable_anchor=torch.zeros(b,d,device=device,dtype=dtype),
        )

    def step(self, x:Tensor, state:V26State, goal:Optional[Tensor]=None,
             modalities:Optional[Tensor]=None,presence:Optional[Tensor]=None,
             proprioception:Optional[Tensor]=None,interoception:Optional[Tensor]=None,
             commit_memory:bool=True, run_experiment:bool=True):
        o25,s25 = self.core.step(x,state.base,goal=goal,modalities=modalities,presence=presence,
                                 proprioception=proprioception,interoception=interoception,commit_memory=commit_memory)
        z=o25['latent_v25']; unc=o25['uncertainty']; nov=o25['novelty']; conf=o25['confidence']
        workspace=o25['workspace_v25']; needs=o25['needs_v23']; boundary=o25['event_boundary_v25']
        self_model=o25['identity_trajectory_v25']
        read,new_mem,pred_err=self.memory(z,state.neural_memory,nov,unc)
        corrected=self.corrector(z,state.transition_state)
        pred_state, transition_raw, weights=self.transitions(z,state.transition_state,o25['chosen_action_v25'],unc)
        exp_probs,probe=self.experimenter(workspace,self_model,unc,nov,boundary,conf,needs)
        memory_mix, memory_weights = self.memory_router(z, read, transition_raw, state.stable_anchor if state.life_clock.max()>0 else z.detach(), unc, nov, conf)
        goal_lat=goal.to(z.dtype) if goal is not None else o25['persistent_goal_v23'].to(z.dtype)
        plans, plan_scores = self.plan_cache(z, memory_mix, goal_lat, unc)
        inv_candidate,inv_score=self.invariant(z,state.stable_anchor if state.life_clock.max()>0 else z.detach())
        cap=self.capability_head(torch.cat([z,workspace,self_model,unc,nov,boundary],-1))
        # Active experiment affects only the candidate action branch; default execution is conservative.
        mix = (0.92 if not run_experiment else 0.78) * o25['chosen_action_v25'] + (0.08 if not run_experiment else 0.22) * probe
        chosen=torch.tanh(mix)
        # State updates are detached and bounded to keep the mobile life-state safe.
        mu=torch.clamp(self.cfg.memory_uncertainty_decay*state.memory_uncertainty + (1-self.cfg.memory_uncertainty_decay)*pred_err,0,2)
        corr=self.cfg.correction_decay*state.correction_state + (1-self.cfg.correction_decay)*corrected[2].detach()
        trans=self.cfg.transition_decay*state.transition_state + (1-self.cfg.transition_decay)*transition_raw.detach()
        anchor=self.cfg.anchor_decay*state.stable_anchor + (1-self.cfg.anchor_decay)*inv_candidate.detach()
        exp_state=self.cfg.verify_decay*state.experiment_state + (1-self.cfg.verify_decay)*exp_probs.detach()
        invariant=self.cfg.verify_decay*state.invariant_state + (1-self.cfg.verify_decay)*(z.detach()-anchor)
        ns=V26State(base=s25,neural_memory=new_mem.detach() if commit_memory else state.neural_memory,
                    memory_uncertainty=mu.detach(),transition_state=trans,correction_state=corr,
                    experiment_state=exp_state,invariant_state=invariant,life_clock=state.life_clock+1,
                    stable_anchor=anchor)
        out=dict(o25); out.update({
            'neural_memory_read_v26':read,'neural_memory_pred_error_v26':pred_err,'memory_uncertainty_v26':mu,
            'memory_mix_v26':memory_mix,'memory_algorithm_weights_v26':memory_weights,'plan_latents_v26':plans,'plan_scores_v26':plan_scores,
            'transition_pred_v26':pred_state,'transition_weights_v26':weights,
            'predictive_prediction_v26':corrected[0],'predictive_error_v26':corrected[1],'predictive_correction_v26':corrected[2],
            'experiment_probs_v26':exp_probs,'experiment_probe_v26':probe,'chosen_action_v26':chosen,
            'identity_invariant_v26':inv_candidate,'identity_deviation_v26':inv_score,'capability_vector_v26':cap,
            'stable_anchor_v26':anchor,'life_clock_v26':ns.life_clock,
        })
        return out,ns

    def forward(self,x:Tensor,state:Optional[V26State]=None,goal:Optional[Tensor]=None,
                goal_sequence:Optional[Tensor]=None,modality_sequence:Optional[Tensor]=None,
                presence_sequence:Optional[Tensor]=None,proprioception_sequence:Optional[Tensor]=None,
                interoception_sequence:Optional[Tensor]=None,commit_memory:bool=True,run_experiment:bool=True):
        if x.ndim!=3 or x.size(-1)!=self.cfg.d: raise ValueError('x must be [B,T,D]')
        st=self.initial_state(x.size(0),x.device,x.dtype) if state is None else state; rows=[]
        for t in range(x.size(1)):
            o,st=self.step(x[:,t],st,
                goal=goal_sequence[:,t] if goal_sequence is not None else goal,
                modalities=modality_sequence[:,t] if modality_sequence is not None else None,
                presence=presence_sequence[:,t] if presence_sequence is not None else None,
                proprioception=proprioception_sequence[:,t] if proprioception_sequence is not None else None,
                interoception=interoception_sequence[:,t] if interoception_sequence is not None else None,
                commit_memory=commit_memory,run_experiment=run_experiment)
            rows.append(o)
        return {k:torch.stack([r[k] for r in rows],1) for k in rows[0] if torch.is_tensor(rows[0][k])}|{'_final_state':st}

    def training_loss_parts(self,out:Dict[str,Tensor],target:Optional[Tensor]=None):
        z=out['latent_v25']; zero=z.new_zeros(())
        if z.size(1)<=1:return zero,zero
        observed=z[:,1:].detach()
        pred=F.normalize(out['transition_pred_v26'][:,:-1],dim=-1,eps=1e-5)
        primary=F.smooth_l1_loss(pred,observed)
        primary += 0.15*F.smooth_l1_loss(out['predictive_prediction_v26'][:,:-1],observed)
        if target is not None and target.shape==z[:,-1].shape: primary += 0.20*F.mse_loss(z[:,-1],target)
        mem_target=z.detach()
        retrieved=out['memory_mix_v26']
        memory_loss=(1-F.cosine_similarity(retrieved,mem_target,dim=-1,eps=1e-5)).mean()
        plan_target=out['latent_v25'].detach().unsqueeze(2).expand(-1,-1,out['plan_latents_v26'].size(2),-1)
        plan_loss=F.smooth_l1_loss(out['plan_latents_v26'], plan_target)
        # Corrector learns to predict an explicit future delta from its previous-state prediction.
        delta_target=(z[:,1:]-z[:,:-1]).detach()
        delta_pred=out['predictive_correction_v26'][:,:-1]
        predictive_loss=F.smooth_l1_loss(delta_pred,delta_target)
        inv_target=(out['autobiographical_v23']).detach()
        inv_loss=F.smooth_l1_loss(out['identity_invariant_v26'],inv_target)
        # Experiment distribution should correlate with measurable uncertainty/novelty/need.
        desirability=torch.cat([out['uncertainty'],out['novelty'],out['learning_pressure_v23'].mean(-1,keepdim=True)],-1).detach()
        desired=F.softmax(desirability,dim=-1)
        exp_loss=F.kl_div(out['experiment_probs_v26'].clamp_min(1e-6).log(),desired,reduction='batchmean')
        aux=self.cfg.memory_weight*memory_loss+self.cfg.predictive_weight*predictive_loss+self.cfg.invariant_weight*inv_loss+self.cfg.experiment_weight*exp_loss+0.06*plan_loss
        return primary,aux

    def training_loss(self,out,target=None):
        a,b=self.training_loss_parts(out,target); return self.cfg.primary_weight*a+b


class LifelongTrainerV26:
    """Scoped trainer with conflict-aware projection of auxiliary gradients onto the primary-loss cone."""
    def __init__(self,model:NeuroWeaveV26,lr:float=7e-4,max_norm:float=1.0):
        self.model=model; self.max_norm=max_norm
        mods=[model.memory,model.transitions,model.corrector,model.experimenter,model.invariant,model.capability_head]
        self.params=[p for m in mods for p in m.parameters()]
        allowed={id(p) for p in self.params}
        for p in model.parameters():
            if id(p) not in allowed:p.requires_grad_(False)
        self.optimizer=torch.optim.AdamW(self.params,lr=lr,weight_decay=1e-4)

    @staticmethod
    def _flat_grad(params):
        vals=[]
        for p in params:
            if p.grad is None:
                vals.append(torch.zeros_like(p).reshape(-1))
            else:
                vals.append(p.grad.reshape(-1))
        return torch.cat(vals) if vals else None

    def step(self,x:Tensor,target:Optional[Tensor]=None,**kwargs):
        self.model.train(); self.optimizer.zero_grad(set_to_none=True)
        out=self.model(x,commit_memory=False,**kwargs)
        primary,aux=self.model.training_loss_parts(out,target)
        primary.backward(retain_graph=True)
        pg=self._flat_grad(self.params)
        pvec=pg.detach().clone() if pg is not None else None
        self.optimizer.zero_grad(set_to_none=True)
        aux.backward()
        if pvec is not None:
            ag=self._flat_grad(self.params)
            if ag is not None:
                dot=torch.dot(ag,pvec); denom=torch.dot(pvec,pvec).clamp_min(1e-8)
                if dot < 0:
                    coeff=dot/denom
                    offset=0
                    for p in self.params:
                        if p.grad is None: continue
                        n=p.numel(); g=p.grad.reshape(-1); g.copy_(g-coeff*pvec[offset:offset+n]); offset+=n
        torch.nn.utils.clip_grad_norm_(self.params,self.max_norm); self.optimizer.step()
        return (primary+aux).detach(),out


class StagedLifelongTrainerV26(LifelongTrainerV26):
    """Two-phase trainer: warm the primary predictive path, then introduce auxiliary objectives.
    Designed to test whether V26 complexity becomes useful without sacrificing the base learning signal.
    """
    def __init__(self, model:NeuroWeaveV26, lr:float=7e-4, max_norm:float=1.0, warmup_steps:int=2):
        super().__init__(model,lr=lr,max_norm=max_norm); self.warmup_steps=warmup_steps; self.step_count=0

    def step(self,x:Tensor,target:Optional[Tensor]=None,**kwargs):
        self.model.train(); self.optimizer.zero_grad(set_to_none=True)
        out=self.model(x,commit_memory=False,**kwargs)
        primary,aux=self.model.training_loss_parts(out,target)
        loss=primary if self.step_count < self.warmup_steps else primary + aux
        loss.backward(); torch.nn.utils.clip_grad_norm_(self.params,self.max_norm); self.optimizer.step(); self.step_count += 1
        return loss.detach(),out
