from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, Sequence
import statistics,time
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .program_abstraction_v1 import ProgramAbstractionV1

class ProgramGeneralizationV1:
    def __init__(self, root:Path, seeds:Sequence[int]=(1721,1722,1723), max_candidates:int=8):
        self.root=Path(root); self.seeds=list(seeds); self.max_candidates=max_candidates; self.abstraction=ProgramAbstractionV1()
    def run(self, families=None)->Dict[str,Any]:
        t=time.perf_counter(); runs=[]
        for s in self.seeds:
            acq=ProgramAcquisitionCoreV2(self.root,seed=s); rep=acq.acquire(families,seed=s+100,max_candidates=self.max_candidates)
            runs.append({'seed':s,'coverage':rep['coverage'],'verified':rep['verified_families'],'families':rep['families_seen'],'bank_size':rep['bank_size'],'results':rep['results']})
        coverages=[float(x['coverage']) for x in runs]
        fams=sorted({r['family'] for run in runs for r in run['results'] if r.get('verified')})
        fingerprints={}
        for run in runs:
            for r in run['results']:
                b=r.get('best') or {}; code=b.get('code')
                if code and r.get('verified'):
                    fp=self.abstraction.canonical([tuple(x) for x in code])['fingerprint']
                    fingerprints.setdefault(r['family'],set()).add(fp)
        stability=sum(1 for f in fams if len(fingerprints.get(f,set()))>=1)/max(1,len(fams))
        return {'seeds':self.seeds,'mean_coverage':statistics.mean(coverages) if coverages else 0.0,'min_coverage':min(coverages) if coverages else 0.0,'max_coverage':max(coverages) if coverages else 0.0,'verified_families_intersection':len(set.intersection(*[set(r['family'] for r in run['results'] if r.get('verified')) for run in runs])) if runs else 0,'stable_family_rate':stability,'runs':runs,'elapsed_s':time.perf_counter()-t}
