from __future__ import annotations

"""V10 research synthesizer: candidate portfolio generation + semantic plan scoring."""
from typing import List, Optional, Tuple
import math
import torch
import torch.nn.functional as F

from .neural_program_synth_v9 import NeuralProgramSynthesizerV9
from .task_spec_v1 import parse_task_spec


class NeuralProgramSynthesizerV10(NeuralProgramSynthesizerV9):
    version = "typed-sketch-search-v10"

    _OP_TO_OPCODE = {
        "ADD": {3}, "SUB": {4}, "XOR": {5}, "MUL": {15},
        "MIN": {17}, "MAX": {18}, "MOD": {4,15},
        "CLAMP": {17,18}, "PARITY": {5,9}, "LOOP": {11,12},
    }

    def _plan_score(self, code, text: str) -> float:
        spec = parse_task_spec(text)
        if not spec.semantic_valid or not spec.operators:
            return 0.0
        generated = [int(op) for op, _, _ in code if int(op) not in (0,1,13,14,16)]
        expected = list(spec.operators)
        if not generated:
            return 0.0
        wanted = [self._OP_TO_OPCODE.get(name, set()) for name in expected]
        # Ordered soft-alignment: each expected operator gets credit for the closest
        # still-unused generated instruction. This handles LOAD scaffolding without
        # assuming a fixed register allocation.
        used = set(); hits = []
        for ops in wanted:
            best = None
            for i, op in enumerate(generated):
                if i in used: continue
                if op in ops:
                    best = i; break
            if best is not None:
                used.add(best); hits.append(1.0)
            else:
                hits.append(0.0)
        coverage = sum(hits) / max(1, len(hits))
        ordering = 1.0
        if len(used) > 1:
            pos = sorted(used)
            inversions = sum(1 for i in range(len(pos)) for j in range(i+1,len(pos)) if pos[i] > pos[j])
            ordering = 1.0 / (1.0 + inversions)
        return float(0.75 * coverage + 0.25 * ordering)

    @torch.no_grad()
    def generate_candidates(
        self, text: str, *, family_id: Optional[int] = None, max_len: Optional[int] = None,
        beam_size: int = 4, family_beam: int = 4, candidates: int = 8,
    ) -> List[Tuple[float, List[Tuple[int,int,int]]]]:
        self.eval()
        families = []
        if family_id is None:
            _, family_logits = self._condition(text, None)
            logp = F.log_softmax(family_logits[0], dim=-1)
            vals, ids = torch.topk(logp, min(max(1, int(family_beam)), self.family_count))
            families = [(int(i), float(v)) for i, v in zip(ids.tolist(), vals.tolist())]
        else:
            families = [(int(family_id), 0.0)]
        rows = []
        for fid, family_prior in families:
            # Ask the existing atomic decoder for a beam portfolio. Its private helper
            # currently returns only the best beam, so use small beam widths and vary the
            # family hypotheses; this deliberately stays bounded on mobile.
            for beam in sorted(set([1, max(2, int(beam_size))])):
                code, logscore = self._generate_for_family(text, fid, None, max_len, beam)
                plan = self._plan_score(code, text)
                score = float(logscore) + 0.65 * plan + 0.15 * family_prior
                rows.append((score, code))
        rows.sort(key=lambda x: x[0], reverse=True)
        unique = []
        seen = set()
        for score, code in rows:
            key = tuple(tuple(x) for x in code)
            if key in seen: continue
            seen.add(key); unique.append((score, code))
            if len(unique) >= max(1, int(candidates)): break
        return unique

    @torch.no_grad()
    def generate(self, text: str, family_id: Optional[int] = 0, latent=None,
                 max_len=None, beam_size: int = 1, family_beam: int = 3) -> List[Tuple[int,int,int]]:
        # Backward-compatible single-program API; V10 uses plan-aware candidate search
        # only when the caller asks for uncertain family routing or beam search.
        if family_id is not None and int(beam_size) <= 1:
            return super().generate(text, family_id, latent, max_len, beam_size, family_beam)
        rows = self.generate_candidates(text, family_id=family_id, max_len=max_len,
                                        beam_size=max(2, int(beam_size)), family_beam=family_beam, candidates=4)
        return list(rows[0][1]) if rows else super().generate(text, family_id, latent, max_len, beam_size, family_beam)
