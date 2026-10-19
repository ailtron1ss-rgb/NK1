from __future__ import annotations
import hashlib
import json
import math
import random
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from .governance_runtime import record_degraded_mode


FAMILIES = [
    "math", "program", "logic", "planning", "memory", "sequence", "vision", "audio",
    "general", "tool", "verification", "search",
]
FAMILY_TO_ID = {n: i for i, n in enumerate(FAMILIES)}


def stable_hash(text: str, buckets: int = 4096) -> int:
    return int(hashlib.blake2b(text.encode("utf-8"), digest_size=8).hexdigest(), 16) % buckets


def text_ids(text: str, length: int = 32, vocab: int = 4096) -> torch.Tensor:
    toks = text.lower().split()
    ids = [stable_hash(t, vocab) for t in toks[:length]]
    ids += [0] * (length - len(ids))
    return torch.tensor(ids, dtype=torch.long)


@dataclass
class BrainOutput:
    latent: torch.Tensor
    family_logits: torch.Tensor
    value: torch.Tensor
    novelty: torch.Tensor
    uncertainty: torch.Tensor

    def to_dict(self) -> Dict[str, Any]:
        return {
            "latent_shape": list(self.latent.shape),
            "family": int(self.family_logits.argmax(-1).item()) if self.family_logits.numel() else -1,
            "value": float(self.value.detach().mean()),
            "novelty": float(self.novelty.detach().mean()),
            "uncertainty": float(self.uncertainty.detach().mean()),
        }


class ResearchBrain(nn.Module):
    """Compact shared representation + policy/value heads.

    It is intentionally small and deterministic. The model can be trained on
    synthetic curricula before being trusted by the runtime.
    """
    def __init__(self, latent_dim: int = 64, hidden: int = 96, vocab: int = 4096):
        super().__init__()
        self.latent_dim = latent_dim
        self.vocab = vocab
        self.token = nn.Embedding(vocab, hidden)
        self.text_norm = nn.LayerNorm(hidden)
        self.image_proj = nn.Sequential(nn.Linear(32, hidden), nn.SiLU(), nn.Linear(hidden, hidden))
        self.audio_proj = nn.Sequential(nn.Linear(32, hidden), nn.SiLU(), nn.Linear(hidden, hidden))
        self.fuse = nn.Sequential(nn.LayerNorm(hidden * 3), nn.Linear(hidden * 3, hidden), nn.GELU(), nn.Linear(hidden, latent_dim))
        self.family_head = nn.Linear(latent_dim, len(FAMILIES))
        self.value_head = nn.Sequential(nn.LayerNorm(latent_dim), nn.Linear(latent_dim, hidden // 2), nn.SiLU(), nn.Linear(hidden // 2, 1), nn.Sigmoid())
        self.novelty_head = nn.Sequential(nn.Linear(latent_dim, hidden // 2), nn.SiLU(), nn.Linear(hidden // 2, 1), nn.Sigmoid())
        self.uncertainty_head = nn.Sequential(nn.Linear(latent_dim, hidden // 2), nn.SiLU(), nn.Linear(hidden // 2, 1), nn.Sigmoid())
        self.policy_head = nn.Linear(latent_dim, 8)
        self.world_action = nn.Embedding(8, latent_dim)
        self.world = nn.GRUCell(latent_dim * 2, latent_dim)
        self.world_value = nn.Sequential(nn.Linear(latent_dim, hidden // 2), nn.SiLU(), nn.Linear(hidden // 2, 1))

    def encode(self, token_batch: torch.Tensor, image: Optional[torch.Tensor] = None, audio: Optional[torch.Tensor] = None) -> torch.Tensor:
        t = self.text_norm(self.token(token_batch).mean(1))
        b = t.size(0)
        if image is None:
            i = torch.zeros(b, 32, device=t.device)
        else:
            i = image.to(t.device)
            if i.dim() == 1:
                i = i.unsqueeze(0)
            i = i.view(b, -1)
            if i.size(1) < 32:
                i = F.pad(i, (0, 32 - i.size(1)))
            i = i[:, :32]
        if audio is None:
            a = torch.zeros(b, 32, device=t.device)
        else:
            a = audio.to(t.device)
            if a.dim() == 1:
                a = a.unsqueeze(0)
            a = a.view(b, -1)
            if a.size(1) < 32:
                a = F.pad(a, (0, 32 - a.size(1)))
            a = a[:, :32]
        i = self.image_proj(i)
        a = self.audio_proj(a)
        return self.fuse(torch.cat([t, i, a], -1))

    def forward(self, token_batch: torch.Tensor, image: Optional[torch.Tensor] = None, audio: Optional[torch.Tensor] = None) -> BrainOutput:
        z = self.encode(token_batch, image, audio)
        fam = self.family_head(z)
        val = self.value_head(z)
        nov = self.novelty_head(z)
        unc = self.uncertainty_head(z)
        return BrainOutput(z, fam, val, nov, unc)

    def policy(self, latent: torch.Tensor) -> torch.Tensor:
        return F.softmax(self.policy_head(latent), dim=-1)

    def predict_world(self, latent: torch.Tensor, action: torch.Tensor, steps: int = 1) -> Tuple[torch.Tensor, torch.Tensor]:
        h = latent
        for _ in range(max(1, steps)):
            act = self.world_action(action)
            h = self.world(torch.cat([h, act], -1), h)
        return h, self.world_value(h).squeeze(-1)


class CurriculumFactory:
    def __init__(self, seed: int = 41):
        self.seed = seed
        self.rng = random.Random(seed)

    def sample(self, split: str = "train", count: int = 64) -> List[Dict[str, Any]]:
        local = random.Random(self.seed + (0 if split == "train" else 100003))
        out = []
        for _ in range(count):
            fam = local.choice(FAMILIES)
            difficulty = local.random()
            op = local.choice(["sum", "xor", "mul", "min", "max", "sub", "lt", "eq"]) if fam in {"math", "program", "logic"} else None
            text = self._text(fam, op, difficulty, local)
            prototype = torch.zeros(32)
            idx = FAMILY_TO_ID[fam]
            prototype[idx % 32] = 1.0
            if op:
                prototype[(idx + stable_hash(op, 20) + 1) % 32] = 0.75
            prototype += 0.05 * torch.randn(32, generator=torch.Generator().manual_seed(stable_hash(text)))
            out.append({"text": text, "family": fam, "family_id": idx, "difficulty": difficulty, "prototype": prototype, "op": op})
        return out

    def _text(self, fam: str, op: Optional[str], difficulty: float, rng: random.Random) -> str:
        if fam == "math": return f"compute {op or 'an expression'} with {2 + int(4*difficulty)} operands and verify the result"
        if fam == "program": return f"synthesize a small program for {op or 'a transformation'} and test it"
        if fam == "logic": return f"reason about a {op or 'logical'} relation and prove the result"
        if fam == "planning": return f"plan {2 + int(4*difficulty)} actions to reach a target while avoiding invalid moves"
        if fam == "memory": return "retrieve a relevant previous episode and decide whether it applies"
        if fam == "sequence": return "infer the rule behind a numeric sequence and predict the next value"
        if fam == "vision": return "inspect an image-like observation and classify the visible state"
        if fam == "audio": return "inspect an audio-like observation and classify the signal state"
        if fam == "tool": return "select a safe tool and execute a bounded operation"
        if fam == "verification": return "check a candidate solution and produce evidence"
        if fam == "search": return "search a compact hypothesis space for a verified construction"
        return "solve a general task with an adaptive reasoning budget"


class BrainTrainer:
    def __init__(self, model: ResearchBrain, lr: float = 3e-4, seed: int = 41):
        self.model = model
        self.seed = seed
        self.opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
        self.steps = 0

    def train_step(self, batch: Sequence[Dict[str, Any]]) -> Dict[str, float]:
        ids = torch.stack([text_ids(x["text"]) for x in batch])
        y = torch.tensor([x["family_id"] for x in batch], dtype=torch.long)
        proto = torch.stack([x["prototype"] for x in batch])
        diff = torch.tensor([x["difficulty"] for x in batch], dtype=torch.float32)
        out = self.model(ids)
        fam_loss = F.cross_entropy(out.family_logits, y)
        norm_z = F.normalize(out.latent, dim=-1)
        norm_p = F.normalize(proto, dim=-1)
        align_loss = (1.0 - (norm_z[:, :min(norm_z.size(1), norm_p.size(1))] * norm_p[:, :min(norm_z.size(1), norm_p.size(1))]).sum(-1)).mean()
        target_novelty = diff.clamp(0.05, 0.95)
        nov_loss = F.mse_loss(out.novelty.squeeze(-1), target_novelty)
        value_target = 1.0 - 0.6 * diff
        val_loss = F.mse_loss(out.value.squeeze(-1), value_target)
        action_target = torch.remainder(y, 8)
        policy_logits = self.model.policy_head(out.latent)
        policy_loss = F.cross_entropy(policy_logits, action_target)
        loss = fam_loss + 0.15 * align_loss + 0.10 * nov_loss + 0.15 * val_loss + 0.20 * policy_loss
        self.opt.zero_grad(set_to_none=True)
        loss.backward()
        nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
        self.opt.step()
        self.steps += 1
        return {"loss": float(loss.detach()), "family_acc": float((out.family_logits.argmax(-1) == y).float().mean()), "policy_acc": float((policy_logits.argmax(-1) == action_target).float().mean()), "align": float(align_loss.detach()), "step": self.steps}

    @torch.no_grad()
    def evaluate(self, batch: Sequence[Dict[str, Any]]) -> Dict[str, float]:
        self.model.eval()
        ids = torch.stack([text_ids(x["text"]) for x in batch])
        y = torch.tensor([x["family_id"] for x in batch], dtype=torch.long)
        out = self.model(ids)
        acc = float((out.family_logits.argmax(-1) == y).float().mean())
        policy_target = torch.remainder(y, 8)
        policy_acc = float((self.model.policy_head(out.latent).argmax(-1) == policy_target).float().mean())
        return {"family_acc": acc, "policy_acc": policy_acc, "value_mean": float(out.value.mean()), "novelty_mean": float(out.novelty.mean())}


class WorldModelTrainer:
    """Learns short-horizon action utility from synthetic/observed traces."""
    def __init__(self, model: ResearchBrain, lr: float = 5e-4):
        self.model = model
        self.opt = torch.optim.AdamW(list(model.world.parameters()) + list(model.world_action.parameters()) + list(model.world_value.parameters()), lr=lr)
        self.steps = 0

    def fit(self, samples: Sequence[Dict[str, Any]], epochs: int = 2) -> Dict[str, float]:
        if not samples:
            return {"loss": 0.0, "steps": self.steps}
        losses = []
        self.model.train()
        for _ in range(epochs):
            for s in samples:
                z = s["latent"].detach().float().view(1, -1)
                action = torch.tensor([int(s["action"]) % 8])
                target = torch.tensor([float(s["reward"])])
                _, pred = self.model.predict_world(z, action, steps=int(s.get("horizon", 1)))
                loss = F.mse_loss(pred, target)
                self.opt.zero_grad(set_to_none=True)
                loss.backward()
                nn.utils.clip_grad_norm_(list(self.model.world.parameters()) + list(self.model.world_action.parameters()) + list(self.model.world_value.parameters()), 1.0)
                self.opt.step()
                self.steps += 1
                losses.append(float(loss.detach()))
        return {"loss": sum(losses) / max(1, len(losses)), "steps": self.steps}


class ResearchCheckpoint:
    @staticmethod
    def save(path: Path, model: ResearchBrain, trainer: Optional[BrainTrainer] = None, extra: Optional[Dict[str, Any]] = None) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        torch.save({"model": model.state_dict(), "optimizer": trainer.opt.state_dict() if trainer else None, "steps": trainer.steps if trainer else 0, "extra": extra or {}}, path)

    @staticmethod
    def load(path: Path, model: ResearchBrain, trainer: Optional[BrainTrainer] = None) -> Dict[str, Any]:
        blob = torch.load(path, map_location="cpu", weights_only=False)
        model.load_state_dict(blob["model"], strict=True)
        if trainer is not None and blob.get("optimizer"):
            try: trainer.opt.load_state_dict(blob["optimizer"])
            except Exception as exc:
                record_degraded_mode("ResearchBrain", "OPTIMIZER_STATE_DEGRADED", exc)
            trainer.steps = int(blob.get("steps", 0))
        return dict(blob.get("extra") or {})


def parameter_report(model: nn.Module) -> Dict[str, Any]:
    params = sum(p.numel() for p in model.parameters())
    return {"parameters": params, "fp32_mb": round(params * 4 / 1e6, 4), "int8_mb": round(params / 1e6, 4), "int4_mb": round(params * 0.5 / 1e6, 4)}
