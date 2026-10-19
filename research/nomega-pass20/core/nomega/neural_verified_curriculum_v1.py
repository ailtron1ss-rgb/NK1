from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Sequence, Tuple
import hashlib, json, random

from .neural_program_synth_v2 import Program, ProgramAugmenterV2
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .task_spec_v1 import (CANONICAL_PROMPT, CUES, FAMILY_ORDER, FAMILY_TO_ID, parse_task_spec, validate_task_spec)

@dataclass(frozen=True)
class VerifiedCurriculumStatsV1:
    families: int
    raw_candidates: int
    semantic_valid: int
    execution_verified_programs: int
    rows: int
    rows_per_family: int
    holdout_verified_families: int
    fingerprint: str

class VerifiedNeuralCurriculumV1:
    """Build balanced natural-language -> verified-program examples.

    The text remains raw natural language; no typed semantic sketch is injected into
    the training input. Every target program is independently checked on holdout and
    HVM before it becomes a neural label.
    """
    WRAPPERS = (
        'Given the inputs, {cue}.',
        'Please {cue}.',
        'Calculate this: {cue}.',
        'For these values, {cue}.',
        'We need to {cue}.',
        'Solve the task by doing this: {cue}.',
        'Compute the requested result: {cue}.',
        'What do we get when we {cue}?',
    )

    def __init__(self, root: Path, seed: int = 4101):
        self.root = Path(root)
        self.seed = int(seed)

    def _verified_programs(self, acq: ProgramAcquisitionCoreV2, family: str, count: int) -> List[Program]:
        result = acq.synthesize_family(family, seed=self.seed + FAMILY_TO_ID[family], max_candidates=8)
        best_row = result.get('best') or {}
        best = best_row.get('code') if isinstance(best_row, dict) else best_row
        if not result.get('verified') or not best:
            raise ValueError(f'no independently verified program for family {family}')
        tr, ho, _ = acq._examples(family, self.seed + 1000 + FAMILY_TO_ID[family])
        candidates = ProgramAugmenterV2(self.seed + 2000 + FAMILY_TO_ID[family]).augment(best, n=max(2, count * 2))
        good: List[Program] = []
        seen=set()
        for code in candidates:
            if not code:
                continue
            key=tuple(tuple(x) for x in code)
            if key in seen:
                continue
            seen.add(key)
            hold, hvm, _ = acq._eval(code, ho)
            if hold >= 0.8 and hvm >= 0.8:
                good.append(code)
            if len(good) >= count:
                break
        if not good:
            raise ValueError(f'no verified augmentation for family {family}')
        while len(good) < count:
            good.append(good[len(good) % len(good)])
        return good[:count]

    def build(
        self,
        *,
        families: Sequence[str] = FAMILY_ORDER,
        rows_per_family: int = 8,
        programs_per_family: int = 2,
    ) -> Tuple[List[Tuple[str, Program, int]], VerifiedCurriculumStatsV1]:
        rng=random.Random(self.seed)
        acq=ProgramAcquisitionCoreV2(self.root, seed=self.seed + 11)
        rows: List[Tuple[str, Program, int]]=[]
        raw_candidates=semantic_valid=verified_programs=0
        verified_families=0
        for family in families:
            if family not in FAMILY_TO_ID:
                continue
            # Verify canonical semantic contract before any data is admitted.
            spec=parse_task_spec(CANONICAL_PROMPT[family])
            validate_task_spec(spec)
            semantic_valid += 1
            prompts=[CANONICAL_PROMPT[family]]
            for cue in CUES[family]:
                for wrapper in self.WRAPPERS:
                    prompts.append(wrapper.format(cue=cue))
            # Stable deduplication while keeping lexical diversity.
            dedup=[]; seen_prompts=set()
            for text in prompts:
                t=' '.join(text.lower().split())
                if t not in seen_prompts:
                    seen_prompts.add(t); dedup.append(text)
            rng.shuffle(dedup)
            raw_candidates += len(dedup)
            programs=self._verified_programs(acq, family, programs_per_family)
            verified_programs += len(programs)
            if programs:
                verified_families += 1
            need=max(1, rows_per_family)
            for i in range(need):
                text=dedup[i % len(dedup)]
                code=programs[i % len(programs)]
                parsed=parse_task_spec(text)
                validate_task_spec(parsed)
                rows.append((text, code, FAMILY_TO_ID[family]))
        # Keep the set balanced and deterministic.
        rows.sort(key=lambda r:(r[2], r[0], tuple(tuple(x) for x in r[1])))
        payload='\n'.join(f'{t}|{fid}|{tuple(map(tuple,c))}' for t,c,fid in rows).encode()
        fp=hashlib.sha256(payload).hexdigest()
        stats=VerifiedCurriculumStatsV1(len(list(families)),raw_candidates,semantic_valid,verified_programs,len(rows),rows_per_family,verified_families,fp)
        out=self.root/'runtime'/'neural_verified_curriculum_v1.json'
        out.parent.mkdir(parents=True,exist_ok=True)
        out.write_text(json.dumps({'stats':asdict(stats),'rows':len(rows),'families':list(families)},indent=2))
        return rows, stats
