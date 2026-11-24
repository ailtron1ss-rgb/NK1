from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple, List, Any
import copy
import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v41 import (
    V41Config,
    V41State,
    NeuroWeaveV41,
    RuntimeStateStoreV41,
)
from neurocore.v40 import ExternalPolicyVerifierV40, ExternalEvalResultV40


def _norm(x: Tensor) -> Tensor:
    return F.normalize(x, dim=-1, eps=1e-5)


@dataclass
class V42Config(V41Config):
    """V42 continual-development configuration.

    V42 adds a task-free continual-learning control loop around the V41 brain:
    prioritized episodic replay, drift estimation, selective plasticity,
    gradient-conflict projection and conservative acceptance. Replay is
    procedural training state; it is explicitly not the canonical factual
    memory store of the organism.
    """

    replay_capacity_v42: int = 24
    replay_batch_v42: int = 3
    replay_min_items_v42: int = 3
    replay_min_priority_v42: float = 1e-4
    replay_novelty_weight_v42: float = 0.45
    replay_reward_weight_v42: float = 0.25
    replay_drift_weight_v42: float = 0.22
    replay_prediction_error_weight_v42: float = 0.08
    replay_temperature_v42: float = 0.60
    drift_ema_v42: float = 0.92
    drift_threshold_v42: float = 0.12
    plasticity_min_v42: float = 0.35
    plasticity_max_v42: float = 1.40
    plasticity_drift_gain_v42: float = 1.75
    anchor_weight_v42: float = 0.015
    anchor_decay_v42: float = 0.995
    gradient_conflict_tol_v42: float = 0.0
    gradient_conflict_projection_v42: bool = True
    replay_gradient_scale_v42: float = 0.70
    max_grad_norm_v42: float = 1.0
    teacher_ema_decay_v42: float = 0.995
    teacher_rehearsal_weight_v42: float = 0.01
    adaptation_interval_v42: int = 1
    acceptance_eval_interval_v42: int = 4
    acceptance_loss_margin_v42: float = 0.02
    external_acceptance_enabled_v42: bool = True
    external_eval_clone_v42: bool = True
    commit_after_accept_v42: bool = True


def mobile_v42_config(raw_observation_dim: int = 9) -> V42Config:
    # Keep the V41 mobile profile as the exact base to avoid silently changing
    # earlier mobile constraints.
    from neurocore.v41 import mobile_v41_config
    base = dict(mobile_v41_config(raw_observation_dim).__dict__)
    return V42Config(
        **base,
        replay_capacity_v42=24,
        replay_batch_v42=3,
        replay_min_items_v42=3,
        replay_min_priority_v42=1e-4,
        replay_novelty_weight_v42=0.45,
        replay_reward_weight_v42=0.25,
        replay_drift_weight_v42=0.22,
        replay_prediction_error_weight_v42=0.08,
        replay_temperature_v42=0.60,
        drift_ema_v42=0.92,
        drift_threshold_v42=0.12,
        plasticity_min_v42=0.35,
        plasticity_max_v42=1.40,
        plasticity_drift_gain_v42=1.75,
        anchor_weight_v42=0.015,
        anchor_decay_v42=0.995,
        gradient_conflict_tol_v42=0.0,
        gradient_conflict_projection_v42=True,
        replay_gradient_scale_v42=0.70,
        max_grad_norm_v42=1.0,
        teacher_ema_decay_v42=0.995,
        teacher_rehearsal_weight_v42=0.01,
        adaptation_interval_v42=1,
        acceptance_eval_interval_v42=4,
        acceptance_loss_margin_v42=0.02,
        external_acceptance_enabled_v42=True,
        external_eval_clone_v42=True,
        commit_after_accept_v42=True,
    )


@dataclass
class V42State:
    base: V41State
    task_signature: Tensor
    drift_score: Tensor
    novelty_score: Tensor
    plasticity_gate: Tensor


class TaskFreeDriftDetectorV42:
    """Task-free shift detector over the organism's current task representation."""

    def __init__(self, dim: int, ema: float = 0.92, threshold: float = 0.12):
        self.dim = int(dim)
        self.ema = float(ema)
        self.threshold = float(threshold)
        self.center: Optional[Tensor] = None
        self.last_score: float = 0.0
        self.updates: int = 0

    def update(self, signature: Tensor) -> Dict[str, float | bool]:
        if signature.shape[-1] != self.dim:
            raise ValueError(f'signature dimension mismatch: expected {self.dim}, got {signature.shape[-1]}')
        x = _norm(signature.detach().mean(0, keepdim=True))
        if self.center is None:
            self.center = x.clone()
            score = 0.0
        else:
            score = float((1.0 - F.cosine_similarity(x, self.center, dim=-1)).mean().item())
            self.center = _norm(self.ema * self.center + (1.0 - self.ema) * x)
        self.last_score = score
        self.updates += 1
        return {
            'score': score,
            'shift': bool(score >= self.threshold),
            'updates': float(self.updates),
        }

    def novelty(self, signature: Tensor, references: Optional[Tensor]) -> Tensor:
        x = _norm(signature)
        if references is None or references.numel() == 0:
            return torch.ones(x.size(0), 1, device=x.device, dtype=x.dtype)
        sims = torch.matmul(x, _norm(references).transpose(0, 1))
        return (1.0 - sims.max(dim=-1, keepdim=True).values).clamp(0.0, 2.0)

@dataclass
class ReplayItemV42:
    x: Tensor
    goal: Optional[Tensor]
    target: Optional[Tensor]
    reward: Optional[Tensor]
    risk: Optional[Tensor]
    signature: Tensor
    priority: float
    step_id: int


class AdaptiveExperienceReplayV42:
    """Bounded, priority-weighted episodic replay for continual adaptation.

    It stores training episodes rather than factual assertions and therefore
    does not compete with the canonical memory truth owner.
    """

    def __init__(self, capacity: int, min_priority: float = 1e-4):
        self.capacity = int(max(1, capacity))
        self.min_priority = float(min_priority)
        self.items: List[ReplayItemV42] = []
        self.total_seen = 0

    def __len__(self) -> int:
        return len(self.items)

    def references(self) -> Optional[Tensor]:
        if not self.items:
            return None
        return torch.cat([i.signature.reshape(1, -1) for i in self.items], dim=0)

    def add(
        self,
        x: Tensor,
        goal: Optional[Tensor],
        target: Optional[Tensor],
        reward: Optional[Tensor],
        risk: Optional[Tensor],
        signature: Tensor,
        priority: float,
    ) -> None:
        self.total_seen += 1
        p = float(max(abs(float(priority)), self.min_priority))
        item = ReplayItemV42(
            x=x.detach().cpu().clone(),
            goal=None if goal is None else goal.detach().cpu().clone(),
            target=None if target is None else target.detach().cpu().clone(),
            reward=None if reward is None else reward.detach().cpu().clone(),
            risk=None if risk is None else risk.detach().cpu().clone(),
            signature=(signature.detach().mean(0) if signature.detach().ndim > 1 else signature.detach()).cpu().clone(),
            priority=p,
            step_id=self.total_seen,
        )
        if len(self.items) < self.capacity:
            self.items.append(item)
            return
        # Priority-reservoir replacement: weak episodes are replaced first,
        # but a strong old item can survive indefinitely.
        weakest = min(range(len(self.items)), key=lambda j: self.items[j].priority)
        if p > self.items[weakest].priority:
            self.items[weakest] = item

    def priorities(self) -> Tensor:
        return torch.tensor([i.priority for i in self.items], dtype=torch.float32)

    def sample(self, batch_size: int, temperature: float = 0.6) -> Optional[Dict[str, Tensor]]:
        if len(self.items) == 0:
            return None
        n = min(int(batch_size), len(self.items))
        pri = self.priorities().clamp_min(self.min_priority)
        logits = torch.log(pri) / max(float(temperature), 0.05)
        probs = F.softmax(logits, dim=0)
        idx = torch.multinomial(probs, n, replacement=False if n <= len(self.items) else True)
        rows = [self.items[int(i)] for i in idx]
        if any(r.x.shape != rows[0].x.shape for r in rows):
            # We intentionally require homogeneous episode shape. A future
            # variable-length backend belongs in the runtime/data layer.
            return None

        def stack_optional(name: str) -> Optional[Tensor]:
            values = [getattr(r, name) for r in rows]
            if any(v is None for v in values):
                return None
            return torch.cat(values, 0)

        return {
            'x': torch.cat([r.x for r in rows], 0),
            'goal': stack_optional('goal'),
            'target': stack_optional('target'),
            'reward': stack_optional('reward'),
            'risk': stack_optional('risk'),
            'signature': torch.stack([r.signature for r in rows], 0),
            'replay_probability': probs[idx],
        }

    def stats(self) -> Dict[str, float]:
        pri = self.priorities()
        diversity = 0.0
        if len(self.items) > 1:
            refs = _norm(self.references())
            sims = refs @ refs.t()
            mask = ~torch.eye(len(self.items), dtype=torch.bool)
            diversity = float((1.0 - sims[mask]).mean().item())
        return {
            'size': float(len(self.items)),
            'capacity': float(self.capacity),
            'total_seen': float(self.total_seen),
            'mean_priority': float(pri.mean().item()) if pri.numel() else 0.0,
            'max_priority': float(pri.max().item()) if pri.numel() else 0.0,
            'min_priority': float(pri.min().item()) if pri.numel() else 0.0,
            'signature_diversity': diversity,
        }


class GradientConflictResolverV42:
    """PCGrad-like projection for current-vs-replay gradient conflicts."""

    def __init__(self, tolerance: float = 0.0, projection_enabled: bool = True):
        self.tolerance = float(tolerance)
        self.projection_enabled = bool(projection_enabled)
        self.conflicts = 0
        self.calls = 0

    @staticmethod
    def flatten(grads: List[Optional[Tensor]], params: List[nn.Parameter]) -> Tensor:
        chunks = []
        for g, p in zip(grads, params):
            if g is None:
                chunks.append(torch.zeros_like(p).reshape(-1))
            else:
                chunks.append(g.reshape(-1))
        return torch.cat(chunks) if chunks else torch.zeros(0)

    def combine(
        self,
        current: List[Optional[Tensor]],
        replay: List[Optional[Tensor]],
        params: List[nn.Parameter],
        replay_scale: float,
        plasticity_gate: float,
    ) -> Tuple[List[Tensor], Dict[str, float]]:
        self.calls += 1
        g_cur = self.flatten(current, params)
        g_rep = self.flatten(replay, params)
        dot = float(torch.dot(g_cur, g_rep).detach().item())
        cur_norm = float(g_cur.norm().detach().item())
        rep_norm = float(g_rep.norm().detach().item())
        projected = g_rep
        conflict = dot < self.tolerance
        if conflict and cur_norm > 1e-12 and self.projection_enabled:
            self.conflicts += 1
            projected = g_rep - (dot / (g_cur.pow(2).sum() + 1e-12)) * g_cur
        combined = g_cur + float(replay_scale) * float(plasticity_gate) * projected
        out: List[Tensor] = []
        cursor = 0
        for p in params:
            count = p.numel()
            out.append(combined[cursor:cursor + count].view_as(p))
            cursor += count
        metrics = {
            'gradient_dot_v42': dot,
            'current_grad_norm_v42': cur_norm,
            'replay_grad_norm_v42': rep_norm,
            'gradient_conflict_v42': float(conflict),
            'gradient_conflict_rate_v42': self.conflicts / max(1, self.calls),
        }
        return out, metrics


def external_acceptance_v42(
    before: ExternalEvalResultV40,
    after: ExternalEvalResultV40,
    cfg: V42Config,
) -> Dict[str, float | bool]:
    """Sign-safe external acceptance for reward scales where higher is better."""
    # The verifier owns the task lists; use the common names present in both
    # evaluations and classify retain/new via the V40 naming convention.
    retain_names = sorted(n for n in before.per_task_reward if n.startswith('retain_'))
    new_names = sorted(n for n in before.per_task_reward if n.startswith('new_'))
    rb = sum(before.per_task_reward[n] for n in retain_names) / max(1, len(retain_names))
    ra = sum(after.per_task_reward[n] for n in retain_names) / max(1, len(retain_names))
    nb = sum(before.per_task_reward[n] for n in new_names) / max(1, len(new_names))
    na = sum(after.per_task_reward[n] for n in new_names) / max(1, len(new_names))
    allowed_drop = abs(rb) * (1.0 - cfg.external_retention_floor_v40)
    accepted = (
        na >= nb + cfg.external_accept_margin_v40
        and ra >= rb - allowed_drop
        and after.risk_rate <= before.risk_rate + cfg.external_risk_tolerance_v40
    )
    retention_ratio = (ra / rb) if rb != 0.0 else 1.0
    return {
        'accepted': bool(accepted),
        'new_before': float(nb),
        'new_after': float(na),
        'retention_before': float(rb),
        'retention_after': float(ra),
        'retention_ratio_legacy_safe_v42': float(retention_ratio),
        'retention_allowed_drop': float(allowed_drop),
        'risk_before': float(before.risk_rate),
        'risk_after': float(after.risk_rate),
    }


def _mutable_state_snapshot(model: NeuroWeaveV41) -> Dict[str, Tensor]:
    """Snapshot V40/V41 mutable procedural tensors altered by observe_outcome."""
    return {
        'skill_quality': model.base.skill_bank.skill_quality.detach().clone(),
        'transition_logits': model.composer.transition_logits.detach().clone(),
        'transition_value': model.composer.transition_value.detach().clone(),
    }


def _restore_mutable_state(model: NeuroWeaveV41, snap: Dict[str, Tensor]) -> None:
    with torch.no_grad():
        model.base.skill_bank.skill_quality.copy_(snap['skill_quality'])
        model.composer.transition_logits.copy_(snap['transition_logits'])
        model.composer.transition_value.copy_(snap['transition_value'])


def side_effect_free_forward_v42(
    model: 'NeuroWeaveV42',
    x: Tensor,
    goal_sequence=None,
    target_sequence=None,
    reward_sequence=None,
    risk_sequence=None,
) -> Dict[str, Tensor]:
    """Evaluate/train on a tensor graph without committing procedural updates."""
    snap = _mutable_state_snapshot(model.base)
    was_training = model.training
    try:
        out = model(
            x,
            goal_sequence=goal_sequence,
            target_sequence=target_sequence,
            reward_sequence=reward_sequence,
            risk_sequence=risk_sequence,
            commit_memory=False,
            force_planning=False,
        )
        return out
    finally:
        _restore_mutable_state(model.base, snap)
        model.train(was_training)


class NeuroWeaveV42(nn.Module):
    """V42 task-free continual-development wrapper around the V41 brain."""

    def __init__(self, cfg: Optional[V42Config] = None):
        super().__init__()
        self.cfg = cfg or V42Config()
        self.base = NeuroWeaveV41(self.cfg)

    def initial_state(self, b: int, device=None, dtype=None) -> V42State:
        return V42State(
            base=self.base.initial_state(b, device=device, dtype=dtype),
            task_signature=torch.zeros(b, self.cfg.d, device=device, dtype=dtype),
            drift_score=torch.zeros(b, 1, device=device, dtype=dtype),
            novelty_score=torch.ones(b, 1, device=device, dtype=dtype),
            plasticity_gate=torch.ones(b, 1, device=device, dtype=dtype),
        )

    def step(self, x: Tensor, state: V42State, goal=None, **kwargs):
        out, st41 = self.base.step(x, state.base, goal=goal, **kwargs)
        signature = _norm(out.get('task_embedding_v41', out['composition_v41']))
        prev = _norm(state.task_signature)
        previous_valid = (state.task_signature.abs().sum(-1, keepdim=True) > 1e-6).float()
        instantaneous_drift = (1.0 - F.cosine_similarity(signature, prev, dim=-1, eps=1e-6)).unsqueeze(-1)
        instantaneous_drift = torch.where(previous_valid > 0, instantaneous_drift, torch.zeros_like(instantaneous_drift))
        drift = self.cfg.drift_ema_v42 * state.drift_score + (1.0 - self.cfg.drift_ema_v42) * instantaneous_drift
        gate_value = self.cfg.plasticity_min_v42 + self.cfg.plasticity_drift_gain_v42 * drift
        gate = gate_value.clamp(self.cfg.plasticity_min_v42, self.cfg.plasticity_max_v42)
        st = V42State(
            base=st41,
            task_signature=signature.detach(),
            drift_score=drift.detach(),
            novelty_score=state.novelty_score.detach(),
            plasticity_gate=gate.detach(),
        )
        out = dict(out)
        out.update({
            'task_signature_v42': signature,
            'drift_score_v42': drift,
            'plasticity_gate_v42': gate,
            'adaptation_shift_v42': (drift >= self.cfg.drift_threshold_v42).float(),
        })
        out['_final_state'] = st
        return out, st

    def forward(self, x: Tensor, state: Optional[V42State] = None, goal_sequence=None,
                target_sequence=None, reward_sequence=None, risk_sequence=None, **kwargs):
        if x.ndim != 3:
            raise ValueError('x must be [B,T,D]')
        st = self.initial_state(x.size(0), x.device, x.dtype) if state is None else state
        rows = []
        for t in range(x.size(1)):
            o, st = self.step(
                x[:, t], st,
                goal=goal_sequence[:, t] if goal_sequence is not None else None,
                **kwargs,
            )
            if target_sequence is not None and t < x.size(1) - 1:
                rr = reward_sequence[:, t] if reward_sequence is not None else torch.zeros(x.size(0), 1, device=x.device, dtype=x.dtype)
                rk = risk_sequence[:, t] if risk_sequence is not None else torch.zeros_like(rr)
                oo, st41 = self.base.observe_outcome(
                    st.base, o, target_sequence[:, t + 1], rr, rk, None
                )
                st = V42State(
                    base=st41,
                    task_signature=st.task_signature,
                    drift_score=st.drift_score,
                    novelty_score=st.novelty_score,
                    plasticity_gate=st.plasticity_gate,
                )
                o.update({f'outcome_{k}_v42': v for k, v in oo.items() if torch.is_tensor(v)})
            rows.append(o)
        tensors = {
            k: torch.stack([r[k] for r in rows], 1)
            for k in rows[0]
            if torch.is_tensor(rows[0][k]) and k != '_final_state' and not k.startswith('outcome_')
        }
        tensors['_final_state'] = st
        return tensors

    def loss_parts(self, out: Dict[str, Tensor], target_sequence=None,
                   reward_sequence=None, risk_sequence=None, **kwargs):
        p = self.base.loss_parts(
            out,
            target_sequence=target_sequence,
            reward_sequence=reward_sequence,
            risk_sequence=risk_sequence,
            **kwargs,
        )
        z = out['fused_latent_v30']
        zero = z.new_zeros(())
        drift = out.get('drift_score_v42', z.new_zeros(z.shape[:2] + (1,))).mean()
        gate = out.get('plasticity_gate_v42', z.new_ones(z.shape[:2] + (1,))).mean()
        sig = out.get('task_signature_v42', z.new_zeros(z.shape[:2] + (self.cfg.d,)))
        temporal = F.smooth_l1_loss(sig[:, 1:], sig[:, :-1].detach()) if sig.size(1) > 1 else zero
        p.update({
            'drift_v42': drift,
            'plasticity_gate_v42': gate,
            'signature_temporal_v42': temporal,
        })
        return p

    def training_loss(self, out: Dict[str, Tensor], **kwargs) -> Tensor:
        p = self.loss_parts(out, **kwargs)
        return self.base.training_loss(out, **kwargs) + 0.01 * p['signature_temporal_v42']


class OrganismTrainerV42:
    """Continual trainer with replay, conflict-aware gradients and acceptance."""

    def __init__(
        self,
        model: NeuroWeaveV42,
        lr: float = 3e-4,
        warmup_steps: int = 4,
        external_verifier: Optional[ExternalPolicyVerifierV40] = None,
    ):
        self.model = model
        self.optimizer = torch.optim.AdamW(model.parameters(), lr=lr)
        self.lr = float(lr)
        self.warmup_steps = int(warmup_steps)
        self.steps = 0
        self.replay = AdaptiveExperienceReplayV42(
            model.cfg.replay_capacity_v42,
            model.cfg.replay_min_priority_v42,
        )
        self.drift_detector = TaskFreeDriftDetectorV42(
            model.cfg.d,
            model.cfg.drift_ema_v42,
            model.cfg.drift_threshold_v42,
        )
        self.conflict_resolver = GradientConflictResolverV42(model.cfg.gradient_conflict_tol_v42, model.cfg.gradient_conflict_projection_v42)
        self.teacher = copy.deepcopy(model)
        for p in self.teacher.parameters():
            p.requires_grad_(False)
        self.teacher.eval()
        self.anchor: Dict[str, Tensor] = {
            n: p.detach().cpu().clone() for n, p in model.named_parameters() if p.requires_grad
        }
        self.last_update_report: Dict[str, Any] = {}
        self.external_verifier = external_verifier
        self.external_reports: List[Dict[str, Any]] = []

    def _named_params(self) -> Tuple[List[str], List[nn.Parameter]]:
        pairs = [(n, p) for n, p in self.model.named_parameters() if p.requires_grad]
        return [n for n, _ in pairs], [p for _, p in pairs]

    def _anchor_loss(self) -> Tensor:
        terms = []
        for name, p in self.model.named_parameters():
            if not p.requires_grad or name not in self.anchor:
                continue
            a = self.anchor[name].to(device=p.device, dtype=p.dtype)
            terms.append(F.smooth_l1_loss(p, a))
        if not terms:
            return next(self.model.parameters()).new_zeros(())
        return torch.stack(terms).mean()

    def _record_episode(self, x, goal_sequence, target_sequence, reward_sequence, risk_sequence, out):
        signature = out['task_signature_v42'].detach().mean(1)
        novelty = self.drift_detector.novelty(signature, self.replay.references().to(signature.device) if self.replay.references() is not None else None)
        reward_mag = torch.zeros_like(novelty)
        if reward_sequence is not None:
            reward_mag = reward_sequence.detach().abs().mean(dim=1).to(novelty.device)
        drift = out['drift_score_v42'].detach().mean(1)
        prediction_error = out.get('prediction_error_v31')
        prediction_error = (
            prediction_error.detach().mean(1) if prediction_error is not None else torch.zeros_like(novelty)
        )
        priorities = (
            self.model.cfg.replay_novelty_weight_v42 * novelty
            + self.model.cfg.replay_reward_weight_v42 * reward_mag
            + self.model.cfg.replay_drift_weight_v42 * drift
            + self.model.cfg.replay_prediction_error_weight_v42 * prediction_error
        )
        for b in range(x.size(0)):
            self.replay.add(
                x[b:b + 1],
                None if goal_sequence is None else goal_sequence[b:b + 1],
                None if target_sequence is None else target_sequence[b:b + 1],
                None if reward_sequence is None else reward_sequence[b:b + 1],
                None if risk_sequence is None else risk_sequence[b:b + 1],
                signature[b],
                float(priorities[b].item()),
            )
        return float(novelty.mean().item()), float(priorities.mean().item())

    @torch.no_grad()
    def _eval_loss(self, x, goal_sequence=None, target_sequence=None, reward_sequence=None, risk_sequence=None) -> float:
        was_training = self.model.training
        self.model.eval()
        out = side_effect_free_forward_v42(
            self.model, x, goal_sequence, target_sequence, reward_sequence, risk_sequence
        )
        loss = self.model.training_loss(
            out,
            target_sequence=target_sequence,
            reward_sequence=reward_sequence,
            risk_sequence=risk_sequence,
        )
        self.model.train(was_training)
        return float(loss.detach().item())

    def _external_eval(self) -> Optional[ExternalEvalResultV40]:
        if self.external_verifier is None:
            return None
        if self.model.cfg.external_eval_clone_v42:
            probe = copy.deepcopy(self.model)
        else:
            probe = self.model
        return self.external_verifier.evaluate(probe, self.external_verifier.tasks, seed_offset=self.steps + 17)

    def _commit_after_accept(self, x, goal_sequence=None, target_sequence=None, reward_sequence=None, risk_sequence=None):
        if not self.model.cfg.commit_after_accept_v42:
            return
        # Commit the model's procedural outcome statistics exactly once, after
        # acceptance, rather than during the competing gradient evaluations.
        self.model.train()
        with torch.no_grad():
            self.model(
                x,
                goal_sequence=goal_sequence,
                target_sequence=target_sequence,
                reward_sequence=reward_sequence,
                risk_sequence=risk_sequence,
            )

    def step(self, x: Tensor, goal_sequence=None, target_sequence=None,
             reward_sequence=None, risk_sequence=None, **kwargs):
        if x.ndim != 3:
            raise ValueError('x must be [B,T,D]')
        cfg = self.model.cfg
        self.steps += 1
        model_snapshot = copy.deepcopy(self.model.state_dict())
        opt_snapshot = copy.deepcopy(self.optimizer.state_dict())

        current_out = side_effect_free_forward_v42(
            self.model, x, goal_sequence, target_sequence, reward_sequence, risk_sequence
        )
        current_loss = self.model.training_loss(
            current_out,
            target_sequence=target_sequence,
            reward_sequence=reward_sequence,
            risk_sequence=risk_sequence,
        )

        heldout_before = None
        hx = hg = ht = hr = hk = None
        if x.size(1) >= 4:
            cut = max(2, x.size(1) // 2)
            hx = x[:, cut:]
            hg = goal_sequence[:, cut:] if goal_sequence is not None else None
            ht = target_sequence[:, cut:] if target_sequence is not None else None
            hr = reward_sequence[:, cut:] if reward_sequence is not None else None
            hk = risk_sequence[:, cut:] if risk_sequence is not None else None
            heldout_before = self._eval_loss(hx, hg, ht, hr, hk)

        external_before = None
        external_due = (
            cfg.external_acceptance_enabled_v42
            and self.external_verifier is not None
            and self.steps % max(1, cfg.acceptance_eval_interval_v42) == 0
        )
        if external_due:
            probe = copy.deepcopy(self.model) if cfg.external_eval_clone_v42 else self.model
            external_before = self.external_verifier.evaluate(
                probe, self.external_verifier.tasks, seed_offset=self.steps + 7
            )

        drift_metrics = self.drift_detector.update(current_out['task_signature_v42'])
        if cfg.adaptation_interval_v42 <= 1 or self.steps % cfg.adaptation_interval_v42 == 0:
            novelty, priority = self._record_episode(
                x, goal_sequence, target_sequence, reward_sequence, risk_sequence, current_out
            )
        else:
            novelty, priority = 0.0, 0.0

        replay_batch = None
        if len(self.replay) >= cfg.replay_min_items_v42:
            replay_batch = self.replay.sample(cfg.replay_batch_v42, cfg.replay_temperature_v42)

        names, params = self._named_params()
        anchor_loss = self._anchor_loss()
        current_objective = current_loss + cfg.anchor_weight_v42 * anchor_loss
        current_grads = torch.autograd.grad(
            current_objective, params, retain_graph=False, allow_unused=True
        )
        replay_grads: List[Optional[Tensor]] = [None] * len(params)
        replay_loss_value = 0.0
        if replay_batch is not None and replay_batch['target'] is not None:
            rx = replay_batch['x'].to(device=x.device, dtype=x.dtype)
            rg = None if replay_batch['goal'] is None else replay_batch['goal'].to(device=x.device, dtype=x.dtype)
            rt = None if replay_batch['target'] is None else replay_batch['target'].to(device=x.device, dtype=x.dtype)
            rr = None if replay_batch['reward'] is None else replay_batch['reward'].to(device=x.device, dtype=x.dtype)
            rk = None if replay_batch['risk'] is None else replay_batch['risk'].to(device=x.device, dtype=x.dtype)
            replay_out = side_effect_free_forward_v42(self.model, rx, rg, rt, rr, rk)
            replay_loss = self.model.training_loss(
                replay_out,
                target_sequence=rt,
                reward_sequence=rr,
                risk_sequence=rk,
            )
            if cfg.teacher_rehearsal_weight_v42 > 0.0:
                with torch.no_grad():
                    teacher_out = side_effect_free_forward_v42(self.teacher, rx, rg, rt, rr, rk)
                student_action = replay_out.get('chosen_action_v40')
                teacher_action = teacher_out.get('chosen_action_v40')
                if student_action is not None and teacher_action is not None:
                    rehearsal = F.smooth_l1_loss(student_action, teacher_action.detach())
                    replay_loss = replay_loss + cfg.teacher_rehearsal_weight_v42 * rehearsal
                else:
                    rehearsal = replay_loss.new_zeros(())
            else:
                rehearsal = replay_loss.new_zeros(())
            replay_loss_value = float(replay_loss.detach().item())
            replay_grads = list(torch.autograd.grad(
                replay_loss, params, retain_graph=False, allow_unused=True
            ))

        plasticity = float(current_out['plasticity_gate_v42'].detach().mean().item())
        combined_grads, grad_metrics = self.conflict_resolver.combine(
            list(current_grads),
            replay_grads,
            params,
            cfg.replay_gradient_scale_v42,
            plasticity,
        )
        self.optimizer.zero_grad(set_to_none=True)
        for p, g in zip(params, combined_grads):
            p.grad = g
        total_norm = float(torch.nn.utils.clip_grad_norm_(params, cfg.max_grad_norm_v42).detach().item())
        self.optimizer.step()

        accepted = True
        rollback_reason = None
        heldout_after = None
        if heldout_before is not None:
            heldout_after = self._eval_loss(hx, hg, ht, hr, hk)
            if heldout_after > heldout_before + cfg.acceptance_loss_margin_v42:
                accepted = False
                rollback_reason = 'heldout_loss_regression'

        external_decision = None
        if accepted and external_before is not None and external_due:
            external_after = self.external_verifier.evaluate(
                copy.deepcopy(self.model) if cfg.external_eval_clone_v42 else self.model,
                self.external_verifier.tasks,
                seed_offset=self.steps + 7,
            )
            # V40's verifier remains a real safety gate: if the model does not
            # pass the actual held-out environment comparison, this weight update
            # is rolled back rather than merely logged.
            external_decision = external_acceptance_v42(external_before, external_after, cfg)
            self.external_reports.append(external_decision)
            if not external_decision['accepted']:
                accepted = False
                rollback_reason = 'external_verifier_reject'

        if not accepted:
            self.model.load_state_dict(model_snapshot)
            self.optimizer.load_state_dict(opt_snapshot)
        else:
            self._commit_after_accept(
                x, goal_sequence, target_sequence, reward_sequence, risk_sequence
            )
            with torch.no_grad():
                tau = float(cfg.teacher_ema_decay_v42)
                for tp, sp in zip(self.teacher.parameters(), self.model.parameters()):
                    tp.mul_(tau).add_((1.0 - tau) * sp.detach())
            # Update anchor only toward accepted parameters, making it a slow
            # consolidation point rather than an immutable copy.
            with torch.no_grad():
                for name, p in self.model.named_parameters():
                    if name not in self.anchor:
                        continue
                    old = self.anchor[name]
                    self.anchor[name] = (
                        cfg.anchor_decay_v42 * old
                        + (1.0 - cfg.anchor_decay_v42) * p.detach().cpu()
                    )

        self.last_update_report = {
            'attempted': True,
            'accepted': bool(accepted),
            'rolled_back': bool(not accepted),
            'rollback_reason': rollback_reason,
            'step': self.steps,
            'current_loss': float(current_loss.detach().item()),
            'replay_loss': replay_loss_value,
            'teacher_rehearsal_weight': float(cfg.teacher_rehearsal_weight_v42),
            'anchor_loss': float(anchor_loss.detach().item()),
            'plasticity_gate': plasticity,
            'drift_score': float(current_out['drift_score_v42'].detach().mean().item()),
            'drift_shift': bool(drift_metrics['shift']),
            'replay_size': len(self.replay),
            'replay_priority': priority,
            'replay_novelty': novelty,
            'gradient_total_norm_before_clip': total_norm,
            **grad_metrics,
            'heldout_before': heldout_before,
            'heldout_after': heldout_after,
            'external_decision': external_decision,
        }
        return current_loss.detach(), current_out

    def benchmark_sequence(self, batches: List[Dict[str, Tensor]]) -> Dict[str, Any]:
        """Run a deterministic sequence and measure task loss before/after later learning."""
        task_metrics = []
        for i, batch in enumerate(batches):
            before_loss = self._eval_loss(
                batch['x'], batch.get('goal'), batch.get('target'), batch.get('reward'), batch.get('risk')
            )
            _, _ = self.step(
                batch['x'], batch.get('goal'), batch.get('target'), batch.get('reward'), batch.get('risk')
            )
            after_immediate = self._eval_loss(
                batch['x'], batch.get('goal'), batch.get('target'), batch.get('reward'), batch.get('risk')
            )
            task_metrics.append({
                'task_index': i,
                'before_loss': before_loss,
                'after_immediate_loss': after_immediate,
                'immediate_delta': after_immediate - before_loss,
                'accepted': self.last_update_report.get('accepted', False),
            })

        final_losses = []
        for batch in batches:
            final_losses.append(self._eval_loss(
                batch['x'], batch.get('goal'), batch.get('target'), batch.get('reward'), batch.get('risk')
            ))
        for row, final_loss in zip(task_metrics, final_losses):
            row['final_loss'] = final_loss
            row['forgetting_from_best'] = max(0.0, final_loss - row['after_immediate_loss'])

        return {
            'tasks': task_metrics,
            'mean_final_loss': sum(final_losses) / max(1, len(final_losses)),
            'mean_immediate_delta': sum(r['immediate_delta'] for r in task_metrics) / max(1, len(task_metrics)),
            'mean_forgetting_proxy': sum(r['forgetting_from_best'] for r in task_metrics) / max(1, len(task_metrics)),
            'replay': self.replay.stats(),
            'gradient_conflict_rate': self.conflict_resolver.conflicts / max(1, self.conflict_resolver.calls),
        }


class RuntimeStateStoreV42(RuntimeStateStoreV41):
    VERSION = 1

    @classmethod
    def save(cls, path, state):
        torch.save({'version': cls.VERSION, 'state': state}, path)

    @classmethod
    def load(cls, path, device=None, dtype=None):
        payload = torch.load(path, map_location=device, weights_only=False)
        if payload.get('version') != cls.VERSION:
            raise ValueError(f'unsupported V42 runtime-state version: {payload.get("version")}')
        state = payload['state']
        if device is not None or dtype is not None:
            state = cls._move(state, device=device, dtype=dtype)
        return state


__all__ = [
    'V42Config', 'mobile_v42_config', 'V42State',
    'TaskFreeDriftDetectorV42', 'ReplayItemV42', 'AdaptiveExperienceReplayV42',
    'GradientConflictResolverV42', 'external_acceptance_v42', 'side_effect_free_forward_v42',
    'NeuroWeaveV42', 'OrganismTrainerV42', 'RuntimeStateStoreV42',
]
