from __future__ import annotations
from dataclasses import dataclass
from typing import Optional, Tuple, Dict
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v22 import NeuroWeaveV22, V22Config, V22State


@dataclass
class V23State:
    base: V22State
    autobiographical: Tensor
    capability_ema: Tensor
    need_ema: Tensor
    attention_trace: Tensor
    learning_pressure: Tensor
    goal_memory: Tensor
    action_ema: Tensor
    world_error_ema: Tensor
    retention_score: Tensor
    life_age: Tensor
    developmental_stage: Tensor


@dataclass
class V23Config:
    d: int = 16
    hidden: int = 32
    action_dim: int = 4
    modalities: int = 3
    attention_decay: float = 0.90
    capability_decay: float = 0.97
    need_decay: float = 0.93
    learning_pressure_decay: float = 0.94
    world_error_decay: float = 0.92
    retention_decay: float = 0.985
    identity_decay: float = 0.995
    developmental_gain: float = 0.08
    action_smooth: float = 0.85
    goal_persistence: float = 0.96
    curiosity_weight: float = 0.35
    progress_weight: float = 0.30
    homeostasis_weight: float = 0.20
    risk_weight: float = 0.15
    prediction_weight: float = 0.45
    retention_weight: float = 0.20
    development_weight: float = 0.18
    agency_weight: float = 0.17
    mobile_cap: float = 0.30


class EventAttentionV23(nn.Module):
    """Bounded event-driven attention. Only large changes refresh the trace strongly."""
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.score = nn.Sequential(nn.Linear(2*d + 5, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.mix = nn.Sequential(nn.Linear(2*d + 3, hidden), nn.SiLU(), nn.Linear(hidden, d))

    def forward(self, z: Tensor, prev: Tensor, novelty: Tensor, uncertainty: Tensor,
                confidence: Tensor, energy: Tensor, regime: Tensor) -> Tuple[Tensor, Tensor]:
        delta = z - prev
        s = torch.sigmoid(self.score(torch.cat([z, delta, novelty, uncertainty, confidence, energy, regime], -1)))
        candidate = torch.tanh(self.mix(torch.cat([z, prev, novelty, uncertainty, energy], -1)))
        return s, candidate


class NeedDynamicsV23(nn.Module):
    """Maps observable internal variables into four bounded need pressures."""
    def __init__(self, hidden: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(8, hidden), nn.SiLU(), nn.Linear(hidden, 4))

    def forward(self, energy: Tensor, thermal: Tensor, confidence: Tensor, uncertainty: Tensor,
                novelty: Tensor, regime: Tensor, prediction_error: Tensor, progress: Tensor) -> Tensor:
        inp = torch.cat([energy, thermal, confidence, uncertainty, novelty, regime, prediction_error, progress], -1)
        return torch.sigmoid(self.net(inp))


class GoalGeneratorV23(nn.Module):
    """Generates a compact persistent goal from state, needs and capability gaps.

    This is a learned controller, not a claim of intrinsic motivation or consciousness.
    """
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(2*d + 18, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.gate = nn.Sequential(nn.Linear(2*d + 3, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, z: Tensor, needs: Tensor, capability: Tensor, goal_memory: Tensor,
                novelty: Tensor, uncertainty: Tensor, confidence: Tensor,
                progress: Tensor, regime: Tensor, learning_pressure: Tensor) -> Tuple[Tensor, Tensor]:
        gap = (0.6 - capability).mean(-1, keepdim=True)
        raw = self.net(torch.cat([z, goal_memory, needs, capability,
                                   novelty, uncertainty, confidence, progress, regime, learning_pressure, gap], -1))
        gate = torch.sigmoid(self.gate(torch.cat([z, goal_memory, novelty, uncertainty, progress], -1)))
        return torch.tanh(raw), gate


class DevelopmentalControllerV23(nn.Module):
    """Selects bounded self-generated learning pressure from observable capability gaps."""
    def __init__(self, hidden: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(9, hidden), nn.SiLU(), nn.Linear(hidden, 5))

    def forward(self, capability: Tensor, uncertainty: Tensor, novelty: Tensor, need: Tensor,
                world_error: Tensor, retention: Tensor, energy: Tensor, thermal: Tensor,
                regime: Tensor) -> Tuple[Tensor, Tensor]:
        x = torch.cat([capability.mean(-1, keepdim=True), uncertainty, novelty,
                       need.mean(-1, keepdim=True), world_error, retention, energy, thermal, regime], -1)
        raw = self.net(x)
        pressure = torch.sigmoid(raw[:, :4])
        stage = torch.sigmoid(raw[:, 4:5])
        return pressure, stage


class RetentionGateV23(nn.Module):
    """Estimates whether a state should be protected from aggressive plasticity."""
    def __init__(self, d: int, hidden: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(2*d + 6, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, z: Tensor, identity: Tensor, uncertainty: Tensor, confidence: Tensor,
                novelty: Tensor, world_error: Tensor, life_age: Tensor, need: Tensor) -> Tensor:
        x = torch.cat([z, identity, uncertainty, confidence, novelty, world_error, life_age, need], -1)
        return torch.sigmoid(self.net(x))


class AgencyHeadV23(nn.Module):
    """Goal-conditioned action proposal with an explicit risk-sensitive utility signal."""
    def __init__(self, d: int, hidden: int, action_dim: int):
        super().__init__()
        self.propose = nn.Sequential(nn.Linear(2*d + 9, hidden), nn.SiLU(), nn.Linear(hidden, action_dim))
        self.utility = nn.Sequential(nn.Linear(d + action_dim + 5, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, z: Tensor, goal: Tensor, needs: Tensor, budget: Tensor,
                uncertainty: Tensor, confidence: Tensor, energy: Tensor,
                progress: Tensor, action_prev: Tensor) -> Tuple[Tensor, Tensor]:
        a = torch.tanh(self.propose(torch.cat([z, goal, needs, uncertainty, confidence, energy, progress, budget], -1)))
        u = self.utility(torch.cat([z, a, uncertainty, confidence, energy, progress, (a-action_prev).norm(dim=-1, keepdim=True)], -1))
        return a, u


class ConsolidationControllerV23(nn.Module):
    """Computes a bounded consolidation gate from stability, retention and learning pressure."""
    def __init__(self, hidden: int):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(6, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, retention: Tensor, confidence: Tensor, uncertainty: Tensor,
                world_error: Tensor, learning_pressure: Tensor, need: Tensor) -> Tensor:
        x = torch.cat([retention, confidence, 1-uncertainty, 1-world_error.clamp(0,1), learning_pressure.mean(-1,keepdim=True), need.mean(-1,keepdim=True)], -1)
        return torch.sigmoid(self.net(x))


class NeuroWeaveV23(nn.Module):
    """Frontier MAX V23: canonical continual organism loop.

    V23 does not claim consciousness. It integrates V22 with a bounded life loop:
    event-driven attention, needs, self-generated development pressure, persistent goals,
    agency proposals, retention protection, autobiographical state and state-only consolidation.
    """
    def __init__(self, cfg: Optional[V23Config] = None):
        super().__init__()
        c = cfg or V23Config(); self.cfg = c
        self.core = NeuroWeaveV22(V22Config(
            d=c.d, hidden=c.hidden, action_dim=c.action_dim, modalities=c.modalities,
            mobile_cap=c.mobile_cap,
        ))
        self.event_attention = EventAttentionV23(c.d, c.hidden)
        self.need_head = NeedDynamicsV23(c.hidden)
        self.goal_generator = GoalGeneratorV23(c.d, c.hidden)
        self.development = DevelopmentalControllerV23(c.hidden)
        self.retention_gate = RetentionGateV23(c.d, c.hidden)
        self.agency = AgencyHeadV23(c.d, c.hidden, c.action_dim)
        self.consolidation = ConsolidationControllerV23(c.hidden)
        self.identity_projection = nn.Sequential(nn.Linear(2*c.d + 8, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.d))
        self.future_value = nn.Sequential(nn.Linear(2*c.d + 5, c.hidden), nn.SiLU(), nn.Linear(hidden if False else c.hidden, 1))

    def initial_state(self, b: int, device=None, dtype=None) -> V23State:
        base = self.core.initial_state(b, device=device, dtype=dtype)
        z = lambda: torch.zeros(b, self.cfg.d, device=device, dtype=dtype)
        return V23State(
            base=base,
            autobiographical=z(),
            capability_ema=torch.full((b,4),0.5,device=device,dtype=dtype),
            need_ema=torch.full((b,4),0.5,device=device,dtype=dtype),
            attention_trace=z(),
            learning_pressure=torch.full((b,4),0.25,device=device,dtype=dtype),
            goal_memory=z(), action_ema=torch.zeros(b,self.cfg.action_dim,device=device,dtype=dtype),
            world_error_ema=torch.zeros(b,1,device=device,dtype=dtype),
            retention_score=torch.full((b,1),0.5,device=device,dtype=dtype),
            life_age=torch.zeros(b,1,device=device,dtype=dtype),
            developmental_stage=torch.zeros(b,1,device=device,dtype=dtype),
        )

    @torch.no_grad()
    def _consolidate(self, state: V23State, identity: Tensor, goal: Tensor,
                     attention: Tensor, retention: Tensor, gate: Tensor):
        rate = 0.04 * gate.clamp(0,1) * retention.clamp(0,1)
        auto = (1-rate) * state.autobiographical + rate * identity.detach()
        gm = (1-rate) * state.goal_memory + rate * goal.detach()
        at = (1-rate) * state.attention_trace + rate * attention.detach()
        return auto.detach(), gm.detach(), at.detach()

    def step(self, x: Tensor, state: V23State, goal: Optional[Tensor]=None, action: Optional[Tensor]=None,
             modalities: Optional[Tensor]=None, presence: Optional[Tensor]=None, commit_memory: bool=True):
        out22, base_state = self.core.step(x, state.base, goal=goal, action=action,
                                           modalities=modalities, presence=presence, commit_memory=commit_memory)
        z = out22["latent_v22"]
        unc = out22["uncertainty"].to(z.dtype); nov = out22["novelty"].to(z.dtype)
        conf = out22["confidence"].to(z.dtype); energy = out22["energy_v14"].to(z.dtype)
        thermal = out22["thermal_v14"].to(z.dtype); regime = out22["regime_v21"].to(z.dtype)
        pred_err = out22["temporal_error"].to(z.dtype)
        progress = (-out22["active_free_energy_v22"]).tanh().detach()
        attn, attn_candidate = self.event_attention(z, state.attention_trace, nov, unc, conf, energy, regime)
        attention = (self.cfg.attention_decay * state.attention_trace + (1-self.cfg.attention_decay) * attn * attn_candidate).detach()
        needs_raw = self.need_head(energy, thermal, conf, unc, nov, regime, pred_err, progress)
        needs = self.cfg.need_decay * state.need_ema + (1-self.cfg.need_decay) * needs_raw
        capability = out22["capability_v22"].to(z.dtype)
        capability_ema = self.cfg.capability_decay * state.capability_ema + (1-self.cfg.capability_decay) * capability.detach()
        pressure, stage = self.development(capability_ema, unc, nov, needs, pred_err, state.retention_score, energy, thermal, regime)
        learning_pressure = self.cfg.learning_pressure_decay*state.learning_pressure + (1-self.cfg.learning_pressure_decay)*pressure

        goal_in = torch.zeros_like(z) if goal is None else goal
        generated_goal, goal_gate = self.goal_generator(z, needs, capability_ema, state.goal_memory, nov, unc, conf, progress, regime, learning_pressure)
        persistent_goal = torch.where(goal_gate > 0.45, generated_goal, state.goal_memory)
        if goal is not None:
            persistent_goal = 0.65*persistent_goal + 0.35*goal
        persistent_goal = F.normalize(persistent_goal, dim=-1, eps=1e-4)

        prior_action = out22["chosen_action_v22"] if action is None else action
        budget = out22["compute_budget_v22"].to(z.dtype)
        agency_action, agency_utility = self.agency(z, persistent_goal, needs, budget, unc, conf, energy, progress, state.action_ema)
        agency_gate = (0.35 + 0.65*budget) * (1-thermal).clamp(0,1) * conf
        chosen = prior_action if action is not None else torch.tanh((1-agency_gate)*prior_action + agency_gate*agency_action)
        action_ema = self.cfg.action_smooth * state.action_ema + (1-self.cfg.action_smooth)*chosen.detach()

        # Use the canonical V22 planner as a world interface; V23 does not create a second world truth store.
        planner = self.core.core.core.core.planner
        imagined_next, imagined_reward, imagined_risk, imagined_unc = planner.transition(z, chosen)
        baseline_action = torch.zeros_like(chosen)
        base_next, base_reward, base_risk, base_unc = planner.transition(z, baseline_action)
        cf_adv = (imagined_reward - base_reward) - 0.5*(imagined_risk - base_risk)
        future_value = self.future_value(torch.cat([z, persistent_goal, unc, conf, energy, imagined_reward, imagined_risk], -1))

        retention = self.retention_gate(z, out22["identity_slow_v22"].to(z.dtype), unc, conf, nov,
                                        pred_err, state.life_age, needs.mean(-1,keepdim=True))
        world_error_ema = self.cfg.world_error_decay*state.world_error_ema + (1-self.cfg.world_error_decay)*pred_err.detach()
        consolidation_gate = self.consolidation(retention, conf, unc, world_error_ema, learning_pressure, needs)
        identity_input = torch.cat([z, state.autobiographical, capability_ema, unc, conf, energy, regime], -1)
        identity_candidate = torch.tanh(self.identity_projection(identity_input))
        identity = self.cfg.identity_decay*state.autobiographical + (1-self.cfg.identity_decay)*identity_candidate
        auto, gm, at = self._consolidate(state, identity, persistent_goal, attention, retention, consolidation_gate)
        retention_score = self.cfg.retention_decay*state.retention_score + (1-self.cfg.retention_decay)*retention.detach()
        life_age = state.life_age + 1
        developmental_stage = (0.96*state.developmental_stage + 0.04*stage.detach()).clamp(0,1)

        # V23 canonical context flows forward; no parameter mutation in forward.
        base_state.context = z.detach()
        ns = V23State(base=base_state, autobiographical=auto, capability_ema=capability_ema.detach(),
                      need_ema=needs.detach(), attention_trace=at, learning_pressure=learning_pressure.detach(),
                      goal_memory=gm, action_ema=action_ema, world_error_ema=world_error_ema,
                      retention_score=retention_score.detach(), life_age=life_age, developmental_stage=developmental_stage)
        out = dict(out22)
        out.update({
            "latent_v23": z,
            "attention_event_v23": attn,
            "attention_trace_v23": attention,
            "attention_candidate_v23": attn_candidate,
            "needs_v23": needs,
            "capability_ema_v23": capability_ema,
            "learning_pressure_v23": learning_pressure,
            "generated_goal_v23": generated_goal,
            "goal_gate_v23": goal_gate,
            "persistent_goal_v23": persistent_goal,
            "agency_action_v23": agency_action,
            "agency_gate_v23": agency_gate,
            "chosen_action_v23": chosen,
            "agency_utility_v23": agency_utility,
            "imagined_next_v23": imagined_next,
            "imagined_reward_v23": imagined_reward,
            "imagined_risk_v23": imagined_risk,
            "imagined_uncertainty_v23": imagined_unc,
            "baseline_reward_v23": base_reward,
            "baseline_risk_v23": base_risk,
            "counterfactual_advantage_v23": cf_adv,
            "future_value_v23": future_value,
            "retention_gate_v23": retention,
            "consolidation_gate_v23": consolidation_gate,
            "autobiographical_v23": identity,
            "world_error_ema_v23": world_error_ema,
            "developmental_stage_v23": developmental_stage,
            "life_age_v23": life_age,
            "needs_raw_v23": needs_raw,
        })
        return out, ns

    def forward(self, x: Tensor, state: Optional[V23State]=None, goal: Optional[Tensor]=None,
                goal_sequence: Optional[Tensor]=None, modality_sequence: Optional[Tensor]=None,
                presence_sequence: Optional[Tensor]=None, commit_memory: bool=True) -> Dict[str, Tensor]:
        if x.ndim != 3 or x.size(-1) != self.cfg.d:
            raise ValueError("x must be [B,T,D]")
        if goal_sequence is not None and goal_sequence.shape[:2] != x.shape[:2]:
            raise ValueError("goal_sequence must match [B,T,*]")
        if modality_sequence is not None and (modality_sequence.ndim != 4 or modality_sequence.shape[:2] != x.shape[:2]):
            raise ValueError("modality_sequence must be [B,T,M,D]")
        if presence_sequence is not None and presence_sequence.shape[:2] != x.shape[:2]:
            raise ValueError("presence_sequence must match [B,T,*]")
        state = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows=[]
        for t in range(x.size(1)):
            g = goal_sequence[:,t] if goal_sequence is not None else goal
            m = modality_sequence[:,t] if modality_sequence is not None else None
            p = presence_sequence[:,t] if presence_sequence is not None else None
            o, state = self.step(x[:,t], state, goal=g, modalities=m, presence=p, commit_memory=commit_memory)
            rows.append(o)
        return {k: torch.stack([r[k] for r in rows],1) for k in rows[0] if torch.is_tensor(rows[0][k])} | {"_final_state": state}

    def training_loss(self, out: Dict[str, Tensor], target: Optional[Tensor]=None) -> Tensor:
        primary, auxiliary = self.training_loss_parts(out, target=target)
        return primary + auxiliary

    def training_loss_parts(self, out: Dict[str, Tensor], target: Optional[Tensor]=None):
        """Return primary predictive loss and auxiliary organism loss separately.

        Separating these enables gradient-conflict surgery: auxiliary objectives cannot
        silently degrade the main predictive learning path when their gradients oppose it.
        """
        z = out["latent_v23"]
        primary = z.new_zeros(())
        auxiliary = z.new_zeros(())
        if z.size(1) > 1:
            actual_next = out["imagined_next_v23"][:, :-1]
            future_target = z[:, 1:].detach()
            pred_loss = F.smooth_l1_loss(actual_next, future_target)
            value_loss = F.smooth_l1_loss(torch.tanh(out["future_value_v23"][:, :-1]),
                                          out["imagined_reward_v23"][:, :-1].detach().clamp(-1,1))
            primary = self.cfg.prediction_weight * pred_loss + 0.12 * value_loss
            goal_progress = (1 - (out["persistent_goal_v23"] - z).norm(dim=-1, keepdim=True).clamp(0, 10)/10).detach()
            agency_loss = -out["agency_utility_v23"].mean()
            retention_target = (out["confidence"] * (1-out["uncertainty"]).clamp(0,1)).detach()
            retention_loss = F.smooth_l1_loss(out["retention_gate_v23"], retention_target)
            dev_target = (out["novelty"] + out["uncertainty"]).clamp(0,1).detach()
            dev_loss = F.smooth_l1_loss(out["learning_pressure_v23"].mean(-1,keepdim=True), dev_target)
            attention_target = (out["novelty"] + out["temporal_error"]).clamp(0,1).detach()
            attn_loss = F.smooth_l1_loss(out["attention_event_v23"], attention_target)
            need_target = torch.cat([out["energy_v14"], out["thermal_v14"], out["confidence"], (1-out["uncertainty"]).clamp(0,1)], -1).detach()
            need_loss = F.mse_loss(out["needs_v23"], need_target)
            identity_loss = F.mse_loss(out["autobiographical_v23"][:,1:], out["autobiographical_v23"][:,:-1].detach())
            cf_loss = -out["counterfactual_advantage_v23"].mean()
            attention_candidate_target = (z - out["attention_trace_v23"].detach()).detach()
            attention_candidate_loss = F.smooth_l1_loss(out["attention_candidate_v23"], attention_candidate_target)
            goal_gate_target = out["learning_pressure_v23"].mean(-1, keepdim=True).detach().clamp(0,1)
            goal_gate_loss = F.smooth_l1_loss(out["goal_gate_v23"], goal_gate_target)
            consolidation_target = (out["retention_gate_v23"] * out["confidence"] * (1-out["uncertainty"]).clamp(0,1)).detach()
            consolidation_loss = F.smooth_l1_loss(out["consolidation_gate_v23"], consolidation_target)
            auxiliary = (self.cfg.agency_weight*agency_loss + self.cfg.retention_weight*retention_loss +
                         self.cfg.development_weight*dev_loss + 0.06*attn_loss + 0.08*need_loss +
                         0.05*identity_loss + 0.06*cf_loss - 0.05*goal_progress.mean() +
                         0.04*attention_candidate_loss + 0.04*goal_gate_loss + 0.04*consolidation_loss)
        if target is not None and target.shape == z[:,-1].shape:
            primary = primary + 0.20*F.mse_loss(z[:,-1], target)
        return primary, auxiliary


class LifeTrainerV23:
    """Optimizer scoped to V23-added mechanisms; V22 stays the fixed substrate by default."""
    def __init__(self, model: NeuroWeaveV23, lr: float=1e-3, max_norm: float=1.0):
        self.model=model; self.max_norm=max_norm
        mods=[model.event_attention, model.need_head, model.goal_generator, model.development,
              model.retention_gate, model.agency, model.consolidation, model.identity_projection, model.future_value]
        self.params=[p for m in mods for p in m.parameters()]
        self.optimizer=torch.optim.AdamW(self.params,lr=lr,weight_decay=1e-4)
    def step(self,x:Tensor,target:Optional[Tensor]=None,modality_sequence:Optional[Tensor]=None,
             presence_sequence:Optional[Tensor]=None,goal_sequence:Optional[Tensor]=None):
        self.model.train(); self.optimizer.zero_grad(set_to_none=True)
        out=self.model(x,modality_sequence=modality_sequence,presence_sequence=presence_sequence,
                       goal_sequence=goal_sequence,commit_memory=False)
        loss=self.model.training_loss(out,target=target)
        loss.backward(); torch.nn.utils.clip_grad_norm_(self.params,self.max_norm); self.optimizer.step()
        return loss.detach(),out


class ConflictAwareLifeTrainerV23(LifeTrainerV23):
    """Multi-objective trainer with gradient-conflict projection.

    Primary predictive gradients are preserved. Auxiliary organism objectives are projected
    away from the primary gradient when they would directly oppose it.
    """
    @staticmethod
    def _project_conflicts(primary_grads, auxiliary_grads):
        dot = None; norm = None
        for gp, ga in zip(primary_grads, auxiliary_grads):
            if gp is None or ga is None: continue
            d = (gp * ga).sum()
            dot = d if dot is None else dot + d
            n = (gp * gp).sum()
            norm = n if norm is None else norm + n
        if dot is None or norm is None or float(dot.detach()) >= 0.0:
            return auxiliary_grads, False
        coeff = dot / (norm + 1e-12)
        out=[]
        for gp, ga in zip(primary_grads, auxiliary_grads):
            if gp is None or ga is None: out.append(ga)
            else: out.append(ga - coeff * gp)
        return out, True

    def step(self, x: Tensor, target: Optional[Tensor]=None, modality_sequence: Optional[Tensor]=None,
             presence_sequence: Optional[Tensor]=None, goal_sequence: Optional[Tensor]=None):
        self.model.train(); self.optimizer.zero_grad(set_to_none=True)
        out=self.model(x,modality_sequence=modality_sequence,presence_sequence=presence_sequence,
                       goal_sequence=goal_sequence,commit_memory=False)
        primary, auxiliary = self.model.training_loss_parts(out, target=target)
        primary_grads=torch.autograd.grad(primary, self.params, retain_graph=True, allow_unused=True)
        auxiliary_grads=torch.autograd.grad(auxiliary, self.params, retain_graph=False, allow_unused=True)
        auxiliary_projected, conflict=self._project_conflicts(primary_grads, auxiliary_grads)
        self.optimizer.zero_grad(set_to_none=True)
        for p,gp,ga in zip(self.params,primary_grads,auxiliary_projected):
            if gp is None and ga is None: continue
            g = (gp if gp is not None else 0) + (ga if ga is not None else 0)
            p.grad = g.clone() if torch.is_tensor(g) else None
        torch.nn.utils.clip_grad_norm_(self.params,self.max_norm)
        self.optimizer.step()
        return (primary.detach()+auxiliary.detach()), {'primary':primary.detach(),'auxiliary':auxiliary.detach(),'conflict_projected':conflict,'output':out}
