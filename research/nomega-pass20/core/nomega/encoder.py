from __future__ import annotations
import hashlib
from typing import Dict, List
import torch
import torch.nn as nn

class TinyTextEncoder(nn.Module):
    """Byte/hashed-token encoder with no external tokenizer dependency."""
    def __init__(self, latent_dim: int = 96, buckets: int = 256):
        super().__init__()
        self.emb = nn.Embedding(buckets, latent_dim)
        self.norm = nn.LayerNorm(latent_dim)
        self.proj = nn.Sequential(nn.Linear(latent_dim, latent_dim), nn.SiLU(), nn.Linear(latent_dim, latent_dim))
    def forward(self, texts: List[str]) -> torch.Tensor:
        rows = []
        for text in texts:
            ids = []
            for tok in text.lower().split():
                h = hashlib.blake2b(tok.encode(), digest_size=4).digest()
                ids.append(int.from_bytes(h, "little") % self.emb.num_embeddings)
            if not ids:
                ids = [0]
            rows.append(torch.tensor(ids, dtype=torch.long, device=self.emb.weight.device))
        max_len = max(len(x) for x in rows)
        batch = torch.zeros(len(rows), max_len, dtype=torch.long, device=self.emb.weight.device)
        mask = torch.zeros_like(batch, dtype=torch.bool)
        for i, ids in enumerate(rows):
            batch[i, :len(ids)] = ids
            mask[i, :len(ids)] = True
        x = self.emb(batch)
        x = (x * mask.unsqueeze(-1)).sum(dim=1) / mask.sum(dim=1, keepdim=True).clamp(min=1)
        return self.proj(self.norm(x))
