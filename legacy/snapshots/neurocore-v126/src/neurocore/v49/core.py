from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Sequence, Tuple
import math
import copy

import torch
from torch import Tensor, nn
import torch.nn.functional as F

from neurocore.v48 import (
    V48Config,
    mobile_v48_config,
    V47BrainState,
    NeuroWeaveV48,
    OrganismTrainerV48,
    RuntimeStateStoreV48,
    EpisodicMemoryItemV48,
    EpisodicMemoryV48,
)


def _norm(x: Tensor, eps: float = 1e-6) -> Tensor:
    return x / x.norm(dim=-1, keepdim=True).clamp_min(eps)


@dataclass
class V49Config(V48Config):
    """V49: complementary fast/slow memory + grounded recurrent world dynamics."""

    semantic_capacity_v49: int = 24
    semantic_top_k_v49: int = 3
    semantic_recurrence_threshold_v49: int = 3
    semantic_similarity_threshold_v49: float = 0.86
    semantic_confidence_threshold_v49: float = 0.58
    semantic_blend_v49: float = 0.08
    semantic_reliability_threshold_v49: float = 0.55
    semantic_consolidation_lr_v49: float = 0.18
    semantic_key_latent_weight_v49: float = 0.35
    semantic_key_goal_weight_v49: float = 1.0
    semantic_contradiction_penalty_v49: float = 0.35
    semantic_min_cluster_variance_v49: float = 0.28
    semantic_action_coherence_threshold_v49: float = 0.60
    world_hidden_v49: int = 28
    world_learning_rate_v49: float = 8e-4
    world_latent_weight_v49: float = 0.16
    world_reward_weight_v49: float = 0.03
    world_risk_weight_v49: float = 0.03
    world_free_rollout_weight_v49: float = 0.04
    world_rollout_horizon_v49: int = 8
    world_candidate_count_v49: int = 6
    world_candidate_noise_v49: float = 0.11
    world_action_support_v49: float = 0.22
    world_admission_margin_v49: float = 0.015
    world_readiness_error_v49: float = 0.32
    world_readiness_observations_v49: int = 24
    world_readiness_decay_v49: float = 0.94
    online_world_updates_per_feedback_v49: int = 2
    runtime_state_version_v49: int = 1


def mobile_v49_config(raw_observation_dim: int = 9) -> V49Config:
    base = dict(mobile_v48_config(raw_observation_dim).__dict__)
    return V49Config(
        **base,
        semantic_capacity_v49=24,
        semantic_top_k_v49=3,
        semantic_recurrence_threshold_v49=3,
        semantic_similarity_threshold_v49=0.86,
        semantic_confidence_threshold_v49=0.58,
        semantic_blend_v49=0.08,
        semantic_reliability_threshold_v49=0.55,
        semantic_consolidation_lr_v49=0.18,
        semantic_key_latent_weight_v49=0.35,
        semantic_key_goal_weight_v49=1.0,
        semantic_contradiction_penalty_v49=0.35,
        semantic_min_cluster_variance_v49=0.28,
        semantic_action_coherence_threshold_v49=0.60,
        world_hidden_v49=24,
        world_learning_rate_v49=1e-3,
        world_latent_weight_v49=0.16,
        world_reward_weight_v49=0.03,
        world_risk_weight_v49=0.03,
        world_free_rollout_weight_v49=0.04,
        world_rollout_horizon_v49=6,
        world_candidate_count_v49=5,
        world_candidate_noise_v49=0.10,
        world_action_support_v49=0.20,
        world_admission_margin_v49=0.015,
        world_readiness_error_v49=0.34,
        world_readiness_observations_v49=20,
        world_readiness_decay_v49=0.94,
        online_world_updates_per_feedback_v49=2,
        runtime_state_version_v49=1,
    )


@dataclass
class SemanticPrototypeV49:
    signature: Tensor
    action: Tensor
    utility: float
    reliability: float
    recurrence_count: int
    source_steps: List[int]
    contradiction_count: int = 0
    last_seen_step: int = 0
    evidence_variance: float = 0.0
    semantic_key: Optional[Tensor] = None

    @property
    def confidence(self) -> float:
        recurrence_term = 1.0 - math.exp(-max(0, self.recurrence_count) / 3.0)
        reliability_term = max(0.0, min(1.0, self.reliability))
        contradiction_term = math.exp(-0.7 * max(0, self.contradiction_count))
        consistency_term = max(0.0, 1.0 - min(1.0, self.evidence_variance))
        return float(recurrence_term * reliability_term * contradiction_term * consistency_term)


class ComplementaryMemoryV49:
    """Fast episodic store + slow source-anchored semantic prototypes.

    Promotion is conservative: repeated, reliable, internally consistent episodes
    are required before a semantic prototype is created. Semantic entries retain
    source step ids so abstraction remains auditable rather than becoming a free
    floating summary.
    """

    def __init__(self, episodic: Optional[EpisodicMemoryV48] = None,
                 capacity: int = 24, top_k: int = 3,
                 recurrence_threshold: int = 3,
                 similarity_threshold: float = 0.90,
                 confidence_threshold: float = 0.58,
                 reliability_threshold: float = 0.55,
                 semantic_blend: float = 0.08,
                 consolidation_lr: float = 0.18,
                 contradiction_penalty: float = 0.35,
                 min_cluster_variance: float = 0.28,
                 action_coherence_threshold: float = 0.60):
        self.episodic = episodic or EpisodicMemoryV48()
        self.capacity = int(max(1, capacity))
        self.top_k = int(max(1, top_k))
        self.recurrence_threshold = int(max(2, recurrence_threshold))
        self.similarity_threshold = float(similarity_threshold)
        self.confidence_threshold = float(confidence_threshold)
        self.reliability_threshold = float(reliability_threshold)
        self.semantic_blend = float(semantic_blend)
        self.consolidation_lr = float(consolidation_lr)
        self.contradiction_penalty = float(contradiction_penalty)
        self.min_cluster_variance = float(min_cluster_variance)
        self.action_coherence_threshold = float(action_coherence_threshold)
        self.prototypes: List[SemanticPrototypeV49] = []
        self.semantic_keys: Dict[int, Tensor] = {}
        self.processed_semantic_steps: set[int] = set()
        self.consolidation_count = 0
        self.last_consolidated_step = -1

    def __len__(self) -> int:
        return len(self.episodic)

    def __iter__(self):
        return iter(self.episodic.items)

    @property
    def items(self) -> List[EpisodicMemoryItemV48]:
        return self.episodic.items

    def _nearest_prototype(self, signature: Tensor, semantic_key: Optional[Tensor] = None) -> Tuple[Optional[int], float]:
        if not self.prototypes:
            return None, -1.0
        source = semantic_key if semantic_key is not None else signature
        q = _norm(source.detach().reshape(1, -1).cpu())
        refs = []
        for p in self.prototypes:
            ref = p.semantic_key if p.semantic_key is not None else p.signature
            refs.append(_norm(ref.reshape(1, -1)).reshape(-1))
        refs = torch.stack(refs)
        sims = torch.matmul(q, refs.T).reshape(-1)
        idx = int(sims.argmax().item())
        return idx, float(sims[idx].item())

    def add(self, signature: Tensor, action: Tensor, reward: float = 0.0,
            factors: Optional[Tensor] = None, step_id: int = 0,
            risk: float = 0.0, prediction_error: float = 0.0,
            goal_relevance: float = 0.5, self_relevance: float = 0.5,
            semantic_key: Optional[Tensor] = None) -> int:
        before_steps = {int(i.step_id) for i in self.episodic.items}
        idx = self.episodic.add(
            signature, action, reward=reward, factors=factors, step_id=step_id,
            risk=risk, prediction_error=prediction_error,
            goal_relevance=goal_relevance, self_relevance=self_relevance,
        )
        if semantic_key is not None:
            self.semantic_keys[int(step_id)] = semantic_key.detach().reshape(-1).cpu().float()
        live_steps = {int(i.step_id) for i in self.episodic.items}
        for old_step in before_steps - live_steps:
            self.semantic_keys.pop(old_step, None)
        return idx

    def update_utility(self, *args, **kwargs) -> None:
        self.episodic.update_utility(*args, **kwargs)

    def _semantic_retrieve(self, signature: Tensor) -> Dict[str, Tensor]:
        if not self.prototypes:
            b = signature.size(0)
            return {
                "action_prior": signature.new_zeros(b, self.episodic.items[0].action.numel() if self.episodic.items else 0),
                "confidence": signature.new_zeros(b, 1),
                "similarity": signature.new_zeros(b, 0),
            }
        q = _norm(signature.detach())
        refs = torch.stack([_norm(p.signature).reshape(-1) for p in self.prototypes]).to(q)
        acts = torch.stack([p.action for p in self.prototypes]).to(q)
        conf = torch.tensor([p.confidence for p in self.prototypes], device=q.device, dtype=q.dtype)
        sims = torch.matmul(_norm(q), refs.T)
        k = min(self.top_k, refs.size(0))
        vals, idx = torch.topk(sims, k=k, dim=-1)
        selected_actions = acts[idx]
        selected_conf = conf[idx]
        logits = (vals / 0.15) + 1.5 * selected_conf
        weights = F.softmax(logits, dim=-1)
        prior = torch.einsum("bk,bka->ba", weights, selected_actions)
        confidence = (weights * selected_conf).sum(-1, keepdim=True)
        return {"action_prior": prior, "confidence": confidence, "similarity": vals}

    def retrieve(self, signature: Tensor) -> Dict[str, Tensor]:
        fast = self.episodic.retrieve(signature)
        slow = self._semantic_retrieve(signature)
        slow_conf = slow["confidence"]
        if fast["action_prior"].numel() == 0 and self.prototypes:
            gate = (slow_conf >= self.confidence_threshold).to(signature.dtype)
            weight = self.semantic_blend * gate
            return {
                "action_prior": (weight * slow["action_prior"]).clamp(-1.0, 1.0),
                "quality": signature.new_zeros(signature.size(0), 1),
                "similarity": slow["similarity"],
                "value_score": signature.new_zeros(signature.size(0), slow["similarity"].size(-1)),
                "reliability": slow_conf.clamp(0.0, 1.0),
                "semantic_action_prior_v49": slow["action_prior"],
                "semantic_confidence_v49": slow_conf,
                "semantic_similarity_v49": slow["similarity"],
            }
        if fast["action_prior"].numel() == 0:
            return fast
        gate = (slow_conf >= self.confidence_threshold).to(signature.dtype)
        weight = self.semantic_blend * gate
        prior = ((1.0 - weight) * fast["action_prior"] + weight * slow["action_prior"]).clamp(-1.0, 1.0)
        reliability = fast.get("reliability", signature.new_zeros(signature.size(0), 1))
        return {
            **fast,
            "action_prior": prior,
            "semantic_action_prior_v49": slow["action_prior"],
            "semantic_confidence_v49": slow_conf,
            "semantic_similarity_v49": slow["similarity"],
            "reliability": reliability.clamp(0.0, 1.0),
        }

    def _candidate_clusters(self) -> List[List[EpisodicMemoryItemV48]]:
        """Greedy source-anchored clustering over the current episodic store.

        Each episode is assigned once. Similarity is measured in the original
        signature space, keeping semantic promotion cheap and deterministic on
        mobile while allowing multiple semantic clusters to consolidate in one
        pass rather than only the newest cluster.
        """
        items = [i for i in self.episodic.items if i.signature.numel() > 0]
        if not items:
            return []
        # Use the same semantic key that will be stored in the slow memory.
        # Raw observations can vary substantially while the underlying goal/state
        # relation remains stable; clustering them would otherwise block true
        # fast->slow consolidation during continuous operation.
        refs_list = []
        for item in items:
            key = self.semantic_keys.get(int(item.step_id), item.signature)
            refs_list.append(_norm(key.reshape(1, -1)).reshape(-1))
        refs = torch.stack(refs_list)
        assigned = set()
        clusters: List[List[EpisodicMemoryItemV48]] = []
        for anchor_idx, anchor in enumerate(items):
            if anchor_idx in assigned:
                continue
            q = refs[anchor_idx]
            sims = torch.mv(refs, q)
            cluster_idx = [j for j, sim in enumerate(sims.tolist())
                           if j not in assigned and sim >= self.similarity_threshold]
            if len(cluster_idx) >= self.recurrence_threshold:
                cluster = [items[j] for j in cluster_idx]
                clusters.append(cluster)
                assigned.update(cluster_idx)
            else:
                assigned.add(anchor_idx)
        return clusters

    def _promote_cluster(self, cluster: List[EpisodicMemoryItemV48], step_id: int) -> bool:
        new_items = [i for i in cluster if int(i.step_id) not in self.processed_semantic_steps]
        if len(cluster) < self.recurrence_threshold or not new_items:
            return False
        rel = sum(max(0.0, min(1.0, float(i.reliability))) for i in cluster) / len(cluster)
        if rel < self.reliability_threshold:
            return False
        utilities = torch.tensor([float(i.utility) for i in cluster])
        variance = float(utilities.var(unbiased=False).item()) if len(cluster) > 1 else 0.0
        if float(utilities.max().item()) > 0.15 and float(utilities.min().item()) < -0.15:
            return False
        actions = torch.stack([i.action for i in cluster])
        mean_action = actions.mean(0)
        action_coherence = float(F.cosine_similarity(actions, mean_action.unsqueeze(0), dim=-1).mean().item())
        if action_coherence < self.action_coherence_threshold:
            return False
        sig = torch.stack([i.signature for i in cluster]).mean(0)
        cluster_keys = [self.semantic_keys.get(int(i.step_id), i.signature) for i in cluster]
        semantic_key = torch.stack(cluster_keys).mean(0)
        act = mean_action.clamp(-1.0, 1.0)
        util = float(utilities.mean().item())
        reliability = float(sum(i.reliability for i in cluster) / len(cluster))
        idx, similarity = self._nearest_prototype(sig, semantic_key=semantic_key)
        if idx is not None and similarity >= self.similarity_threshold:
            proto = self.prototypes[idx]
            sign_conflict = (proto.utility * util) < -0.15
            if sign_conflict:
                proto.contradiction_count += 1
                proto.reliability = max(0.0, proto.reliability - self.contradiction_penalty)
                proto.evidence_variance = min(1.0, 0.7 * proto.evidence_variance + 0.3 * variance)
                return False
            a = self.consolidation_lr
            proto.signature = ((1.0 - a) * proto.signature + a * sig).detach().cpu()
            proto.action = ((1.0 - a) * proto.action + a * act).detach().cpu().clamp(-1.0, 1.0)
            proto.utility = (1.0 - a) * proto.utility + a * util
            proto.reliability = (1.0 - a) * proto.reliability + a * reliability
            proto.recurrence_count += len(new_items)
            proto.source_steps = list(dict.fromkeys((proto.source_steps + [i.step_id for i in new_items])[-64:]))
            proto.last_seen_step = int(step_id)
            proto.evidence_variance = 0.8 * proto.evidence_variance + 0.2 * variance
            return True
        proto = SemanticPrototypeV49(
            signature=sig.detach().cpu(), action=act.detach().cpu(), utility=util,
            reliability=reliability, recurrence_count=len(cluster),
            source_steps=[i.step_id for i in cluster][-64:], last_seen_step=int(step_id),
            evidence_variance=variance, semantic_key=semantic_key.detach().cpu(),
        )
        self.prototypes.append(proto)
        if len(self.prototypes) > self.capacity:
            self.prototypes.sort(key=lambda p: p.confidence, reverse=True)
            self.prototypes = self.prototypes[:self.capacity]
        return True

    def consolidate(self, step_id: int = 0, force: bool = False) -> bool:
        if not self.episodic.items:
            return False
        if not force and self.last_consolidated_step == int(step_id):
            return False
        clusters = self._candidate_clusters()
        promoted = 0
        for cluster in clusters:
            if self._promote_cluster(cluster, int(step_id)):
                promoted += 1
            for item in cluster:
                self.processed_semantic_steps.add(int(item.step_id))
        if promoted == 0:
            self.last_consolidated_step = int(step_id)
            return False
        self.consolidation_count += promoted
        self.last_consolidated_step = int(step_id)
        return True

    def maybe_consolidate(self, step_id: int = 0) -> bool:
        return self.consolidate(step_id=step_id, force=False)

    def state_dict(self) -> Dict[str, Any]:
        return {
            "episodic": self.episodic.state_dict(),
            "capacity": self.capacity,
            "top_k": self.top_k,
            "recurrence_threshold": self.recurrence_threshold,
            "similarity_threshold": self.similarity_threshold,
            "confidence_threshold": self.confidence_threshold,
            "reliability_threshold": self.reliability_threshold,
            "semantic_blend": self.semantic_blend,
            "consolidation_lr": self.consolidation_lr,
            "contradiction_penalty": self.contradiction_penalty,
            "min_cluster_variance": self.min_cluster_variance,
            "prototypes": [asdict(p) for p in self.prototypes],
            "semantic_keys": {str(k): v.clone() for k,v in self.semantic_keys.items()},
            "consolidation_count": self.consolidation_count,
            "last_consolidated_step": self.last_consolidated_step,
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.capacity = int(state.get("capacity", self.capacity))
        self.top_k = int(state.get("top_k", self.top_k))
        self.recurrence_threshold = int(state.get("recurrence_threshold", self.recurrence_threshold))
        self.similarity_threshold = float(state.get("similarity_threshold", self.similarity_threshold))
        self.confidence_threshold = float(state.get("confidence_threshold", self.confidence_threshold))
        self.reliability_threshold = float(state.get("reliability_threshold", self.reliability_threshold))
        self.semantic_blend = float(state.get("semantic_blend", self.semantic_blend))
        self.consolidation_lr = float(state.get("consolidation_lr", self.consolidation_lr))
        self.contradiction_penalty = float(state.get("contradiction_penalty", self.contradiction_penalty))
        self.min_cluster_variance = float(state.get("min_cluster_variance", self.min_cluster_variance))
        if state.get("episodic") is not None:
            self.episodic.load_state_dict(state["episodic"])
        self.prototypes = [SemanticPrototypeV49(**x) for x in state.get("prototypes", [])]
        self.semantic_keys = {int(k): torch.as_tensor(v, dtype=torch.float32) for k,v in (state.get("semantic_keys") or {}).items()}
        self.consolidation_count = int(state.get("consolidation_count", 0))
        self.last_consolidated_step = int(state.get("last_consolidated_step", -1))

    def summary(self) -> Dict[str, float]:
        base = self.episodic.summary()
        confidences = [p.confidence for p in self.prototypes]
        return {
            **base,
            "semantic_items": float(len(self.prototypes)),
            "semantic_mean_confidence": float(sum(confidences) / len(confidences)) if confidences else 0.0,
            "consolidation_count": float(self.consolidation_count),
        }


class RecurrentLatentDynamicsV49(nn.Module):
    """Grounded recurrent latent transition model with reward/risk heads."""

    def __init__(self, latent_dim: int, action_dim: int, goal_latent_dim: int,
                 hidden: int = 28):
        super().__init__()
        self.latent_dim = int(latent_dim)
        self.action_dim = int(action_dim)
        self.goal_latent_dim = int(goal_latent_dim)
        self.hidden = int(hidden)
        self.input = nn.Sequential(
            nn.Linear(latent_dim + action_dim + goal_latent_dim, hidden), nn.SiLU(),
        )
        self.cell = nn.GRUCell(hidden, hidden)
        self.delta = nn.Sequential(nn.Linear(hidden + latent_dim, hidden), nn.SiLU(), nn.Linear(hidden, latent_dim))
        self.reward = nn.Sequential(nn.Linear(hidden + latent_dim + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1))
        self.risk = nn.Sequential(nn.Linear(hidden + latent_dim + action_dim, hidden), nn.SiLU(), nn.Linear(hidden, 1), nn.Sigmoid())
        self.confidence = nn.Sequential(nn.Linear(hidden + latent_dim, 1), nn.Sigmoid())

    def initial_hidden(self, batch: int, device=None, dtype=None) -> Tensor:
        return torch.zeros(batch, self.hidden, device=device, dtype=dtype)

    def step(self, latent: Tensor, action: Tensor, goal_latent: Tensor,
             hidden: Tensor) -> Dict[str, Tensor]:
        latent = latent.unsqueeze(0) if latent.ndim == 1 else latent
        action = action.unsqueeze(0) if action.ndim == 1 else action
        goal_latent = goal_latent.unsqueeze(0) if goal_latent.ndim == 1 else goal_latent
        hidden = hidden.unsqueeze(0) if hidden.ndim == 1 else hidden
        inp = self.input(torch.cat([latent, action, goal_latent], -1))
        next_hidden = self.cell(inp, hidden)
        delta = torch.tanh(self.delta(torch.cat([next_hidden, latent], -1)))
        pred = _norm(latent + 0.5 * delta)
        rr = self.reward(torch.cat([next_hidden, latent, action], -1))
        rk = self.risk(torch.cat([next_hidden, latent, action], -1))
        conf = self.confidence(torch.cat([next_hidden, pred], -1))
        return {"next_latent": pred, "reward": rr, "risk": rk, "confidence": conf, "hidden": next_hidden}

    def rollout(self, start_latent: Tensor, actions: Tensor, goal_latent: Tensor) -> Dict[str, Tensor]:
        if actions.ndim != 3:
            raise ValueError("actions must be [B,H,A]")
        hidden = self.initial_hidden(actions.size(0), actions.device, actions.dtype)
        latent = _norm(start_latent)
        latents = [latent]
        rewards = []
        risks = []
        confidences = []
        for h in range(actions.size(1)):
            out = self.step(latent, actions[:, h], goal_latent, hidden)
            latent = out["next_latent"]
            hidden = out["hidden"]
            latents.append(latent)
            rewards.append(out["reward"])
            risks.append(out["risk"])
            confidences.append(out["confidence"])
        return {
            "latents": torch.stack(latents, 1),
            "rewards": torch.stack(rewards, 1),
            "risks": torch.stack(risks, 1),
            "confidences": torch.stack(confidences, 1),
        }


class WorldModelReadinessV49:
    """Tracks grounded world-model reliability from held-out real transitions."""

    def __init__(self, threshold: float = 0.34, observations_needed: int = 20, decay: float = 0.94):
        self.threshold = float(threshold)
        self.observations_needed = int(max(1, observations_needed))
        self.decay = float(max(0.0, min(0.999, decay)))
        self.latent_error_ema = float("inf")
        self.reward_error_ema = float("inf")
        self.risk_error_ema = float("inf")
        self.observations = 0

    @property
    def ready(self) -> bool:
        return self.observations >= self.observations_needed and self.latent_error_ema <= self.threshold

    @property
    def score(self) -> float:
        if not math.isfinite(self.latent_error_ema):
            return 0.0
        return float(math.exp(-max(0.0, self.latent_error_ema)) * min(1.0, self.observations / max(1, self.observations_needed)))

    def update(self, latent_error: float, reward_error: float, risk_error: float) -> None:
        for name, value in (("latent_error_ema", latent_error), ("reward_error_ema", reward_error), ("risk_error_ema", risk_error)):
            old = getattr(self, name)
            if math.isfinite(old):
                value = self.decay * old + (1.0 - self.decay) * float(value)
            setattr(self, name, float(value))
        self.observations += 1

    def state_dict(self) -> Dict[str, Any]:
        return {
            "threshold": self.threshold,
            "observations_needed": self.observations_needed,
            "decay": self.decay,
            "latent_error_ema": self.latent_error_ema,
            "reward_error_ema": self.reward_error_ema,
            "risk_error_ema": self.risk_error_ema,
            "observations": self.observations,
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        self.threshold = float(state.get("threshold", self.threshold))
        self.observations_needed = int(state.get("observations_needed", self.observations_needed))
        self.decay = float(state.get("decay", self.decay))
        self.latent_error_ema = float(state.get("latent_error_ema", self.latent_error_ema))
        self.reward_error_ema = float(state.get("reward_error_ema", self.reward_error_ema))
        self.risk_error_ema = float(state.get("risk_error_ema", self.risk_error_ema))
        self.observations = int(state.get("observations", self.observations))


class LongHorizonLatentPlannerV49:
    """Compact action-sequence planner over the grounded recurrent dynamics."""

    def __init__(self, cfg: V49Config):
        self.cfg = cfg

    def _candidate_sequences(self, base: Tensor, horizon: int, count: int) -> Tensor:
        b, a = base.shape
        count = max(1, int(count))
        noise = torch.randn(b, count, horizon, a, device=base.device, dtype=base.dtype) * float(self.cfg.world_candidate_noise_v49)
        seq = base[:, None, None, :] + noise
        return seq.clamp(-1.0, 1.0)

    @torch.no_grad()
    def select(self, world_model: RecurrentLatentDynamicsV49,
               current_latent: Tensor, subgoal_latent: Tensor, base_action: Tensor,
               uncertainty: Tensor) -> Tuple[Tensor, Dict[str, Tensor]]:
        h = max(1, int(self.cfg.world_rollout_horizon_v49))
        candidates = self._candidate_sequences(base_action, h, self.cfg.world_candidate_count_v49)
        flat = candidates.reshape(-1, h, base_action.size(-1))
        cur = current_latent[:, None, :].expand(-1, candidates.size(1), -1).reshape(-1, current_latent.size(-1))
        goal = subgoal_latent[:, None, :].expand(-1, candidates.size(1), -1).reshape(-1, subgoal_latent.size(-1))
        pred = world_model.rollout(cur, flat, goal)
        endpoint = pred["latents"][:, -1].reshape(current_latent.size(0), candidates.size(1), -1)
        rewards = pred["rewards"].mean(1).reshape(current_latent.size(0), candidates.size(1), -1).squeeze(-1)
        risks = pred["risks"].mean(1).reshape(current_latent.size(0), candidates.size(1), -1).squeeze(-1)
        conf = pred["confidences"].mean(1).reshape(current_latent.size(0), candidates.size(1), -1).squeeze(-1)
        distance = 1.0 - F.cosine_similarity(endpoint, subgoal_latent[:, None, :], dim=-1)
        score = -distance + 0.06 * rewards - 0.16 * risks + 0.04 * conf - 0.02 * uncertainty.reshape(-1, 1)
        idx = score.argmax(1)
        action = candidates[torch.arange(current_latent.size(0), device=current_latent.device), idx, 0]
        # Constrain the first action to a small neighborhood around the known baseline.
        delta = (action - base_action).clamp(-float(self.cfg.world_action_support_v49), float(self.cfg.world_action_support_v49))
        action = (base_action + delta).clamp(-1.0, 1.0)
        meta = {
            "world49_score": score[torch.arange(score.size(0), device=score.device), idx].unsqueeze(-1),
            "world49_distance": distance[torch.arange(distance.size(0), device=distance.device), idx].unsqueeze(-1),
            "world49_confidence": conf[torch.arange(conf.size(0), device=conf.device), idx].unsqueeze(-1),
            "world49_risk": risks[torch.arange(risks.size(0), device=risks.device), idx].unsqueeze(-1),
            "world49_readiness_hint": conf.max(1, keepdim=True).values,
            "world49_horizon": current_latent.new_full((current_latent.size(0), 1), float(h)),
        }
        return action, meta


class WorldModelAdmissionGateV49:
    """Planner admission requires grounded readiness and predicted score margin."""

    def __init__(self, margin: float = 0.015):
        self.margin = float(margin)

    def select(self, proposed: Tensor, proposed_score: Tensor,
               baseline: Tensor, baseline_score: Tensor,
               readiness: WorldModelReadinessV49) -> Tuple[Tensor, Tensor]:
        score_delta = proposed_score - baseline_score
        ready = proposed.new_full((proposed.size(0), 1), 1.0 if readiness.ready else 0.0)
        accept = ((score_delta > self.margin).to(proposed.dtype) * ready)
        out = baseline + accept * (proposed - baseline)
        return out.clamp(-1.0, 1.0), accept


@dataclass
class TransitionEvidenceV49:
    step: int
    latent_error: float
    reward_error: float
    risk_error: float
    used_for_update: bool


class NeuroWeaveV49(NeuroWeaveV48):
    """V49 brain: fast/slow complementary memory + grounded recurrent world model."""

    def __init__(self, cfg: Optional[V49Config] = None):
        super().__init__(cfg or V49Config())
        self.cfg: V49Config
        self.world_model_v49 = RecurrentLatentDynamicsV49(
            latent_dim=self.cfg.latent_dim_v46,
            action_dim=self.cfg.action_dim,
            goal_latent_dim=self.cfg.latent_dim_v46,
            hidden=self.cfg.world_hidden_v49,
        )
        self.world_planner_v49 = LongHorizonLatentPlannerV49(self.cfg)
        self.world_gate_v49 = WorldModelAdmissionGateV49(self.cfg.world_admission_margin_v49)

    def create_memory(self) -> ComplementaryMemoryV49:
        episodic = EpisodicMemoryV48(
            capacity=self.cfg.memory_capacity_v46,
            top_k=max(self.cfg.memory_top_k_v46, 2),
            similarity_temperature=self.cfg.memory_similarity_temperature_v46,
            utility_temperature=self.cfg.memory_utility_temperature_v46,
        )
        return ComplementaryMemoryV49(
            episodic=episodic,
            capacity=self.cfg.semantic_capacity_v49,
            top_k=self.cfg.semantic_top_k_v49,
            recurrence_threshold=self.cfg.semantic_recurrence_threshold_v49,
            similarity_threshold=self.cfg.semantic_similarity_threshold_v49,
            confidence_threshold=self.cfg.semantic_confidence_threshold_v49,
            reliability_threshold=self.cfg.semantic_reliability_threshold_v49,
            semantic_blend=self.cfg.semantic_blend_v49,
            consolidation_lr=self.cfg.semantic_consolidation_lr_v49,
            contradiction_penalty=self.cfg.semantic_contradiction_penalty_v49,
            min_cluster_variance=self.cfg.semantic_min_cluster_variance_v49,
            action_coherence_threshold=self.cfg.semantic_action_coherence_threshold_v49,
        )

    @torch.no_grad()
    def step(self, x: Tensor, state: V47BrainState, goal=None,
             memory: Optional[Any] = None, world_readiness: Optional[WorldModelReadinessV49] = None,
             **kwargs):
        out48, state48 = super().step(x, state, goal=goal, memory=memory, **kwargs)
        if world_readiness is None:
            world_readiness = WorldModelReadinessV49(
                self.cfg.world_readiness_error_v49,
                self.cfg.world_readiness_observations_v49,
                self.cfg.world_readiness_decay_v49,
            )
        current = out48["brain_current_latent_v47"]
        subgoal = out48["brain_subgoal_v47"]
        base = out48["chosen_action_v48"]
        uncertainty = out48["brain_epistemic_uncertainty_v47"]
        proposed, wm_meta = self.world_planner_v49.select(
            self.world_model_v49, current, subgoal, base, uncertainty,
        )
        base_h = max(1, int(self.cfg.world_rollout_horizon_v49))
        base_seq = base.unsqueeze(1).expand(-1, base_h, -1)
        base_pred = self.world_model_v49.rollout(current, base_seq, subgoal)
        base_endpoint = base_pred["latents"][:, -1]
        base_distance = 1.0 - F.cosine_similarity(base_endpoint, subgoal, dim=-1)
        base_score = -base_distance + 0.04 * base_pred["rewards"].mean(1).squeeze(-1) - 0.12 * base_pred["risks"].mean(1).squeeze(-1)
        proposed_score = wm_meta["world49_score"]
        final, accepted = self.world_gate_v49.select(
            proposed, proposed_score, base, base_score.unsqueeze(-1), world_readiness,
        )
        out = dict(out48)
        out.update(wm_meta)
        out.update({
            "world49_proposed_action": proposed,
            "world49_base_score": base_score.unsqueeze(-1),
            "world49_admission": accepted,
            "world49_ready": x.new_full((x.size(0), 1), 1.0 if world_readiness.ready else 0.0),
            "world49_readiness_score": x.new_full((x.size(0), 1), world_readiness.score),
            "chosen_action_v49": final,
        })
        return out, state48

    def training_loss(self, out: Dict[str, Tensor], target_sequence=None, reward_sequence=None,
                      risk_sequence=None, **kwargs) -> Tensor:
        base = super().training_loss(out, target_sequence, reward_sequence, risk_sequence, **kwargs)
        if out["input_observation_v48"].size(1) < 2:
            return base
        obs = out["input_observation_v48"]
        goals = out["goal_sequence_v48"]
        current = out["brain_current_latent_v47"][:, :-1].detach()
        actions = out["chosen_action_v48"][:, :-1].detach()
        subgoals = out["brain_subgoal_v47"][:, :-1].detach()
        with torch.no_grad():
            flat_next_obs = obs[:, 1:].reshape(-1, obs.size(-1))
            flat_next_goal = goals[:, 1:].reshape(-1, goals.size(-1))
            target_next = _norm(self.target47(torch.cat([flat_next_obs, flat_next_goal], -1))).reshape(current.size(0), current.size(1), -1)
        hidden = self.world_model_v49.initial_hidden(current.size(0), current.device, current.dtype)
        losses_latent = []
        losses_reward = []
        losses_risk = []
        for t in range(current.size(1)):
            w = self.world_model_v49.step(current[:, t], actions[:, t], subgoals[:, t], hidden)
            hidden = w["hidden"]
            losses_latent.append(1.0 - F.cosine_similarity(w["next_latent"], target_next[:, t].detach(), dim=-1).mean())
            if reward_sequence is not None:
                rr = reward_sequence[:, t]
                if rr.ndim == 1: rr = rr.unsqueeze(-1)
                losses_reward.append(F.smooth_l1_loss(w["reward"], rr))
            if risk_sequence is not None:
                rk = risk_sequence[:, t]
                if rk.ndim == 1: rk = rk.unsqueeze(-1)
                losses_risk.append(F.binary_cross_entropy(w["risk"].clamp(1e-5,1-1e-5), rk.float().clamp(0,1)))
        latent_loss = torch.stack(losses_latent).mean()
        reward_loss = torch.stack(losses_reward).mean() if losses_reward else current.new_tensor(0.0)
        risk_loss = torch.stack(losses_risk).mean() if losses_risk else current.new_tensor(0.0)
        return base + (
            self.cfg.world_latent_weight_v49 * latent_loss
            + self.cfg.world_reward_weight_v49 * reward_loss
            + self.cfg.world_risk_weight_v49 * risk_loss
        )


class OrganismRuntimeV49:
    """V49 long-lived runtime with fast episodic/slow semantic memory and grounded transitions."""

    def __init__(self, model: NeuroWeaveV49, trainer: Optional["OrganismTrainerV49"] = None):
        self.model = model
        self.trainer = trainer
        self.memory = self._new_memory()
        self.state = model.initial_state(1)
        self.world_readiness = WorldModelReadinessV49(
            model.cfg.world_readiness_error_v49,
            model.cfg.world_readiness_observations_v49,
            model.cfg.world_readiness_decay_v49,
        )
        self._world_hidden = model.world_model_v49.initial_hidden(1)
        self._pending_world_hidden = self._world_hidden.clone()
        self.transition_evidence: List[TransitionEvidenceV49] = []
        self.events: List[Dict[str, Any]] = []
        self._pending_observation: Optional[Tensor] = None
        self._pending_goal: Optional[Tensor] = None
        self._pending_latent: Optional[Tensor] = None
        self._pending_subgoal: Optional[Tensor] = None
        self._pending_action: Optional[Tensor] = None
        self._pending_step: Optional[int] = None
        self._pending_predicted_reward: Optional[float] = None
        self._pending_predicted_risk: Optional[float] = None

    def _new_memory(self) -> ComplementaryMemoryV49:
        return self.model.create_memory()

    @torch.no_grad()
    def step(self, observation: Tensor, goal: Optional[Tensor] = None) -> Dict[str, Tensor]:
        if observation.ndim == 1:
            observation = observation.unsqueeze(0)
        out, next_state = self.model.step(
            observation, self.state, goal=goal, memory=self.memory,
            world_readiness=self.world_readiness,
        )
        self.state = next_state
        self._pending_observation = observation.detach().clone().cpu()
        self._pending_goal = self.model._goal47(goal, observation)[0].detach().clone().cpu()
        self._pending_latent = out["brain_current_latent_v47"][0].detach().cpu()
        self._pending_subgoal = out["brain_subgoal_v47"][0].detach().cpu()
        self._pending_action = out["chosen_action_v49"][0].detach().cpu()
        self._pending_step = int(self.state.step_index)
        self._pending_predicted_reward = float(out["brain_predicted_reward_v47"].mean().item())
        self._pending_world_hidden = self._world_hidden.detach().clone()
        with torch.no_grad():
            world_step = self.model.world_model_v49.step(
                self._pending_latent.to(observation),
                self._pending_action.to(observation),
                self._pending_subgoal.to(observation),
                self._pending_world_hidden.to(observation),
            )
            self._world_hidden = world_step["hidden"].detach()
        self._pending_predicted_risk = float(out["brain_predicted_risk_v47"].mean().item())
        self.events.append({
            "step": self._pending_step,
            "action": self._pending_action.tolist(),
            "world49_ready": float(out["world49_ready"].mean().item()),
            "world49_admission": float(out["world49_admission"].mean().item()),
        })
        self.events = self.events[-256:]
        return out

    def observe_transition(self, next_observation: Tensor, *, actual_reward: float,
                           actual_risk: float, goal: Optional[Tensor] = None,
                           update_world_model: bool = True) -> Dict[str, float]:
        if self._pending_latent is None or self._pending_action is None or self._pending_step is None:
            raise RuntimeError("observe_transition requires a prior step()")
        if next_observation.ndim == 1:
            next_observation = next_observation.unsqueeze(0)
        next_goal = self.model._goal47(goal, next_observation)
        with torch.no_grad():
            target = _norm(self.model.target47(torch.cat([next_observation, next_goal], -1)))
            pred = self.model.world_model_v49.step(
                self._pending_latent.to(next_observation),
                self._pending_action.to(next_observation),
                self._pending_subgoal.to(next_observation),
                self._pending_world_hidden.to(next_observation),
            )
            latent_error = float((1.0 - F.cosine_similarity(pred["next_latent"], target, dim=-1)).mean().item())
            reward_error = abs(float(pred["reward"].mean().item()) - float(actual_reward))
            risk_error = abs(float(pred["risk"].mean().item()) - float(actual_risk))
        used = False
        if update_world_model and self.trainer is not None:
            for _ in range(max(1, int(self.model.cfg.online_world_updates_per_feedback_v49))):
                self.trainer.online_world_update(
                    self._pending_latent.to(next_observation),
                    self._pending_action.to(next_observation),
                    self._pending_subgoal.to(next_observation),
                    target,
                    next_reward=float(actual_reward),
                    next_risk=float(actual_risk),
                    hidden=self._pending_world_hidden.to(next_observation),
                )
            used = True
            with torch.no_grad():
                pred2 = self.model.world_model_v49.step(
                    self._pending_latent.to(next_observation),
                    self._pending_action.to(next_observation),
                    self._pending_subgoal.to(next_observation),
                    self._pending_world_hidden.to(next_observation),
                )
                self._world_hidden = pred2["hidden"].detach()
                latent_error = float((1.0 - F.cosine_similarity(pred2["next_latent"], target, dim=-1)).mean().item())
                reward_error = abs(float(pred2["reward"].mean().item()) - float(actual_reward))
                risk_error = abs(float(pred2["risk"].mean().item()) - float(actual_risk))
        self.world_readiness.update(latent_error, reward_error, risk_error)
        utility = float(actual_reward) - 0.5 * float(actual_risk)
        factors = torch.tensor([
            min(2.0, latent_error),
            0.5,
            max(-1.0, min(1.0, utility)),
            0.5,
            max(-1.0, min(1.0, utility)),
            1.0,
            1.0,
        ], dtype=torch.float32)
        memory_signature = (
            torch.cat([self._pending_observation[0], self._pending_goal], -1)
            if self._pending_observation is not None and self._pending_goal is not None
            else torch.zeros(self.model.cfg.raw_observation_dim + self.model.cfg.goal_dim)
        )
        self.memory.add(
            memory_signature,
            self._pending_action,
            reward=utility,
            factors=factors,
            step_id=self._pending_step,
            risk=actual_risk,
            prediction_error=latent_error,
            semantic_key=(
                torch.cat([
                    float(self.model.cfg.semantic_key_latent_weight_v49) * self._pending_latent,
                    float(self.model.cfg.semantic_key_goal_weight_v49) * self._pending_goal,
                ])
                if self._pending_latent is not None and self._pending_goal is not None
                else (self._pending_latent if self._pending_latent is not None else None)
            ),
        )
        self.memory.update_utility(memory_signature, utility,
                                   lr=self.model.cfg.memory_reliability_lr_v48,
                                   decay=self.model.cfg.memory_utility_decay_v46,
                                   reliability=float(factors[5]))
        self.memory.maybe_consolidate(self._pending_step)
        ev = TransitionEvidenceV49(self._pending_step, latent_error, reward_error, risk_error, used)
        self.transition_evidence.append(ev)
        self.transition_evidence = self.transition_evidence[-256:]
        return {
            "latent_error": latent_error,
            "reward_error": reward_error,
            "risk_error": risk_error,
            "world_readiness_score": self.world_readiness.score,
            "world_ready": float(self.world_readiness.ready),
            "semantic_items": float(len(self.memory.prototypes)),
        }

    def state_dict(self) -> Dict[str, Any]:
        return {
            "memory": self.memory.state_dict(),
            "state": self.state.state_dict(),
            "world_readiness": self.world_readiness.state_dict(),
            "world_hidden": self._world_hidden,
            "pending_world_hidden": self._pending_world_hidden,
            "transition_evidence": [asdict(x) for x in self.transition_evidence],
            "events": self.events,
            "pending_observation": self._pending_observation,
            "pending_goal": self._pending_goal,
            "pending_latent": self._pending_latent,
            "pending_subgoal": self._pending_subgoal,
            "pending_action": self._pending_action,
            "pending_step": self._pending_step,
            "pending_predicted_reward": self._pending_predicted_reward,
            "pending_predicted_risk": self._pending_predicted_risk,
        }

    def load_state_dict(self, state: Dict[str, Any]) -> None:
        raw = state.get("state") or {}
        base_obj = raw.get("base_obj", self.model.initial_state(1).base)
        self.state = V47BrainState(
            base=base_obj,
            fast_hidden=raw.get("fast_hidden", self.model.brain47.initial_fast(1)),
            slow_hidden=raw.get("slow_hidden", self.model.brain47.initial_slow(1)),
            workspace=raw.get("workspace", self.model.brain47.initial_workspace(1)),
            last_action=raw.get("last_action", torch.zeros(1, self.model.cfg.action_dim)),
            step_index=int(raw.get("step_index", 0)),
        )
        if state.get("memory") is not None:
            self.memory.load_state_dict(state["memory"])
        if state.get("world_readiness") is not None:
            self.world_readiness.load_state_dict(state["world_readiness"])
        self._world_hidden = state.get("world_hidden", self.model.world_model_v49.initial_hidden(1))
        self._pending_world_hidden = state.get("pending_world_hidden", self._world_hidden.clone())
        self.transition_evidence = [TransitionEvidenceV49(**x) for x in state.get("transition_evidence", [])][-256:]
        self.events = list(state.get("events", []))[-256:]
        for name in (
            "_pending_observation", "_pending_goal", "_pending_latent", "_pending_subgoal",
            "_pending_action", "_pending_step", "_pending_predicted_reward", "_pending_predicted_risk",
        ):
            setattr(self, name, state.get(name))


class OrganismTrainerV49(OrganismTrainerV48):
    def __init__(self, model: NeuroWeaveV49, lr: float = 3e-4, warmup_steps: int = 4, external_verifier=None):
        super().__init__(model, lr=lr, warmup_steps=warmup_steps, external_verifier=external_verifier)
        self.model: NeuroWeaveV49
        self.world_optimizer_v49 = torch.optim.Adam(
            self.model.world_model_v49.parameters(), lr=self.model.cfg.world_learning_rate_v49
        )
        self.world_update_steps_v49 = 0

    def online_world_update(self, current_latent: Tensor, action: Tensor,
                            subgoal_latent: Tensor, target_latent: Tensor,
                            next_reward: float, next_risk: float, hidden: Optional[Tensor] = None) -> float:
        current_latent = current_latent.unsqueeze(0) if current_latent.ndim == 1 else current_latent
        action = action.unsqueeze(0) if action.ndim == 1 else action
        subgoal_latent = subgoal_latent.unsqueeze(0) if subgoal_latent.ndim == 1 else subgoal_latent
        target_latent = target_latent.unsqueeze(0) if target_latent.ndim == 1 else target_latent
        if hidden is None:
            hidden = self.model.world_model_v49.initial_hidden(current_latent.size(0), current_latent.device, current_latent.dtype)
        else:
            hidden = hidden.detach().to(device=current_latent.device, dtype=current_latent.dtype)
            if hidden.ndim == 1:
                hidden = hidden.unsqueeze(0)
        pred = self.model.world_model_v49.step(current_latent, action, subgoal_latent, hidden)
        target_reward = torch.full_like(pred["reward"], float(next_reward))
        target_risk = torch.full_like(pred["risk"], float(next_risk)).clamp(0.0, 1.0)
        latent_loss = (1.0 - F.cosine_similarity(pred["next_latent"], target_latent.detach(), dim=-1)).mean()
        reward_loss = F.smooth_l1_loss(pred["reward"], target_reward)
        risk_loss = F.binary_cross_entropy(pred["risk"].clamp(1e-5,1-1e-5), target_risk)
        loss = (
            self.model.cfg.world_latent_weight_v49 * latent_loss
            + self.model.cfg.world_reward_weight_v49 * reward_loss
            + self.model.cfg.world_risk_weight_v49 * risk_loss
        )
        self.world_optimizer_v49.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.model.world_model_v49.parameters(), 1.0)
        self.world_optimizer_v49.step()
        self.world_update_steps_v49 += 1
        return float(loss.detach().item())

    def step(self, x, goal_sequence=None, target_sequence=None, reward_sequence=None, risk_sequence=None, **kwargs):
        result = super().step(x, goal_sequence, target_sequence, reward_sequence, risk_sequence, **kwargs)
        with torch.no_grad():
            self.last_update_report.update({
                "v49_world_parameters": sum(p.numel() for p in self.model.world_model_v49.parameters() if p.requires_grad),
                "v49_world_update_steps": self.world_update_steps_v49,
            })
        return result


class RuntimeStateStoreV49(RuntimeStateStoreV48):
    VERSION = 1

    @classmethod
    def save(cls, path, model: NeuroWeaveV49, trainer: Optional[OrganismTrainerV49] = None,
             runtime: Optional[OrganismRuntimeV49] = None) -> None:
        RuntimeStateStoreV48.save(path, model, trainer, None)
        payload = torch.load(path, map_location="cpu", weights_only=False)
        payload["v49"] = {
            "world_model": model.world_model_v49.state_dict(),
            "world_optimizer": trainer.world_optimizer_v49.state_dict() if trainer is not None else None,
            "world_update_steps": trainer.world_update_steps_v49 if trainer is not None else 0,
            "runtime": runtime.state_dict() if runtime is not None else None,
        }
        payload["version_v49"] = cls.VERSION
        torch.save(payload, path)

    @classmethod
    def load(cls, path, model: NeuroWeaveV49, trainer: Optional[OrganismTrainerV49] = None,
             runtime: Optional[OrganismRuntimeV49] = None, device=None) -> Dict[str, Any]:
        payload = RuntimeStateStoreV48.load(path, model, trainer, None, device=device)
        v49 = payload.get("v49") or {}
        if v49.get("world_model") is not None:
            model.world_model_v49.load_state_dict(v49["world_model"])
        if trainer is not None:
            if v49.get("world_optimizer") is not None:
                trainer.world_optimizer_v49.load_state_dict(v49["world_optimizer"])
            trainer.world_update_steps_v49 = int(v49.get("world_update_steps", 0))
        if runtime is not None and v49.get("runtime") is not None:
            runtime.load_state_dict(v49["runtime"])
        return payload


__all__ = [
    "V49Config", "mobile_v49_config", "SemanticPrototypeV49", "ComplementaryMemoryV49",
    "RecurrentLatentDynamicsV49", "WorldModelReadinessV49", "LongHorizonLatentPlannerV49",
    "WorldModelAdmissionGateV49", "TransitionEvidenceV49", "NeuroWeaveV49",
    "OrganismRuntimeV49", "OrganismTrainerV49", "RuntimeStateStoreV49",
]
