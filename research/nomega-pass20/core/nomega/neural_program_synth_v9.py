from __future__ import annotations

"""Research candidate: V8 ordered encoder + explicit typed semantic sketch fusion."""
import hashlib
from typing import List, Optional
import torch
import torch.nn as nn

from .neural_program_synth_v8 import NeuralProgramSynthesizerV8
from .task_spec_v1 import parse_task_spec
from .program_ir_v1 import from_task_spec


class NeuralProgramSynthesizerV9(NeuralProgramSynthesizerV8):
    version = "typed-sketch-fusion-v9"

    def __init__(self, *args, sketch_buckets: int = 512, **kwargs):
        super().__init__(*args, **kwargs)
        self.sketch_buckets = int(sketch_buckets)
        sem_dim = max(16, self.hidden // 2)
        self.semantic_operator = nn.Embedding(16, sem_dim)
        self.semantic_operand = nn.Embedding(32, sem_dim)
        self.semantic_token = nn.Embedding(self.sketch_buckets, sem_dim)
        self.semantic_proj = nn.Linear(sem_dim * 3, self.hidden)
        self.semantic_norm = nn.LayerNorm(self.hidden)
        self.semantic_decode_constrained = True
        self._active_token_mask = None

    @staticmethod
    def _bucket(value: str, buckets: int) -> int:
        return int.from_bytes(hashlib.blake2b(value.encode("utf-8"), digest_size=4).digest(), "little") % buckets

    def _semantic_vector(self, texts: List[str], device: torch.device) -> torch.Tensor:
        out = []
        op_names = {name: idx for idx, name in enumerate(("ADD","SUB","MUL","XOR","MIN","MAX","MOD","CLAMP","PARITY","LOOP"))}
        for text in texts:
            spec = parse_task_spec(text)
            if not spec.semantic_valid:
                out.append(torch.zeros(self.hidden, device=device))
                continue
            sketch = from_task_spec(spec)
            op_ids = torch.tensor([op_names.get(x, 0) for x in sketch.operators], dtype=torch.long, device=device)
            op_vec = self.semantic_operator(op_ids).mean(0)
            role_ids = [self._bucket(role, 32) for role in sketch.operand_refs]
            role_vec = self.semantic_operand(torch.tensor(role_ids or [0], dtype=torch.long, device=device)).mean(0)
            token_ids = [self._bucket(tok, self.sketch_buckets) for tok in sketch.sketch]
            token_vec = self.semantic_token(torch.tensor(token_ids or [0], dtype=torch.long, device=device)).mean(0)
            fused = self.semantic_norm(self.semantic_proj(torch.cat([op_vec, role_vec, token_vec], dim=-1)))
            out.append(fused)
        return torch.stack(out, 0)

    def _semantic_opcode_mask(self, text: str, device: torch.device) -> torch.Tensor:
        """Mask impossible opcode families during neural decoding.

        Loads/control/output remain available to every task. Semantic operators add
        the exact TinyVM opcodes observed in the governed acquisition DSL; helper
        opcodes stay enabled for bounded MOD/PARITY/LOOP implementations.
        """
        spec = parse_task_spec(text)
        allowed = {0, 1, 2, 13, 14}
        semantic_to_opcode = {
            "ADD": {3}, "SUB": {4}, "XOR": {5}, "MUL": {15},
            "MIN": {17}, "MAX": {18},
        }
        if spec.semantic_valid:
            for op in spec.operators:
                allowed.update(semantic_to_opcode.get(op, set()))
            if any(x in spec.operators for x in ("CLAMP", "MOD", "PARITY", "LOOP")):
                allowed.update({3,4,5,6,9,10,11,12,15,16,17,18})
        token_op = self.token_op.to(device)
        return torch.tensor([int(int(op.item()) in allowed) for op in token_op], dtype=torch.bool, device=device)

    def _joint_logits(self, h: torch.Tensor) -> torch.Tensor:
        logits = super()._joint_logits(h)
        mask = self._active_token_mask
        if mask is not None:
            logits = logits.masked_fill(~mask.view(1, -1), -1e9)
        return logits

    def encode_text_batch(self, texts):
        base = super().encode_text_batch(texts)
        sem = self._semantic_vector(list(texts), base.device)
        return base + sem

    def _generate_for_family(self, text: str, family_id: int, latent=None, max_len=None, beam_size: int = 1):
        previous = self._active_token_mask
        try:
            self._active_token_mask = self._semantic_opcode_mask(text, next(self.parameters()).device) if self.semantic_decode_constrained else None
            return super()._generate_for_family(text, family_id, latent, max_len, beam_size)
        finally:
            self._active_token_mask = previous

    def _condition(self, text: str, family_id: Optional[int] = 0, latent=None):
        base = self.encode_text_batch([text])
        family_logits = self.family_head(base)
        if family_id is None:
            weights = torch.softmax(family_logits, dim=-1)
            fam_vec = weights @ self.family.weight
        else:
            fid = int(family_id) % self.family_count
            fam_vec = self.family(torch.tensor([fid], device=base.device))
        z = base + fam_vec
        if latent is not None:
            if latent.dim() == 1:
                latent = latent.unsqueeze(0)
            z = z + self.latent_proj(latent.float().to(z.device))
        return z.unsqueeze(1), family_logits
