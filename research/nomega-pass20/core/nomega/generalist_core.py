from __future__ import annotations
import hashlib
import json
import random
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

from .task_generator import GeneratedTask, FAMILIES, make_tasks
from .governance_runtime import record_degraded_mode

FAMILY_TO_ID = {name: i for i, name in enumerate(FAMILIES)}


def stable_token(text: str, vocab: int) -> int:
    return int(hashlib.blake2b(text.encode('utf-8'), digest_size=8).hexdigest(), 16) % vocab


def encode_text(text: str, length: int = 32, vocab: int = 2048) -> torch.Tensor:
    toks = text.lower().split()
    ids = [stable_token(t, vocab) for t in toks[:length]]
    ids += [0] * max(0, length - len(ids))
    return torch.tensor(ids[:length], dtype=torch.long)


@dataclass
class GeneralistOutput:
    latent: torch.Tensor
    family_logits: torch.Tensor
    policy_logits: torch.Tensor
    value: torch.Tensor
    novelty: torch.Tensor
    uncertainty: torch.Tensor
    compute: torch.Tensor

    def summary(self) -> Dict[str, Any]:
        return {
            'family_id': int(self.family_logits.argmax(-1).item()),
            'policy_id': int(self.policy_logits.argmax(-1).item()),
            'value': float(self.value.detach().mean()),
            'novelty': float(self.novelty.detach().mean()),
            'uncertainty': float(self.uncertainty.detach().mean()),
            'compute': float(self.compute.detach().mean()),
            'latent_dim': int(self.latent.shape[-1]),
        }


class AdaptiveGeneralist(nn.Module):
    """Compact multi-head generalist intended for mobile-first executive guidance.

    It is deliberately a *controller*, not a foundation model. It predicts task
    family, action/expert policy, difficulty/value, novelty, uncertainty and a
    compute budget. The main runtime may consume these signals behind a gate.
    """
    def __init__(self, latent_dim: int = 96, hidden: int = 96, vocab: int = 2048, actions: int = 8):
        super().__init__()
        self.latent_dim = latent_dim
        self.hidden = hidden
        self.vocab = vocab
        self.actions = actions
        self.token = nn.Embedding(vocab, hidden)
        self.text_norm = nn.LayerNorm(hidden)
        self.image_proj = nn.Sequential(nn.Linear(32, hidden), nn.SiLU(), nn.Linear(hidden, hidden))
        self.audio_proj = nn.Sequential(nn.Linear(32, hidden), nn.SiLU(), nn.Linear(hidden, hidden))
        self.context_proj = nn.Sequential(nn.Linear(8, hidden), nn.SiLU(), nn.Linear(hidden, hidden))
        self.fuse = nn.Sequential(nn.LayerNorm(hidden * 4), nn.Linear(hidden * 4, hidden), nn.GELU(), nn.Linear(hidden, latent_dim))
        self.residual = nn.Sequential(nn.LayerNorm(latent_dim), nn.Linear(latent_dim, latent_dim * 2), nn.GLU(), nn.Linear(latent_dim, latent_dim))
        self.family_head = nn.Linear(latent_dim, len(FAMILIES))
        self.policy_head = nn.Sequential(nn.LayerNorm(latent_dim), nn.Linear(latent_dim, hidden), nn.SiLU(), nn.Linear(hidden, actions))
        self.value_head = nn.Sequential(nn.LayerNorm(latent_dim), nn.Linear(latent_dim, hidden // 2), nn.SiLU(), nn.Linear(hidden // 2, 1), nn.Sigmoid())
        self.novelty_head = nn.Sequential(nn.Linear(latent_dim, hidden // 2), nn.SiLU(), nn.Linear(hidden // 2, 1), nn.Sigmoid())
        self.uncertainty_head = nn.Sequential(nn.Linear(latent_dim, hidden // 2), nn.SiLU(), nn.Linear(hidden // 2, 1), nn.Sigmoid())
        self.compute_head = nn.Sequential(nn.Linear(latent_dim, hidden // 2), nn.SiLU(), nn.Linear(hidden // 2, 1), nn.Sigmoid())
        self.next_state = nn.GRUCell(latent_dim + actions, latent_dim)
        self.world_value = nn.Sequential(nn.Linear(latent_dim, hidden // 2), nn.SiLU(), nn.Linear(hidden // 2, 1))

    def encode(self, ids: torch.Tensor, image: Optional[torch.Tensor] = None, audio: Optional[torch.Tensor] = None, context: Optional[torch.Tensor] = None) -> torch.Tensor:
        t = self.text_norm(self.token(ids).mean(1))
        b = t.size(0)
        def prep(x: Optional[torch.Tensor]) -> torch.Tensor:
            if x is None:
                return torch.zeros(b, 32, device=t.device)
            x = x.to(t.device).float()
            if x.dim() == 1:
                x = x.unsqueeze(0)
            x = x.view(b, -1)
            if x.size(1) < 32:
                x = F.pad(x, (0, 32 - x.size(1)))
            return x[:, :32]
        i = self.image_proj(prep(image))
        a = self.audio_proj(prep(audio))
        if context is None:
            c = torch.zeros(b, 8, device=t.device)
        else:
            c = context.to(t.device).float()
            if c.dim() == 1:
                c = c.unsqueeze(0)
            if c.size(1) < 8:
                c = F.pad(c, (0, 8 - c.size(1)))
            c = c[:, :8]
        c = self.context_proj(c)
        z = self.fuse(torch.cat([t, i, a, c], -1))
        return z + 0.15 * self.residual(z)

    def forward(self, ids: torch.Tensor, image: Optional[torch.Tensor] = None, audio: Optional[torch.Tensor] = None, context: Optional[torch.Tensor] = None) -> GeneralistOutput:
        z = self.encode(ids, image, audio, context)
        return GeneralistOutput(
            latent=z,
            family_logits=self.family_head(z),
            policy_logits=self.policy_head(z),
            value=self.value_head(z),
            novelty=self.novelty_head(z),
            uncertainty=self.uncertainty_head(z),
            compute=self.compute_head(z),
        )

    def predict_next(self, latent: torch.Tensor, action: torch.Tensor) -> torch.Tensor:
        onehot = F.one_hot(action.long(), num_classes=self.actions).float().to(latent.device)
        return self.next_state(torch.cat([latent, onehot], -1), latent)


@dataclass
class ReplayItem:
    text: str
    family_id: int
    policy_id: int
    difficulty: float
    novelty: float
    weight: float = 1.0
    source: str = 'synthetic'


class PrioritizedReplay:
    def __init__(self, capacity: int = 2048, seed: int = 41):
        self.capacity = capacity
        self.rng = random.Random(seed)
        self.items: List[ReplayItem] = []

    def add(self, item: ReplayItem) -> None:
        self.items.append(item)
        if len(self.items) > self.capacity:
            self.items = self.items[-self.capacity:]

    def extend(self, items: Iterable[ReplayItem]) -> None:
        for x in items:
            self.add(x)

    def sample(self, n: int) -> List[ReplayItem]:
        if not self.items:
            return []
        n = min(n, len(self.items))
        weights = [max(1e-6, x.weight) for x in self.items]
        return self.rng.choices(self.items, weights=weights, k=n)

    def state_dict(self) -> Dict[str, Any]:
        return {'capacity': self.capacity, 'items': [asdict(x) for x in self.items]}

    def load_state_dict(self, blob: Dict[str, Any]) -> None:
        self.capacity = int(blob.get('capacity', self.capacity))
        self.items = [ReplayItem(**x) for x in blob.get('items', [])]


class FisherSnapshot:
    """Small diagonal Fisher-like importance estimate for anti-forgetting."""
    def __init__(self) -> None:
        self.params: Dict[str, torch.Tensor] = {}
        self.importance: Dict[str, torch.Tensor] = {}

    def capture(self, model: nn.Module, loader: Sequence[Tuple[torch.Tensor, torch.Tensor]]) -> None:
        self.params = {n: p.detach().clone() for n, p in model.named_parameters() if p.requires_grad}
        imp = {n: torch.zeros_like(p) for n, p in model.named_parameters() if p.requires_grad}
        if not loader:
            self.importance = imp
            return
        model.eval()
        for ids, y in loader:
            model.zero_grad(set_to_none=True)
            out = model(ids)
            loss = F.cross_entropy(out.family_logits, y)
            loss.backward()
            for n, p in model.named_parameters():
                if p.grad is not None and n in imp:
                    imp[n] += p.grad.detach().pow(2)
        self.importance = {n: v / max(1, len(loader)) for n, v in imp.items()}

    def penalty(self, model: nn.Module, strength: float = 0.05) -> torch.Tensor:
        if not self.params:
            return torch.zeros((), device=next(model.parameters()).device)
        total = torch.zeros((), device=next(model.parameters()).device)
        for n, p in model.named_parameters():
            if n in self.params and n in self.importance:
                total = total + (self.importance[n].to(p.device) * (p - self.params[n].to(p.device)).pow(2)).mean()
        return strength * total


class GeneralistTrainer:
    def __init__(self, model: AdaptiveGeneralist, lr: float = 3e-4, seed: int = 41):
        self.model = model
        self.opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
        self.seed = seed
        self.steps = 0
        self.replay = PrioritizedReplay(seed=seed)
        self.anchors = FisherSnapshot()

    def _batch(self, rows: Sequence[GeneratedTask | ReplayItem]):
        ids = torch.stack([encode_text(x.text, vocab=self.model.vocab) for x in rows])
        family = torch.tensor([FAMILY_TO_ID[x.family] if isinstance(x, GeneratedTask) else int(x.family_id) for x in rows], dtype=torch.long)
        difficulty = torch.tensor([float(x.difficulty) if isinstance(x, GeneratedTask) else float(x.difficulty) for x in rows])
        novelty = torch.tensor([0.25 + 0.70 * float(x.difficulty) if isinstance(x, GeneratedTask) else float(x.novelty) for x in rows])
        policy = []
        for x in rows:
            fam = x.family if isinstance(x, GeneratedTask) else FAMILIES[int(x.family_id)]
            # Stable action mapping: groups of computational strategies.
            policy.append({'sum3': 0, 'xor3': 1, 'dot2': 2, 'clamp': 0, 'parity': 1, 'max3': 0, 'min3': 0,
                           'sequence_inc': 3, 'sequence_diff': 3, 'program_sum': 4, 'program_xor': 4,
                           'program_mul': 4}.get(fam, {'math': 0, 'program': 4, 'logic': 1, 'planning': 3, 'memory': 5,
                                                        'sequence': 3, 'vision': 6, 'audio': 7, 'tool': 6, 'verification': 2,
                                                        'search': 3, 'general': 0}.get(fam, 0)))
        return ids, family, torch.tensor(policy), difficulty.clamp(0.01, 0.99), novelty.clamp(0.01, 0.99)

    def train_step(self, rows: Sequence[GeneratedTask | ReplayItem]) -> Dict[str, float]:
        if not rows:
            return {'loss': 0.0, 'step': self.steps}
        ids, family, policy, difficulty, novelty = self._batch(rows)
        self.model.train()
        out = self.model(ids)
        value_target = 1.0 - 0.60 * difficulty
        uncertainty_target = 0.20 + 0.65 * difficulty
        compute_target = (0.25 + 0.70 * difficulty).clamp(0.05, 0.98)
        loss_family = F.cross_entropy(out.family_logits, family)
        loss_policy = F.cross_entropy(out.policy_logits, policy)
        loss_value = F.mse_loss(out.value.squeeze(-1), value_target)
        loss_novelty = F.mse_loss(out.novelty.squeeze(-1), novelty)
        loss_unc = F.mse_loss(out.uncertainty.squeeze(-1), uncertainty_target)
        loss_compute = F.mse_loss(out.compute.squeeze(-1), compute_target)
        loss = loss_family + 0.55*loss_policy + 0.15*loss_value + 0.12*loss_novelty + 0.12*loss_unc + 0.10*loss_compute
        loss = loss + self.anchors.penalty(self.model, strength=0.08)
        self.opt.zero_grad(set_to_none=True)
        loss.backward()
        nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
        self.opt.step(); self.steps += 1
        with torch.no_grad():
            fam_acc = (out.family_logits.argmax(-1) == family).float().mean().item()
            pol_acc = (out.policy_logits.argmax(-1) == policy).float().mean().item()
        return {'loss': float(loss.detach()), 'family_acc': fam_acc, 'policy_acc': pol_acc, 'step': self.steps}

    @torch.no_grad()
    def evaluate(self, rows: Sequence[GeneratedTask | ReplayItem]) -> Dict[str, float]:
        if not rows:
            return {'family_acc': 0.0, 'policy_acc': 0.0, 'value_mae': 1.0, 'uncertainty_mae': 1.0}
        ids, family, policy, difficulty, _ = self._batch(rows)
        self.model.eval(); out = self.model(ids)
        value_target = 1.0 - 0.60 * difficulty
        unc_target = 0.20 + 0.65 * difficulty
        return {
            'family_acc': float((out.family_logits.argmax(-1) == family).float().mean()),
            'policy_acc': float((out.policy_logits.argmax(-1) == policy).float().mean()),
            'value_mae': float((out.value.squeeze(-1) - value_target).abs().mean()),
            'uncertainty_mae': float((out.uncertainty.squeeze(-1) - unc_target).abs().mean()),
        }

    def freeze_anchor(self, rows: Sequence[GeneratedTask | ReplayItem]) -> None:
        ids, family, _, _, _ = self._batch(rows)
        self.anchors.capture(self.model, [(ids[i:i+1], family[i:i+1]) for i in range(ids.size(0))])


class GeneralistCheckpoint:
    @staticmethod
    def save(path: Path, model: AdaptiveGeneralist, trainer: Optional[GeneralistTrainer] = None, extra: Optional[Dict[str, Any]] = None) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        torch.save({
            'model': model.state_dict(),
            'optimizer': trainer.opt.state_dict() if trainer else None,
            'steps': trainer.steps if trainer else 0,
            'architecture': {'latent_dim': model.latent_dim, 'hidden': model.hidden, 'vocab': model.vocab, 'actions': model.actions},
            'extra': extra or {},
            'version': '1.0.0',
        }, path)

    @staticmethod
    def load(path: Path, trainer: Optional[GeneralistTrainer] = None) -> Tuple[AdaptiveGeneralist, Dict[str, Any]]:
        blob = torch.load(path, map_location='cpu', weights_only=False)
        arch = dict(blob.get('architecture') or {})
        model = AdaptiveGeneralist(**arch)
        model.load_state_dict(blob['model'], strict=True)
        if trainer is not None and blob.get('optimizer'):
            try:
                trainer.opt.load_state_dict(blob['optimizer'])
                trainer.steps = int(blob.get('steps', 0))
            except Exception as exc:
                record_degraded_mode("GeneralistCheckpoint", "OPTIMIZER_STATE_DEGRADED", exc, checkpoint=str(p) if "p" in locals() else "unknown")
        return model, dict(blob.get('extra') or {})


def model_report(model: nn.Module) -> Dict[str, Any]:
    params = sum(p.numel() for p in model.parameters())
    return {
        'parameters': params,
        'fp32_mb': params * 4 / 1e6,
        'int8_mb_est': params / 1e6,
        'int4_mb_est': params * 0.5 / 1e6,
    }
