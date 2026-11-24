from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, List, Sequence
import json, statistics, random

from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .repair_operator_policy_v2 import RepairOperatorPolicyV2


class RepairOperatorTransferAblationV1:
    """Equal-budget cross-family transfer benchmark for repair operators.

    The warm-up families and held-out families are disjoint. Both static and
    adaptive tracks receive the exact same candidate pools; only operator order
    differs. A repair is counted only when both TinyVM and HVM verification pass.
    """

    VERSION = "1.9.6"

    def __init__(self, root: Path, seed: int = 19620):
        self.root = Path(root)
        self.seed = int(seed)
        self.operators = RepairOperatorPolicyV2.OPERATORS

    @staticmethod
    def _tagged_mutations(code, seed: int, per_operator: int = 4):
        rng = random.Random(int(seed))
        ops = [3,4,5,6,7,15,17,18]
        out = {name: [] for name in RepairOperatorPolicyV2.OPERATORS}
        for name in out:
            for _ in range(int(per_operator)):
                p = list(code)
                if not p:
                    continue
                i = rng.randrange(len(p)); op,a,b = p[i]
                if name == "opcode_replace":
                    if op in (1,10,11,12,13,14):
                        continue
                    p[i] = (rng.choice(ops), a, b)
                elif name == "arg_a_replace":
                    p[i] = (op, rng.randrange(4), b)
                elif name == "arg_b_replace":
                    p[i] = (op, a, rng.randrange(8))
                else:
                    p.insert(i, (rng.choice([1,3,4,5,15,17,18]), rng.randrange(4), rng.randrange(4)))
                    p = p[:48]
                out[name].append(p)
        return out

    def _examples(self, family: str, seed: int):
        acq = ProgramAcquisitionCoreV2(self.root, seed=seed)
        return acq._examples(family, seed)

    def _find_case(self, family: str, case_seed: int) -> Dict[str, Any] | None:
        acq = ProgramAcquisitionCoreV2(self.root, seed=case_seed)
        base = acq.templates(family)[0]
        _, holdout, _ = self._examples(family, 40000 + case_seed)
        broken_pool = acq._mutate(base, 24)[1:]
        for raw_index, raw in enumerate(broken_pool):
            rf, ra, _ = acq._eval(raw, holdout)
            if rf >= .8 and ra >= .8:
                continue
            pools = self._tagged_mutations(raw, seed=50000 + case_seed * 17 + raw_index, per_operator=5)
            solved = any(
                any(acq._eval(c, holdout)[0] >= .8 and acq._eval(c, holdout)[1] >= .8 for c in candidates)
                for candidates in pools.values()
            )
            if not solved:
                continue
            return {
                "family": family,
                "id": f"{family}-{case_seed}-{raw_index}",
                "raw": raw,
                "holdout": holdout,
                "candidate_pools": pools,
                "mutation_seed": case_seed,
                "raw_fitness": rf,
                "raw_agreement": ra,
            }
        return None

    def _cases(self, families: Sequence[str], needed_per_family: int = 2) -> List[Dict[str, Any]]:
        out=[]
        for fam_idx, family in enumerate(families):
            found=0
            for offset in range(120):
                case=self._find_case(family, self.seed + fam_idx*1000 + offset)
                if case:
                    out.append(case); found += 1
                if found >= needed_per_family:
                    break
        return out

    @staticmethod
    def _search(root: Path, case: Dict[str,Any], operator_order: Sequence[str], budget: int) -> Dict[str,Any]:
        tested=0; op_counts={}; verified_op=None
        for op in operator_order:
            for cand in case['candidate_pools'].get(op,[]):
                if tested >= budget:
                    break
                tested += 1
                op_counts[op]=op_counts.get(op,0)+1
                acq=ProgramAcquisitionCoreV2(root, seed=90000 + tested + int(case['mutation_seed']))
                fit,agree,ce=acq._eval([tuple(x) for x in cand], case['holdout'])
                if fit >= .8 and agree >= .8:
                    verified_op=op
                    return {'case_id':case['id'],'family':case['family'],'success':True,'candidates_tested':tested,'verified_operator':verified_op,'operator_counts':op_counts,'counterexamples':ce}
            if tested >= budget: break
        return {'case_id':case['id'],'family':case['family'],'success':False,'candidates_tested':tested,'verified_operator':None,'operator_counts':op_counts,'counterexamples':[]}

    def run(self, *, warmup_families=('sum3','xor3'), evaluation_families=('minmax3','compose_sum_xor'), cases_per_family=2, budget=20) -> Dict[str,Any]:
        warm=self._cases(warmup_families,cases_per_family)
        evals=self._cases(evaluation_families,cases_per_family)
        if len(warm) < len(warmup_families)*cases_per_family or len(evals) < len(evaluation_families)*cases_per_family:
            raise RuntimeError(f'insufficient cross-family cases: warm={len(warm)} eval={len(evals)}')
        policy_root=self.root/'runtime'/'repair_operator_transfer_adaptive'
        policy_root.mkdir(parents=True,exist_ok=True)
        policy=RepairOperatorPolicyV2(policy_root,seed=self.seed)
        warm_results=[]
        static_order=list(self.operators)
        for case in warm:
            r=self._search(policy_root,case,static_order,budget); warm_results.append(r)
            for op,count in sorted(r['operator_counts'].items()):
                policy.observe(family=case['family'],operator=op,verified=(r['success'] and op==r['verified_operator']),candidates_tested=count,cycle_id=f"warm-{case['id']}",source_family=case['family'])
        static=[]; adaptive=[]
        for case in evals:
            static.append(self._search(self.root,case,static_order,budget))
            order=policy.rank_operators(case['family'],self.operators)
            adaptive.append(self._search(policy_root,case,order,budget))
        def summarize(rows):
            costs=[int(x['candidates_tested']) for x in rows]
            succ=[x for x in rows if x['success']]
            return {'success_rate':len(succ)/max(1,len(rows)),'mean_candidates_tested':statistics.mean(costs),'median_candidates_tested':statistics.median(costs),'mean_success_cost':statistics.mean([x['candidates_tested'] for x in succ]) if succ else None,'results':rows}
        s=summarize(static); a=summarize(adaptive)
        return {
            'version':self.VERSION,
            'warmup_families':list(warmup_families),'evaluation_families':list(evaluation_families),
            'warmup_cases':[x['id'] for x in warm],'evaluation_cases':[x['id'] for x in evals],
            'budget':int(budget),'warmup':warm_results,'static':s,'adaptive':a,
            'cross_family_transfer':True,
            'candidate_pools_identical':True,
            'promotion_candidate':a['success_rate']>=s['success_rate'] and a['mean_candidates_tested']<s['mean_candidates_tested'],
            'policy_state':policy.snapshot(),
            'promotion_rule':'cross-family adaptive success must not fall and mean verified-search cost must strictly fall under identical held-out candidate pools and budget',
        }
