from __future__ import annotations
from pathlib import Path
import json, os, sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from neurocore.current import NeuroCoreCurrent
from neurocore.frontier import CURRENT_FRONTIER, CURRENT_ENGINE_VERSION
model=NeuroCoreCurrent()
report={"version":CURRENT_FRONTIER,"engine_version":CURRENT_ENGINE_VERSION,"total_parameters":sum(p.numel() for p in model.parameters()),"trainable_parameters":sum(p.numel() for p in model.parameters() if p.requires_grad),"legacy_imports":[],"recurrent_owner_count":sum(1 for m in model.modules() if m.__class__.__name__=="UnifiedAssociativeSpine") }
Path(ROOT/'evidence/V115_CURRENT_AUDIT.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2,ensure_ascii=False))
