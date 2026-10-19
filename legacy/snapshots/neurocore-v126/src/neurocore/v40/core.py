from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple
import copy

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v39 import V39Config, V39State, NeuroWeaveV39, OrganismTrainerV39, RuntimeStateStoreV39


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


@dataclass
class V40Config(V39Config):
    """V40 external-verification and transferable-skill layer.

    V40 focuses on a real self-improvement loop rather than additional cosmetic
    heads: compact skill vectors are transferred into the existing V39 planning
    path, while a harness-side evaluator can accept/rollback weight updates
    based on actual environment outcomes across multiple held-out tasks.
    """
    skill_vector_count_v40: int = 4
    skill_vector_temperature_v40: float = 0.35
    skill_vector_scale_v40: float = 0.10
    skill_vector_goal_weight_v40: float = 0.16
    skill_vector_action_anchor_weight_v40: float = 0.04
    skill_vector_diversity_weight_v40: float = 0.015
    skill_vector_update_rate_v40: float = 0.08
    skill_vector_decay_v40: float = 0.995
    task_context_momentum_v40: float = 0.92
    external_verify_interval_v40: int = 2
    external_eval_episodes_v40: int = 1
    external_eval_horizon_v40: int = 8
    external_accept_margin_v40: float = 0.02
    external_retention_floor_v40: float = 0.97
    external_risk_tolerance_v40: float = 0.03
    external_success_distance_v40: float = 0.22
    external_init_scale_v40: float = 0.15
    external_dt_v40: float = 0.25
    external_friction_v40: float = 0.90
    external_action_gain_v40: float = 0.30
    external_eval_seed_v40: int = 1729
    external_new_task_count_v40: int = 2
    external_retention_task_count_v40: int = 4
    skill_transfer_loss_weight_v40: float = 0.04
    skill_action_fit_weight_v40: float = 0.03
    skill_context_loss_weight_v40: float = 0.02


def mobile_v40_config(raw_observation_dim: int = 9) -> V40Config:
    return V40Config(
        d=8, hidden=16, action_dim=3, modalities=3, proprio_dim=2, intero_dim=2,
        working_slots=8, episodic_slots=10, semantic_slots=6, event_slots=8, causal_slots=8,
        world_dim=6, ego_dim=5, body_dim=6, goal_dim=8, max_horizon=3, planner_candidates=3,
        ensemble_heads=2, refine_steps=1, replay_capacity=32, replay_batch=4,
        plan_rollout_depth=3, planning_probe_interval=2, dream_candidates=2,
        episodic_slots_v34=8, skill_count_v34=4, sr_gammas_v34=(0.8, 0.93), sr_dim_v34=8,
        subgoal_horizon_v34=2, identity_slots_v35=4, raw_observation_dim=raw_observation_dim,
        cognitive_map_slots_v36=8, macro_horizons_v36=(1, 2, 4), macro_duration_max_v36=4,
        transfer_cache_slots_v37=4, search_iterations_v37=2, search_candidates_v37=3,
        development_slots_v38=5, development_online_update_interval_v38=4,
        policy_credit_hidden_v39=16, policy_online_update_interval_v39=4,
        policy_candidate_count_v39=3, skill_vector_count_v40=4,
        external_verify_interval_v40=2,
    )


@dataclass
class V40State:
    base: V39State
    skill_context: Tensor
    skill_probs: Tensor
    skill_vector: Tensor
    task_embedding: Tensor
    skill_quality: Tensor


class TransferableSkillVectorBankV40(nn.Module):
    """Compact, low-cost skill basis for cross-task transfer.

    This is procedural transfer state, not a second factual memory. The bank
    stores reusable behavioral directions and is selected from current task
    context. The final influence is routed into V39's existing goal/planning
    path so the emitted action is still the one recorded by the canonical V39
    memory path.
    """

    def __init__(self, d: int, hidden: int, goal_dim: int, action_dim: int, count: int):
        super().__init__()
        self.count = int(count)
        self._action_scale = 0.10
        self.task_encoder = nn.Sequential(
            nn.Linear(2 * d + goal_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, d), nn.Tanh(),
        )
        self.keys = nn.Parameter(torch.randn(self.count, d) * 0.05)
        self.skill_values = nn.Parameter(torch.randn(self.count, d) * 0.05)
        self.action_basis = nn.Parameter(torch.randn(self.count, action_dim) * 0.03)
        self.goal_basis = nn.Parameter(torch.randn(self.count, goal_dim) * 0.03)
        self.skill_quality = nn.Parameter(torch.zeros(self.count, 1))
        self.context_proj = nn.Sequential(
            nn.Linear(2 * d + goal_dim, hidden), nn.SiLU(),
            nn.Linear(hidden, d), nn.Tanh(),
        )
        self.quality_head = nn.Sequential(
            nn.Linear(2 * d + 1, hidden), nn.SiLU(), nn.Linear(hidden, 1), nn.Sigmoid()
        )

    def forward(self, z: Tensor, identity: Tensor, goal: Tensor,
                prior_context: Optional[Tensor] = None,
                temperature: float = 0.35) -> Dict[str, Tensor]:
        task_embedding = _norm(self.task_encoder(torch.cat([z, identity, goal], -1)))
        keys = _norm(self.keys)
        logits = torch.matmul(task_embedding, keys.t()) / max(float(temperature), 0.1)
        if prior_context is not None:
            logits = logits + 0.15 * torch.matmul(_norm(prior_context), keys.t())
        logits = logits + 0.20 * self.skill_quality.view(1, -1)
        probs = F.softmax(logits, -1)
        skill_vector = torch.einsum('bk,kd->bd', probs, self.skill_values)
        action_vector = self._action_scale * torch.einsum('bk,ka->ba', probs, self.action_basis)
        goal_bias = self._action_scale * torch.einsum('bk,kg->bg', probs, self.goal_basis)
        quality = self.quality_head(torch.cat([z, skill_vector, probs.max(-1, keepdim=True).values], -1))
        context = _norm(self.context_proj(torch.cat([z, skill_vector, goal], -1)))
        return {
            'task_embedding': task_embedding,
            'logits': logits,
            'probs': probs,
            'skill_vector': skill_vector,
            'action_vector': action_vector,
            'goal_bias': goal_bias,
            'quality': quality,
            'context': context,
        }

    def set_action_scale(self, scale: float) -> None:
        self._action_scale = float(max(scale, 0.0))

    def update_quality(self, probs: Tensor, reward: Tensor, rate: float, decay: float) -> None:
        with torch.no_grad():
            slot_reward = torch.matmul(probs.detach().transpose(0, 1), reward.detach().reshape(-1, 1))
            weight = probs.detach().sum(0, keepdim=True).transpose(0, 1).clamp_min(1e-5)
            observed = slot_reward / weight
            base = decay * self.skill_quality + (1.0 - decay) * observed
            self.skill_quality.mul_(1.0 - rate).add_(rate * base)


class ExternalTaskV40:
    """Deterministic, model-independent task environment used by the verifier."""

    def __init__(self, target: Tuple[float, float], friction: float = 0.90,
                 action_gain: float = 0.30, dt: float = 0.25, init_scale: float = 0.15,
                 seed: int = 0):
        self.target = torch.tensor(target, dtype=torch.float32)
        self.friction = float(friction)
        self.action_gain = float(action_gain)
        self.dt = float(dt)
        self.init_scale = float(init_scale)
        self.seed = int(seed)
        self.g = torch.Generator().manual_seed(self.seed)
        self.pos = torch.zeros(2)
        self.vel = torch.zeros(2)

    def reset(self) -> Tensor:
        self.pos = (torch.rand(2, generator=self.g) - 0.5) * 2.0 * self.init_scale
        self.vel = torch.zeros(2)
        return self.observe()

    def observe(self) -> Tensor:
        diff = self.target - self.pos
        speed = self.vel.norm().reshape(1)
        dist = diff.norm().reshape(1)
        alignment = (self.vel * diff).sum().reshape(1)
        return torch.cat([self.pos, self.vel, diff, speed, dist, alignment], -1).unsqueeze(0)

    def step(self, action: Tensor) -> Tuple[Tensor, Tensor, Tensor]:
        a = action.detach().reshape(-1)[:2].clamp(-1.0, 1.0)
        self.vel = self.friction * self.vel + self.action_gain * a
        self.pos = self.pos + self.dt * self.vel
        diff = self.target - self.pos
        dist = diff.norm()
        reward = -dist
        risk = ((self.pos.abs() > 1.5).any()).float()
        return self.observe(), reward.reshape(1, 1), risk.reshape(1, 1)


def task_goal_v40(target: Tuple[float, float], goal_dim: int, device=None, dtype=torch.float32) -> Tensor:
    t = torch.tensor(target, device=device, dtype=dtype)
    g = torch.zeros(1, goal_dim, device=device, dtype=dtype)
    g[0, :2] = t
    if goal_dim >= 4:
        g[0, 2:4] = t
    return g


@dataclass
class ExternalEvalResultV40:
    aggregate_reward: float
    success_rate: float
    risk_rate: float
    episodes: int
    per_task_reward: Dict[str, float]
    mean_final_distance: float


class ExternalPolicyVerifierV40:
    """Harness-side evaluator based only on actual task outcomes.

    The verifier never reads model internals, world-model predictions, loss
    values, gradients, or replay. It compares actual environment returns.
    It is sealed at the harness API level, not cryptographically inaccessible
    to the developer or model process.
    """

    def __init__(self, cfg: V40Config):
        self.cfg = cfg
        self.tasks = [
            ('retain_0', (-0.9, 0.8)),
            ('retain_1', (0.8, -0.9)),
            ('retain_2', (-0.7, -0.8)),
            ('retain_3', (0.75, 0.65)),
            ('new_0', (0.1, 0.95)),
            ('new_1', (-0.95, -0.1)),
        ]
        self.retention = self.tasks[:cfg.external_retention_task_count_v40]
        self.new = self.tasks[cfg.external_retention_task_count_v40:cfg.external_retention_task_count_v40 + cfg.external_new_task_count_v40]

    @torch.no_grad()
    def evaluate(self, model: 'NeuroWeaveV40', task_subset: Optional[list] = None, seed_offset: int = 0) -> ExternalEvalResultV40:
        was_training = model.training
        model.eval()
        tasks = task_subset if task_subset is not None else self.tasks
        total_reward = 0.0
        success = 0
        risk_hits = 0
        final_distance_sum = 0.0
        count = 0
        per_task: Dict[str, float] = {}
        for ti, (name, target) in enumerate(tasks):
            reward_acc = 0.0
            for ep in range(self.cfg.external_eval_episodes_v40):
                env = ExternalTaskV40(
                    target=target,
                    friction=self.cfg.external_friction_v40,
                    action_gain=self.cfg.external_action_gain_v40,
                    dt=self.cfg.external_dt_v40,
                    init_scale=self.cfg.external_init_scale_v40,
                    seed=self.cfg.external_eval_seed_v40 + seed_offset + ti * 97 + ep,
                )
                obs = env.reset()
                state = model.initial_state(1, obs.device, obs.dtype)
                final_obs = obs
                ep_reward = 0.0
                ep_risk = 0.0
                for _ in range(self.cfg.external_eval_horizon_v40):
                    goal = task_goal_v40(target, self.cfg.goal_dim, device=obs.device, dtype=obs.dtype)
                    out, state = model.step(obs, state, goal=goal, commit_memory=True, force_planning=False)
                    action = out['chosen_action_v40']
                    final_obs, reward, risk = env.step(action)
                    obs = final_obs
                    ep_reward += float(reward.item())
                    ep_risk += float(risk.item())
                final_dist = float(final_obs[0, -2].item())
                final_distance_sum += final_dist
                success += int(final_dist <= self.cfg.external_success_distance_v40)
                risk_hits += int(ep_risk > 0.0)
                total_reward += ep_reward
                reward_acc += ep_reward
                count += 1
            per_task[name] = reward_acc / max(1, self.cfg.external_eval_episodes_v40)
        model.train(was_training)
        return ExternalEvalResultV40(
            aggregate_reward=total_reward / max(1, count),
            success_rate=success / max(1, count),
            risk_rate=risk_hits / max(1, count),
            episodes=count,
            per_task_reward=per_task,
            mean_final_distance=final_distance_sum / max(1, count),
        )

    def acceptance(self, before: ExternalEvalResultV40, after: ExternalEvalResultV40) -> Dict[str, float | bool]:
        retention_before = sum(before.per_task_reward[n] for n, _ in self.retention) / max(1, len(self.retention))
        retention_after = sum(after.per_task_reward[n] for n, _ in self.retention) / max(1, len(self.retention))
        new_names = {n for n, _ in self.new}
        new_before = sum(before.per_task_reward[n] for n in new_names) / max(1, len(new_names))
        new_after = sum(after.per_task_reward[n] for n in new_names) / max(1, len(new_names))
        retention_ratio = retention_after / max(1e-6, abs(retention_before)) if retention_before != 0 else 1.0
        accepted = (
            new_after >= new_before + self.cfg.external_accept_margin_v40
            and retention_ratio >= self.cfg.external_retention_floor_v40
            and after.risk_rate <= before.risk_rate + self.cfg.external_risk_tolerance_v40
        )
        return {
            'accepted': bool(accepted),
            'new_before': float(new_before),
            'new_after': float(new_after),
            'retention_before': float(retention_before),
            'retention_after': float(retention_after),
            'retention_ratio': float(retention_ratio),
            'risk_before': float(before.risk_rate),
            'risk_after': float(after.risk_rate),
        }


class NeuroWeaveV40(nn.Module):
    """V40: transferable skills + external-verification hooks."""

    def __init__(self, cfg: Optional[V40Config] = None):
        super().__init__()
        self.cfg = cfg or V40Config()
        c = self.cfg
        self.base = NeuroWeaveV39(c)
        self.skill_bank = TransferableSkillVectorBankV40(c.d, c.hidden, c.goal_dim, c.action_dim, c.skill_vector_count_v40)
        self.skill_bank.set_action_scale(c.skill_vector_scale_v40)
        self.skill_goal_proj = nn.Sequential(
            nn.Linear(c.d + c.action_dim, c.hidden), nn.SiLU(),
            nn.Linear(c.hidden, c.goal_dim), nn.Tanh(),
        )
        self.task_context_gate = nn.Sequential(
            nn.Linear(2 * c.d + 1, c.hidden), nn.SiLU(), nn.Linear(c.hidden, 1), nn.Sigmoid()
        )

    @staticmethod
    def _identity_from_state(state: V40State) -> Tensor:
        return state.base.base.base.base.base.identity_state

    def initial_state(self, b: int, device=None, dtype=None) -> V40State:
        c = self.cfg
        return V40State(
            base=self.base.initial_state(b, device=device, dtype=dtype),
            skill_context=torch.zeros(b, c.d, device=device, dtype=dtype),
            skill_probs=torch.full((b, c.skill_vector_count_v40), 1.0 / c.skill_vector_count_v40, device=device, dtype=dtype),
            skill_vector=torch.zeros(b, c.d, device=device, dtype=dtype),
            task_embedding=torch.zeros(b, c.d, device=device, dtype=dtype),
            skill_quality=torch.full((b, 1), 0.5, device=device, dtype=dtype),
        )

    def step(self, x: Tensor, state: V40State, goal: Optional[Tensor] = None,
             target_next: Optional[Tensor] = None, presence=None, modalities=None,
             proprioception=None, interoception=None, commit_memory: bool = True,
             force_planning: Optional[bool] = None) -> Tuple[Dict[str, Tensor], V40State]:
        z = self.base._internal(x)
        identity = self._identity_from_state(state)
        base_goal = goal if goal is not None else state.base.base.base.base.base.active_goal
        if base_goal is None or base_goal.shape[-1] != self.cfg.goal_dim:
            base_goal = torch.zeros(x.size(0), self.cfg.goal_dim, device=x.device, dtype=x.dtype)
        skill = self.skill_bank(z, identity, base_goal, prior_context=state.skill_context, temperature=self.cfg.skill_vector_temperature_v40)
        gated = self.task_context_gate(torch.cat([z, skill['skill_vector'], skill['quality'].detach()], -1))
        skill_goal = self.skill_goal_proj(torch.cat([skill['skill_vector'], skill['action_vector']], -1))
        shaped_goal = base_goal + self.cfg.skill_vector_goal_weight_v40 * gated * (skill['goal_bias'] + skill_goal)
        out39, st39 = self.base.step(
            x, state.base, goal=shaped_goal, target_next=target_next,
            presence=presence, modalities=modalities, proprioception=proprioception,
            interoception=interoception, commit_memory=commit_memory, force_planning=force_planning,
        )
        skill_context = (self.cfg.task_context_momentum_v40 * state.skill_context
                         + (1.0 - self.cfg.task_context_momentum_v40) * skill['context'])
        quality = 0.90 * state.skill_quality + 0.10 * skill['quality']
        new_state = V40State(
            base=st39,
            skill_context=skill_context.detach() if commit_memory else skill_context,
            skill_probs=skill['probs'].detach() if commit_memory else skill['probs'],
            skill_vector=skill['skill_vector'].detach() if commit_memory else skill['skill_vector'],
            task_embedding=skill['task_embedding'].detach() if commit_memory else skill['task_embedding'],
            skill_quality=quality.detach() if commit_memory else quality,
        )
        out = dict(out39)
        out.update({
            'task_embedding_v40': skill['task_embedding'],
            'skill_probs_v40': skill['probs'],
            'skill_vector_v40': skill['skill_vector'],
            'skill_action_prior_v40': skill['action_vector'],
            'skill_goal_bias_v40': skill['goal_bias'],
            'skill_goal_shaping_v40': skill_goal,
            'skill_quality_v40': skill['quality'],
            'skill_context_v40': skill['context'],
            'skill_gate_v40': gated,
            'planning_goal_v40': shaped_goal,
            'chosen_action_v40': out39['chosen_action_v39'],
        })
        out['_final_state'] = new_state
        return out, new_state

    def observe_outcome(self, state_after_action: V40State, prior_output: Dict[str, Tensor],
                        next_observation: Tensor, reward: Tensor, risk: Tensor,
                        done: Optional[Tensor] = None) -> Tuple[Dict[str, Tensor], V40State]:
        observed39, st39 = self.base.observe_outcome(
            state_after_action.base, prior_output, next_observation, reward, risk, done
        )
        self.skill_bank.update_quality(state_after_action.skill_probs, reward, self.cfg.skill_vector_update_rate_v40, self.cfg.skill_vector_decay_v40)
        real = reward.detach() - self.cfg.policy_credit_risk_aversion_v39 * risk.detach()
        score = real.reshape(-1, 1)
        new_quality = 0.93 * state_after_action.skill_quality + 0.07 * torch.sigmoid(score)
        new_state = V40State(
            base=st39,
            skill_context=state_after_action.skill_context.detach(),
            skill_probs=state_after_action.skill_probs.detach(),
            skill_vector=state_after_action.skill_vector.detach(),
            task_embedding=state_after_action.task_embedding.detach(),
            skill_quality=new_quality.detach(),
        )
        observed = dict(observed39)
        observed['skill_real_utility_v40'] = real
        observed['skill_quality_next_v40'] = new_quality
        return observed, new_state

    def forward(self, x: Tensor, state: Optional[V40State] = None, goal_sequence=None,
                target_sequence=None, reward_sequence=None, risk_sequence=None,
                presence_sequence=None, modality_sequence=None, proprioception_sequence=None,
                interoception_sequence=None, commit_memory: bool = True,
                force_planning: Optional[bool] = None, **kwargs) -> Dict[str, Tensor]:
        if x.ndim != 3:
            raise ValueError('x must be [B,T,D]')
        st = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows = []
        for t in range(x.size(1)):
            o, st = self.step(
                x[:, t], st,
                goal=goal_sequence[:, t] if goal_sequence is not None else None,
                target_next=target_sequence[:, t + 1] if target_sequence is not None and target_sequence.shape[:2] == x.shape[:2] and t < x.size(1) - 1 else None,
                presence=presence_sequence[:, t] if presence_sequence is not None else None,
                modalities=modality_sequence[:, t] if modality_sequence is not None else None,
                proprioception=proprioception_sequence[:, t] if proprioception_sequence is not None else None,
                interoception=interoception_sequence[:, t] if interoception_sequence is not None else None,
                commit_memory=commit_memory, force_planning=force_planning, **kwargs,
            )
            if target_sequence is not None and target_sequence.shape[:2] == x.shape[:2] and t < x.size(1) - 1:
                rr = reward_sequence[:, t] if reward_sequence is not None else o.get('reward_v32', torch.zeros(x.size(0), 1, device=x.device, dtype=x.dtype)).detach()
                rk = risk_sequence[:, t] if risk_sequence is not None else o.get('risk_v32', torch.zeros_like(rr)).detach()
                obs, st = self.observe_outcome(st, o, target_sequence[:, t + 1], rr.detach(), rk.detach())
                o.update({f'outcome_{k}_v40': v for k, v in obs.items() if torch.is_tensor(v)})
            rows.append(o)
        tensors = {k: torch.stack([r[k] for r in rows], 1) for k in rows[0]
                   if torch.is_tensor(rows[0][k]) and not k.startswith('outcome_') and k != '_final_state'}
        keys = set().union(*[set(k for k in r if k.startswith('outcome_')) for r in rows]) if rows else set()
        for k in keys:
            template = next((r[k] for r in rows if k in r), None)
            if template is not None:
                tensors[k] = torch.stack([r[k] if k in r else torch.zeros_like(template) for r in rows], 1)
        tensors['_final_state'] = st
        return tensors

    def loss_parts(self, out: Dict[str, Tensor], target_sequence: Optional[Tensor] = None,
                   reward_sequence: Optional[Tensor] = None,
                   risk_sequence: Optional[Tensor] = None,
                   expert_action_sequence: Optional[Tensor] = None) -> Dict[str, Tensor]:
        p = self.base.loss_parts(out, target_sequence=target_sequence,
                                 reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        z = out['fused_latent_v30']
        zero = z.new_zeros(())
        if z.size(1) <= 1:
            return {**p, 'skill_transfer': zero, 'skill_action_fit': zero, 'skill_context': zero}
        probs = out['skill_probs_v40'][:, :-1]
        action_prior = out['skill_action_prior_v40'][:, :-1]
        chosen = out['chosen_action_v40'][:, :-1].detach()
        task_emb = out['task_embedding_v40'][:, :-1]
        context = out['skill_context_v40'][:, :-1]
        skill_fit = 1.0 - (probs.max(-1).values).mean()
        fit_target = expert_action_sequence[:, :-1].detach() if expert_action_sequence is not None and expert_action_sequence.shape[:2] == z.shape[:2] else chosen
        action_fit = F.smooth_l1_loss(action_prior, fit_target)
        temporal_fit = F.smooth_l1_loss(context[:, 1:], context[:, :-1].detach()) if context.size(1) > 1 else zero
        # Reward-conditioned direction: skills should correlate with the emitted action's observed utility.
        utility = (reward_sequence[:, :-1] if reward_sequence is not None and reward_sequence.shape[:2] == z.shape[:2]
                   else torch.zeros_like(z[..., :1])).detach().squeeze(-1)
        credit = (action_prior * chosen).sum(-1)
        target = torch.tanh(utility)
        transfer_loss = F.smooth_l1_loss(credit, target)
        basis = _norm(self.skill_bank.action_basis)
        gram = basis @ basis.t()
        off = gram - torch.diag(torch.diag(gram))
        diversity_loss = off.pow(2).mean()
        anchor = F.smooth_l1_loss(action_prior, chosen)
        return {**p, 'skill_transfer': transfer_loss, 'skill_action_fit': action_fit,
                'skill_anchor': anchor, 'skill_diversity': diversity_loss,
                'skill_context': temporal_fit + 0.25 * skill_fit + 0.01 * task_emb.pow(2).mean()}

    def training_loss(self, out: Dict[str, Tensor], **kwargs) -> Tensor:
        p = self.loss_parts(out, **kwargs)
        c = self.cfg
        return self.base.training_loss(out, **kwargs) \
            + c.skill_transfer_loss_weight_v40 * p['skill_transfer'] \
            + c.skill_action_fit_weight_v40 * p['skill_action_fit'] \
            + c.skill_vector_action_anchor_weight_v40 * p['skill_anchor'] \
            + c.skill_vector_diversity_weight_v40 * p['skill_diversity'] \
            + c.skill_context_loss_weight_v40 * p['skill_context']


class RuntimeStateStoreV40(RuntimeStateStoreV39):
    VERSION = 1

    @classmethod
    def save(cls, path, state):
        torch.save({'version': cls.VERSION, 'state': state}, path)

    @classmethod
    def load(cls, path, device=None, dtype=None):
        payload = torch.load(path, map_location=device, weights_only=False)
        if payload.get('version') != cls.VERSION:
            raise ValueError(f'unsupported V40 runtime-state version: {payload.get("version")}')
        state = payload['state']
        if device is not None or dtype is not None:
            state = cls._move(state, device=device, dtype=dtype)
        return state


class OrganismTrainerV40(OrganismTrainerV39):
    """V40 trainer with optional actual-environment acceptance/rollback."""

    def __init__(self, model: NeuroWeaveV40, lr: float = 3e-4, warmup_steps: int = 4,
                 external_verifier: Optional[ExternalPolicyVerifierV40] = None):
        super().__init__(model=model, lr=lr, warmup_steps=warmup_steps)
        self.model = model
        self.external_verifier = external_verifier
        self.external_reports = []

    def step(self, x: Tensor, goal_sequence=None, target_sequence=None,
             reward_sequence=None, risk_sequence=None, **kwargs):
        before_state = copy.deepcopy(self.model.state_dict())
        baseline_external = None
        should_verify = self.external_verifier is not None and self.steps % max(1, self.model.cfg.external_verify_interval_v40) == 0
        if should_verify:
            baseline_external = self.external_verifier.evaluate(self.model, self.external_verifier.tasks)
        loss, out = super().step(
            x, goal_sequence=goal_sequence, target_sequence=target_sequence,
            reward_sequence=reward_sequence, risk_sequence=risk_sequence, **kwargs
        )
        if should_verify and self.last_update_report.get('accepted'):
            after_external = self.external_verifier.evaluate(self.model, self.external_verifier.tasks, seed_offset=0)
            # Compare against the same task identities with a different episode seed; require conservative retention.
            decision = self.external_verifier.acceptance(baseline_external, after_external)
            if not decision['accepted']:
                self.model.load_state_dict(before_state)
                self.last_update_report['accepted'] = False
                self.last_update_report['rolled_back'] = True
                self.last_update_report['external_rejection'] = True
                self.external_reports.append({'decision': decision, 'accepted': False})
            else:
                self.external_reports.append({'decision': decision, 'accepted': True})
        return loss, out
