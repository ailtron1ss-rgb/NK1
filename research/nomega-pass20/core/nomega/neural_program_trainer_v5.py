from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Sequence, Tuple
import random
import time

import torch
import torch.nn as nn
import torch.nn.functional as F

from .neural_program_synth_v4 import AtomicProgramSynthesizerV4, AtomicProgramTrainReportV4, Program
from .generalist_core import stable_token


@dataclass
class AtomicProgramTrainReportV5:
    loss: float
    token_loss: float
    family_loss: float
    examples: int
    epochs: int
    steps: int
    batch_size: int
    wall_s: float
    samples_per_second: float
    scheduled_prefix_start: float
    scheduled_prefix_end: float
    scheduled_tokens: int
    teacher_forced_tokens: int


class AtomicProgramTrainerV5:
    """Atomic trainer with program-prefix scheduled sampling.

    The learner first rolls out a bounded prefix using the model's own previous
    predictions (without gradient through the discrete sampled tokens), then
    performs the normal masked teacher objective against the verified target.
    This directly reduces the train/inference prefix-distribution mismatch
    without using the executor or repair engine during inference.
    """

    def __init__(self, model: AtomicProgramSynthesizerV4, seed: int = 3501, lr: float = 8e-4):
        self.model = model
        self.seed = int(seed)
        self.steps = 0
        random.seed(self.seed)
        torch.manual_seed(self.seed)
        self.opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)

    def _prepare_batch(self, rows: Sequence[Tuple[str, Program, int]]):
        device = next(self.model.parameters()).device
        targets = []
        fam = []
        texts = []
        max_t = 1
        for text, code, fid in rows:
            target = self.model.instruction_vocab.encode(code[: self.model.max_len])
            if not target or target[-1] != self.model.instruction_vocab.halt_id:
                target = (target + [self.model.instruction_vocab.halt_id])[: self.model.max_len]
            targets.append(target)
            max_t = max(max_t, len(target))
            fam.append(int(fid) % self.model.family_count)
            texts.append(str(text))
        max_t = min(max_t, self.model.max_len)
        y = torch.full(
            (len(rows), max_t),
            self.model.instruction_vocab.halt_id,
            dtype=torch.long,
            device=device,
        )
        x_teacher = torch.full(
            (len(rows), max_t),
            self.model.instruction_vocab.bos_id,
            dtype=torch.long,
            device=device,
        )
        mask = torch.zeros((len(rows), max_t), dtype=torch.bool, device=device)
        for i, target in enumerate(targets):
            n = min(len(target), max_t)
            y[i, :n] = torch.tensor(target[:n], dtype=torch.long, device=device)
            if n > 1:
                x_teacher[i, 1:n] = y[i, : n - 1]
            mask[i, :n] = True

        if hasattr(self.model, "encode_text_batch"):
            base = self.model.encode_text_batch(texts)
        else:
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
            base = self.model.norm(w_base + self.model.char_proj(c_emb))

        family_y = torch.tensor(fam, dtype=torch.long, device=device)
        family_logits = self.model.family_head(base)
        pred_fam = torch.softmax(family_logits, -1) @ self.model.family.weight
        gold_fam = self.model.family(family_y)
        return texts, x_teacher, y, mask, base, family_logits, gold_fam, pred_fam, family_y

    def _decode_loss_logits(self, x: torch.Tensor, base: torch.Tensor, fam_vec: torch.Tensor) -> torch.Tensor:
        cond = (base + fam_vec).unsqueeze(1)
        emb = self.model._prefix_embed(x)
        pos = self.model.pos(torch.arange(x.size(1), device=x.device)).unsqueeze(0)
        mask = torch.triu(
            torch.full((x.size(1), x.size(1)), float("-inf"), device=x.device), diagonal=1
        )
        h = self.model.norm(self.model.decoder(emb + pos + cond, mask=mask))
        return self.model._joint_logits(h)

    @torch.no_grad()
    def _scheduled_prefix(
        self,
        x_teacher: torch.Tensor,
        y: torch.Tensor,
        base: torch.Tensor,
        fam_vec: torch.Tensor,
        probability: float,
        max_tokens: int,
    ) -> tuple[torch.Tensor, int, int]:
        """Generate a bounded self-conditioned prefix for each batch item."""
        p = float(max(0.0, min(1.0, probability)))
        if p <= 0.0 or x_teacher.size(1) <= 1:
            total = int(x_teacher[:, 1:].ne(self.model.instruction_vocab.bos_id).sum().item())
            return x_teacher.clone(), 0, total

        was_training = self.model.training
        self.model.eval()
        x = x_teacher.clone()
        scheduled_tokens = 0
        teacher_tokens = 0
        limit = min(max(1, int(max_tokens)), x.size(1) - 1)
        rng = random.Random(self.seed + self.steps * 1009 + x.size(0) * 17)

        for t in range(limit):
            # Do not waste compute on already-invalid padding rows.
            active = y[:, t].ne(self.model.instruction_vocab.halt_id) | (t == 0)
            prefix = x[:, : t + 1]
            logits = self._decode_loss_logits(prefix, base, fam_vec)[:, -1]
            pred = logits.argmax(-1)
            use_self = torch.tensor(
                [rng.random() < p for _ in range(x.size(0))],
                dtype=torch.bool,
                device=x.device,
            )
            use_self &= active
            next_gold = y[:, t]
            next_tok = torch.where(use_self, pred, next_gold)
            x[:, t + 1] = next_tok
            scheduled_tokens += int(use_self.sum().item())
            teacher_tokens += int(active.sum().item()) - int(use_self.sum().item())

        if was_training:
            self.model.train()
        return x, scheduled_tokens, teacher_tokens

    def _batch(
        self,
        rows: Sequence[Tuple[str, Program, int]],
        family_teacher_forcing: float = 1.0,
        scheduled_prefix_probability: float = 0.0,
        scheduled_max_tokens: int = 12,
    ):
        (
            _texts,
            x_teacher,
            y,
            mask,
            base,
            family_logits,
            gold_fam,
            pred_fam,
            family_y,
        ) = self._prepare_batch(rows)
        alpha = float(max(0.0, min(1.0, family_teacher_forcing)))
        fam_vec = alpha * gold_fam + (1.0 - alpha) * pred_fam
        x, scheduled_tokens, teacher_tokens = self._scheduled_prefix(
            x_teacher,
            y,
            base,
            fam_vec,
            scheduled_prefix_probability,
            scheduled_max_tokens,
        )
        logits = self._decode_loss_logits(x, base, fam_vec)
        return logits, y, mask, family_logits, family_y, scheduled_tokens, teacher_tokens

    def fit(
        self,
        rows: Sequence[Tuple[str, Program, int]],
        epochs: int = 16,
        batch_size: int = 8,
        max_examples: int = 128,
        family_weight: float = 0.2,
        family_teacher_forcing_start: float = 1.0,
        family_teacher_forcing_end: float = 0.0,
        scheduled_prefix_start: float = 0.0,
        scheduled_prefix_end: float = 0.35,
        scheduled_max_tokens: int = 12,
    ) -> AtomicProgramTrainReportV5:
        data = list(rows)[:max_examples]
        if not data:
            return AtomicProgramTrainReportV5(0.0, 0.0, 0.0, 0, 0, batch_size, 0.0, 0.0, scheduled_prefix_start, scheduled_prefix_end, 0, 0)
        rng = random.Random(self.seed)
        t0 = time.perf_counter()
        last = (0.0, 0.0, 0.0)
        steps = 0
        scheduled_total = 0
        teacher_total = 0
        self.model.train()
        E = max(1, int(epochs))
        for epoch in range(E):
            rng.shuffle(data)
            frac = epoch / max(1, E - 1)
            family_tf = family_teacher_forcing_start + frac * (family_teacher_forcing_end - family_teacher_forcing_start)
            scheduled_p = scheduled_prefix_start + frac * (scheduled_prefix_end - scheduled_prefix_start)
            for start in range(0, len(data), max(1, int(batch_size))):
                batch = data[start : start + max(1, int(batch_size))]
                (
                    logits,
                    y,
                    mask,
                    family_logits,
                    family_y,
                    scheduled_n,
                    teacher_n,
                ) = self._batch(
                    batch,
                    family_teacher_forcing=family_tf,
                    scheduled_prefix_probability=scheduled_p,
                    scheduled_max_tokens=scheduled_max_tokens,
                )
                token_loss_all = F.cross_entropy(logits.transpose(1, 2), y, reduction="none")
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
                scheduled_total += scheduled_n
                teacher_total += teacher_n
                last = (float(loss.detach()), float(token_loss.detach()), float(family_loss.detach()))
        wall = time.perf_counter() - t0
        return AtomicProgramTrainReportV5(
            loss=last[0],
            token_loss=last[1],
            family_loss=last[2],
            examples=len(data),
            epochs=E,
            steps=steps,
            batch_size=batch_size,
            wall_s=wall,
            samples_per_second=len(data) * E / max(wall, 1e-9),
            scheduled_prefix_start=float(scheduled_prefix_start),
            scheduled_prefix_end=float(scheduled_prefix_end),
            scheduled_tokens=int(scheduled_total),
            teacher_forced_tokens=int(teacher_total),
        )

    @staticmethod
    def save(path: Path, model: AtomicProgramSynthesizerV4, report: object | None = None):
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "architecture": model.checkpoint_signature(),
            "model": model.state_dict(),
            "state_digest": model.state_digest() if hasattr(model, "state_digest") else None,
            "trainer": "atomic_program_trainer_v5_scheduled_prefix",
            "report": asdict(report) if hasattr(report, "__dataclass_fields__") else report or {},
        }
        torch.save(payload, path)

    @staticmethod
    def load(path: Path):
        blob = torch.load(path, map_location="cpu", weights_only=False)
        a = dict(blob["architecture"])
        a.pop("version", None)
        a.pop("instruction_vocab_size", None)
        a.pop("output_parameterization", None)
        model_class = a.pop("model_class", None)
        model_map = {
            "core.nomega.neural_program_synth_v8.NeuralProgramSynthesizerV8": ".neural_program_synth_v8",
            "core.nomega.neural_program_synth_v9.NeuralProgramSynthesizerV9": ".neural_program_synth_v9",
            "core.nomega.neural_program_synth_v10.NeuralProgramSynthesizerV10": ".neural_program_synth_v10",
            "core.nomega.neural_program_synth_v11.NeuralProgramSynthesizerV11": ".neural_program_synth_v11",
            "core.nomega.neural_program_synth_v12.NeuralProgramSynthesizerV12": ".neural_program_synth_v12",
            "core.nomega.neural_program_synth_v13.NeuralProgramSynthesizerV13": ".neural_program_synth_v13",
        }
        if model_class in model_map:
            import importlib
            module = importlib.import_module(model_map[model_class], package=__package__)
            model_cls = getattr(module, model_class.rsplit(".", 1)[-1])
        else:
            model_cls = AtomicProgramSynthesizerV4
        model = model_cls(**a)
        model.load_state_dict(blob["model"])
        expected_digest = blob.get("state_digest")
        if expected_digest and hasattr(model, "state_digest"):
            actual_digest = model.state_digest()
            if actual_digest != expected_digest:
                raise ValueError(f"checkpoint state digest mismatch: {actual_digest} != {expected_digest}")
        return model, blob.get("report", {})
