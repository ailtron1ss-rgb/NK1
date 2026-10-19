from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple, List
import math
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v33 import V33Config, V33State, NeuroWeaveV33, OutcomeReplayV33


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


def _zero_like(x: Tensor) -> Tensor:
    return x.new_zeros(())


@dataclass
class V34Config(V33Config):
    """V34 Memory Brain: persistent episodic/semantic memory + multiscale future fields + skills.

    All new mechanisms have explicit causal influence paths and supervised/self-supervised
    objectives. The implementation stays compact for Android: bounded slots, bounded skills,
    fixed number of successor scales, no unbounded context accumulation.
    """
    episodic_slots_v34: int = 16
    causal_memory_scale: float = 0.0
    legacy_rule_scale: float = 0.0
    semantic_blend_v34: float = 0.18
    memory_temperature_v34: float = 0.35
    memory_write_weight_v34: float = 0.10
    memory_read_goal_weight_v34: float = 0.16
    memory_recall_weight_v34: float = 0.08
    memory_semantic_weight_v34: float = 0.10
    memory_prediction_weight_v34: float = 0.12
    memory_priority_decay_v34: float = 0.92
    memory_age_penalty_v34: float = 0.02
    skill_count_v34: int = 6
    skill_blend_v34: float = 0.14
    skill_distill_weight_v34: float = 0.10
    skill_boundary_weight_v34: float = 0.04
    skill_balance_weight_v34: float = 0.01
    sr_dim_v34: int = 8
    sr_gammas_v34: Tuple[float, ...] = (0.80, 0.92, 0.985)
    successor_weight_v34: float = 0.10
    subgoal_weight_v34: float = 0.08
    subgoal_horizon_v34: int = 3
    replay_capacity_v34: int = 256
    replay_batch_v34: int = 8
    replay_weight_v34: float = 0.06
    rehearsal_interval_v34: int = 8


class EpisodicSemanticMemoryV34(nn.Module):
    """Bounded differentiable event memory with utility-aware writes and semantic consolidation."""

    def __init__(self, d: int, hidden: int, action_dim: int, slots: int, temperature: float, priority_decay: float, age_penalty: float):
        super().__init__()
        self.d = d
        self.slots = slots
        self.temperature = temperature
        self.priority_decay_rate = float(priority_decay)
        self.age_penalty = float(age_penalty)
        self.query = nn.Sequential(nn.Linear(2 * d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.event = nn.Sequential(nn.Linear(d + action_dim + 5, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.write_gate = nn.Sequential(nn.Linear(d + 4, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.semantic_update = nn.Sequential(nn.Linear(2 * d + 5, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.semantic_predict = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.to_goal = nn.Sequential(nn.Linear(2 * d, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.register_buffer('temperature_floor', torch.tensor(0.05), persistent=False)

    def read(self, x: Tensor, semantic_state: Tensor, memory: Tensor, priority: Tensor, age: Tensor):
        q = _norm(self.query(torch.cat([x, semantic_state], -1)))
        mn = _norm(memory)
        sim = (q.unsqueeze(1) * mn).sum(-1)
        utility = sim + 0.30 * priority - age * self.age_penalty
        temp = max(self.temperature, float(self.temperature_floor.item()))
        attn = F.softmax(utility / temp, dim=-1)
        read = (attn.unsqueeze(-1) * memory).sum(1)
        return q, read, attn, sim

    def write(self, x: Tensor, semantic_state: Tensor, memory: Tensor, priority: Tensor, age: Tensor,
              action: Tensor, uncertainty: Tensor, novelty: Tensor, prediction_error: Tensor,
              reward: Tensor, risk: Tensor):
        content = _norm(self.event(torch.cat([x, action, uncertainty, novelty, prediction_error, reward, risk], -1)))
        evidence = torch.sigmoid(1.4 * prediction_error + 0.9 * novelty + 0.5 * reward.abs() + 0.6 * risk)
        gate = torch.sigmoid(self.write_gate(torch.cat([x, uncertainty, novelty, prediction_error, reward], -1))) * evidence
        q, read_before, read_attn, sim = self.read(x, semantic_state, memory, priority, age)
        # Write where the event is least represented, while allowing high-priority old slots to recover.
        write_score = -sim + 0.20 * age + 0.15 * (1.0 - priority)
        w = F.softmax(write_score / max(self.temperature, 0.05), dim=-1)
        alpha = gate * self._write_scale(w, x)
        new_memory = memory + alpha.unsqueeze(-1) * (w.unsqueeze(-1) * (content.unsqueeze(1) - memory))
        new_priority = (self.priority_decay(priority) + alpha * w * evidence).clamp(0.0, 1.0)
        new_age = (age + 1.0 - alpha * w * 2.0).clamp(0.0, 1000.0)
        q2, post_read, post_attn, _ = self.read(x, semantic_state, new_memory, new_priority, new_age)
        sem_input = torch.cat([post_read, x, uncertainty, novelty, prediction_error, reward, risk], -1)
        candidate_sem = torch.tanh(self.semantic_update(sem_input))
        new_semantic = torch.tanh(0.94 * semantic_state + 0.06 * candidate_sem)
        sem_next = _norm(self.semantic_predict(new_semantic))
        return {
            'memory': new_memory,
            'priority': new_priority,
            'age': new_age,
            'semantic': new_semantic,
            'query': q,
            'read_before': read_before,
            'read_after': post_read,
            'read_attention': post_attn,
            'write_weights': w,
            'write_gate': gate,
            'write_content': content,
            'evidence': evidence,
            'semantic_next_prediction': sem_next,
        }

    def _write_scale(self, w: Tensor, x: Tensor) -> Tensor:
        return w.sum(-1, keepdim=True).clamp(0.0, 1.0) * 1.0

    def priority_decay(self, priority: Tensor) -> Tensor:
        return self.priority_decay_rate * priority


class SuccessorFieldV34(nn.Module):
    """Multi-timescale successor representations for reusable temporal abstractions and subgoals."""

    def __init__(self, d: int, hidden: int, sr_dim: int, gammas: Tuple[float, ...], goal_dim: int):
        super().__init__()
        self.sr_dim = sr_dim
        self.gammas = gammas
        self.phi = nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, sr_dim))
        self.heads = nn.ModuleList([nn.Sequential(nn.Linear(d, hidden), nn.SiLU(), nn.Linear(hidden, sr_dim)) for _ in gammas])
        self.subgoal = nn.Sequential(nn.Linear(len(gammas) * sr_dim, hidden), nn.SiLU(), nn.Linear(hidden, goal_dim))

    def forward(self, z: Tensor) -> Dict[str, Tensor]:
        phi = _norm(self.phi(z))
        preds = torch.stack([h(z) for h in self.heads], -2)
        sr_mean = preds.mean(-2)
        subgoal = _norm(self.subgoal(preds.reshape(*preds.shape[:-2], -1)))
        return {'phi': phi, 'sr': preds, 'sr_mean': sr_mean, 'subgoal': subgoal}

    def loss(self, out: Dict[str, Tensor]) -> Tensor:
        sr = out['successor_field_v34']
        phi = out['successor_phi_v34']
        zero = phi.new_zeros(())
        if phi.size(1) <= 1:
            return zero
        losses = []
        for i, gamma in enumerate(self.gammas):
            pred = sr[:, :-1, i]
            target = phi[:, :-1].detach() + gamma * sr[:, 1:, i].detach()
            losses.append(F.smooth_l1_loss(pred, target))
        return torch.stack(losses).mean()


class SkillLibraryV34(nn.Module):
    """Bounded option/skill library. Skills are selected by state-goal similarity and distilled from search."""

    def __init__(self, d: int, hidden: int, action_dim: int, goal_dim: int, body_dim: int,
                 semantic_dim: int, count: int):
        super().__init__()
        self.count = count
        context_dim = d + goal_dim + body_dim + semantic_dim
        self.context = nn.Sequential(nn.Linear(context_dim, hidden), nn.SiLU(), nn.Linear(hidden, d))
        self.skill_keys = nn.Parameter(torch.randn(count, d) * 0.05)
        self.action = nn.Sequential(nn.Linear(context_dim, hidden), nn.SiLU(), nn.Linear(hidden, action_dim))
        self.skill_bias = nn.Parameter(torch.zeros(count, action_dim))
        self.gate = nn.Sequential(nn.Linear(context_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.termination = nn.Sequential(nn.Linear(d + 1, hidden), nn.SiLU(), nn.Linear(hidden, 1))

    def forward(self, z: Tensor, goal: Tensor, body: Tensor, semantic: Tensor, prediction_error: Tensor) -> Dict[str, Tensor]:
        ctx = torch.cat([z, goal, body, semantic], -1)
        h = _norm(self.context(ctx))
        keys = _norm(self.skill_keys)
        logits = torch.matmul(h, keys.t()) / 0.35
        probs = F.softmax(logits, -1)
        base = self.action(ctx)
        residual = torch.matmul(probs, self.skill_bias)
        action = torch.tanh(base + residual)
        gate = torch.sigmoid(self.gate(ctx))
        chosen = probs.argmax(-1)
        skill_vec = torch.matmul(probs, self.skill_keys)
        term = torch.sigmoid(self.termination(torch.cat([skill_vec, prediction_error], -1)))
        return {'skill_probs': probs, 'skill_action': action, 'skill_gate': gate, 'skill_termination': term, 'skill_index': chosen}


@dataclass
class V34State:
    base: V33State
    episodic_memory: Tensor
    memory_priority: Tensor
    memory_age: Tensor
    semantic_state: Tensor
    life_clock: Tensor


class NeuroWeaveV34(nn.Module):
    """V34: a persistent memory/temporal-abstraction brain over V33."""

    def __init__(self, cfg: Optional[V34Config] = None):
        super().__init__()
        self.cfg = cfg or V34Config()
        c = self.cfg
        self.base = NeuroWeaveV33(c)
        self.memory = EpisodicSemanticMemoryV34(c.d, c.hidden, c.action_dim, c.episodic_slots_v34, c.memory_temperature_v34, c.memory_priority_decay_v34, c.memory_age_penalty_v34)
        self.successor = SuccessorFieldV34(c.d, c.hidden, c.sr_dim_v34, c.sr_gammas_v34, c.goal_dim)
        self.skills = SkillLibraryV34(c.d, c.hidden, c.action_dim, c.goal_dim, c.body_dim, c.d, c.skill_count_v34)
        self.memory_goal_proj = nn.Sequential(nn.Linear(2 * c.d, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.goal_dim))
        self.subgoal_proj = nn.Sequential(nn.Linear(c.goal_dim, c.hidden), nn.SiLU(), nn.Linear(c.hidden, c.goal_dim))
        self.skill_action_mix = nn.Parameter(torch.tensor(-2.0))

    def initial_state(self, b: int, device=None, dtype=None) -> V34State:
        return V34State(
            base=self.base.initial_state(b, device=device, dtype=dtype),
            episodic_memory=torch.zeros(b, self.cfg.episodic_slots_v34, self.cfg.d, device=device, dtype=dtype),
            memory_priority=torch.zeros(b, self.cfg.episodic_slots_v34, device=device, dtype=dtype),
            memory_age=torch.zeros(b, self.cfg.episodic_slots_v34, device=device, dtype=dtype),
            semantic_state=torch.zeros(b, self.cfg.d, device=device, dtype=dtype),
            life_clock=torch.zeros(b, 1, device=device, dtype=dtype),
        )

    def _internal(self, x: Tensor) -> Tensor:
        return self.base.observation_adapter(x)

    def step(self, x: Tensor, state: V34State, goal: Optional[Tensor] = None,
             target_next: Optional[Tensor] = None, presence=None, modalities=None,
             proprioception=None, interoception=None, commit_memory: bool = True,
             force_planning: Optional[bool] = None) -> Tuple[Dict[str, Tensor], V34State]:
        xin = self._internal(x)
        # Read previous experience BEFORE observing the current consequence/action.
        _, mem_read, mem_attn, _ = self.memory.read(xin, state.semantic_state, state.episodic_memory,
                                                   state.memory_priority, state.memory_age)
        sr_pre = self.successor(xin)
        semantic_mix = (1.0 - self.cfg.semantic_blend_v34) * mem_read + self.cfg.semantic_blend_v34 * state.semantic_state
        mem_goal = self.memory_goal_proj(torch.cat([mem_read, semantic_mix], -1))
        subgoal = self.subgoal_proj(sr_pre['subgoal'])
        if goal is None:
            enriched_goal = _norm(mem_goal + 0.12 * subgoal)
        else:
            enriched_goal = _norm(0.82 * goal + self.cfg.memory_read_goal_weight_v34 * mem_goal + 0.08 * subgoal)
        o33, st33 = self.base.step(
            x, state.base, goal=enriched_goal, target_next=target_next,
            presence=presence, modalities=modalities, proprioception=proprioception,
            interoception=interoception, commit_memory=commit_memory,
            force_planning=force_planning,
        )
        z = o33['fused_latent_v30']
        body = o33['body_state_v30']
        action = o33['chosen_action_v33']
        unc = o33['foresight_uncertainty_v32']
        nov = o33['novelty']
        pe = o33['prediction_error_v31']
        reward = o33['reward_v32']
        risk = o33['risk_v32']
        mem = self.memory.write(xin, state.semantic_state, state.episodic_memory, state.memory_priority,
                                state.memory_age, action, unc, nov, pe, reward, risk)
        sr = self.successor(z)
        skills = self.skills(z, enriched_goal, body, mem['semantic'], pe)
        mix = (self.cfg.skill_blend_v34 * torch.sigmoid(self.skill_action_mix) * skills['skill_gate']).clamp(0.0, 0.25)
        emitted = torch.tanh((1.0 - mix) * action + mix * skills['skill_action'])
        out = dict(o33)
        out.update({
            'memory_read_v34': mem['read_before'],
            'memory_post_read_v34': mem['read_after'],
            'memory_attention_v34': mem['read_attention'],
            'memory_write_weights_v34': mem['write_weights'],
            'memory_write_gate_v34': mem['write_gate'],
            'memory_write_content_v34': mem['write_content'],
            'memory_evidence_v34': mem['evidence'],
            'memory_priority_v34': mem['priority'],
            'memory_age_v34': mem['age'],
            'semantic_state_v34': mem['semantic'],
            'semantic_next_prediction_v34': mem['semantic_next_prediction'],
            'successor_phi_v34': sr['phi'],
            'successor_field_v34': sr['sr'],
            'successor_subgoal_v34': sr['subgoal'],
            'skill_probs_v34': skills['skill_probs'],
            'skill_action_v34': skills['skill_action'],
            'skill_gate_v34': skills['skill_gate'],
            'skill_termination_v34': skills['skill_termination'],
            'skill_index_v34': skills['skill_index'],
            'chosen_action_v34': emitted,
            'enriched_goal_v34': enriched_goal,
        })
        if commit_memory:
            next_mem = mem['memory'].detach()
            next_priority = mem['priority'].detach()
            next_age = mem['age'].detach()
            next_sem = mem['semantic'].detach()
        else:
            next_mem, next_priority, next_age, next_sem = mem['memory'], mem['priority'], mem['age'], mem['semantic']
        new_state = V34State(
            base=st33,
            episodic_memory=next_mem,
            memory_priority=next_priority,
            memory_age=next_age,
            semantic_state=next_sem,
            life_clock=state.life_clock + 1,
        )
        out['_final_state'] = new_state
        return out, new_state

    def forward(self, x: Tensor, state: Optional[V34State] = None, goal_sequence=None,
                target_sequence=None, presence_sequence=None, modality_sequence=None,
                proprioception_sequence=None, interoception_sequence=None,
                commit_memory: bool = True, force_planning: Optional[bool] = None) -> Dict[str, Tensor]:
        if x.ndim != 3:
            raise ValueError('x must be [B,T,D]')
        st = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows = []
        for t in range(x.size(1)):
            target_next = target_sequence[:, t] if target_sequence is not None and target_sequence.shape[:2] == x.shape[:2] else None
            o, st = self.step(
                x[:, t], st,
                goal=goal_sequence[:, t] if goal_sequence is not None else None,
                target_next=target_next,
                presence=presence_sequence[:, t] if presence_sequence is not None else None,
                modalities=modality_sequence[:, t] if modality_sequence is not None else None,
                proprioception=proprioception_sequence[:, t] if proprioception_sequence is not None else None,
                interoception=interoception_sequence[:, t] if interoception_sequence is not None else None,
                commit_memory=commit_memory, force_planning=force_planning,
            )
            rows.append(o)
        tensors = {k: torch.stack([r[k] for r in rows], 1) for k in rows[0]
                   if torch.is_tensor(rows[0][k]) and k != '_final_state'}
        if 'foresight_next_heads_v32' in tensors:
            tensors['foresight_next_heads_v32'] = tensors['foresight_next_heads_v32'].permute(0, 2, 1, 3).contiguous()
        tensors['_final_state'] = st
        return tensors

    def act_from_observation(self, observation: Tensor, state: V34State, goal: Optional[Tensor] = None,
                             commit_memory: bool = True, force_planning: Optional[bool] = None):
        return self.step(observation, state, goal=goal, commit_memory=commit_memory, force_planning=force_planning)

    def loss_parts(self, out: Dict[str, Tensor], target_sequence: Optional[Tensor] = None,
                   reward_sequence: Optional[Tensor] = None, risk_sequence: Optional[Tensor] = None) -> Dict[str, Tensor]:
        p = self.base.loss_parts(out, target_sequence=target_sequence, reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        z = out['fused_latent_v30']
        zero = _zero_like(z)
        if z.size(1) <= 1:
            return {**p, 'memory': zero, 'semantic': zero, 'semantic_prediction': zero, 'successor': zero, 'subgoal': zero,
                    'skill': zero, 'skill_boundary': zero, 'skill_balance': zero}
        # Memory utility: post-write recall reconstructs the newly committed event.
        memory_loss = F.smooth_l1_loss(out['memory_post_read_v34'], out['memory_write_content_v34'].detach())
        if z.size(1) > 1:
            recall = F.cosine_similarity(out['memory_read_v34'][:, 1:], out['memory_write_content_v34'][:, :-1].detach(), dim=-1)
            recall_loss = (1.0 - recall).mean()
            memory_loss = memory_loss + self.cfg.memory_recall_weight_v34 * recall_loss
        semantic_consolidation = F.smooth_l1_loss(out['semantic_state_v34'], _norm((0.7 * out['memory_post_read_v34'] + 0.3 * z)).detach())
        semantic_prediction = F.smooth_l1_loss(out['semantic_next_prediction_v34'][:, :-1], _norm(z[:, 1:]).detach())
        successor_loss = self.successor.loss(out)
        h = min(max(1, self.cfg.subgoal_horizon_v34), z.size(1) - 1)
        subgoal_pred = out['successor_subgoal_v34'][:, :-h]
        subgoal_target = _norm(z[:, h:]).detach()
        subgoal_loss = F.smooth_l1_loss(subgoal_pred, subgoal_target)
        teacher = out['teacher_action_v33'].detach()
        skill_loss = F.smooth_l1_loss(out['skill_action_v34'][:, :-1], teacher[:, :-1])
        boundary_target = torch.sigmoid(1.8 * out['prediction_error_v31'][:, :-1].detach()
                                        + 1.2 * out['novelty'][:, :-1].detach()
                                        + 0.7 * out['reward_v32'][:, :-1].abs().detach())
        skill_boundary_loss = F.binary_cross_entropy(out['skill_termination_v34'][:, :-1].clamp(1e-5, 1-1e-5), boundary_target)
        usage = out['skill_probs_v34'].mean((0, 1)).clamp_min(1e-6)
        skill_balance = (usage * torch.log(usage * self.cfg.skill_count_v34)).sum()
        return {**p, 'memory': memory_loss, 'semantic': semantic_consolidation, 'semantic_prediction': semantic_prediction, 'successor': successor_loss,
                'subgoal': subgoal_loss, 'skill': skill_loss, 'skill_boundary': skill_boundary_loss,
                'skill_balance': skill_balance}

    def training_loss(self, out: Dict[str, Tensor], **kwargs) -> Tensor:
        p = self.loss_parts(out, **kwargs)
        c = self.cfg
        return self.base.training_loss(out, **kwargs) \
            + c.memory_write_weight_v34 * p['memory'] \
            + c.memory_semantic_weight_v34 * p['semantic'] \
            + c.memory_prediction_weight_v34 * p['semantic_prediction'] \
            + c.successor_weight_v34 * p['successor'] \
            + c.subgoal_weight_v34 * p['subgoal'] \
            + c.skill_distill_weight_v34 * p['skill'] \
            + c.skill_boundary_weight_v34 * p['skill_boundary'] \
            + c.skill_balance_weight_v34 * p['skill_balance']


class RuntimeStateStoreV34:
    """Atomic local persistence for the live organism state.

    Stores only runtime state tensors, never optimizer/model weights. This keeps
    memory/identity continuity separate from code parameters and is suitable for
    an Android/Termux checkpoint file.
    """
    VERSION = 1

    @classmethod
    def save(cls, path: str, state: V34State) -> None:
        import os
        from pathlib import Path
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp = target.with_suffix(target.suffix + '.tmp')
        torch.save({'version': cls.VERSION, 'state': state}, tmp)
        os.replace(tmp, target)

    @classmethod
    def load(cls, path: str, device=None, dtype=None) -> V34State:
        payload = torch.load(path, map_location=device, weights_only=False)
        if payload.get('version') != cls.VERSION:
            raise ValueError(f'unsupported V34 runtime-state version: {payload.get("version")}')
        state = payload['state']
        if device is not None or dtype is not None:
            state = cls._move(state, device=device, dtype=dtype)
        return state

    @classmethod
    def _move(cls, state, device=None, dtype=None):
        import copy
        obj = copy.copy(state)
        def convert(v):
            if isinstance(v, Tensor):
                return v.to(device=device if device is not None else v.device,
                            dtype=dtype if dtype is not None and v.is_floating_point() else v.dtype)
            if hasattr(v, '__dict__') and hasattr(v, '__dataclass_fields__'):
                return cls._move(v, device=device, dtype=dtype)
            if isinstance(v, list):
                return [convert(x) for x in v]
            if isinstance(v, tuple):
                return tuple(convert(x) for x in v)
            if isinstance(v, dict):
                return {k: convert(x) for k, x in v.items()}
            return v
        for k, v in getattr(state, '__dict__', {}).items():
            try:
                setattr(obj, k, convert(v))
            except Exception:
                pass
        return obj


class OrganismTrainerV34:
    """Trainer for V34 with real-outcome replay and occasional anchored rehearsal."""

    def __init__(self, model: NeuroWeaveV34, lr: float = 5e-4, warmup_steps: int = 2, max_norm: Optional[float] = None):
        self.model = model
        self.steps = 0
        self.warmup_steps = warmup_steps
        self.max_norm = max_norm or model.cfg.max_grad_norm
        self.params = [p for p in model.parameters() if p.requires_grad]
        self.optimizer = torch.optim.AdamW(self.params, lr=lr, weight_decay=1e-4)
        self.replay = OutcomeReplayV33(model.cfg.replay_capacity_v34, model.cfg.replay_priority_alpha,
                                       model.cfg.replay_epsilon, model.cfg.replay_importance_beta)
        self.last_rehearsal = {'accepted': 0.0, 'examined': 0.0, 'loss': 0.0}

    def _internal(self, x: Tensor) -> Tensor:
        return self.model._internal(x)

    def ingest_outcome(self, z: Tensor, action: Tensor, body: Tensor, external_state: Tensor,
                       next_obs: Tensor, reward: Tensor, risk: Tensor) -> None:
        vals = (z, action, body, external_state, next_obs, reward, risk)
        b = z.size(0)
        if any(t.ndim != 2 or t.size(0) != b for t in vals):
            raise ValueError('online outcome tensors must be rank-2 with shared batch size')
        self.replay.add(z, action, body, external_state, self._internal(next_obs), reward, risk)

    def _replay_loss(self, device, dtype):
        sampled = self.replay.sample(self.model.cfg.replay_batch_v34, device, dtype)
        if sampled is None:
            return torch.zeros((), device=device, dtype=dtype), None, None
        batch, idx, is_w = sampled
        pred = self.model.base.base.ensemble(batch['z'], batch['action'], batch['body'], batch['external_state'])
        next_err = F.smooth_l1_loss(pred['next_mean'], batch['next_obs'], reduction='none').mean(-1)
        reward_err = F.smooth_l1_loss(pred['reward_mean'], batch['reward'], reduction='none').mean(-1)
        risk_err = F.binary_cross_entropy(pred['risk_mean'].clamp(1e-5, 1-1e-5), batch['risk'].clamp(0,1), reduction='none').mean(-1)
        per = next_err + 0.5 * reward_err + 0.5 * risk_err
        return (per * is_w).mean(), idx, per.detach()

    def dream_rehearse(self, max_items: Optional[int] = None) -> Dict[str, float]:
        n = min(len(self.replay), max_items or self.model.cfg.replay_batch_v34)
        if n <= 0:
            return {'accepted': 0.0, 'examined': 0.0, 'loss': 0.0}
        sampled = self.replay.sample(n, next(self.model.parameters()).device, next(self.model.parameters()).dtype)
        batch, _, _ = sampled
        z, act, body, ext = batch['z'], batch['action'], batch['body'], batch['external_state']
        with torch.no_grad():
            base = self.model.base.base.ensemble(z, act, body, ext)
            base_obj = (base['reward_mean'] - self.model.cfg.risk_aversion * base['risk_mean'] - 0.10 * base['total_uncertainty']).squeeze(-1)
            K = self.model.cfg.dream_candidates
            noise = torch.randn(n, K, act.size(-1), device=act.device, dtype=act.dtype) * self.model.cfg.dream_action_noise
            cands = torch.tanh(act.unsqueeze(1) + noise)
            flat = cands.reshape(n*K, -1)
            zf = z.unsqueeze(1).expand(-1, K, -1).reshape(n*K, -1)
            bf = body.unsqueeze(1).expand(-1, K, -1).reshape(n*K, -1)
            ef = ext.unsqueeze(1).expand(-1, K, -1).reshape(n*K, -1)
            cf = self.model.base.base.ensemble(zf, flat, bf, ef)
            cobj = (cf['reward_mean'] - self.model.cfg.risk_aversion * cf['risk_mean'] - 0.10 * cf['total_uncertainty']).view(n,K)
            best, idx = cobj.max(-1)
            chosen = cands[torch.arange(n, device=z.device), idx]
            chosen_unc = cf['total_uncertainty'].view(n,K)[torch.arange(n, device=z.device), idx]
            accepted = (best - base_obj > self.model.cfg.dream_accept_margin) & (chosen_unc < self.model.cfg.dream_uncertainty_limit)
        if not accepted.any():
            return {'accepted': 0.0, 'examined': float(n), 'loss': 0.0}
        goal = ext[accepted]
        if goal.size(-1) != self.model.cfg.goal_dim:
            goal = F.pad(goal, (0, max(0, self.model.cfg.goal_dim-goal.size(-1))))[..., :self.model.cfg.goal_dim]
        semantic = torch.zeros(goal.size(0), self.model.cfg.d, device=z.device, dtype=z.dtype)
        pred_err = torch.zeros(goal.size(0), 1, device=z.device, dtype=z.dtype)
        body_a = body[accepted]
        skill = self.model.skills(z[accepted], goal, body_a, semantic, pred_err)
        loss = F.smooth_l1_loss(skill['skill_action'], chosen[accepted])
        self.optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.params, self.max_norm)
        self.optimizer.step()
        return {'accepted': float(accepted.sum()), 'examined': float(n), 'loss': float(loss.detach())}

    def step(self, x: Tensor, goal_sequence=None, target_sequence=None,
             reward_sequence=None, risk_sequence=None, **kwargs):
        self.optimizer.zero_grad(set_to_none=True)
        out = self.model(x, goal_sequence=goal_sequence, target_sequence=target_sequence,
                         commit_memory=False, **kwargs)
        loss = self.model.training_loss(out, target_sequence=target_sequence,
                                        reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        idx = priority = None
        if self.steps >= self.warmup_steps and target_sequence is not None and target_sequence.shape[:2] == x.shape[:2]:
            z = out['fused_latent_v30'][:, :-1].reshape(-1, self.model.cfg.d)
            action = out['chosen_action_v34'][:, :-1].reshape(-1, self.model.cfg.action_dim)
            body = out['body_state_v30'][:, :-1].reshape(-1, self.model.cfg.body_dim)
            ext = out['external_state_v31'][:, :-1].reshape(-1, self.model.cfg.d)
            nxt = self._internal(target_sequence[:, 1:]).reshape(-1, self.model.cfg.d)
            rew = (reward_sequence[:, 1:] if reward_sequence is not None else out['reward_v32'][:, :-1]).reshape(-1,1)
            rsk = (risk_sequence[:, 1:] if risk_sequence is not None else out['risk_v32'][:, :-1]).reshape(-1,1)
            self.replay.add(z, action, body, ext, nxt, rew.detach(), rsk.detach())
            replay_loss, idx, priority = self._replay_loss(x.device, x.dtype)
            loss = loss + self.model.cfg.replay_weight_v34 * replay_loss
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.params, self.max_norm)
        self.optimizer.step()
        if idx is not None:
            self.replay.update_priority(idx, priority)
        self.steps += 1
        if self.cfg_rehearsal_due():
            self.last_rehearsal = self.dream_rehearse()
        return loss.detach(), out

    def cfg_rehearsal_due(self) -> bool:
        return self.model.cfg.rehearsal_interval_v34 > 0 and self.steps % self.model.cfg.rehearsal_interval_v34 == 0 and len(self.replay) > 0
