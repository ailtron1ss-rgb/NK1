from __future__ import annotations
import argparse, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0,str(ROOT))
from core.nomega.execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1


def main() -> None:
    ap=argparse.ArgumentParser(description='Run a bounded NΩ self-development cycle with persistent verified replay.')
    ap.add_argument('--root',default='.',help='NΩ project root')
    ap.add_argument('--seed',type=int,default=1970)
    ap.add_argument('--initial-epochs',type=int,default=4)
    ap.add_argument('--guided-epochs',type=int,default=2)
    ap.add_argument('--max-examples',type=int,default=32)
    ap.add_argument('--family-budget',type=int,default=5)
    args=ap.parse_args()
    learner=ExecutionGuidedProgramLearnerV1(Path(args.root),seed=args.seed,hidden=48)
    result=learner.run_development_cycle(args.seed,args.initial_epochs,args.guided_epochs,args.max_examples,args.family_budget)
    out=Path(args.root)/'runtime'/'nomega_1_9_7_development_cycle.json'
    out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(result,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
    print(json.dumps({'output':str(out),'version':result.get('version'),'paired_delta':result['run'].get('paired_delta'),'restart_delta':result['run'].get('restart_delta'),'memory':result['run'].get('replay_memory'),'archive':result['run'].get('evolution_archive')},ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
