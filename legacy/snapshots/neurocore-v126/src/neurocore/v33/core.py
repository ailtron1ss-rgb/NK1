from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Optional, Tuple, List
import math
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v32 import V32Config, V32State, NeuroWeaveV32, OutcomeReplayV32


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


def _discounted_returns(reward: Tensor, gamma: float) -> Tensor:
    out = torch.zeros_like(reward)
    running = torch.zeros_like(reward[:, 0])
    for t in range(reward.size(1) - 1, -1, -1):
        running = reward[:, t] + gamma * running
        out[:, t] = running
    return out


@dataclass
class V33Config(V32Config):
    """V33 learned-planning brain over the V32 causal organism spine.

    The additions are deliberately compact: a learned multi-step rollout critic,
    an adaptive compute gate, a fast policy distilled from search, a persistent drive
    state, and real-anchored dream rehearsal. These are mechanisms with explicit
    training/effect paths, not decorative heads.
    """
    plan_rollout_depth: int = 4
    plan_refine_iters: int = 2
    plan_discount: float = 0.97
    plan_uncertainty_weight: float = 0.10
    plan_progress_weight: float = 0.20
    plan_risk_weight: float = 0.45
    planner_teacher_weight: float = 0.08
    fast_policy_weight: float = 0.10
    adaptive_compute_weight: float = 0.06
    drive_weight: float = 0.05
    dream_weight: float = 0.06
    dream_candidates: int = 3
    dream_action_noise: float = 0.20
    dream_accept_margin: float = 0.02
    dream_uncertainty_limit: float = 0.35
    dream_rehearsal_interval: int = 4
    replay_importance_beta: float = 0.40
    planning_gate_threshold: float = 0.50
    planning_probe_interval: int = 4
    drive_dim: int = 4
    drive_momentum: float = 0.92
    drive_temperature: float = 0.75
    raw_observation_dim: int = 0
    fast_policy_scale: float = 0.20
    search_temperature: float = 0.35


class ObservationAdapterV33(nn.Module):
    """Trainable boundary adapter from real/raw sensor width into the compact neural state width."""
    def __init__(self, raw_dim: int, d: int, hidden: int):
        super().__init__()
        self.raw_dim = raw_dim
        self.d = d
        if raw_dim and raw_dim != d:
            self.net = nn.Sequential(nn.Linear(raw_dim, hidden), nn.SiLU(), nn.Linear(hidden, d))
        else:
            self.net = nn.Identity()

    def forward(self, x: Tensor) -> Tensor:
        if x.size(-1) == self.d:
            return x
        if not self.raw_dim or x.size(-1) != self.raw_dim:
            raise ValueError(f'expected compact dim {self.d} or raw observation dim {self.raw_dim}, got {x.size(-1)}')
        return torch.tanh(self.net(x))


class OutcomeReplayV33(OutcomeReplayV32):
    """Prioritized replay with normalized importance-sampling correction."""
    def __init__(self, capacity: int = 256, alpha: float = 0.6, epsilon: float = 1e-3, beta: float = 0.4):
        super().__init__(capacity=capacity, alpha=alpha, epsilon=epsilon)
        self.beta = beta

    def sample(self, n: int, device: torch.device, dtype: torch.dtype):
        if not self.data:
            return None
        n = min(n, len(self.data))
        raw = torch.tensor([max(p, self.epsilon) ** self.alpha for p in self.priority], dtype=torch.float32)
        probs = raw / raw.sum().clamp_min(self.epsilon)
        idx = torch.multinomial(probs, n, replacement=len(self.data) < n)
        is_w = (len(self.data) * probs[idx]).clamp_min(self.epsilon).pow(-self.beta)
        is_w = is_w / is_w.max().clamp_min(self.epsilon)
        batch = {k: torch.stack([self.data[int(i)][k] for i in idx]).to(device=device, dtype=dtype) for k in self.data[0]}
        return batch, idx, is_w.to(device=device, dtype=dtype)


class DriveHomeostasisV33(nn.Module):
    """Persistent bounded drive state coupled to prediction error, novelty and cost signals."""
    def __init__(self, d: int, hidden: int, drive_dim: int = 4):
        super().__init__()
        self.drive_dim = drive_dim
        self.encode = nn.Sequential(nn.Linear(d + 5, hidden), nn.SiLU(), nn.Linear(hidden, drive_dim))
        self.readout = nn.Sequential(nn.Linear(drive_dim, hidden), nn.SiLU(), nn.Linear(hidden, d))

    def step(self, state: Tensor, z: Tensor, uncertainty: Tensor, novelty: Tensor,
             prediction_error: Tensor, reward: Tensor, risk: Tensor) -> Tuple[Tensor, Tensor]:
        signals = torch.cat([z, uncertainty, novelty, prediction_error, reward, risk], -1)
        drive_update = torch.tanh(self.encode(signals))
        nxt = torch.tanh(0.92 * state + 0.08 * drive_update)
        drive_context = _norm(self.readout(nxt))
        return nxt, drive_context


class AdaptiveComputeGateV33(nn.Module):
    """Cheap gate evaluated before expensive long-horizon planning."""
    def __init__(self, d: int, hidden: int, drive_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(2 * d + drive_dim + 5, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(),
            nn.Linear(hidden, 1)
        )

    def forward(self, z: Tensor, goal: Tensor, uncertainty: Tensor, novelty: Tensor,
                prediction_error: Tensor, drive: Tensor, gap: Tensor, risk: Tensor) -> Tensor:
        return torch.sigmoid(self.net(torch.cat([z, goal, uncertainty, novelty, prediction_error, drive, gap, risk], -1)))


class FastPolicyV33(nn.Module):
    """Cheap policy distilled from slow search/planning."""
    def __init__(self, d: int, hidden: int, action_dim: int, goal_dim: int, drive_dim: int, body_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d + goal_dim + drive_dim + body_dim + 5, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(),
            nn.Linear(hidden, action_dim)
        )

    def forward(self, z: Tensor, goal: Tensor, drive: Tensor, body: Tensor,
                uncertainty: Tensor, novelty: Tensor, prediction_error: Tensor,
                gap: Tensor, risk: Tensor) -> Tensor:
        return torch.tanh(self.net(torch.cat([z, goal, drive, body, uncertainty, novelty, prediction_error, gap, risk], -1)))


class MultiStepPlannerV33(nn.Module):
    """Model-predictive planning through the *learned external* V32 ensemble.

    Planning is performed on candidate sequences already generated by V32's
    hierarchical refiner. The important upgrade is recursive model-based rollout:
    each future step is predicted from the previous predicted external state, so
    planning quality depends on the learned dynamics rather than a one-step score.
    """
    def __init__(self, d: int, hidden: int, action_dim: int, body_dim: int, depth: int = 4):
        super().__init__()
        self.depth = depth
        self.value = nn.Sequential(
            nn.Linear(2 * d + body_dim + action_dim + 3, hidden), nn.SiLU(),
            nn.Linear(hidden, hidden), nn.SiLU(), nn.Linear(hidden, 1)
        )

    def rollout(self, ensemble: nn.Module, z: Tensor, goal: Tensor, body: Tensor,
                ext: Tensor, actions: Tensor, depth: Optional[int] = None) -> Dict[str, Tensor]:
        B, K, H, A = actions.shape
        D = z.size(-1)
        depth = min(H, self.depth if depth is None else depth)
        zt = z.unsqueeze(1).expand(-1, K, -1)
        et = ext.unsqueeze(1).expand(-1, K, -1)
        bt = body.unsqueeze(1).expand(-1, K, -1)
        total = torch.zeros(B, K, device=z.device, dtype=z.dtype)
        total_unc = torch.zeros_like(total)
        total_risk = torch.zeros_like(total)
        progress = torch.zeros_like(total)
        traces = []
        for h in range(depth):
            ah = actions[:, :, h]
            pred = ensemble(
                zt.reshape(B * K, D), ah.reshape(B * K, A),
                bt.reshape(B * K, -1), et.reshape(B * K, -1)
            )
            zn = pred['next_mean'].reshape(B, K, D)
            rr = pred['reward_mean'].reshape(B, K)
            rk = pred['risk_mean'].reshape(B, K)
            uu = pred['total_uncertainty'].reshape(B, K)
            goal_k = goal.unsqueeze(1)
            step_progress = (zt - goal_k).norm(dim=-1) - (zn - goal_k).norm(dim=-1)
            disc = self._discount(h, z.dtype, z.device)
            total = total + disc * (rr + 0.20 * step_progress)
            total_risk = total_risk + disc * rk
            total_unc = total_unc + disc * uu
            progress = progress + disc * step_progress
            traces.append(zn)
            zt, et = zn, zn
        objective = total - 0.45 * total_risk - 0.10 * total_unc
        # Small learned residual value keeps ranking adaptable while model-based terms remain dominant.
        last_a = actions[:, :, min(depth - 1, H - 1)]
        q = self.value(torch.cat([
            z.unsqueeze(1).expand(-1, K, -1), goal.unsqueeze(1).expand(-1, K, -1),
            body.unsqueeze(1).expand(-1, K, -1), last_a,
            total_unc.unsqueeze(-1), total_risk.unsqueeze(-1), progress.unsqueeze(-1)
        ], -1)).squeeze(-1)
        objective = objective + 0.05 * q
        return {
            'objective': objective,
            'future_reward': total,
            'future_risk': total_risk,
            'future_uncertainty': total_unc,
            'future_progress': progress,
            'terminal_latent': zt,
            'trace': torch.stack(traces, dim=2) if traces else z.new_zeros(B, K, 0, D),
        }

    @staticmethod
    def _discount(step: int, dtype: torch.dtype, device: torch.device) -> Tensor:
        return torch.tensor(0.97 ** step, dtype=dtype, device=device)


@dataclass
class V33State:
    base: V32State
    drive_state: Tensor
    life_clock: Tensor


class NeuroWeaveV33(nn.Module):
    """V33: learned planning brain with adaptive compute and drive coupling."""
    def __init__(self, cfg: Optional[V33Config] = None):
        super().__init__()
        self.cfg = cfg or V33Config()
        c = self.cfg
        v32_kwargs = {k: getattr(c, k) for k in V32Config.__dataclass_fields__.keys() if hasattr(c, k)}
        self.base = NeuroWeaveV32(V32Config(**v32_kwargs))
        self.planner = MultiStepPlannerV33(c.d, c.hidden, c.action_dim, c.body_dim, c.plan_rollout_depth)
        self.compute_gate = AdaptiveComputeGateV33(c.d, c.hidden, c.drive_dim)
        self.fast_policy = FastPolicyV33(c.d, c.hidden, c.action_dim, c.goal_dim, c.drive_dim, c.body_dim)
        self.drive = DriveHomeostasisV33(c.d, c.hidden, c.drive_dim)
        self.plan_temperature = nn.Parameter(torch.tensor(math.log(max(c.search_temperature, 1e-3))))
        self.observation_adapter = ObservationAdapterV33(c.raw_observation_dim, c.d, c.hidden)

    def initial_state(self, b: int, device=None, dtype=None) -> V33State:
        return V33State(
            base=self.base.initial_state(b, device=device, dtype=dtype),
            drive_state=torch.zeros(b, self.cfg.drive_dim, device=device, dtype=dtype),
            life_clock=torch.zeros(b, 1, device=device, dtype=dtype),
        )

    def step(self, x: Tensor, state: V33State, goal: Optional[Tensor] = None,
             target_next: Optional[Tensor] = None, presence=None, modalities=None,
             proprioception=None, interoception=None, commit_memory: bool = True,
             force_planning: Optional[bool] = None) -> Tuple[Dict[str, Tensor], V33State]:
        x = self.observation_adapter(x)
        if target_next is not None and target_next.size(-1) != self.cfg.d:
            target_next = self.observation_adapter(target_next)
        o32, st32 = self.base.step(
            x, state.base, goal=goal, target_next=target_next, presence=presence,
            modalities=modalities, proprioception=proprioception, interoception=interoception,
            commit_memory=commit_memory
        )
        z = o32['fused_latent_v30']
        eff_goal = o32['effective_goal_v32']
        body = o32['body_state_v30']
        base_action = o32['chosen_action_v32']
        unc = o32['foresight_uncertainty_v32']
        nov = o32['novelty']
        pe = o32['prediction_error_v31']
        risk = o32['risk_v32']
        gap = (eff_goal - z).norm(dim=-1, keepdim=True)

        drive_state, drive_context = self.drive.step(
            state.drive_state, z, unc, nov, pe, o32['reward_v32'], risk
        )
        drive_goal = _norm(0.85 * eff_goal + 0.15 * self.drive.readout(drive_state))
        gate = self.compute_gate(z, drive_goal, unc, nov, pe, drive_state, gap, risk)
        if force_planning is None:
            do_plan = bool((gate.mean() >= self.cfg.planning_gate_threshold).item())
        else:
            do_plan = bool(force_planning)
        teacher_probe = (int(state.life_clock.max().item()) % max(1, self.cfg.planning_probe_interval) == 0)
        run_slow = do_plan or teacher_probe

        teacher_action = base_action
        plan_obj = base_action.new_zeros(base_action.size(0), self.cfg.planner_candidates)
        plan_trace = base_action.new_zeros(base_action.size(0), self.cfg.planner_candidates, min(self.cfg.plan_rollout_depth, self.cfg.max_horizon), z.size(-1))
        if run_slow:
            candidates = o32['refined_actions_v32']
            roll = self.planner.rollout(
                self.base.ensemble, z, drive_goal, body, o32['external_state_v31'], candidates,
                depth=self.cfg.plan_rollout_depth
            )
            plan_obj = roll['objective']
            idx = plan_obj.argmax(-1)
            rows = torch.arange(z.size(0), device=z.device)
            teacher_action = candidates[rows, idx, 0]
            plan_trace = roll['trace']
            selected_obj = plan_obj.gather(-1, idx.unsqueeze(-1)).squeeze(-1)
        else:
            selected_obj = plan_obj.new_zeros(plan_obj.size(0))

        fast_action = self.fast_policy(
            z, drive_goal, drive_state, body, unc, nov, pe, gap, risk
        )
        mix = self.cfg.fast_policy_scale
        # On expensive teacher probes/sufficient-gate states, include the teacher; otherwise fast policy dominates.
        blend = (mix + (1.0 - mix) * gate).clamp(0.0, 1.0)
        if run_slow:
            emitted = torch.tanh((1.0 - blend) * fast_action + blend * teacher_action)
        else:
            emitted = torch.tanh((1.0 - mix) * fast_action + mix * base_action)

        out = dict(o32)
        out.update({
            'drive_state_v33': drive_state,
            'drive_context_v33': drive_context,
            'drive_goal_v33': drive_goal,
            'compute_gate_v33': gate,
            'planning_executed_v33': torch.full_like(gate, float(run_slow)),
            'teacher_probe_v33': torch.full_like(gate, float(teacher_probe)),
            'teacher_action_v33': teacher_action,
            'fast_action_v33': fast_action,
            'chosen_action_v33': emitted,
            'plan_objective_v33': plan_obj,
            'selected_plan_objective_v33': selected_obj.unsqueeze(-1),
            'plan_trace_v33': plan_trace,
        })
        new_state = V33State(base=st32, drive_state=drive_state.detach(), life_clock=state.life_clock + 1)
        out['_final_state'] = new_state
        return out, new_state

    def forward(self, x: Tensor, state: Optional[V33State] = None, goal_sequence=None,
                target_sequence=None, presence_sequence=None, modality_sequence=None,
                proprioception_sequence=None, interoception_sequence=None,
                commit_memory: bool = True, force_planning: Optional[bool] = None) -> Dict[str, Tensor]:
        if x.ndim != 3 or x.size(-1) not in {self.cfg.d, self.cfg.raw_observation_dim}:
            raise ValueError('x must be [B,T,D] in compact or configured raw observation width')
        raw_x = x
        x = self.observation_adapter(x)
        if target_sequence is not None and target_sequence.ndim == 3 and target_sequence.size(-1) != self.cfg.d:
            target_sequence = self.observation_adapter(target_sequence)
        st = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows = []
        for t in range(x.size(1)):
            target_next = None
            if target_sequence is not None and target_sequence.shape[:2] == x.shape[:2]:
                target_next = target_sequence[:, t]
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
        tensors = {k: torch.stack([r[k] for r in rows], 1) for k in rows[0] if torch.is_tensor(rows[0][k]) and k != '_final_state'}
        if 'foresight_next_heads_v32' in tensors:
            tensors['foresight_next_heads_v32'] = tensors['foresight_next_heads_v32'].permute(0, 2, 1, 3).contiguous()
        tensors['_final_state'] = st
        return tensors

    def act_from_observation(self, observation: Tensor, state: V33State, goal: Optional[Tensor] = None,
                             commit_memory: bool = True, force_planning: Optional[bool] = None):
        """Single-step boundary for a real/raw observation stream."""
        return self.step(observation, state, goal=goal, commit_memory=commit_memory, force_planning=force_planning)

    def loss_parts(self, out: Dict[str, Tensor], target_sequence: Optional[Tensor] = None,
                   reward_sequence: Optional[Tensor] = None, risk_sequence: Optional[Tensor] = None) -> Dict[str, Tensor]:
        target_internal = target_sequence
        if target_internal is not None and target_internal.size(-1) != self.cfg.d:
            target_internal = self.observation_adapter(target_internal).detach()
        p = self.base.loss_parts(out, target_sequence=target_internal, reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        z = out['fused_latent_v30']
        zero = z.new_zeros(())
        if z.size(1) <= 1:
            return {**p, 'plan': zero, 'distill': zero, 'gate': zero, 'drive': zero}

        # Slow teacher target: real outcome return-to-go when available, otherwise objective ranking consistency.
        distill = F.smooth_l1_loss(out['fast_action_v33'][:, :-1], out['teacher_action_v33'][:, :-1].detach())
        gate = out['compute_gate_v33'][:, :-1]
        run = out['planning_executed_v33'][:, :-1]
        if reward_sequence is not None and reward_sequence.shape[:2] == z.shape[:2]:
            rtg = _discounted_returns(reward_sequence.detach(), self.cfg.plan_discount)[:, :-1]
            sel = out['selected_plan_objective_v33'][:, :-1].squeeze(-1)
            # Gate should select expensive planning when its selected return signal exceeds the cheap baseline proxy.
            base_proxy = out['foresight_reward_v32'][:, :-1].squeeze(-1) if out['foresight_reward_v32'].ndim == 3 else out['foresight_reward_v32'][:, :-1]
            benefit = (rtg.squeeze(-1) - base_proxy).detach()
            target_gate = torch.sigmoid(benefit / 0.25).unsqueeze(-1)
            gate_loss = F.binary_cross_entropy(gate.clamp(1e-5, 1 - 1e-5), target_gate.clamp(1e-5, 1 - 1e-5))
            mask = run.squeeze(-1).detach()
            per_plan = F.smooth_l1_loss(sel, rtg.squeeze(-1), reduction='none')
            plan_loss = (per_plan * mask).sum() / mask.sum().clamp_min(1.0)
        else:
            gate_loss = (gate - gate.detach()).abs().mean()
            plan_loss = -out['selected_plan_objective_v33'].mean() * 0.01

        # Drive state should predict compactly useful internal change signals, not float freely.
        target_drive = torch.tanh(torch.cat([
            out['prediction_error_v31'][:, :-1], out['novelty'][:, :-1],
            out['risk_v32'][:, :-1], out['reward_v32'][:, :-1]
        ], -1).mean(-1, keepdim=True))
        drive_scalar = self.drive_state_scalar(out['drive_state_v33'][:, :-1])
        drive = F.smooth_l1_loss(drive_scalar, target_drive.detach())
        return {**p, 'plan': plan_loss, 'distill': distill, 'gate': gate_loss, 'drive': drive}

    @staticmethod
    def drive_state_scalar(state: Tensor) -> Tensor:
        return torch.tanh(state.mean(-1, keepdim=True))

    def training_loss(self, out: Dict[str, Tensor], **kwargs) -> Tensor:
        p = self.loss_parts(out, **kwargs)
        c = self.cfg
        return self.base.training_loss(out, target_sequence=kwargs.get('target_sequence'),
                                       reward_sequence=kwargs.get('reward_sequence'),
                                       risk_sequence=kwargs.get('risk_sequence')) \
            + c.planner_teacher_weight * p['plan'] \
            + c.fast_policy_weight * p['distill'] \
            + c.adaptive_compute_weight * p['gate'] \
            + c.drive_weight * p['drive']


class OrganismTrainerV33:
    """Trainer with real outcomes, prioritized replay and real-anchored dream rehearsal."""
    def __init__(self, model: NeuroWeaveV33, lr: float = 5e-4, warmup_steps: int = 2,
                 max_norm: Optional[float] = None):
        self.model = model
        self.steps = 0
        self.warmup_steps = warmup_steps
        self.max_norm = max_norm or model.cfg.max_grad_norm
        self.params = [p for p in model.parameters() if p.requires_grad]
        self.optimizer = torch.optim.AdamW(self.params, lr=lr, weight_decay=1e-4)
        self.replay = OutcomeReplayV33(model.cfg.replay_capacity, model.cfg.replay_priority_alpha, model.cfg.replay_epsilon, model.cfg.replay_importance_beta)
        self.last_rehearsal: Dict[str, float] = {'accepted': 0.0, 'examined': 0.0, 'loss': 0.0}

    def ingest_outcome(self, *args) -> None:
        self._validate_online(args)
        self.replay.add(*args)

    @staticmethod
    def _validate_online(args):
        if len(args) != 7:
            raise ValueError('online outcome requires z, action, body, external_state, next_obs, reward, risk')
        b = args[0].size(0)
        if any(t.ndim != 2 for t in args) or any(t.size(0) != b for t in args):
            raise ValueError('online outcome tensors must be rank-2 with shared batch size')

    def _replay_loss(self, device, dtype) -> Tuple[Tensor, Optional[Tensor], Optional[Tensor]]:
        sampled = self.replay.sample(self.model.cfg.replay_batch, device, dtype)
        if sampled is None:
            return torch.zeros((), device=device, dtype=dtype), None, None
        batch, idx, is_w = sampled
        pred = self.model.base.ensemble(batch['z'], batch['action'], batch['body'], batch['external_state'])
        next_err = F.smooth_l1_loss(pred['next_mean'], batch['next_obs'], reduction='none').mean(-1)
        reward_err = F.smooth_l1_loss(pred['reward_mean'], batch['reward'], reduction='none').mean(-1)
        risk_err = F.binary_cross_entropy(pred['risk_mean'].clamp(1e-5, 1 - 1e-5), batch['risk'].clamp(0, 1), reduction='none').mean(-1)
        per = next_err + 0.5 * reward_err + 0.5 * risk_err
        return (per * is_w).mean(), idx, per.detach()

    def dream_rehearse(self, max_items: Optional[int] = None) -> Dict[str, float]:
        """Real-anchored dream rehearsal: only local action alternatives around observed real transitions.

        A synthetic candidate is accepted as a teacher only when the *current learned world model*
        predicts a margin improvement and low uncertainty. No synthetic transition is inserted into replay.
        """
        n = min(len(self.replay), max_items or self.model.cfg.replay_batch)
        if n == 0:
            return {'accepted': 0.0, 'examined': 0.0}
        sampled = self.replay.sample(n, next(self.model.parameters()).device, next(self.model.parameters()).dtype)
        if sampled is None:
            return {'accepted': 0.0, 'examined': 0.0}
        sample_payload = sampled
        batch, _idx, _is_w = sample_payload
        z, act, body, ext = batch['z'], batch['action'], batch['body'], batch['external_state']
        with torch.no_grad():
            base = self.model.base.ensemble(z, act, body, ext)
            base_obj = (base['reward_mean'] - self.model.cfg.risk_aversion * base['risk_mean'] - 0.10 * base['total_uncertainty']).squeeze(-1)
            noise = torch.randn(n, self.model.cfg.dream_candidates, act.size(-1), device=act.device, dtype=act.dtype) * self.model.cfg.dream_action_noise
            cands = torch.tanh(act.unsqueeze(1) + noise)
            flat = cands.reshape(n * self.model.cfg.dream_candidates, -1)
            zf = z.unsqueeze(1).expand(-1, self.model.cfg.dream_candidates, -1).reshape(n * self.model.cfg.dream_candidates, -1)
            bf = body.unsqueeze(1).expand(-1, self.model.cfg.dream_candidates, -1).reshape(n * self.model.cfg.dream_candidates, -1)
            ef = ext.unsqueeze(1).expand(-1, self.model.cfg.dream_candidates, -1).reshape(n * self.model.cfg.dream_candidates, -1)
            cf = self.model.base.ensemble(zf, flat, bf, ef)
            cobj = (cf['reward_mean'] - self.model.cfg.risk_aversion * cf['risk_mean'] - 0.10 * cf['total_uncertainty']).view(n, self.model.cfg.dream_candidates)
            best, idx = cobj.max(-1)
            margin = best - base_obj
            chosen = cands[torch.arange(n, device=act.device), idx]
            accepted = (margin > self.model.cfg.dream_accept_margin) & (cf['total_uncertainty'].view(n, self.model.cfg.dream_candidates)[torch.arange(n, device=act.device), idx] < self.model.cfg.dream_uncertainty_limit)
        # Distill only accepted locally-improved teachers. This creates a cheap policy-learning path without hallucinating memory.
        if accepted.any():
            goal = ext[accepted]
            if goal.size(-1) != self.model.cfg.goal_dim:
                goal = F.pad(goal, (0, max(0, self.model.cfg.goal_dim-goal.size(-1))))[..., :self.model.cfg.goal_dim]
            drive = torch.zeros(goal.size(0), self.model.cfg.drive_dim, device=z.device, dtype=z.dtype)
            novelty = torch.zeros_like(base['total_uncertainty'][accepted])
            pe = torch.zeros_like(base['total_uncertainty'][accepted])
            gap = (goal - z[accepted, :goal.size(-1)]).norm(dim=-1, keepdim=True) if goal.size(-1) == z.size(-1) else torch.zeros_like(base['total_uncertainty'][accepted])
            out = self.model.fast_policy(z[accepted], goal, drive, body[accepted], base['total_uncertainty'][accepted], novelty, pe, gap, base['risk_mean'][accepted])
            loss = F.smooth_l1_loss(out, chosen[accepted])
            self.optimizer.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.params, self.max_norm)
            self.optimizer.step()
            return {'accepted': float(accepted.sum()), 'examined': float(n), 'loss': float(loss.detach())}
        return {'accepted': 0.0, 'examined': float(n), 'loss': 0.0}

    def step(self, x: Tensor, goal_sequence=None, target_sequence=None,
             reward_sequence=None, risk_sequence=None, **kwargs):
        self.optimizer.zero_grad(set_to_none=True)
        out = self.model(x, goal_sequence=goal_sequence, target_sequence=target_sequence, commit_memory=False, **kwargs)
        loss = self.model.training_loss(out, target_sequence=target_sequence,
                                        reward_sequence=reward_sequence, risk_sequence=risk_sequence)
        if self.steps >= self.warmup_steps and target_sequence is not None and target_sequence.shape == x.shape:
            self.replay.add(out['fused_latent_v30'][:, :-1].reshape(-1, x.size(-1)),
                            out['chosen_action_v33'][:, :-1].reshape(-1, self.model.cfg.action_dim),
                            out['body_state_v30'][:, :-1].reshape(-1, self.model.cfg.body_dim),
                            out['external_state_v31'][:, :-1].reshape(-1, x.size(-1)),
                            target_sequence[:, 1:].reshape(-1, x.size(-1)),
                            (reward_sequence[:, 1:] if reward_sequence is not None else out['reward_v32'][:, :-1].detach()).reshape(-1, 1),
                            (risk_sequence[:, 1:] if risk_sequence is not None else out['risk_v32'][:, :-1].detach()).reshape(-1, 1))
            replay_loss, idx, priority = self._replay_loss(x.device, x.dtype)
            loss = loss + self.model.cfg.replay_weight * replay_loss
        else:
            idx = priority = None
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.params, self.max_norm)
        self.optimizer.step()
        if idx is not None:
            self.replay.update_priority(idx, priority)
        self.steps += 1
        rehearsal = None
        if self.cfg_rehearsal_due():
            self.last_rehearsal = self.dream_rehearse(max_items=self.model.cfg.replay_batch)
        return loss.detach(), out

    def cfg_rehearsal_due(self) -> bool:
        return self.model.cfg.dream_rehearsal_interval > 0 and self.steps % self.model.cfg.dream_rehearsal_interval == 0 and len(self.replay) > 0
