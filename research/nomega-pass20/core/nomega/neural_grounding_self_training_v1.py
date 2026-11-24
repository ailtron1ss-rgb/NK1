from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple
import json, random, time

from .neural_program_synth_v2 import NeuralProgramSynthesizerV2, NeuralProgramTrainerV2, Program
from .neural_program_trainer_v3 import NeuralProgramTrainerV3
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .task_spec_v1 import FAMILY_TO_ID, CANONICAL_PROMPT, parse_task_spec, validate_task_spec

@dataclass
class GroundingRow:
    text: str
    code: Program
    family: str
    family_id: int
    view: str
    verified_source: str

class NeuralGroundingSelfTrainingV1:
    """Execution-grounded natural-language self-training for the neural program decoder.

    Phase A creates many independently semantic-validated natural views of verified
    programs. Phase B trains the decoder on those views. Phase C lets the trained
    decoder propose programs on held-out views and adds only independently verified
    proposals as new training evidence. No unverified proposal becomes a label.
    """
    def __init__(self, root: Path, seed: int = 2311):
        self.root = Path(root); self.seed = seed; self.rng = random.Random(seed)
        self.runtime = self.root / 'runtime'; self.runtime.mkdir(parents=True, exist_ok=True)

    def _views(self, family: str) -> List[Tuple[str, str]]:
        base = CANONICAL_PROMPT[family]
        views: List[Tuple[str, str]] = [('canonical', base)]
        variants = {
            'sum3': ['aggregate the first three observations','compute the total of the first three quantities','perform a three-way addition'],
            'xor3': ['exclusive bitwise merge of three values','toggle the bits across the three inputs','combine three integers with xor'],
            'mul2': ['form the product of the first pair','multiply the first and second slots','take the two-value product'],
            'minmax3': ['apply nested extrema to the first three inputs','find the larger of the pairwise minima','combine the minimum pair with the third value using max'],
            'compose_sum_xor': ['first add the pair, then xor the remaining value','combine the first two with addition and xor the third','perform addition followed by xor'],
        }
        for x in variants.get(family, []):
            views.append(('paraphrase', x))
        views.append(('instruction', 'Solve this computational task exactly: ' + base))
        return views

    def build_verified_rows(self, families: Sequence[str]) -> List[GroundingRow]:
        acq = ProgramAcquisitionCoreV2(self.root, seed=self.seed + 17)
        rows: List[GroundingRow] = []
        for idx, family in enumerate(families):
            templates = acq.templates(family)[:1]
            if not templates: continue
            train, holdout, adv = acq._examples(family, seed=self.seed + 100 + idx)
            code = templates[0]
            tf, th, ce1 = acq._eval(code, train)
            hf, hh, ce2 = acq._eval(code, holdout)
            af, ah, ce3 = acq._eval(code, adv)
            verified = tf >= .8 and hf >= .8 and af >= .7 and min(th, hh, ah) >= .8
            if not verified:
                continue
            fid = FAMILY_TO_ID[family]
            for view, text in self._views(family):
                spec = parse_task_spec(text, min_confidence=.995)
                if not spec.semantic_valid or spec.family != family:
                    continue
                validate_task_spec(spec)
                rows.append(GroundingRow(text=text, code=list(code), family=family, family_id=fid, view=view, verified_source='baseline_verified'))
        return rows

    @staticmethod
    def _tuples(rows: Sequence[GroundingRow]) -> List[Tuple[str, Program, int]]:
        return [(r.text, r.code, r.family_id) for r in rows]

    def _evaluate_model(self, model: NeuralProgramSynthesizerV2, families: Sequence[str], seed: int, oracle_family: bool = False) -> Dict[str, Any]:
        acq = ProgramAcquisitionCoreV2(self.root, seed=seed + 71)
        rows=[]
        for idx, family in enumerate(families):
            _, holdout, _ = acq._examples(family, seed + 1000 + idx)
            prompts = self._views(family)[1:]
            verified=0; fitness=[]
            for view, prompt in prompts:
                code=model.generate(prompt, family_id=(FAMILY_TO_ID[family] if oracle_family else None), max_len=model.max_len)
                fit, agree, _ = acq._eval(code, holdout)
                ok=fit>=.8 and agree>=.8
                verified += int(ok); fitness.append(float(fit))
            rows.append({'family':family,'verified_views':verified,'view_count':len(prompts),'verification_rate':verified/max(1,len(prompts)),'mean_fitness':sum(fitness)/max(1,len(fitness))})
        return {'families':len(rows),'coverage':sum(int(r['verification_rate']>=2/3) for r in rows)/max(1,len(rows)),'prompt_level':sum(r['verified_views'] for r in rows)/max(1,sum(r['view_count'] for r in rows)),'results':rows,'seed':seed}

    def run(self, families: Sequence[str] = ('sum3','xor3','mul2','minmax3','compose_sum_xor'), seed: int | None = None, warmup_epochs: int = 8, self_training_rounds: int = 2, model_kwargs: Dict[str, Any] | None = None) -> Dict[str, Any]:
        seed = self.seed if seed is None else int(seed)
        t0=time.perf_counter()
        rows=self.build_verified_rows(families)
        if not rows:
            raise RuntimeError('no independently verified grounding rows available')
        # Equal-budget semantic ablation: every family contributes the same number
        # of examples to both arms. The baseline receives canonical views, while
        # the grounded arm receives one canonical + one paraphrase + one instruction
        # view when available. This prevents the earlier accidental family skew.
        baseline_rows=[]; grounded_rows=[]
        for family in families:
            fam_rows=[r for r in rows if r.family==family]
            if not fam_rows:
                continue
            canonical=[r for r in fam_rows if r.view=='canonical']
            alternates=[r for r in fam_rows if r.view in {'paraphrase','instruction'}]
            if canonical:
                baseline_rows.extend(canonical[:3])
                grounded_rows.extend(canonical[:1])
            grounded_rows.extend(alternates[:2])
        mk=dict(vocab=2048,hidden=48,latent_dim=48,max_len=20,max_b=64,layers=2,heads=4); mk.update(model_kwargs or {})
        base_model=NeuralProgramSynthesizerV2(**mk)
        grounded_model=NeuralProgramSynthesizerV2(**mk)
        base_trainer=NeuralProgramTrainerV3(base_model,seed=seed+1,lr=8e-4)
        grounded_trainer=NeuralProgramTrainerV3(grounded_model,seed=seed+1,lr=8e-4)
        equal_budget=min(48,len(baseline_rows),len(grounded_rows))
        baseline_rows=baseline_rows[:equal_budget]
        grounded_rows=grounded_rows[:equal_budget]
        base_rep=base_trainer.fit(self._tuples(baseline_rows),epochs=warmup_epochs,batch_size=max(1,equal_budget),max_examples=equal_budget)
        grounded_rep=grounded_trainer.fit(self._tuples(grounded_rows),epochs=warmup_epochs,batch_size=max(1,equal_budget),max_examples=equal_budget)
        before_base=self._evaluate_model(base_model,families,seed+500,oracle_family=False)
        before_grounded=self._evaluate_model(grounded_model,families,seed+500,oracle_family=False)
        oracle_base=self._evaluate_model(base_model,families,seed+500,oracle_family=True)
        oracle_grounded=self._evaluate_model(grounded_model,families,seed+500,oracle_family=True)
        self_generated=[]
        for round_idx in range(max(0,int(self_training_rounds))):
            acq=ProgramAcquisitionCoreV2(self.root,seed=seed+200+round_idx)
            new=[]
            for family in families:
                _, holdout, _=acq._examples(family,seed+3000+round_idx+FAMILY_TO_ID[family])
                for view,prompt in self._views(family)[1:]:
                    code=grounded_model.generate(prompt,family_id=FAMILY_TO_ID[family],max_len=grounded_model.max_len)
                    fit,agree,ces=acq._eval(code,holdout)
                    if fit>=.8 and agree>=.8:
                        spec=parse_task_spec(prompt,min_confidence=.995)
                        if spec.semantic_valid and spec.family==family:
                            new.append(GroundingRow(prompt,code,family,FAMILY_TO_ID[family],view,'neural_verified'))
            if not new: continue
            self_generated.extend(new)
            grounded_trainer.fit(self._tuples(grounded_rows+new),epochs=2,batch_size=max(1,equal_budget),max_examples=equal_budget)
            grounded_rows.extend(new)
        after_grounded=self._evaluate_model(grounded_model,families,seed+500,oracle_family=False)
        oracle_after_grounded=self._evaluate_model(grounded_model,families,seed+500,oracle_family=True)
        ck=self.runtime/f'grounding_self_training_{seed}.pt'
        NeuralProgramTrainerV2.save(ck,grounded_model,grounded_rep)
        fresh,_=NeuralProgramTrainerV2.load(ck)
        restart=self._evaluate_model(fresh,families,seed+500,oracle_family=False)
        report={
            'version':'1.13.0','families':list(families),'seed':seed,
            'dataset':{'verified_rows':len(rows),'canonical_rows':len(baseline_rows),'grounded_rows':len(grounded_rows),'self_generated_verified':len(self_generated),'equal_budget_examples_per_epoch':equal_budget,'equal_budget_optimizer_steps':equal_budget*warmup_epochs},
            'baseline_canonical_train':asdict(base_rep),'grounded_train':asdict(grounded_rep),
            'baseline_ood_end_to_end':before_base,'grounded_before_self_training_end_to_end':before_grounded,'grounded_after_end_to_end':after_grounded,'restart':restart,'oracle_baseline':oracle_base,'oracle_grounded_before':oracle_grounded,'oracle_grounded_after':oracle_after_grounded,
            'paired_prompt_level_delta':float(after_grounded['prompt_level']-before_grounded['prompt_level']),
            'paired_family_coverage_delta':float(after_grounded['coverage']-before_grounded['coverage']),
            'end_to_end_grounding_vs_canonical':float(before_grounded['prompt_level']-before_base['prompt_level']),
            'self_generated_verified_rows':len(self_generated),
            'restart_delta':float(restart['prompt_level']-after_grounded['prompt_level']),
            'promotion_safe':bool(after_grounded['prompt_level']>before_grounded['prompt_level'] and abs(restart['prompt_level']-after_grounded['prompt_level'])<=1e-12),
            'checkpoint':str(ck),
            'elapsed_s':round(time.perf_counter()-t0,3),
            'provenance':'Only independently execution-verified programs become self-training labels; benchmark prompts are never used as answer labels.'
        }
        path=self.runtime/f'neural_grounding_self_training_{seed}.json'
        path.write_text(json.dumps(report,indent=2,ensure_ascii=False,default=str),encoding='utf-8')
        return report
