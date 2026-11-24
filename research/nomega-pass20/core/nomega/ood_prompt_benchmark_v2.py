from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Sequence
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .task_spec_v1 import FAMILY_TO_ID
from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2

class OODPromptBenchmarkV2:
    """Strict prompt-shift evaluation with wording not used by the training descriptors."""
    PROMPTS={
      'sum3':['aggregate the first three observations','compute their total','three-way addition'],
      'xor3':['exclusive bitwise merge of three values','toggle bits across three inputs','xor the three slots'],
      'mul2':['form the product of the first pair','multiply the first and second slots','take the two-value product'],
      'minmax3':['apply nested extrema to the first three values','combine min and max across three inputs','take the minimum pair then compare to the third'],
      'compose_sum_xor':['first add, then apply xor with the third value','sum the pair and xor the remaining input','addition followed by xor'],
    }
    def __init__(self,root:Path): self.root=Path(root)
    def evaluate_codes(self,codes:Dict[str,Sequence[Sequence[int]]],seed:int=77)->Dict[str,Any]:
        acq=ProgramAcquisitionCoreV2(self.root,seed=seed); res=[]
        for fam,code in codes.items():
            _,ho,_=acq._examples(fam,seed+len(res)); fit,agree,_=acq._eval([tuple(x) for x in code],ho); res.append({'family':fam,'verified':fit>=0.8 and agree>=0.8,'fitness':fit,'agreement':agree})
        return {'families':len(res),'verified':sum(int(r['verified']) for r in res),'coverage':sum(int(r['verified']) for r in res)/max(1,len(res)),'results':res}

    def evaluate_model(self, model, seed: int = 77, max_len: int | None = None, oracle_family: bool = True) -> Dict[str, Any]:
        """End-to-end OOD evaluation: shifted natural language -> neural program -> execution."""
        rows = []
        for idx, (family, prompts) in enumerate(self.PROMPTS.items()):
            prompt_rows = []
            _, holdout, _ = ProgramAcquisitionCoreV2(self.root, seed=seed + idx)._examples(family, seed + 1000 + idx)
            for prompt in prompts:
                # Use canonical global family IDs, not prompt-list positions.
                family_id = FAMILY_TO_ID[family] if oracle_family else None
                code = model.generate(prompt, family_id=family_id, max_len=max_len)
                fit, agree, ces = ProgramAcquisitionCoreV2(self.root, seed=seed + idx + 50)._eval(code, holdout)
                prompt_rows.append({
                    'prompt': prompt,
                    'fitness': float(fit),
                    'hvm_agreement': float(agree),
                    'verified': bool(fit >= 0.8 and agree >= 0.8),
                    'code': [list(x) for x in code],
                    'counterexamples': ces,
                    'track': 'PURE_NEURAL' if oracle_family else 'PURE_NEURAL_END_TO_END',
                })
            fam_fit=sum(x['fitness'] for x in prompt_rows)/max(1,len(prompt_rows))
            fam_verify=sum(int(x['verified']) for x in prompt_rows)/max(1,len(prompt_rows))
            rows.append({'family': family, 'prompt_count': len(prompt_rows),
                         'mean_fitness': fam_fit, 'verification_rate': fam_verify,
                         'verified': bool(fam_verify >= 2/3), 'prompts': prompt_rows})
        return {
            'track':'PURE_NEURAL' if oracle_family else 'PURE_NEURAL_END_TO_END',
            'families':len(rows),
            'coverage':sum(int(x['verified']) for x in rows)/max(1,len(rows)),
            'prompt_level_verification':sum(int(p['verified']) for x in rows for p in x['prompts'])/max(1,sum(x['prompt_count'] for x in rows)),
            'seed':seed,'oracle_family':bool(oracle_family),
            'results':rows,
        }
