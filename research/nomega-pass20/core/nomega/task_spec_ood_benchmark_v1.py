from __future__ import annotations
from pathlib import Path
from typing import Any, Dict
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .task_spec_v1 import parse_task_spec, validate_task_spec, typed_model_condition

class TaskSpecOodBenchmarkV1:
    """Semantic-IR ablation: shifted text -> TaskSpec -> neural program -> execution."""
    PROMPTS = {
      'sum3':['aggregate the first three observations','compute their total','three-way addition'],
      'xor3':['exclusive bitwise merge of three values','toggle bits across three inputs','xor the three slots'],
      'mul2':['form the product of the first pair','multiply the first and second slots','take the two-value product'],
      'minmax3':['apply nested extrema to the first three values','combine min and max across three inputs','take the minimum pair then compare to the third'],
      'compose_sum_xor':['first add, then apply xor with the third value','sum the pair and xor the remaining input','addition followed by xor'],
    }

    def __init__(self, root: Path):
        self.root = Path(root)

    def evaluate_model(self, model, seed: int = 1903, max_len: int | None = None, condition_mode: str = 'canonical', prompt_limit: int | None = None) -> Dict[str, Any]:
        rows=[]; invalid=0
        for idx, (family, prompts) in enumerate(self.PROMPTS.items()):
            acq = ProgramAcquisitionCoreV2(self.root, seed=seed + idx)
            _, holdout, _ = acq._examples(family, seed + 1000 + idx)
            prompt_rows=[]
            selected_prompts = prompts if prompt_limit is None else prompts[:max(1, int(prompt_limit))]
            for prompt in selected_prompts:
                spec=parse_task_spec(prompt)
                if not spec.semantic_valid:
                    invalid += 1
                    track='TASKSPEC_TYPED_PLUS_PURE_NEURAL' if condition_mode == 'typed' else 'TASKSPEC_PLUS_PURE_NEURAL'
                    prompt_rows.append({'prompt':prompt,'semantic_valid':False,'verified':False,'reason':spec.reason,'track':track})
                    continue
                validate_task_spec(spec)
                if condition_mode == 'typed':
                    text, fid = typed_model_condition(spec), spec.family_id
                elif condition_mode == 'canonical':
                    text, fid = spec.model_condition()
                elif condition_mode == 'end_to_end':
                    # No external family routing: the model must infer family from raw shifted text.
                    text, fid = prompt, None
                else:
                    raise ValueError(f'unsupported condition_mode: {condition_mode}')
                code=model.generate(text, family_id=fid, max_len=max_len)
                fit, agree, ces=acq._eval(code,holdout)
                prompt_rows.append({
                    'prompt':prompt,'taskspec':spec.to_dict(),'semantic_valid':True,
                    'fitness':float(fit),'hvm_agreement':float(agree),
                    'verified':bool(fit>=0.8 and agree>=0.8),'code':[list(x) for x in code],
                    'counterexamples':ces,'track':(
                        'TASKSPEC_TYPED_PLUS_PURE_NEURAL' if condition_mode == 'typed' else
                        'TASKSPEC_END_TO_END_PURE_NEURAL' if condition_mode == 'end_to_end' else
                        'TASKSPEC_PLUS_PURE_NEURAL'
                    )
                })
            fam_rate=sum(int(x.get('verified',False)) for x in prompt_rows)/max(1,len(prompt_rows))
            rows.append({'family':family,'prompt_count':len(prompt_rows), 'prompt_limit': (None if prompt_limit is None else int(prompt_limit)),'verification_rate':fam_rate,
                         'verified':fam_rate>=2/3,'prompts':prompt_rows})
        prompt_total=sum(x['prompt_count'] for x in rows)
        return {
            'track':(
                'TASKSPEC_TYPED_PLUS_PURE_NEURAL' if condition_mode == 'typed' else
                'TASKSPEC_END_TO_END_PURE_NEURAL' if condition_mode == 'end_to_end' else
                'TASKSPEC_PLUS_PURE_NEURAL'
            ),'families':len(rows),
            'coverage':sum(int(x['verified']) for x in rows)/max(1,len(rows)),
            'prompt_level_verification':sum(int(p.get('verified',False)) for x in rows for p in x['prompts'])/max(1,prompt_total),
            'semantic_invalid_prompts':invalid,'seed':seed,'condition_mode':condition_mode,'results':rows,
        }
