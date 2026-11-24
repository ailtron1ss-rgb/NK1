from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Sequence
import torch
import torch.nn as nn
import torch.nn.functional as F
from .generalist_core import encode_text

@dataclass
class ApexOutput:
    latent: torch.Tensor
    family_logits: torch.Tensor
    policy_logits: torch.Tensor
    value: torch.Tensor
    uncertainty: torch.Tensor
    route_logits: torch.Tensor

class ApexBrainV4(nn.Module):
    """Compact joint brain for routing, confidence and shared latent state.

    This is research code: outputs are useful signals, not calibrated probabilities.
    """
    def __init__(self, families: Sequence[str], latent_dim=64, hidden=96, vocab=2048, actions=8, modalities=3):
        super().__init__()
        self.families = list(families); self.family_to_id={f:i for i,f in enumerate(self.families)}
        self.latent_dim=latent_dim; self.hidden=hidden; self.vocab=vocab; self.actions=actions; self.modalities=modalities
        self.text = nn.Sequential(nn.Embedding(vocab, hidden), nn.LayerNorm(hidden))
        self.text_proj = nn.Linear(hidden, latent_dim)
        self.modality_proj = nn.ModuleList([nn.Linear(latent_dim, latent_dim) for _ in range(modalities)])
        self.fuse = nn.Sequential(nn.Linear(latent_dim*modalities, hidden), nn.SiLU(), nn.Linear(hidden, latent_dim), nn.LayerNorm(latent_dim))
        self.recur = nn.GRUCell(latent_dim, latent_dim)
        self.family = nn.Linear(latent_dim, len(self.families))
        self.policy = nn.Linear(latent_dim, actions)
        self.value = nn.Sequential(nn.Linear(latent_dim, hidden//2), nn.SiLU(), nn.Linear(hidden//2,1))
        self.uncertainty = nn.Sequential(nn.Linear(latent_dim, hidden//2), nn.SiLU(), nn.Linear(hidden//2,1), nn.Sigmoid())
        self.route = nn.Linear(latent_dim, actions)

    def encode_text(self, token_ids: torch.Tensor) -> torch.Tensor:
        # Guard compact/phone-sized vocabularies against external tokenizers with larger ids.
        token_ids = token_ids.long().remainder(self.vocab)
        h=self.text(token_ids)
        return self.text_proj(h.mean(dim=1))

    def forward(self, token_ids: torch.Tensor, modality_latents: Sequence[torch.Tensor]|None=None, recurrent_state: torch.Tensor|None=None) -> ApexOutput:
        zt=self.encode_text(token_ids)
        mods=[zt]
        if modality_latents is not None:
            mods += list(modality_latents)[: self.modalities-1]
        while len(mods)<self.modalities: mods.append(torch.zeros_like(zt))
        mods=[self.modality_proj[min(i,len(self.modality_proj)-1)](mods[i]) for i in range(self.modalities)]
        z=self.fuse(torch.cat(mods,dim=-1))
        if recurrent_state is not None:
            z=self.recur(z,recurrent_state)
        return ApexOutput(z,self.family(z),self.policy(z),self.value(z),self.uncertainty(z),self.route(z))

    def encode_modalities(self, text: torch.Tensor, vision: torch.Tensor, audio: torch.Tensor) -> torch.Tensor:
        out=self.forward(text,[vision,audio])
        return out.latent

    def consistency_loss(self, *latents: torch.Tensor) -> torch.Tensor:
        if len(latents)<2: return latents[0].new_zeros(()) if latents else torch.tensor(0.0)
        base=F.normalize(latents[0],dim=-1)
        vals=[1-F.cosine_similarity(base,F.normalize(x,dim=-1),dim=-1).mean() for x in latents[1:]]
        return torch.stack(vals).mean()

    def distill_loss(self, student: 'ApexBrainV4', token_ids: torch.Tensor) -> torch.Tensor:
        with torch.no_grad(): teacher=self(token_ids)
        student_out=student(token_ids)
        loss=F.kl_div(F.log_softmax(student_out.family_logits,dim=-1),F.softmax(teacher.family_logits,dim=-1),reduction='batchmean')
        loss+=F.mse_loss(student_out.value,teacher.value)
        return loss
