from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple
import hashlib
import random
import time

import torch
import torch.nn as nn
import torch.nn.functional as F

from .generalist_core import stable_token
from .task_spec_v1 import FAMILY_TO_ID

Program = List[Tuple[int, int, int]]
OPS = 20
REGS = 4
BOS = -1
FAMILY_COUNT = len(FAMILY_TO_ID)


class InstructionVocabularyV1:
    """Finite vocabulary of semantically valid TinyVM instructions.

    The previous decoder factorized opcode/a/b independently, allowing the neural
    model to allocate probability mass to impossible combinations.  V4 predicts a
    single atomic instruction token from this constrained vocabulary.
    """

    def __init__(self, max_b: int = 64, max_len: int = 48):
        self.max_b = int(max_b)
        self.max_len = int(max_len)
        rows: List[Tuple[int, int, int]] = []
        rows.append((0, 0, 0))  # NOP
        rows.extend((1, a, b) for a in range(REGS) for b in range(self.max_b))
        rows.extend((2, a, b) for a in range(REGS) for b in range(self.max_b))
        for op in (3, 4, 5, 6, 7, 8, 9, 10, 15, 17, 18, 19):
            rows.extend((op, a, b) for a in range(REGS) for b in range(REGS))
        for op in (11, 12):  # bounded control-flow targets
            rows.extend((op, a, b) for a in range(REGS) for b in range(self.max_b))
        rows.extend((13, a, 0) for a in range(REGS))  # OUT
        rows.extend((16, a, 0) for a in range(REGS))  # NOT
        rows.append((14, 0, 0))  # HALT
        self.tokens = rows
        self.to_id = {tuple(x): i for i, x in enumerate(rows)}
        self.bos_id = len(rows)
        self.size = len(rows)

    def encode(self, code: Sequence[Tuple[int, int, int]]) -> List[int]:
        out: List[int] = []
        for op, a, b in code:
            op_i = int(op)
            b_i = int(b)
            if op_i in (0, 13, 14, 16):
                b_i = 0
            tok = (op_i, int(a) % REGS, b_i)
            if tok not in self.to_id:
                raise ValueError(f"unsupported/invalid instruction for V4 vocabulary: {tok}")
            out.append(self.to_id[tok])
        return out

    def decode(self, ids: Sequence[int]) -> Program:
        return [self.tokens[int(i)] for i in ids if int(i) < len(self.tokens)]

    @property
    def halt_id(self) -> int:
        return self.to_id[(14, 0, 0)]


@dataclass
class AtomicProgramTrainReportV4:
    loss: float
    token_loss: float
    family_loss: float
    examples: int
    epochs: int
    steps: int
    batch_size: int
    wall_s: float
    samples_per_second: float


class AtomicProgramSynthesizerV4(nn.Module):
    """Neural program synthesizer with atomic constrained instruction decoding."""

    version = "atomic-program-v4"

    def __init__(
        self,
        vocab: int = 2048,
        hidden: int = 64,
        latent_dim: int = 64,
        max_len: int = 48,
        max_b: int = 64,
        layers: int = 2,
        heads: int = 4,
        family_count: int = FAMILY_COUNT,
        char_buckets: int = 256,
        char_dim: int = 16,
    ):
        super().__init__()
        self.vocab = int(vocab)
        self.hidden = int(hidden)
        self.latent_dim = int(latent_dim)
        self.max_len = int(max_len)
        self.max_b = int(max_b)
        self.layers = int(layers)
        self.heads = int(heads)
        self.family_count = int(family_count)
        self.char_buckets = int(char_buckets)
        self.char_dim = int(char_dim)
        self.instruction_vocab = InstructionVocabularyV1(max_b=self.max_b, max_len=self.max_len)

        self.word = nn.Embedding(self.vocab, self.hidden, padding_idx=0)
        self.char = nn.Embedding(self.char_buckets, self.char_dim)
        self.char_proj = nn.Linear(self.char_dim, self.hidden)
        self.family = nn.Embedding(self.family_count, self.hidden)
        self.latent_proj = nn.Linear(self.latent_dim, self.hidden)
        self.pos = nn.Embedding(self.max_len, self.hidden)
        part = max(4, self.hidden // 4)
        self.op_emb = nn.Embedding(OPS + 1, part)
        self.a_emb = nn.Embedding(REGS + 1, part)
        self.b_emb = nn.Embedding(self.max_b + 1, part)
        self.prev_proj = nn.Linear(part * 3, self.hidden)
        self.bos = nn.Parameter(torch.zeros(self.hidden))
        self.family_head = nn.Linear(self.hidden, self.family_count)
        self.norm = nn.LayerNorm(self.hidden)
        layer = nn.TransformerEncoderLayer(
            d_model=self.hidden,
            nhead=self.heads,
            dim_feedforward=self.hidden * 3,
            batch_first=True,
            activation="gelu",
        )
        self.decoder = nn.TransformerEncoder(layer, num_layers=self.layers)
        # Factorized parameterization over the atomic vocabulary. The final logits are
        # sums of opcode/A/B logits only for combinations present in InstructionVocabularyV1.
        # This keeps the output space valid without paying for a dense 1098-way head.
        self.op_head = nn.Linear(self.hidden, OPS)
        self.a_head = nn.Linear(self.hidden, REGS)
        self.b_head = nn.Linear(self.hidden, self.max_b)
        self.register_buffer("token_op", torch.tensor([x[0] for x in self.instruction_vocab.tokens], dtype=torch.long))
        self.register_buffer("token_a", torch.tensor([x[1] for x in self.instruction_vocab.tokens], dtype=torch.long))
        self.register_buffer("token_b", torch.tensor([x[2] for x in self.instruction_vocab.tokens], dtype=torch.long))

    @staticmethod
    def _char_ids(text: str, buckets: int = 256, max_chars: int = 192) -> torch.Tensor:
        normalized = " ".join(str(text).lower().split())
        grams: List[int] = []
        padded = f"  {normalized}  "
        for n in (3, 4, 5):
            for i in range(max(0, len(padded) - n + 1)):
                g = padded[i:i + n].encode("utf-8")
                idx = int.from_bytes(hashlib.blake2b(g, digest_size=4).digest(), "little") % buckets
                grams.append(idx)
        if not grams:
            grams = [0]
        return torch.tensor(grams[:max_chars], dtype=torch.long)

    def _condition(self, text: str, family_id: Optional[int] = 0, latent: Optional[torch.Tensor] = None):
        word_ids = torch.tensor([stable_token(t, self.vocab) for t in str(text).lower().split()[:24]], dtype=torch.long)
        if word_ids.numel() == 0:
            word_ids = torch.zeros(1, dtype=torch.long)
        device = next(self.parameters()).device
        word_ids = word_ids.to(device)
        w = self.word(word_ids).mean(0, keepdim=True)
        cids = self._char_ids(text, self.char_buckets).to(device)
        c = self.char(cids).mean(0, keepdim=True)
        base = self.norm(w + self.char_proj(c))
        family_logits = self.family_head(base)
        if family_id is None:
            probs = torch.softmax(family_logits, dim=-1)
            fam_vec = probs @ self.family.weight
        else:
            fid = int(family_id) % self.family_count
            fam_vec = self.family(torch.tensor([fid], device=device))
        z = base + fam_vec
        if latent is not None:
            if latent.dim() == 1:
                latent = latent.unsqueeze(0)
            z = z + self.latent_proj(latent.float().to(device))
        return z.unsqueeze(1), family_logits

    def condition(self, text: str, family_id: Optional[int] = 0, latent: Optional[torch.Tensor] = None) -> torch.Tensor:
        z, _ = self._condition(text, family_id, latent)
        return z

    def _prefix_embed(self, prefix_ids: torch.Tensor) -> torch.Tensor:
        # prefix_ids: [B,T], BOS uses a learned vector; regular ids use structured parts.
        device = prefix_ids.device
        out = self.bos.view(1,1,-1).expand(prefix_ids.size(0), prefix_ids.size(1), -1).clone()
        regular = prefix_ids < self.instruction_vocab.bos_id
        if regular.any():
            clamped = prefix_ids.clamp(0, self.instruction_vocab.bos_id - 1)
            toks = torch.tensor(self.instruction_vocab.tokens, device=device, dtype=torch.long)
            tri = toks[clamped]
            parts = torch.cat([
                self.op_emb(tri[...,0]),
                self.a_emb(tri[...,1]),
                self.b_emb(tri[...,2]),
            ], dim=-1)
            structured = self.prev_proj(parts)
            out = torch.where(regular.unsqueeze(-1), structured, out)
        return out

    def _decode_prefix(self, prefix_ids: torch.Tensor, cond: torch.Tensor) -> torch.Tensor:
        emb = self._prefix_embed(prefix_ids)
        positions = torch.arange(prefix_ids.size(1), device=prefix_ids.device).unsqueeze(0)
        x = emb + self.pos(positions) + cond
        mask = torch.triu(torch.full((prefix_ids.size(1), prefix_ids.size(1)), float("-inf"), device=x.device), diagonal=1)
        return self.norm(self.decoder(x, mask=mask))

    def _joint_logits(self, h: torch.Tensor) -> torch.Tensor:
        op = self.op_head(h)
        a = self.a_head(h)
        b = self.b_head(h)
        return op[..., self.token_op] + a[..., self.token_a] + b[..., self.token_b]

    def forward_teacher(self, text: str, code: Program, family_id: Optional[int] = 0, latent: Optional[torch.Tensor] = None):
        device = next(self.parameters()).device
        cond, family_logits = self._condition(text, family_id, latent)
        target = self.instruction_vocab.encode(code[:self.max_len])
        if not target or target[-1] != self.instruction_vocab.halt_id:
            target = (target + [self.instruction_vocab.halt_id])[:self.max_len]
        inp = [self.instruction_vocab.bos_id] + target[:-1]
        ids = torch.tensor([inp], dtype=torch.long, device=device)
        h = self._decode_prefix(ids, cond)
        return {
            "logits": self._joint_logits(h),
            "target": torch.tensor(target, dtype=torch.long, device=device).unsqueeze(0),
            "family_logits": family_logits,
        }

    @torch.no_grad()
    def _generate_for_family(
        self, text: str, family_id: int, latent: Optional[torch.Tensor] = None,
        max_len: Optional[int] = None, beam_size: int = 1
    ) -> Tuple[Program, float]:
        self.eval()
        L = min(int(max_len or self.max_len), self.max_len)
        cond, _ = self._condition(text, family_id, latent)
        device = cond.device
        bos = self.instruction_vocab.bos_id
        if beam_size <= 1:
            seq = [bos]; score = 0.0
            for _ in range(L):
                ids = torch.tensor([seq], dtype=torch.long, device=device)
                h = self._decode_prefix(ids, cond)[:, -1]
                logp = F.log_softmax(self._joint_logits(h), dim=-1)[0]
                nxt = int(logp.argmax().item())
                score += float(logp[nxt].item())
                seq.append(nxt)
                if nxt == self.instruction_vocab.halt_id:
                    break
            ids = seq[1:]
            if self.instruction_vocab.halt_id not in ids:
                ids = ids[: max(1, L - 1)] + [self.instruction_vocab.halt_id]
            return self.instruction_vocab.decode(ids), score / max(1, len(ids))

        beams: List[Tuple[List[int], float, bool]] = [([bos], 0.0, False)]
        for _ in range(L):
            expanded: List[Tuple[List[int], float, bool]] = []
            for seq, score, done in beams:
                if done:
                    expanded.append((seq, score, done)); continue
                ids = torch.tensor([seq], dtype=torch.long, device=device)
                h = self._decode_prefix(ids, cond)[:, -1]
                logp = F.log_softmax(self._joint_logits(h), dim=-1)[0]
                k = min(int(beam_size), logp.numel())
                vals, idxs = torch.topk(logp, k)
                for val, idx in zip(vals.tolist(), idxs.tolist()):
                    nxt = int(idx); expanded.append((seq + [nxt], score + float(val), nxt == self.instruction_vocab.halt_id))
            expanded.sort(key=lambda x: x[1] / max(1, len(x[0]) - 1), reverse=True)
            beams = expanded[:max(1, int(beam_size))]
            if beams and all(done for _, _, done in beams): break
        best = max(beams, key=lambda x: x[1] / max(1, len(x[0]) - 1))
        ids = best[0][1:]
        if self.instruction_vocab.halt_id not in ids:
            ids = ids[: max(1, L - 1)] + [self.instruction_vocab.halt_id]
        return self.instruction_vocab.decode(ids), best[1] / max(1, len(ids))

    @torch.no_grad()
    def generate(
        self, text: str, family_id: Optional[int] = 0, latent: Optional[torch.Tensor] = None,
        max_len: Optional[int] = None, beam_size: int = 1, family_beam: int = 3
    ) -> Program:
        self.eval()
        if family_id is None:
            # Pure-neural semantic routing: retain top-k family hypotheses instead of
            # collapsing the uncertain family posterior to one class before synthesis.
            _, family_logits = self._condition(text, None, latent)
            k = min(max(1, int(family_beam)), self.family_count)
            fam_logp = F.log_softmax(family_logits[0], dim=-1)
            vals, ids = torch.topk(fam_logp, k)
            best_code: Program = []
            best_score = float('-inf')
            for val, fid in zip(vals.tolist(), ids.tolist()):
                code, program_score = self._generate_for_family(text, int(fid), latent, max_len, beam_size)
                joint = float(val) + float(program_score)
                if joint > best_score:
                    best_score = joint; best_code = code
            return best_code
        code, _ = self._generate_for_family(text, int(family_id), latent, max_len, beam_size)
        return code

    @torch.no_grad()
    def state_digest(self) -> str:
        """Deterministic digest over the complete serialized model state."""
        import hashlib
        h = hashlib.sha256()
        for name, tensor in sorted(self.state_dict().items()):
            h.update(name.encode("utf-8"))
            h.update(tensor.detach().cpu().contiguous().numpy().tobytes())
        return h.hexdigest()

    @torch.no_grad()
    def checkpoint_signature(self) -> Dict[str, int | str]:
        return {
            "version": self.version,
            "vocab": self.vocab,
            "hidden": self.hidden,
            "latent_dim": self.latent_dim,
            "max_len": self.max_len,
            "max_b": self.max_b,
            "layers": self.layers,
            "heads": self.heads,
            "family_count": self.family_count,
            "instruction_vocab_size": self.instruction_vocab.size,
            "output_parameterization": "factorized_atomic",
            "model_class": self.__class__.__module__ + "." + self.__class__.__name__,
        }


class AtomicProgramTrainerV4:
    def __init__(self, model: AtomicProgramSynthesizerV4, seed: int = 3401, lr: float = 8e-4):
        self.model = model
        self.seed = int(seed)
        self.steps = 0
        random.seed(self.seed)
        torch.manual_seed(self.seed)
        self.opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)

    def _batch(self, rows: Sequence[Tuple[str, Program, int]], family_teacher_forcing: float = 1.0):
        device = next(self.model.parameters()).device
        B = len(rows)
        targets: List[List[int]] = []
        fam: List[int] = []
        texts: List[str] = []
        max_t = 1
        for text, code, fid in rows:
            target = self.model.instruction_vocab.encode(code[:self.model.max_len])
            if not target or target[-1] != self.model.instruction_vocab.halt_id:
                target = (target + [self.model.instruction_vocab.halt_id])[:self.model.max_len]
            targets.append(target)
            max_t = max(max_t, len(target))
            fam.append(int(fid) % self.model.family_count)
            texts.append(str(text))
        max_t = min(max_t, self.model.max_len)
        y = torch.full((B, max_t), self.model.instruction_vocab.halt_id, dtype=torch.long, device=device)
        x = torch.full((B, max_t), self.model.instruction_vocab.bos_id, dtype=torch.long, device=device)
        mask = torch.zeros((B, max_t), dtype=torch.bool, device=device)
        for i, row in enumerate(targets):
            n = min(len(row), max_t)
            y[i, :n] = torch.tensor(row[:n], dtype=torch.long, device=device)
            if n > 1:
                x[i, 1:n] = y[i, :n - 1]
            mask[i, :n] = True
        word_ids = []
        char_lists = []
        for text in texts:
            ids = [stable_token(t, self.model.vocab) for t in text.lower().split()[:24]] or [0]
            word_ids.append(torch.tensor(ids, dtype=torch.long))
            char_lists.append(self.model._char_ids(text, self.model.char_buckets))
        w_pad = nn.utils.rnn.pad_sequence(word_ids, batch_first=True).to(device)
        w_mask = w_pad != 0
        w_emb = self.model.word(w_pad)
        w_den = w_mask.sum(-1, keepdim=True).clamp_min(1)
        w_base = (w_emb * w_mask.unsqueeze(-1)).sum(1) / w_den
        c_pad = nn.utils.rnn.pad_sequence(char_lists, batch_first=True).to(device)
        c_emb = self.model.char(c_pad).mean(1)
        if hasattr(self.model, 'encode_text_batch'):
            base = self.model.encode_text_batch(texts)
        else:
            base = self.model.norm(w_base + self.model.char_proj(c_emb))
        family_logits = self.model.family_head(base)
        pred_fam = torch.softmax(family_logits, -1) @ self.model.family.weight
        gold_fam = self.model.family(torch.tensor(fam, dtype=torch.long, device=device))
        alpha = float(max(0.0, min(1.0, family_teacher_forcing)))
        cond = (alpha * gold_fam + (1.0 - alpha) * pred_fam).unsqueeze(1)
        inp = self.model._prefix_embed(x)
        pos = self.model.pos(torch.arange(max_t, device=device)).unsqueeze(0)
        h = self.model.norm(self.model.decoder(inp + pos + cond, mask=torch.triu(torch.full((max_t, max_t), float("-inf"), device=device), diagonal=1)))
        logits = self.model._joint_logits(h)
        return logits, y, mask, family_logits, torch.tensor(fam, dtype=torch.long, device=device)

    def fit(
        self,
        rows: Sequence[Tuple[str, Program, int]],
        epochs: int = 16,
        batch_size: int = 8,
        max_examples: int = 128,
        family_weight: float = 0.2,
        family_teacher_forcing_start: float = 1.0,
        family_teacher_forcing_end: float = 0.0,
    ) -> AtomicProgramTrainReportV4:
        data = list(rows)[:max_examples]
        if not data:
            return AtomicProgramTrainReportV4(0.0, 0.0, 0.0, 0, 0, 0, batch_size, 0.0, 0.0)
        rng = random.Random(self.seed)
        t0 = time.perf_counter()
        last = (0.0, 0.0, 0.0)
        steps = 0
        self.model.train()
        for epoch in range(max(1, int(epochs))):
            rng.shuffle(data)
            frac = epoch / max(1, int(epochs) - 1)
            tf = family_teacher_forcing_start + frac * (family_teacher_forcing_end - family_teacher_forcing_start)
            for start in range(0, len(data), max(1, int(batch_size))):
                batch = data[start:start + max(1, int(batch_size))]
                logits, y, mask, family_logits, family_y = self._batch(batch, family_teacher_forcing=tf)
                token_loss_all = F.cross_entropy(logits.transpose(1, 2), y, reduction="none")
                # Crucial: no loss on artificial padded HALTs.
                token_weights = mask.float()
                token_loss = (token_loss_all * token_weights).sum() / token_weights.sum().clamp_min(1.0)
                family_loss = F.cross_entropy(family_logits, family_y)
                loss = token_loss + float(family_weight) * family_loss
                self.opt.zero_grad(set_to_none=True)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                self.opt.step()
                steps += 1
                self.steps += 1
                last = (float(loss.detach()), float(token_loss.detach()), float(family_loss.detach()))
        wall = time.perf_counter() - t0
        return AtomicProgramTrainReportV4(
            loss=last[0], token_loss=last[1], family_loss=last[2], examples=len(data),
            epochs=max(1, int(epochs)), steps=steps, batch_size=batch_size, wall_s=wall,
            samples_per_second=len(data) * max(1, int(epochs)) / max(wall, 1e-9),
        )

    @staticmethod
    def save(path: Path, model: AtomicProgramSynthesizerV4, report: object | None = None):
        path.parent.mkdir(parents=True, exist_ok=True)
        torch.save({"architecture": model.checkpoint_signature(), "model": model.state_dict(), "report": asdict(report) if hasattr(report, "__dataclass_fields__") else report or {}}, path)

    @staticmethod
    def load(path: Path):
        blob = torch.load(path, map_location="cpu", weights_only=False)
        a = dict(blob["architecture"])
        a.pop("version", None)
        a.pop("instruction_vocab_size", None)
        a.pop("output_parameterization", None)
        model_class=a.pop("model_class", None)
        if model_class == 'core.nomega.neural_program_synth_v8.NeuralProgramSynthesizerV8':
            from importlib import import_module
            NeuralProgramSynthesizerV8 = import_module("core.nomega." + "neural_program_synth_v8").NeuralProgramSynthesizerV8
            model_cls=NeuralProgramSynthesizerV8
        else:
            model_cls=AtomicProgramSynthesizerV4
        model = model_cls(**a)
        model.load_state_dict(blob["model"])
        return model, blob.get("report", {})
