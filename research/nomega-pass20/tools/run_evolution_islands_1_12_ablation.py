from __future__ import annotations
import json
from pathlib import Path
from tempfile import TemporaryDirectory


def main():
    from core.nomega.evolution_islands_v1 import EvolutionIslandControllerV1
    root=Path(__file__).resolve().parents[1]
    operators=['opcode_replace','arg_a_replace','arg_b_replace','insert_instruction']
    candidates=[]
    for i in range(24):
        op=operators[i%4]
        # Synthetic verified evidence is used only to test diversity mechanics.
        quality=1.0 if op in {'opcode_replace','arg_a_replace'} else .45
        candidates.append({'operator':op,'code':[(i%7,(i+1)%4,(i+2)%5)],'source':'raw_local','novelty':1.0 if i<8 else .2,'verified':True,'success':quality,'search_cost':1.0,'complexity':1.0})
    baseline=sorted(candidates,key=lambda r:(-float(r['success']),str(r['operator']),str(r['code'])))[:8]
    baseline_cov=len({x['operator'] for x in baseline})
    with TemporaryDirectory(prefix='nomega_islands_1_12_') as td:
        tmp=Path(td)
        island=EvolutionIslandControllerV1(tmp,islands=4,seed=12051,migration_interval=1)
        selected=island.route_pool('sum3',candidates,budget=8)
        for row in selected:
            island.observe_verified(family='sum3',candidate=row,verified=True,success=float(row.get('success',0.0)),cost=1,cycle_id='ablation')
        st=island.stats()
    island_cov=len({x['operator'] for x in selected})
    out={'version':'1.12.0','budget':8,'baseline_operator_coverage':baseline_cov,'island_operator_coverage':island_cov,'baseline_unique_islands':1,'island_unique_islands':len({int(x['island_id']) for x in selected}),'migrations':st['migrations'],'verified_observations':st['verified_observations'],'status':'component-only'}
    dst=root/'runtime'/'ablation_1_12_evolution_islands.json'; dst.write_text(json.dumps(out,indent=2),encoding='utf-8'); print(json.dumps(out,indent=2))

if __name__=='__main__': main()
