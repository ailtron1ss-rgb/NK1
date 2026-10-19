from __future__ import annotations
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from core.nomega.calibrated_strategy_router_v1 import CalibratedStrategyRouterV1


def scalar_pick(rows, objective):
    scored=[]
    for strategy, vals in rows.items():
        delta=sum(float(x['target_gain']) for x in vals)/len(vals)
        ret=sum(float(x['retention']) for x in vals)/len(vals)
        cost=sum(float(x['steps']) for x in vals)/len(vals)
        if objective=='learning': u=delta-.02*cost
        elif objective=='retention': u=.25*delta+ret-.02*cost
        else: u=.65*delta+.35*ret-.02*cost
        scored.append((u,strategy))
    return sorted(scored, reverse=True)[0][1]


def main():
    root=Path(__file__).resolve().parents[1]
    src=root/'runtime'/'ablation_1_11_multifamily'/'continual_strategy_multifamily_1_11.json'
    data=json.loads(src.read_text(encoding='utf-8'))
    pairs=list(data['pairs']); strategies=list(data['aggregate'].keys())
    objectives=('learning','retention','balanced')
    folds=[]
    with TemporaryDirectory(prefix='nomega_router_1_12_') as td:
        tmp=Path(td); r=CalibratedStrategyRouterV1(tmp)
        for held in pairs:
            train=[x for x in data['runs'] if x['pair']!=held]
            test=[x for x in data['runs'] if x['pair']==held]
            by_strategy={s:[] for s in strategies}
            for run in train:
                for s,v in run['results'].items():
                    by_strategy[s].append({'target_gain':v['target_gain'],'retention':v['retention'],'steps':v['steps'],'family':held})
            # Inject training evidence into the router's expected portfolio file.
            payload={'version':'1.11.0','observations':[],'evidence':{},'events':[]}
            for s,vals in by_strategy.items():
                for i,v in enumerate(vals):
                    payload['observations'].append({'strategy':s,'family':held,'delta':v['target_gain'],'retention':v['retention'],'cost':v['steps'],'cycle_id':f'train-{i}'})
            (tmp/'runtime').mkdir(parents=True,exist_ok=True)
            (tmp/'runtime'/'nomega_continual_strategy_portfolio_v1.json').write_text(json.dumps(payload),encoding='utf-8')
            r=CalibratedStrategyRouterV1(tmp)
            for objective in objectives:
                calibrated=r.recommend(held,objective=objective,budget=1)['selected'][0]['strategy']
                # Replace family matching doesn't matter because router falls back to global strategy evidence.
                scalar=scalar_pick(by_strategy,objective)
                oracle_rows={s:[run['results'][s] for run in test] for s in strategies}
                oracle=scalar_pick(oracle_rows,objective)
                folds.append({'held_out_pair':held,'objective':objective,'calibrated':calibrated,'scalar':scalar,'oracle':oracle,'calibrated_hit':calibrated==oracle,'scalar_hit':scalar==oracle})
    out={'version':'1.12.0','folds':folds,'calibrated_hit_rate':sum(x['calibrated_hit'] for x in folds)/len(folds),'scalar_hit_rate':sum(x['scalar_hit'] for x in folds)/len(folds),'status':'research-only'}
    dst=root/'runtime'/'ablation_1_12_strategy_router.json'; dst.write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8'); print(json.dumps(out,indent=2))

if __name__=='__main__': main()
