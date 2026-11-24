from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
import json, time, random, torch

from .neural_program_synth_v1 import NeuralProgramSynthesizerV1, NeuralProgramTrainerV1, ProgramAugmenterV1
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .counterexample_replay_v1 import CounterexampleReplayV1
from .program_abstraction_v1 import ProgramAbstractionV1
from .skill_induction_v1 import SkillInducerV1

Program = List[Tuple[int,int,int]]

class NeuralProgramAcquisitionV1:
    """Learn program proposals from verified bank, then repair them by execution feedback."""
    def __init__(self, root: Path, seed: int=1800):
        self.root=Path(root); self.seed=seed
        self.device=torch.device('cpu'); self.rng=random.Random(seed)
        self.synth=NeuralProgramSynthesizerV1()
        self.trainer=NeuralProgramTrainerV1(self.synth,seed=seed)
        self.augmenter=ProgramAugmenterV1(seed=seed)
        self.replay=CounterexampleReplayV1(seed=seed+7)
        self.abstractor=ProgramAbstractionV1()

    def _bank_rows(self) -> List[Tuple[str,Program]]:
        """Compact structural corpus: one best/verified program per family plus two renamings."""
        from .program_acquisition_v2 import ProgramAcquisitionCoreV2
        acq=ProgramAcquisitionCoreV2(self.root,seed=self.seed+91)
        chosen={}
        p=self.root/'runtime'/'program_acquisition_v3_bank.json'
        if p.exists():
            try: blob=json.loads(p.read_text())
            except Exception: blob={'items':[]}
            for item in blob.get('items',[]):
                if not item.get('verified'): continue
                fam=str(item.get('family','')); code=[tuple(x) for x in item.get('code',[])]
                if fam and code and fam not in chosen: chosen[fam]=code
        # Guarantee structural coverage even when the persisted bank predates the latest family.
        for fam in acq.FAMILIES:
            if fam not in chosen:
                t=acq.templates(fam)
                if t: chosen[fam]=t[0]
        rows=[]
        for fam,code in chosen.items():
            text=self._descriptor(fam)
            for c in self.augmenter.augment(code,n=3): rows.append((text,c))
        seen=set(); out=[]
        for text,code in rows:
            key=(text,tuple(code))
            if key in seen: continue
            seen.add(key); out.append((text,code))
        return out

    def _descriptor(self,family:str)->str:
        return {
            'sum3':'add the first three values',
            'xor3':'xor three values',
            'mul2':'multiply the first two values',
            'sub_offset':'subtract first from second and add offset',
            'minmax3':'take the larger of the pairwise minima',
            'parity_mix':'compute xor parity of three values',
            'clamp_sum':'add two values then clamp to bounds',
            'dot2_mod':'compute dot product then reduce modulo m',
            'nested3':'subtract then multiply then add offset',
            'sequence_inc':'advance the start value by a count',
            'sequence_diff':'compute the difference of the last values',
            'program_sum':'return the sum of three inputs',
            'compose_sum_xor':'sum the first two then xor the third',
            'compose_min_max':'min the first pair then max with third',
            'compose_affine':'multiply one value then add two others',
            'compose_mod_chain':'add, modulo, then xor',
            'compose_clamp_offset':'add with offset then clamp',
            'compose_nested_parity':'nested arithmetic then parity',
            'inverse_sum':'recover an additive total',
            'invariant_xor':'cancel xor terms to obtain an invariant',
        }.get(family,f'compute {family}')

    def train_from_bank(self, epochs:int=8, max_examples:int=64)->Dict[str,Any]:
        rows=self._bank_rows()
        report=self.trainer.fit(rows,epochs=epochs,max_examples=max_examples)
        path=self.root/'runtime'/'nomega_neural_program_v1.pt'
        NeuralProgramTrainerV1.save(path,self.synth,report)
        return {'rows':len(rows),'report':report.__dict__,'checkpoint':str(path),'parameters':sum(p.numel() for p in self.synth.parameters())}

    def _repair(self,family:str,code:Program,tape:List[int],expected:int,max_rounds:int=3)->Tuple[Program,Dict[str,Any]]:
        from .program_runtime_v2 import run_tiny_v2, run_hvm_compiled_v2
        tiny=run_tiny_v2(code,tape)
        if tiny.get('ok') and tiny.get('result')==expected:
            return code,{'repaired':False,'rounds':0,'counterexamples':0}
        ce=self.replay.add(family,code,tape,expected,tiny.get('result'))
        current=[code]
        for round_idx in range(max_rounds):
            cands=[]
            for p in current:
                cands.extend(self.replay.mutate(ce,n=10))
            for p in cands:
                tt=run_tiny_v2(p,tape); hh=run_hvm_compiled_v2(p,tape)
                if tt.get('ok') and tt.get('result')==expected and hh.get('ok') and hh.get('result')==expected:
                    return p,{'repaired':True,'rounds':round_idx+1,'counterexamples':len(self.replay.failures)}
            current=cands[:12]
        return code,{'repaired':False,'rounds':max_rounds,'counterexamples':len(self.replay.failures)}

    def acquire(self, families:Optional[Sequence[str]]=None, train_epochs:int=8, candidates_per_family:int=2, max_train_examples:int=64, bootstrap_rounds:int=2)->Dict[str,Any]:
        t=time.perf_counter()
        if train_epochs>0:
            train=self.train_from_bank(train_epochs,max_train_examples)
        else:
            train={'rows':0,'report':{'loss':0.0,'steps':0},'checkpoint':str(self.root/'runtime'/'nomega_neural_program_v1.pt'),'parameters':sum(p.numel() for p in self.synth.parameters()),'skipped':True}
            ck=self.root/'runtime'/'nomega_neural_program_v1.pt'
            if ck.exists():
                try:
                    from .neural_program_synth_v1 import NeuralProgramTrainerV1
                    self.synth,_=NeuralProgramTrainerV1.load(ck)
                    self.trainer=NeuralProgramTrainerV1(self.synth,seed=self.seed)
                    train['loaded']=True
                except Exception:
                    train['loaded']=False
        acq=ProgramAcquisitionCoreV2(self.root,self.seed+31)
        fams=list(families or acq.FAMILIES)
        all_rounds=[]; final_results=[]; total_novel=0; total_repair=0
        for round_idx in range(max(1,bootstrap_rounds)):
            results=[]; neural_verified=0; novel=0
            for i,fam in enumerate(fams):
                descriptor=self._descriptor(fam)
                codes=[]
                for _ in range(max(1,candidates_per_family)):
                    codes.extend(self.synth.generate_beam(descriptor,max_len=40,beam_size=4)[:2])
                best=None; template=acq.templates(fam)
                template_fp=self.abstractor.canonical(template[0])['fingerprint'] if template else None
                for code in codes:
                    tr,ho,adv=acq._examples(fam,seed=self.seed+100+i)
                    tf,th,ce1=acq._eval(code,tr); hf,hh,ce2=acq._eval(code,ho); af,ah,ce3=acq._eval(code,adv)
                    score=.45*hf+.25*tf+.18*af+.12*min(hh,ah)-.03*min(1.,len(code)/48)
                    row={'family':fam,'source':'neural_generator','code':[list(x) for x in code],'train_fitness':tf,'holdout_fitness':hf,'adversarial_fitness':af,'hvm_agreement':min(hh,ah),'score':score,'verified':hf>=.8 and af>=.8 and min(hh,ah)>=.8,'counterexample':ce1 or ce2 or ce3}
                    if row['verified'] and template_fp:
                        try:
                            fp=self.abstractor.canonical([tuple(x) for x in code])['fingerprint']; row['novel_structure']=fp!=template_fp; novel += int(row['novel_structure'])
                        except Exception: row['novel_structure']=False
                    if best is None or row['score']>best['score']: best=row
                    if row['counterexample'] and not row['verified']:
                        ce = row['counterexample'][0] if isinstance(row['counterexample'], list) and row['counterexample'] else row['counterexample']
                        if isinstance(ce, dict) and 'tape' in ce:
                            tape=ce['tape']; expected=int(ce['expected']); repaired,rep_meta=self._repair(fam,code,tape,expected)
                        else:
                            repaired,rep_meta=code,{'repaired':False,'rounds':0,'counterexamples':0}
                        total_repair += int(rep_meta.get('repaired',False))
                        tf2,hh2,_=acq._eval(repaired,tr); hf2,hvm2,_=acq._eval(repaired,ho); af2,ahvm2,_=acq._eval(repaired,adv)
                        repair_row=dict(row); repair_row.update({'source':'neural+counterexample_repair','code':[list(x) for x in repaired],'train_fitness':tf2,'holdout_fitness':hf2,'adversarial_fitness':af2,'hvm_agreement':min(hvm2,ahvm2),'score':.45*hf2+.25*tf2+.18*af2+.12*min(hvm2,ahvm2),'repair':rep_meta,'verified':hf2>=.8 and af2>=.8 and min(hvm2,ahvm2)>=.8})
                        if repair_row['score']>best['score']: best=repair_row
                if best:
                    best['candidate_count']=len(codes); results.append(best); neural_verified += int(best.get('verified',False))
            all_rounds.append({'round':round_idx+1,'verified_families':neural_verified,'coverage':neural_verified/max(1,len(fams)),'novel_structures':novel,'results':results})
            total_novel += novel; final_results=results
            # Self-training: only trusted programs re-enter the corpus for the next round.
            trusted=[(self._descriptor(r['family']),[tuple(x) for x in r['code']]) for r in results if r.get('verified')]
            if round_idx+1 < max(1,bootstrap_rounds) and trusted:
                base=self._bank_rows(); extra=[]
                for text,code in trusted: extra.extend((text,c) for c in self.augmenter.augment(code,n=2))
                # Temporarily extend the compact replay window; the trainer still caps total examples.
                report=self.trainer.fit(base+extra,epochs=max(2,train_epochs//2),max_examples=max_train_examples)
                train.setdefault('bootstrap_reports',[]).append(report.__dict__)
        skills=[]; inducer=SkillInducerV1()
        for row in final_results:
            if row.get('verified'):
                s=inducer.induce(row['family'],row['code'],row['score'],True,{'source':row['source'],'neural':True,'bootstrap_rounds':bootstrap_rounds}); skills.append(s.name)
        out={'version':'1.8.0','elapsed_s':time.perf_counter()-t,'training':train,'families_seen':len(fams),'verified_families':sum(1 for r in final_results if r.get('verified')),'coverage':sum(1 for r in final_results if r.get('verified'))/max(1,len(fams)),'novel_structures':total_novel,'results':final_results,'rounds':all_rounds,'skills':inducer.export(),'replay_stats':self.replay.stats(),'repaired_candidates':total_repair,'parameters':train['parameters'],'checkpoint':train['checkpoint']}
        p=self.root/'runtime'/'nomega_1_8_neural_program_acquisition.json'; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(out,indent=2,ensure_ascii=False,default=str))
        return out
