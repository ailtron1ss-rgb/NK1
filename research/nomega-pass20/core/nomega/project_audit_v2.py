from __future__ import annotations
from pathlib import Path
from typing import Any, Dict
import json, re

class ProjectAuditV2:
    """Second-order audit: implementation, integration, evidence and goal coverage are scored separately."""
    def __init__(self,root:Path): self.root=Path(root)
    def collect(self,test_summary:Dict[str,Any]|None=None, eval_report:Dict[str,Any]|None=None):
        files=list((self.root/'core'/'nomega').glob('*.py')) if (self.root/'core'/'nomega').exists() else []
        required=['generalist_core.py','universal_learning_loop.py','research_brain.py','world_model.py','skill_graph_v2.py','continual_v2.py','mobile_compiler_v2.py']
        present=sum((self.root/'core'/'nomega'/x).exists() for x in required)/len(required)*100
        tests=(test_summary or {}).get('passed',0); total=(test_summary or {}).get('total',max(1,tests)); testing=100*tests/max(1,total)
        splits=(eval_report or {}).get('splits',{}); hold= splits.get('holdout',{}).get('verified_rate',0); adv=splits.get('adversarial',{}).get('verified_rate',0)
        evidence=100*(.55*hold+.45*adv)
        docs=list((self.root/'docs'/'nomega').glob('*.md')) if (self.root/'docs'/'nomega').exists() else []
        integration=min(100, 45 + min(30,len(files))/30*30 + min(25,len(docs))/25*25)
        capability=min(100, 40 + .4*evidence + .2*testing)
        overall=.30*present+.20*integration+.20*testing+.15*evidence+.15*capability
        return {'scores':{'engineering_completion_pct':round(present,1),'integration_pct':round(integration,1),'testing_pct':round(testing,1),'evidence_pct':round(evidence,1),'demonstrated_capability_pct':round(capability,1),'overall_readiness_pct':round(overall,1)},'inventory':{'nomega_modules':len(files),'docs':len(docs),'required_core_present_pct':round(present,1)},'holdout_caveat':'Evidence is bounded by provided evaluation tasks; this audit does not measure AGI or real-world general intelligence.'}
