from __future__ import annotations

from typing import Any, Dict, Optional, Sequence, Tuple
import re
import torch
import torch.nn as nn

from .neural_program_synth_v2 import NeuralProgramSynthesizerV2, Program
from .task_spec_v1 import FAMILY_ORDER, SEMANTIC_SCHEMA


class SemanticIRAdapterV1(nn.Module):
    """Learned encoding of non-concrete TaskSpec semantics.

    The adapter receives operator names, operand roles, output role, constraint
    keys and the abstract semantic sketch. It deliberately excludes concrete
    register allocation and does not execute programs.
    """
    def __init__(self, hidden: int, max_len: int = 32, layers: int = 1, heads: int = 2):
        super().__init__()
        vocab_items = ["<pad>", "<unk>"]
        for family in FAMILY_ORDER:
            meta = SEMANTIC_SCHEMA[family]
            items = list(meta.get("operators", ())) + list(meta.get("operand_refs", ()))
            items += [str(meta.get("output", "r0"))]
            items += [f"constraint:{k}" for k in sorted(meta.get("constraints", {}))]
            items += list(meta.get("sketch", ()))
            vocab_items.extend(items)
        self.token_to_id: Dict[str, int] = {}
        for item in vocab_items:
            if item not in self.token_to_id:
                self.token_to_id[item] = len(self.token_to_id)
        self.hidden = hidden
        self.max_len = max_len
        self.token = nn.Embedding(len(self.token_to_id), hidden, padding_idx=0)
        self.pos = nn.Embedding(max_len, hidden)
        enc = nn.TransformerEncoderLayer(d_model=hidden, nhead=heads, dim_feedforward=hidden * 2,
                                         batch_first=True, activation="gelu")
        self.encoder = nn.TransformerEncoder(enc, num_layers=layers)
        self.norm = nn.LayerNorm(hidden)

        rows = []
        for family in FAMILY_ORDER:
            meta = SEMANTIC_SCHEMA[family]
            items = list(meta.get("operators", ())) + list(meta.get("operand_refs", ()))
            items += [str(meta.get("output", "r0"))]
            items += [f"constraint:{k}" for k in sorted(meta.get("constraints", {}))]
            items += list(meta.get("sketch", ()))
            ids = [self.token_to_id.get(x, 1) for x in items][:max_len]
            ids += [0] * (max_len - len(ids))
            rows.append(ids)
        self.register_buffer("family_tokens", torch.tensor(rows, dtype=torch.long))

    def forward(self, family_ids: torch.Tensor) -> torch.Tensor:
        ids = self.family_tokens[family_ids]
        mask = ids == 0
        pos = self.pos(torch.arange(self.max_len, device=ids.device)).unsqueeze(0)
        h = self.encoder(self.token(ids) + pos, src_key_padding_mask=mask)
        valid = (~mask).unsqueeze(-1).float()
        pooled = (h * valid).sum(1) / valid.sum(1).clamp_min(1.0)
        return self.norm(pooled)


class NeuralProgramSynthesizerV5(NeuralProgramSynthesizerV2):
    """V5 neural decoder with learned TaskSpec Semantic-IR conditioning."""
    version = "semantic-ir-program-v5"

    def __init__(self, vocab: int = 2048, hidden: int = 64, latent_dim: int = 64,
                 max_len: int = 48, max_b: int = 64, layers: int = 2, heads: int = 4,
                 family_count: int = len(FAMILY_ORDER)):
        super().__init__(vocab=vocab, hidden=hidden, latent_dim=latent_dim, max_len=max_len,
                         max_b=max_b, layers=layers, heads=heads, family_count=family_count)
        self.semantic_ir = SemanticIRAdapterV1(hidden=hidden, max_len=32, layers=1, heads=max(1, min(2, heads)))
        self.semantic_gate = nn.Sequential(nn.Linear(hidden * 2, hidden), nn.GELU(), nn.Linear(hidden, hidden), nn.Sigmoid())

    def _condition_with_family(self, text: str, family_id: Optional[int] = 0, latent: Optional[torch.Tensor] = None):
        # Reuse V2's deterministic lexical encoder without depending on private helpers.
        from .generalist_core import encode_text
        device = next(self.parameters()).device
        tok_ids = encode_text(text, length=24, vocab=self.vocab).to(device).unsqueeze(0)
        base = self.text(tok_ids).mean(1)
        family_logits = self.family_head(base)
        if family_id is None:
            weights = torch.softmax(family_logits, dim=-1)
            all_ids = torch.arange(self.family_count, device=tok_ids.device)
            sem_all = self.semantic_ir(all_ids)
            fam_all = self.family(all_ids)
            fam_vec = weights @ fam_all
            sem_vec = weights @ sem_all
        else:
            fid = int(family_id) % self.family_count
            fid_tensor = torch.tensor([fid], device=tok_ids.device)
            fam_vec = self.family(fid_tensor)
            sem_vec = self.semantic_ir(fid_tensor)
        gate = self.semantic_gate(torch.cat([base, sem_vec], dim=-1))
        z = base + fam_vec + gate * sem_vec
        if latent is not None:
            if latent.dim() == 1:
                latent = latent.unsqueeze(0)
            z = z + self.latent_proj(latent.float().to(z.device))
        return z.unsqueeze(1), family_logits
