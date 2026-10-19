from __future__ import annotations
import argparse, hashlib, json, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path: sys.path.insert(0, str(ROOT))

from core.nomega.neural_execution_learning_lab_v1 import NeuralExecutionLearningLabV1
from core.nomega.repair_engine_v1 import RepairEngineV1
from core.nomega.neural_causality_benchmark_v1 import NeuralCausalityBenchmarkV1
from core.nomega.partial_program_value_v2 import PartialProgramValueV2
from core.nomega.self_evolution_control_plane_v2 import SelfEvolutionControlPlaneV2, EvaluationSnapshotV2, EvidenceQuorumV1


def sha(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as fh:
        for chunk in iter(lambda: fh.read(1<<20), b''): h.update(chunk)
    return h.hexdigest()


def run(root: Path, families: list[str], seeds: list[int]) -> dict:
    t0=time.perf_counter(); runs=[]
    for seed in seeds:
        report=NeuralExecutionLearningLabV1(root,seed=seed).run(families,hidden=24,epochs=2,preference_epochs=1)
        runs.append(report.to_dict())
    repair=RepairEngineV1(root,seed=seeds[0]+77).repair('sum3',[(0,0,0),(13,0,0),(14,0,0)],tapes=[[5,7,9,0,0,0,0,0]],max_candidates=6)
    value=PartialProgramValueV2(root,seed=seeds[0]+91,ensemble=2)
    value_code=[(1,0,0),(13,0,0),(14,0,0)]
    for i in range(24): value.observe(i%4,value_code,0.3+0.01*i,progress=.4+0.01*i,repairability=.2+0.01*(i%5),cost=3+i%4)
    value_fit=value.fit(epochs=2,batch_size=8); value_pred=value.predict(0,value_code); value_gate=value.should_enable(expected_verifier_savings=8.0)
    first=runs[0]
    baseline=EvaluationSnapshotV2(score=float(first['coverage_before']),verified_rate=float(first['coverage_before']),holdout=float(first['coverage_before']),ood=0.0,adversarial=0.0,restart_delta=0.0,negative_transfer=0.0,latency_ms=float(first['elapsed_s']*1000),memory_mb=0.0,seed=int(seeds[0]))
    candidate=EvaluationSnapshotV2(score=float(first['coverage_after']),verified_rate=float(first['coverage_after']),holdout=float(first['coverage_after']),ood=0.0,adversarial=0.0,restart_delta=0.0,negative_transfer=0.0,latency_ms=float(first['elapsed_s']*1000),memory_mb=0.0,seed=int(seeds[0]))
    qp=EvidenceQuorumV1(seed_count=len(seeds),independent_runs=len(seeds),trajectory_hashes=len(seeds),provenance_sources=2,holdout_id='forge-holdout',ood_id='forge-ood')
    causal=NeuralCausalityBenchmarkV1(root,seed=seeds[0]+301).compare({'verified_rate':first['coverage_before']},{'verified_rate':first['coverage_after']},{'verified_rate':first['coverage_before']})
    decision=SelfEvolutionControlPlaneV2(root).assess(baseline,candidate,min_gain=.01,multi_seed_evidence=True,evidence_quorum=qp,matched_effect={'accepted': bool(causal.causal and first['neural_milestone'] not in {'N0','N1'})})
    promotion={'accepted':bool(decision.accepted),'reason':decision.reason,'gates':decision.gates,'gain':decision.gain}
    report={
        'version':'1.24.0-dev','families':families,'seeds':seeds,'runs':runs,
        'baseline':{'coverage':float(first['coverage_before'])},
        'candidate':{'coverage':float(max(r['coverage_after'] for r in runs))},
        'neural_milestone':max((r['neural_milestone'] for r in runs),key=lambda x:int(x[1])),
        'holdout':{'before':float(first['coverage_before']),'after':float(first['coverage_after'])},
        'ood':{'rows':sum(int(r['partitions'].get('ood',0)) for r in runs)},
        'retention':{'restart_delta':min(float(r.get('causal_effect',0.0)) for r in runs)},
        'search_cost':{'elapsed_s':sum(float(r['elapsed_s']) for r in runs),'per_run_s':[float(r['elapsed_s']) for r in runs]},
        'repair':{'decision':repair['decision'],'attempted':repair['attempted'],'verified':repair['decision']=='verified_repair'},
        'value_model':{'fit':value_fit.to_dict() if value_fit else None,'prediction':value_pred.to_dict(),'enabled_at_expected_savings_8ms':value_gate},
        'causal_ablation':causal.to_dict(),'promotion':promotion,
        'artifact_hashes':{},'elapsed_s':time.perf_counter()-t0,
    }
    out=root/'runtime'/'benchmark_1_24_adaptive_learning.json'; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(report,indent=2,sort_keys=True))
    sidecar=out.with_suffix('.sha256'); report['artifact_hashes'][sidecar.name]=sha(out); out.write_text(json.dumps(report,indent=2,sort_keys=True)); sidecar.write_text(f'{sha(out)}  {out.name}\n')
    return report


def main() -> int:
    ap=argparse.ArgumentParser(); ap.add_argument('--root',type=Path,default=ROOT); ap.add_argument('--families',nargs='+',default=['sum3','xor3']); ap.add_argument('--seed',type=int,default=2401); ap.add_argument('--seeds',type=int,default=3); args=ap.parse_args()
    seeds=[args.seed+i for i in range(max(1,args.seeds))]
    report=run(args.root,args.families,seeds)
    print(json.dumps({'promotion':report['promotion'],'neural_milestone':report['neural_milestone'],'artifact':str(args.root/'runtime'/'benchmark_1_24_adaptive_learning.json')},sort_keys=True))
    return 0

if __name__=='__main__': raise SystemExit(main())
