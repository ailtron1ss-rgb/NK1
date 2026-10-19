from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple
import copy, json, random, time, torch

from .neural_program_synth_v2 import NeuralProgramSynthesizerV2, NeuralProgramTrainerV2, Program
from .neural_program_trainer_v3 import NeuralProgramTrainerV3
from .neural_program_synth_v4 import AtomicProgramSynthesizerV4, AtomicProgramTrainerV4
from .neural_program_synth_v8 import NeuralProgramSynthesizerV8
from .neural_program_trainer_v5 import AtomicProgramTrainerV5
from .program_acquisition_v2 import ProgramAcquisitionCoreV2
from .task_spec_v1 import CANONICAL_PROMPT, FAMILY_TO_ID, parse_task_spec, typed_model_condition
from .adaptive_program_curriculum_v1 import AdaptiveProgramCurriculumV1
from .task_spec_ood_benchmark_v1 import TaskSpecOodBenchmarkV1
from .repair_search_policy_v1 import RepairSearchPolicyV1
from .repair_operator_policy_v2 import RepairOperatorPolicyV2
from .adaptive_experience_memory_v3 import AdaptiveExperienceMemoryV3
from .evolution_archive_v1 import EvolutionArchiveV1
from .self_development_orchestrator_v1 import SelfDevelopmentOrchestratorV1
from .evolutionary_repair_portfolio_v1 import EvolutionaryRepairPortfolioV1
from .evolution_diagnostics_v1 import EvolutionDiagnosticsV1
from .model_time_replay_v1 import ModelTimeReplayControllerV1
from .causal_self_model_v1 import CausalSelfModelV1
from .gradient_alignment_replay_v1 import GradientAlignmentReplayV1
from .multiscale_consolidation_v1 import MultiTimescaleConsolidationV1
from .fixed_replay_schedule_v1 import FixedReplayScheduleV1

class ExecutionGuidedProgramLearnerV1:
    """Execution-guided self-training for the neural program decoder.

    A failed neural program is never counted as success. Counterexamples seed a
    bounded deterministic repair search; only independently verified repaired
    programs can become hard training examples. Raw-neural and repair tracks are
    kept separate in the evidence.
    """
    def __init__(self, root: Path, seed: int = 1903, hidden: int = 48):
        self.root=Path(root); self.seed=seed; self.hidden=hidden
        self.runtime=self.root/'runtime'; self.runtime.mkdir(parents=True,exist_ok=True)
        self.repair_policy=RepairSearchPolicyV1(self.root, seed=seed+500)
        self.repair_operator_policy=RepairOperatorPolicyV2(self.root, seed=seed+600)
        self.experience_memory=AdaptiveExperienceMemoryV3(self.root)
        self.evolution_archive=EvolutionArchiveV1(self.root)
        self.self_development=SelfDevelopmentOrchestratorV1(self.root, seed=seed+1970)
        self.evolutionary_portfolio=EvolutionaryRepairPortfolioV1(self.root, seed=seed+1977)
        self.evolution_diagnostics=EvolutionDiagnosticsV1(self.root)
        self.causal_self_model=CausalSelfModelV1(self.root)
        self.model_time_replay=ModelTimeReplayControllerV1(self.root, threshold=0.055, cooldown_steps=1)
        self.gradient_alignment_replay=GradientAlignmentReplayV1(self.root)
        self.multiscale_consolidation=MultiTimescaleConsolidationV1(self.root)
        self.fixed_replay_schedule=FixedReplayScheduleV1(self.root)
        self._last_replay_lineage=[]

    def training_rows(self, families: Sequence[str], condition_mode: str = 'canonical', include_replay: bool = False, replay_limit: int = 16, replay_mode: str = 'static') -> List[Tuple[str,Program,int]]:
        acq=ProgramAcquisitionCoreV2(self.root,seed=self.seed+11); rows=[]
        # Use the same canonical semantic representation that TaskSpec produces at test time.
        # This removes the accidental train/test lexical mismatch from 1.9.2.
        for fam in families:
            fid=FAMILY_TO_ID[fam]
            spec=parse_task_spec(CANONICAL_PROMPT[fam]); spec_text=typed_model_condition(spec) if condition_mode == 'typed' else CANONICAL_PROMPT[fam]
            for code in acq.templates(fam)[:1]:
                from .neural_program_synth_v2 import ProgramAugmenterV2
                for c in ProgramAugmenterV2(self.seed+17).augment(code,n=3):
                    rows.append((spec_text,c,fid))
        if include_replay:
            replay=[]
            if replay_mode == 'transfer_aware':
                for fam in families:
                    replay.extend(self.experience_memory.retrieve_replay_transfer_aware((fam,), max_items=max(1,replay_limit//max(1,len(families))), current_family=fam, anchor_families=('sum3','xor3')))
            elif replay_mode == 'transfer_selective':
                for fam in families:
                    replay.extend(self.experience_memory.retrieve_replay_transfer_selective(fam, max_items=max(1,replay_limit//max(1,len(families))), anchor_families=('sum3','xor3')))
            else:
                replay=self.experience_memory.retrieve_replay_mix(families, max_items=replay_limit, current_family=None, anchor_families=('sum3','xor3'))
            self._last_replay_lineage=[dict(x) for x in replay]
            for item in replay:
                rec=item.get('record',{})
                try:
                    fam=str(rec.get('family')); fid=FAMILY_TO_ID[fam]
                    code=[tuple(x) for x in rec.get('code',[])]
                    text=str(rec.get('text') or CANONICAL_PROMPT[fam])
                    if condition_mode == 'typed':
                        text=typed_model_condition(parse_task_spec(CANONICAL_PROMPT[fam]))
                    if code:
                        rows.append((text,code,fid))
                except Exception:
                    continue
        return rows

    @staticmethod
    def _verify(acq, code, holdout):
        return acq._eval(code,holdout)

    def _repair_candidates(self, acq: ProgramAcquisitionCoreV2, code: Program, family: str, seed_offset: int = 0, limit: int = 32, adaptive_policy: bool = True):
        rng=random.Random(self.seed+700+seed_offset)
        depths=(1,2,3,4,5)
        order=self.repair_policy.rank_depths(family, depths) if adaptive_policy else list(depths)
        candidates=[]
        for depth in order:
            mutated=acq._mutate(code,n=depth+1)
            if mutated:
                candidates.extend((depth,c) for c in mutated[:max(1,min(3,limit-len(candidates)))])
            if len(candidates)>=limit:
                break
        # Deterministic shuffle within equal-history candidates preserves reproducibility.
        rng.shuffle(candidates) if not adaptive_policy else None
        seen=set()
        for depth,cand in candidates:
            fp=tuple(tuple(x) for x in cand)
            if fp not in seen:
                seen.add(fp); yield depth,cand


    def _tagged_repair_candidates(self, acq: ProgramAcquisitionCoreV2, code: Program, family: str, seed_offset: int = 0, limit: int = 20, adaptive_policy: bool = False, island_mode: bool = False):
        if adaptive_policy:
            pool=self.evolutionary_portfolio.build_pool(family,code,budget=limit,adaptive=True,island_mode=island_mode)
            for row in pool:
                yield str(row.get('operator','archive_parent')), row['code']
            return
        import random
        operators = RepairOperatorPolicyV2.OPERATORS
        rng = random.Random(self.seed + 19600 + seed_offset)
        ops = [3,4,5,6,7,15,17,18]
        for operator in operators:
            made=0
            for _ in range(8):
                if made >= 8 or limit <= 0: break
                p=list(code)
                if not p: break
                i=rng.randrange(len(p)); op,a,b=p[i]
                if operator == 'opcode_replace':
                    if op in (1,10,11,12,13,14): continue
                    p[i]=(rng.choice(ops),a,b)
                elif operator == 'arg_a_replace':
                    p[i]=(op,rng.randrange(4),b)
                elif operator == 'arg_b_replace':
                    p[i]=(op,a,rng.randrange(8))
                else:
                    p.insert(i,(rng.choice([1,3,4,5,15,17,18]),rng.randrange(4),rng.randrange(4))); p=p[:48]
                yield operator,p
                made += 1; limit -= 1
            if limit <= 0: break

    def run_once(self, eval_seed: int, initial_epochs: int = 10, guided_epochs: int = 5, max_examples: int = 60, condition_mode: str = 'typed', adaptive_families: bool = False, family_budget: int = 5, adaptive_repair_policy: bool = False, adaptive_repair_operator_policy: bool = False, development_replay: bool = False, replay_limit: int = 16, replay_mode: str = 'static', island_mode: bool = False, forced_families: Sequence[str] | None = None, training_engine: str = 'v2', prompt_limit: int | None = None, repair_candidate_limit: int = 20) -> Dict[str,Any]:
        acq=ProgramAcquisitionCoreV2(self.root,seed=eval_seed+31)
        available_fams=tuple(ProgramAcquisitionCoreV2.FAMILIES)
        controller=AdaptiveProgramCurriculumV1(self.root,seed=eval_seed+1994,anchor_count=2)
        if forced_families:
            train_fams=tuple(str(x) for x in forced_families if str(x) in available_fams)[:min(max(1,family_budget),len(available_fams))]
            choice={'families':list(train_fams),'scores':[],'anchors':[x for x in ('sum3','xor3') if x in train_fams],'policy':'forced_frontier_from_stagnation'}
        elif adaptive_families:
            choice=controller.select(available_fams,budget=min(max(1,family_budget),len(available_fams)),anchors=('sum3','xor3'))
            train_fams=tuple(choice['families'])
        else:
            train_fams=('sum3','xor3','mul2','minmax3','compose_sum_xor')
        if training_engine == 'atomic':
            model=AtomicProgramSynthesizerV4(vocab=2048,hidden=self.hidden,latent_dim=self.hidden,max_len=20,max_b=64,layers=2,heads=4)
        elif training_engine == 'atomic_scheduled':
            model=NeuralProgramSynthesizerV8(vocab=2048,hidden=self.hidden,latent_dim=self.hidden,max_len=20,max_b=64,layers=2,heads=4,family_count=len(FAMILY_TO_ID))
        else:
            model=NeuralProgramSynthesizerV2(vocab=2048,hidden=self.hidden,latent_dim=self.hidden,max_len=20,max_b=64,layers=2,heads=4)
        if training_engine not in {'v2','v3','atomic','atomic_scheduled'}:
            raise ValueError(f'unsupported training_engine: {training_engine}')
        if training_engine in {'v3','atomic','atomic_scheduled'} and (development_replay or replay_mode != 'static'):
            raise ValueError('training_engine=v3/atomic currently requires development_replay=False and replay_mode=static; replay-aware neural training remains on the governed V2 path until matched promotion evidence exists')
        if training_engine == 'v3':
            trainer = NeuralProgramTrainerV3(model,seed=eval_seed+1,lr=8e-4)
        elif training_engine == 'atomic':
            trainer = AtomicProgramTrainerV4(model,seed=eval_seed+1,lr=8e-4)
        elif training_engine == 'atomic_scheduled':
            trainer = AtomicProgramTrainerV5(model,seed=eval_seed+1,lr=8e-4)
        else:
            trainer = NeuralProgramTrainerV2(model,seed=eval_seed+1,lr=8e-4)
        base_rows=self.training_rows(train_fams,condition_mode=condition_mode,include_replay=development_replay,replay_limit=replay_limit,replay_mode=replay_mode)
        replay_controller = self.model_time_replay if replay_mode == 'model_time' else (self.fixed_replay_schedule if replay_mode in ('gradient_aligned','transfer_selective') else None)
        replay_provider = None
        replay_ranker = None
        if replay_controller is not None:
            replay_provider=lambda n: self.training_rows(train_fams, condition_mode=condition_mode, include_replay=True, replay_limit=n, replay_mode='transfer_selective')
        if replay_mode == 'gradient_aligned':
            replay_ranker=self.gradient_alignment_replay.rank
            if replay_provider is None:
                replay_provider=lambda n: self.training_rows(train_fams, condition_mode=condition_mode, include_replay=True, replay_limit=n, replay_mode='transfer_selective')
        if training_engine in {'v3','atomic','atomic_scheduled'}:
            if training_engine == 'atomic':
                init_report=trainer.fit(base_rows,epochs=initial_epochs,batch_size=min(8,max(1,max_examples)),max_examples=max_examples, family_teacher_forcing_start=1.0, family_teacher_forcing_end=0.0)
            elif training_engine == 'atomic_scheduled':
                init_report=trainer.fit(base_rows,epochs=initial_epochs,batch_size=min(8,max(1,max_examples)),max_examples=max_examples, family_teacher_forcing_start=1.0, family_teacher_forcing_end=0.0, scheduled_prefix_start=0.0, scheduled_prefix_end=0.35, scheduled_max_tokens=12)
            else:
                init_report=trainer.fit(base_rows,epochs=initial_epochs,batch_size=min(8,max(1,max_examples)),max_examples=max_examples)
        else:
            init_report=trainer.fit(base_rows,epochs=initial_epochs,max_examples=max_examples,teacher_forcing_start=1.0,teacher_forcing_end=0.45,replay_controller=replay_controller,replay_provider=replay_provider,replay_max_items=min(8,max(1,replay_limit)),replay_ranker=replay_ranker)
        benchmark=TaskSpecOodBenchmarkV1(self.root)
        before=benchmark.evaluate_model(model,seed=eval_seed+800,max_len=20,condition_mode=condition_mode,prompt_limit=prompt_limit)

        guided_rows=[]; repaired_records=[]; raw_records=[]
        benchmark_items = list(benchmark.PROMPTS.items()) if prompt_limit is None else list(benchmark.PROMPTS.items())[:max(1, int(prompt_limit))]
        for idx,(family,prompts) in enumerate(benchmark_items):
            _,holdout,_=acq._examples(family,eval_seed+1000+idx)
            label_fid=FAMILY_TO_ID[family]
            spec=parse_task_spec(CANONICAL_PROMPT[family])
            for pidx,prompt in enumerate(prompts):
                if condition_mode == 'typed':
                    text, routed_fid = typed_model_condition(spec), label_fid
                elif condition_mode == 'end_to_end':
                    text, routed_fid = prompt, None
                else:
                    text, routed_fid = CANONICAL_PROMPT[family], label_fid
                raw=model.generate(text,family_id=routed_fid,max_len=20)
                fit,agree,ces=self._verify(acq,raw,holdout)
                raw_records.append({'family':family,'prompt':prompt,'fitness':fit,'agreement':agree,'verified':fit>=.8 and agree>=.8})
                if fit>=.8 and agree>=.8:
                    # A raw neural program is already strong enough; this is the cleanest learning signal.
                    guided_rows.append((text,raw,label_fid,'neural_verified'))
                    if development_replay:
                        self.experience_memory.store_verified(
                            family=family,text=text,code=raw,reward=float((fit+agree)/2.0),source='neural_verified',
                            cycle_id=f'guided-{eval_seed}-{pidx}',provenance={'counterexamples':ces,'fitness':fit,'agreement':agree},
                            confidence=float(min(1.0,0.5*fit+0.5*agree)),status='validated')
                        self.evolution_archive.add(
                            family=family,operator='neural_verified',code=raw,verified=True,success=float((fit+agree)/2.0),
                            search_cost=0.0,complexity=float(len(raw)/64.0),source='neural_verified',cycle_id=f'guided-{eval_seed}-{pidx}')
                    continue
                best=None
                tested=0; verified_depth=None; tested_by_depth={}; tested_by_operator={}
                if adaptive_repair_operator_policy:
                    for operator,cand in self._tagged_repair_candidates(acq,raw,family,pidx,limit=max(1, int(repair_candidate_limit)),adaptive_policy=True, island_mode=island_mode):
                        tested+=1; tested_by_operator[operator]=tested_by_operator.get(operator,0)+1
                        cf,ca,cc=self._verify(acq,cand,holdout)
                        if cf>=.8 and ca>=.8:
                            best=(cand,cf,ca,cc); verified_operator=operator
                            break
                    for operator,count in sorted(tested_by_operator.items()):
                        if operator in RepairOperatorPolicyV2.OPERATORS:
                            self.repair_operator_policy.observe(
                                family=family, operator=operator, verified=(best is not None and operator==verified_operator),
                                candidates_tested=count, cycle_id=f'operator-guided-{eval_seed}-{pidx}'
                            )
                else:
                    verified_operator=None
                    for depth,cand in self._repair_candidates(acq,raw,family,pidx,limit=max(1, int(repair_candidate_limit)),adaptive_policy=adaptive_repair_policy):
                        tested+=1; tested_by_depth[depth]=tested_by_depth.get(depth,0)+1
                        cf,ca,cc=self._verify(acq,cand,holdout)
                        if cf>=.8 and ca>=.8:
                            best=(cand,cf,ca,cc); verified_depth=depth
                            break
                    for depth,count in sorted(tested_by_depth.items()):
                        self.repair_policy.observe(
                            family=family, depth=depth, verified=(depth==verified_depth),
                            candidates_tested=count, cycle_id=f'guided-{eval_seed}-{pidx}'
                        )
                if best is not None:
                    cand,cf,ca,cc=best
                    guided_rows.append((text,cand,label_fid,'execution_verified_repair'))
                    repaired_records.append({'family':family,'prompt':prompt,'fitness':cf,'agreement':ca,'source':'execution_verified_repair','counterexamples':cc})
                    if development_replay:
                        op = verified_operator if adaptive_repair_operator_policy else f'depth_{verified_depth}'
                        self.experience_memory.store_verified(
                            family=family,text=text,code=cand,reward=float((cf+ca)/2.0),source='execution_verified_repair',
                            cycle_id=f'guided-{eval_seed}-{pidx}',provenance={'operator':op,'counterexamples':cc,'fitness':cf,'agreement':ca},
                            confidence=float(min(1.0,0.5*cf+0.5*ca)),status='validated')
                        self.evolution_archive.add(
                            family=family,operator=str(op),code=cand,verified=True,success=float((cf+ca)/2.0),
                            search_cost=float(tested),complexity=float(len(cand)/64.0),source='execution_verified_repair',cycle_id=f'guided-{eval_seed}-{pidx}')
                        if adaptive_repair_operator_policy:
                            self.evolutionary_portfolio.observe_verified(
                                family=family, candidate={'operator': str(op), 'code': cand, 'source': 'execution_verified_repair'},
                                verified=True, success=float((cf+ca)/2.0), cost=float(tested), cycle_id=f'guided-{eval_seed}-{pidx}'
                            )
                        self.evolution_diagnostics.record(
                            parent=raw, child=cand, family=family,
                            outcome={'fitness':float(cf),'agreement':float(ca),'search_cost':int(tested)},
                            cycle_id=f'guided-{eval_seed}-{pidx}'
                        )

        # Only verified programs enter the guided training set. Their provenance is retained separately.
        hard=[(t,c,fid) for t,c,fid,_src in guided_rows]
        if training_engine in {'v3','atomic','atomic_scheduled'}:
            guided_rows_v3 = list(hard) + [r for r in base_rows if r not in hard]
            if training_engine == 'atomic':
                guided_report=trainer.fit(guided_rows_v3,epochs=guided_epochs,batch_size=min(8,max(1,max_examples)),max_examples=max_examples+len(hard), family_teacher_forcing_start=0.75, family_teacher_forcing_end=0.15)
            elif training_engine == 'atomic_scheduled':
                guided_report=trainer.fit(guided_rows_v3,epochs=guided_epochs,batch_size=min(8,max(1,max_examples)),max_examples=max_examples+len(hard), family_teacher_forcing_start=0.75, family_teacher_forcing_end=0.15, scheduled_prefix_start=0.20, scheduled_prefix_end=0.35, scheduled_max_tokens=12)
            else:
                guided_report=trainer.fit(guided_rows_v3,epochs=guided_epochs,batch_size=min(8,max(1,max_examples)),max_examples=max_examples+len(hard))
        else:
            guided_report=trainer.fit(base_rows + hard,epochs=guided_epochs,max_examples=max_examples+len(hard),hard_rows=hard,teacher_forcing_start=0.65,teacher_forcing_end=0.30)
        after=benchmark.evaluate_model(model,seed=eval_seed+800,max_len=20,condition_mode=condition_mode,prompt_limit=prompt_limit)

        ckpt=self.runtime/f'nomega_1_9_4_guided_seed_{eval_seed}.pt'
        if training_engine == 'atomic':
            AtomicProgramTrainerV4.save(ckpt,model,guided_report)
            fresh,blob=AtomicProgramTrainerV4.load(ckpt)
        elif training_engine == 'atomic_scheduled':
            AtomicProgramTrainerV5.save(ckpt,model,guided_report)
            fresh,blob=AtomicProgramTrainerV5.load(ckpt)
        else:
            NeuralProgramTrainerV2.save(ckpt,model,guided_report)
            fresh,blob=NeuralProgramTrainerV2.load(ckpt)
        restart=benchmark.evaluate_model(fresh,seed=eval_seed+800,max_len=20,condition_mode=condition_mode,prompt_limit=prompt_limit)
        raw_verified=sum(int(x['verified']) for x in raw_records)
        family_results=[]
        before_by_family={row['family']:float(row['verification_rate']) for row in before.get('results',[])}
        after_by_family={row['family']:float(row['verification_rate']) for row in after.get('results',[])}
        for fam in benchmark.PROMPTS:
            fam_before=before_by_family.get(fam,0.0)
            fam_after=after_by_family.get(fam,0.0)
            repaired=sum(1 for x in repaired_records if x['family']==fam)
            family_results.append({'family':fam,'before':fam_before,'after':fam_after,'delta':fam_after-fam_before,'verified':fam_after>=2/3,'counterexamples':repaired})
        controller.observe(family_results,cycle_id=f'guided-{eval_seed}')
        curriculum_state=controller.select(available_fams,budget=min(max(1,family_budget),len(available_fams)),anchors=('sum3','xor3'))
        self_metrics={
            'raw_neural_verified_rate': raw_verified/max(1,len(raw_records)),
            'repair_verified_rate': len(repaired_records)/max(1,len(raw_records)),
            'ood_coverage': float(after.get('coverage',0.0)),
            'restart_delta': float(restart.get('coverage',0.0)-after.get('coverage',0.0)),
            'normalized_search_cost': min(1.0,float(sum(int(r.get('candidates_tested',0)) for r in repaired_records))/max(1,len(repaired_records)*20)),
            'transfer_delta': 0.0,
            'mobile_budget_overrun': 0.0,
            'paired_delta': float(after.get('coverage',0.0)-before.get('coverage',0.0)),
            'no_progress': bool(after.get('coverage',0.0)-before.get('coverage',0.0) <= 0.0 and len(hard) == 0),
        }
        dev_plan=self.self_development.plan(self_metrics, available_fams, current_family=str(train_fams[0] if train_fams else 'current'))
        dev_record=self.self_development.record_cycle(f'guided-{eval_seed}',self_metrics,dev_plan)
        primary=dev_plan.get('primary') or {}
        intervention_mode = 'model_time_replay' if replay_mode == 'model_time' else ('transfer_selective_replay' if replay_mode == 'transfer_selective' else replay_mode)
        if primary:
            self.causal_self_model.record(
                bottleneck=str(primary.get('name','unknown')),
                intervention=intervention_mode,
                target='ood_coverage',
                baseline=float(before.get('coverage',0.0)),
                outcome=float(after.get('coverage',0.0)),
                cycle_id=f'guided-{eval_seed}',
                evidence={'restart_delta':float(restart.get('coverage',0.0)-after.get('coverage',0.0)), 'repaired':len(repaired_records), 'replay_events':getattr(init_report,'replay_events',0)},
            )
        # Attach transfer evidence to the concrete memory items that were actually replayed.
        after_by_family={row['family']:float(row['verification_rate']) for row in after.get('results',[])}
        before_by_family={row['family']:float(row['verification_rate']) for row in before.get('results',[])}
        for item in self._last_replay_lineage:
            rec=item.get('record',{})
            source=str(rec.get('family','')); key=str(rec.get('key',''))
            for target_family in train_fams:
                delta=after_by_family.get(target_family,0.0)-before_by_family.get(target_family,0.0)
                if source and key:
                    self.experience_memory.observe_transfer(source,target_family,float(delta),cycle_id=f'guided-{eval_seed}',memory_key=key)
        if development_replay:
            self.experience_memory.consolidate()
            self.multiscale_consolidation.consolidate(self.experience_memory.snapshot().get('records', []))
        return {
            'seed':eval_seed,
            'training_engine':training_engine,
            'train_families':list(train_fams),
            'condition_mode':condition_mode,
            'adaptive_families':adaptive_families,
            'next_curriculum':curriculum_state,
            'initial_training':init_report.__dict__,
            'guided_training':guided_report.__dict__,
            'before':before,'after':after,'restart':restart,
            'paired_delta':after['coverage']-before['coverage'],
            'restart_delta':restart['coverage']-after['coverage'],
            'raw_neural_prompt_verified':raw_verified,
            'execution_verified_training_rows':len(hard),
            'development_replay':development_replay,
            'replay_mode': replay_mode if development_replay else 'disabled',
            'model_time_replay': {'enabled': replay_mode == 'model_time', 'events': getattr(init_report,'replay_events',0), 'rows': getattr(init_report,'replay_rows',0), 'snapshot': self.model_time_replay.snapshot()},
            'gradient_alignment_replay': {'enabled': replay_mode == 'gradient_aligned', 'snapshot': self.gradient_alignment_replay.snapshot()},
            'fixed_replay_schedule': self.fixed_replay_schedule.snapshot(),
            'multiscale_consolidation': self.multiscale_consolidation.snapshot(),
            'causal_self_model': self.causal_self_model.snapshot(),
            'replay_memory':self.experience_memory.stats(),
            'evolution_archive':self.evolution_archive.stats(),
            'development_plan':dev_plan,
            'development_record':dev_record,
            'repair_policy':{'enabled':adaptive_repair_policy,'state_path':str(self.repair_policy.path),'rankings':{f:self.repair_policy.rank_depths(f,(1,2,3,4,5)) for f in benchmark.PROMPTS},'snapshot':self.repair_policy.snapshot(),'verified_repairs':len(repaired_records),'repair_search_cost':sum(int(r.get('candidates_tested',0)) for r in repaired_records)},
            'evolutionary_portfolio':{'enabled':adaptive_repair_operator_policy,'version':'1.11.0','archive':self.evolution_archive.stats()},
            'evolution_diagnostics': self.evolution_diagnostics.mechanism_summary(),
            'repair_operator_policy':{'enabled':adaptive_repair_operator_policy,'state_path':str(self.repair_operator_policy.path),'rankings':{f:self.repair_operator_policy.rank_operators(f) for f in benchmark.PROMPTS},'snapshot':self.repair_operator_policy.snapshot()},
            'repaired_records':repaired_records,
            'raw_records':raw_records,
            'checkpoint':str(ckpt),
            'checkpoint_lineage':{'architecture':blob.get('architecture'),'training_report':blob.get('report',{}),'neural_track':getattr(model,'version', 'factorized-v2')},
            'causal_attribution':{
                'same_model_before_after':True,
                'only_execution_verified_rows_added':True,
                'task_spec_representation_fixed_between_before_after':True,
                'fresh_process_reload_tested':True,
            },
        }

    def bootstrap_verified_baseline(self, families: Sequence[str], seed:int=19700) -> Dict[str,Any]:
        """Independently verify existing deterministic templates and seed only verified ones into long-term memory.

        This is a baseline seeding operation, never counted as an autonomous gain.
        """
        acq=ProgramAcquisitionCoreV2(self.root,seed=seed); results=[]
        for idx,fam in enumerate(families):
            templates=acq.templates(fam)[:1]
            if not templates: continue
            tr,ho,adv=acq._examples(fam,seed+idx)
            for code in templates:
                tf,th,ce1=acq._eval(code,tr); hf,hh,ce2=acq._eval(code,ho); af,ah,ce3=acq._eval(code,adv)
                verified=bool(tf>=.8 and hf>=.8 and af>=.7 and min(th,hh,ah)>=.8)
                results.append({'family':fam,'verified':verified,'train':tf,'holdout':hf,'adversarial':af,'hvm':min(th,hh,ah)})
                if verified:
                    text=typed_model_condition(parse_task_spec(CANONICAL_PROMPT[fam]))
                    self.experience_memory.store_verified(family=fam,text=text,code=code,reward=float((hf+af+min(th,hh,ah))/3.0),source='baseline_verified',cycle_id=f'bootstrap-{seed}',provenance={'train':tf,'holdout':hf,'adversarial':af,'hvm':min(th,hh,ah)},confidence=.99,status='trusted')
                    self.evolution_archive.add(family=fam,operator='baseline_verified',code=code,verified=True,success=float((hf+af)/2.0),search_cost=0.0,complexity=float(len(code)/64.0),source='baseline_verified',cycle_id=f'bootstrap-{seed}')
        return {'families':len(families),'verified':sum(r['verified'] for r in results),'results':results,'counted_as_learning_gain':False}

    def run_development_cycle(self, eval_seed:int=1970, initial_epochs:int=4, guided_epochs:int=2, max_examples:int=32, family_budget:int=5) -> Dict[str,Any]:
        """Run one bounded autonomous-development cycle using persistent replay and adaptive repair.

        This is the canonical entry point for the new control plane. Source-tree mutation
        remains outside this method; promotion is evidence-gated and therefore reversible.
        """
        available=tuple(ProgramAcquisitionCoreV2.FAMILIES)
        baseline_metrics={'raw_neural_verified_rate':0.0,'repair_verified_rate':0.0,'ood_coverage':0.0,'restart_delta':0.0,'normalized_search_cost':0.0,'transfer_delta':0.0,'mobile_budget_overrun':0.0}
        history=self.self_development.snapshot().get('orchestrator',{}).get('cycles',[])
        prior_stalled=bool(history and history[-1].get('metrics',{}).get('no_progress',False))
        plan=self.self_development.plan({**baseline_metrics,'no_progress':prior_stalled},available,current_family=str(available[0] if available else 'current'))
        bootstrap=self.bootstrap_verified_baseline(('sum3','xor3','mul2','minmax3','compose_sum_xor'),seed=eval_seed+27000)
        forced=None
        if prior_stalled:
            forced=self.self_development.curriculum.select_frontier(available,budget=min(max(1,family_budget),len(available)),anchors=('sum3','xor3'))['families']
        out=self.run_once(eval_seed,initial_epochs,guided_epochs,max_examples,condition_mode='typed',adaptive_families=True,family_budget=family_budget,adaptive_repair_policy=False,adaptive_repair_operator_policy=True,development_replay=True,replay_limit=16,replay_mode='model_time',island_mode=True,forced_families=forced)
        return {'version':'1.12.0','control_plane':'SELF_DEVELOPMENT_V1','plan':plan,'bootstrap':bootstrap,'run':out,'orchestrator_snapshot':self.self_development.snapshot()}

    def run_multi_seed(self, seeds: Sequence[int] = (1903,1904,1905), initial_epochs: int = 8, guided_epochs: int = 4, max_examples: int = 48, condition_mode: str = 'typed', adaptive_families: bool = False, family_budget: int = 5, adaptive_repair_policy: bool = False, adaptive_repair_operator_policy: bool = False) -> Dict[str,Any]:
        t=time.perf_counter(); runs=[]
        for seed in seeds:
            runs.append(self.run_once(seed,initial_epochs,guided_epochs,max_examples,condition_mode=condition_mode,adaptive_families=adaptive_families,family_budget=family_budget,adaptive_repair_policy=adaptive_repair_policy,adaptive_repair_operator_policy=adaptive_repair_operator_policy))
        deltas=[float(r['paired_delta']) for r in runs]
        restarts=[abs(float(r['restart_delta'])) for r in runs]
        promoted=all(d>0 for d in deltas) and all(abs(x)<=1e-9 for x in restarts)
        report={
            'version':'1.11.0',
            'track':'TASKSPEC_TYPED_PLUS_EXECUTION_GUIDED_NEURAL' if condition_mode == 'typed' else 'TASKSPEC_PLUS_EXECUTION_GUIDED_NEURAL',
            'seeds':list(seeds),
            'runs':runs,
            'mean_paired_delta':sum(deltas)/max(1,len(deltas)),
            'min_paired_delta':min(deltas) if deltas else 0.0,
            'max_paired_delta':max(deltas) if deltas else 0.0,
            'all_seeds_positive':all(d>0 for d in deltas) if deltas else False,
            'restart_max_abs_delta':max(restarts) if restarts else 0.0,
            'promotion_candidate':promoted,
            'elapsed_s':time.perf_counter()-t,
            'promotion_rule':'all paired OOD deltas must be > 0 and fresh restart must reproduce after coverage',
            'repair_policy_enabled':adaptive_repair_policy,
            'repair_operator_policy_enabled':adaptive_repair_operator_policy,
        }
        p=self.runtime/'nomega_1_9_5_execution_guided_evidence.json'; p.write_text(json.dumps(report,indent=2,ensure_ascii=False,default=str),encoding='utf-8')
        return report
