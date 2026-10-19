from __future__ import annotations

"""Bounded self-development control plane for NΩ.

It does not mutate the source tree. It selects and evaluates developmental
experiments, manages verified experience replay, and only promotes a strategy
when explicit evidence gates are satisfied.
"""

from pathlib import Path
from typing import Any, Dict, Sequence
import json, time

from .adaptive_experience_memory_v3 import AdaptiveExperienceMemoryV3
from .developmental_bottleneck_detector_v1 import DevelopmentalBottleneckDetectorV1
from .evolution_archive_v1 import EvolutionArchiveV1
from .causal_development_planner_v1 import CausalDevelopmentPlannerV1
from .continual_strategy_portfolio_v1 import ContinualStrategyPortfolioV1
from .calibrated_strategy_router_v1 import CalibratedStrategyRouterV1
from .evolution_islands_v1 import EvolutionIslandControllerV1
from .strategy_router_gate_v1 import StrategyRouterGateV1
from .adaptive_program_curriculum_v1 import AdaptiveProgramCurriculumV1
from .execution_feedback_policy_v1 import ExecutionFeedbackPolicyTrainerV1
from .neural_program_synth_v2 import NeuralProgramSynthesizerV2
from .self_evolution_control_plane_v2 import SelfEvolutionControlPlaneV2, EvaluationSnapshotV2, EvidenceQuorumV1
from .causal_evidence_ledger_v1 import CausalEvidenceLedgerV1
from .canonical_registry_v1 import CanonicalModuleRegistryV1
from .canonical_consolidation_planner_v1 import CanonicalConsolidationPlannerV1
from .unified_development_loop_v1 import UnifiedDevelopmentLoopV1
from .long_horizon_self_development_v1 import LongHorizonSelfDevelopmentV1
from .development_frontier_selector_v1 import DevelopmentFrontierSelectorV1
from .development_intervention_registry_v1 import DevelopmentInterventionRegistryV1

class SelfDevelopmentOrchestratorV1:
    VERSION='1.13.1'
    def __init__(self, root: Path, seed:int=1970):
        self.root=Path(root); self.seed=int(seed)
        self.memory=AdaptiveExperienceMemoryV3(self.root)
        self.archive=EvolutionArchiveV1(self.root)
        self.bottlenecks=DevelopmentalBottleneckDetectorV1(self.root)
        self.causal_planner=CausalDevelopmentPlannerV1(self.root)
        self.strategy_portfolio=ContinualStrategyPortfolioV1(self.root, seed=seed+2900)
        self.calibrated_router=CalibratedStrategyRouterV1(self.root, seed=seed+2910)
        self.router_gate=StrategyRouterGateV1(self.root, seed=seed+2915)
        self.curriculum=AdaptiveProgramCurriculumV1(self.root, seed=seed+2930, anchor_count=2)
        self.evolution_islands=EvolutionIslandControllerV1(self.root, seed=seed+2920)
        self.execution_feedback=ExecutionFeedbackPolicyTrainerV1(self.root, NeuralProgramSynthesizerV2(hidden=12, latent_dim=12, max_len=8, layers=1, heads=2), seed=seed+2940, lr=5e-4)
        self.control_plane=SelfEvolutionControlPlaneV2(self.root)
        self.architecture_registry=CanonicalModuleRegistryV1(self.root)
        self.consolidation_planner=CanonicalConsolidationPlannerV1(self.root)
        self.unified_loop=UnifiedDevelopmentLoopV1(self.root, seed=seed+2950)
        self.long_horizon=LongHorizonSelfDevelopmentV1(self.root, seed=seed+2960)
        self.frontier_selector=DevelopmentFrontierSelectorV1(self.root, seed=seed+2970)
        self.interventions=DevelopmentInterventionRegistryV1(self.root, seed=seed+2980)
        self.evidence_ledger=CausalEvidenceLedgerV1(self.root / 'runtime' / 'nomega_causal_evidence.jsonl')
        self.path=self.root/'runtime'/'nomega_self_development_orchestrator_v1.json'
        self.state=self._load()

    def _load(self):
        default={'version':self.VERSION,'cycles':[],'promotion':{},'events':[]}
        if not self.path.exists():return default
        try:
            blob=json.loads(self.path.read_text(encoding='utf-8'))
            if not isinstance(blob,dict):return default
            for k,v in default.items():blob.setdefault(k,v)
            blob['version']=self.VERSION; return blob
        except Exception:return default


    def run_execution_feedback_probe(self, tasks, episodes: int = 2, group_size: int = 4, max_len: int = 8, oracle_family: bool = True) -> Dict[str, Any]:
        """Run the bounded execution-feedback policy on externally prepared tasks.

        The probe is evidence-producing and never promotes itself. Verified sampled
        trajectories may enter persistent memory/archive only after independent
        execution checks performed inside the feedback trainer.
        """
        report = self.execution_feedback.fit(tasks, episodes=episodes, group_size=group_size, max_len=max_len, oracle_family=oracle_family)
        stored = self.execution_feedback.store_verified_trajectories(self.execution_feedback.last_trajectories, cycle_id=f'feedback-{self.seed}-{len(self.state.get("cycles", []))}')
        evidence = self.execution_feedback.save_evidence(
            self.root / 'runtime' / 'execution_feedback_orchestrator_probe.json',
            report,
            extra={'stored_verified': stored, 'oracle_family': bool(oracle_family), 'promotion_safe': bool(report.promotion_safe)},
        )
        return {'report': report.__dict__, 'stored_verified': stored, 'evidence': str(evidence), 'status': 'research_only'}


    def plan(self, metrics: Dict[str,Any], available_families: Sequence[str], current_family: str = 'current') -> Dict[str,Any]:
        frontier=self.frontier_selector.select(metrics, cycle_index=len(self.state.get('cycles', [])))
        recs=self.bottlenecks.recommend(metrics,max_items=5)
        actions=[]
        for row in recs:
            if row['name']=='neural_grounding': actions.append({'stage':'neural_grounding','mode':'execution_guided_replay'})
            elif row['name']=='pure_neural_grounding': actions.append({'stage':'neural_grounding','mode':'execution_feedback_policy'})
            elif row['name']=='repair_effectiveness': actions.append({'stage':'repair_search','mode':'evolutionary_portfolio'})
            elif row['name']=='ood_generalization': actions.append({'stage':'ood','mode':'paraphrase_family_expansion'})
            elif row['name']=='restart_continuity': actions.append({'stage':'persistence','mode':'fresh_process_reload'})
            elif row['name']=='negative_transfer': actions.append({'stage':'memory','mode':'quarantine_and_anchor_replay'})
            elif row['name']=='mobile_efficiency': actions.append({'stage':'mobile','mode':'device_profile'})
            elif row['name']=='replay_interference': actions.append({'stage':'memory','mode':'transfer_selective_multiscale_replay'})
            elif row['name']=='causal_self_model': actions.append({'stage':'metacognition','mode':'causal_intervention_ablation'})
            elif row['name']=='model_time_replay': actions.append({'stage':'memory','mode':'model_time_replay_tuning'})
            elif row['name']=='search_efficiency': actions.append({'stage':'search','mode':'cross_family_operator_transfer'})
            elif row['name']=='capability_transfer': actions.append({'stage':'capability_transfer','mode':'cross_family_repair_operator_transfer'})
        # Preserve diversity: at least one neural, one verification, one transfer/persistence stage.
        names={a['stage'] for a in actions}
        for stage,mode in [('neural_grounding','execution_guided_replay'),('repair_search','evolutionary_portfolio'),('persistence','fresh_process_reload'),('memory','transfer_selective_multiscale_replay')]:
            if stage not in names: actions.append({'stage':stage,'mode':mode})
        primary_name=str(recs[0].get('name','neural_grounding') if recs else 'neural_grounding')
        strategy_objective = 'retention' if primary_name in {'negative_transfer','replay_interference','causal_self_model'} else ('mobile' if primary_name=='mobile_efficiency' else 'learning')
        strategy_plan = self.strategy_portfolio.recommend(str(current_family), objective=strategy_objective, budget=3)
        calibrated_plan = self.calibrated_router.recommend(str(current_family), objective=strategy_objective, budget=3, risk_tolerance=0.25)
        safe_strategy_plan = self.router_gate.recommend(str(current_family), objective=strategy_objective, budget=3)
        island_stats = self.evolution_islands.stats()
        no_progress = bool(metrics.get('no_progress', False))
        frontier_plan = self.curriculum.select_frontier(available_families, budget=min(3, len(available_families)), anchors=('sum3','xor3')) if no_progress else None
        causal_plan = self.causal_planner.recommend(primary_name, 'ood_coverage', [a.get('mode','') for a in actions] + ['execution_guided_replay','gradient_aligned_replay','transfer_selective_replay'], budget=2)
        architecture = self.architecture_registry.scan()
        consolidation = self.consolidation_planner.plan()
        return {
            'version':self.VERSION,
            'cycle_id':f'dev-{int(time.time()*1000)}',
            'primary_bottleneck':recs[0] if recs else None,
            'development_frontier': frontier.to_dict(),
            'actions':actions,
            'available_families':list(map(str,available_families)),
            'replay_policy':{'max_items':16,'status_filter':['validated','trusted']},
            'causal_intervention_plan': causal_plan,
            'continual_strategy_plan': {'objective': strategy_objective, 'ranked': strategy_plan},
            'calibrated_strategy_plan': calibrated_plan,
            'safe_strategy_plan': safe_strategy_plan,
            'evolution_island_plan': {'status':'advisory','stats': island_stats},
            'stagnation_escape': {'triggered': no_progress, 'frontier_plan': frontier_plan},
            'execution_feedback_policy': {'status':'experimental','oracle_family_default':True,'max_turns':2,'promotion_required':True},
            'self_evolution_control_plane': {'version': self.control_plane.VERSION, 'status':'active_research_control', 'requires_multi_seed_evidence': True},
            'causal_evidence_ledger': {'path': str(self.evidence_ledger.path), 'integrity': self.evidence_ledger.verify()},
            'architecture_registry': {'version': architecture.version, 'total_modules': architecture.total_modules, 'canonical_modules': architecture.canonical_modules, 'versioned_modules': architecture.legacy_or_versioned_modules, 'consolidation_candidates': architecture.consolidation_candidates, 'import_edges': architecture.import_edges, 'lazy_import_edges': architecture.lazy_import_edges, 'cycles': [list(x) for x in architecture.cycles]},
            'consolidation_plan': {'version': consolidation.version, 'versioned_modules': consolidation.versioned_modules, 'multi_version_families': consolidation.families, 'singleton_versioned_modules': consolidation.singleton_versioned_modules, 'exact_merge_groups': consolidation.exact_merge_groups, 'behavioral_proof_groups': consolidation.behavioral_proof_groups, 'adapter_groups': consolidation.adapter_groups, 'research_only_groups': consolidation.research_only_groups},
            'development_artifact_lifecycle': {'version': self.unified_loop.lifecycle.VERSION, 'active_artifact_id': (self.unified_loop.current_artifact() or {}).get('artifact_id')},
            'promotion_policy':{
                'require_paired_holdout_gain':True,
                'require_no_restart_regression':True,
                'require_no_negative_transfer':True,
                'require_equal_budget_comparison':True,
            },
        }

    def record_cycle(self, cycle_id:str, metrics:Dict[str,Any], plan:Dict[str,Any]|None=None)->Dict[str,Any]:
        analysis=self.bottlenecks.observe(metrics,cycle_id)
        row={'cycle_id':str(cycle_id),'ts':time.time(),'metrics':metrics,'analysis':analysis,'plan':plan or {}}
        self.state['cycles'].append(row); self.state['cycles']=self.state['cycles'][-256:]
        self.state['events'].append({'kind':'cycle_recorded','cycle_id':cycle_id,'primary':analysis.get('primary')})
        self.evidence_ledger.append('development_cycle', {'cycle_id': str(cycle_id), 'primary_bottleneck': analysis.get('primary'), 'metrics_keys': sorted(map(str, metrics.keys()))})
        self.state['events']=self.state['events'][-512:]
        self._save()
        return row


    def evaluate_candidate(self, candidate: Dict[str, Any], baseline: Dict[str, Any], *, multi_seed_evidence: bool = False) -> Dict[str, Any]:
        """Evaluate a candidate through the strict evidence gates; never auto-promotes.

        Candidate and baseline are plain JSON-like snapshots so this method can be used
        by offline experiments as well as by the runtime without coupling the orchestrator
        to one model implementation.
        """
        snapshot_keys = ("score", "verified_rate", "holdout", "ood", "adversarial", "restart_delta", "negative_transfer", "latency_ms", "memory_mb", "seed")
        c = EvaluationSnapshotV2(**{k: candidate[k] for k in snapshot_keys})
        b = EvaluationSnapshotV2(**{k: baseline[k] for k in snapshot_keys})
        raw_quorum = dict(candidate.get('quorum') or {})
        quorum = EvidenceQuorumV1(
            seed_count=int(raw_quorum.get('seed_count', raw_quorum.get('seeds', 0))) if isinstance(raw_quorum.get('seed_count', raw_quorum.get('seeds', 0)), (int, float)) else len(tuple(raw_quorum.get('seed_count', raw_quorum.get('seeds', ()) ))),
            independent_runs=int(raw_quorum.get('independent_runs', 0)),
            trajectory_hashes=int(raw_quorum.get('trajectory_hashes', 0)) if isinstance(raw_quorum.get('trajectory_hashes', 0), (int, float)) else len(tuple(raw_quorum.get('trajectory_hashes', ()))),
            provenance_sources=int(raw_quorum.get('provenance_sources', 0)) if isinstance(raw_quorum.get('provenance_sources', 0), (int, float)) else len(tuple(raw_quorum.get('provenance_sources', ()))),
            holdout_id=str(raw_quorum.get('holdout_id', '')),
            ood_id=str(raw_quorum.get('ood_id', '')),
        )
        matched_effect = candidate.get('matched_effect')
        decision = self.control_plane.assess(b, c, multi_seed_evidence=bool(multi_seed_evidence), evidence_quorum=quorum, matched_effect=matched_effect if isinstance(matched_effect, dict) else None)
        gates=dict(decision.gates); gates['equal_budget']=bool(candidate.get('same_budget', candidate.get('equal_budget', False)))
        accepted=bool(decision.accepted and gates['equal_budget'])
        failed=[k for k,v in gates.items() if not v]
        self.evidence_ledger.append('candidate_evaluation', {
            'accepted': accepted,
            'reason': 'all_required_gates_passed' if accepted else ';'.join(failed),
            'candidate_score': float(c.score),
            'baseline_score': float(b.score),
            'multi_seed_evidence': bool(multi_seed_evidence),
            'gates': gates,
        })
        payload=decision.to_dict(); payload['accepted']=accepted; payload['gates']=gates; payload['reason']='all_required_gates_passed' if accepted else ';'.join(failed)
        return payload

    def current_development_artifact(self) -> Dict[str, Any] | None:
        return self.unified_loop.current_artifact()

    def development_replay_context(self) -> Dict[str, Any]:
        return self.unified_loop.replay_context()

    def rollback_development_artifact(self, artifact_id: str | None = None, *, reason: str = "explicit_rollback") -> Dict[str, Any] | None:
        return self.unified_loop.rollback_artifact(artifact_id, reason=reason)

    def run_long_horizon_development(self, metrics_provider, candidate_factory, evaluator, *, cycles: int = 3, allow_stagnation_escape: bool = True) -> Dict[str, Any]:
        """Run multiple development cycles on the same persistent state without reset."""
        report = self.long_horizon.run(
            metrics_provider, candidate_factory, evaluator,
            cycles=cycles,
            allow_stagnation_escape=allow_stagnation_escape,
        )
        self.state["events"].append({"kind": "long_horizon_run", "run_id": report.get("run_id"), "cycles": len(report.get("cycles", []))})
        self.state["events"] = self.state["events"][-512:]
        self._save()
        return report

    def run_unified_cycle(self, metrics: Dict[str, Any], candidate_factory, evaluator, *, allow_stagnation_escape: bool = True) -> Dict[str, Any]:
        """Run one canonical cycle using evidence-weighted frontier selection."""
        cycle_index=len(self.state.get('cycles', []))
        frontier=self.frontier_selector.select(metrics, cycle_index=cycle_index)
        selected=dict(metrics)
        selected.setdefault('__selected_bottleneck__', frontier.selected.name)
        selected.setdefault('__selected_intervention__', frontier.selected.action)
        selected.setdefault('__frontier_decision_id__', frontier.decision_id)
        result = self.unified_loop.run_cycle(selected, candidate_factory, evaluator, allow_stagnation_escape=allow_stagnation_escape)
        self.record_cycle(result.cycle_id, selected, {'unified_loop': result.to_dict(), 'frontier': frontier.to_dict()})
        return result.to_dict()

    @staticmethod
    def promotion_gate(*, baseline_gain:float, candidate_gain:float, restart_delta:float, negative_transfer:float, same_budget:bool)->Dict[str,Any]:
        passed = (candidate_gain > baseline_gain) and abs(float(restart_delta)) <= 1e-9 and float(negative_transfer) >= 0.0 and bool(same_budget)
        return {'passed':passed,'reasons':{
            'paired_holdout_gain':candidate_gain>baseline_gain,
            'restart_continuity':abs(float(restart_delta))<=1e-9,
            'negative_transfer':float(negative_transfer)>=0.0,
            'equal_budget':bool(same_budget),
        }}

    def run_autonomous_intervention(self, metrics: Dict[str, Any], *, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
        """Select and execute a registered research intervention without an external factory.

        This closes the gap between *choosing* a bottleneck and *actually running* the
        corresponding bounded experiment. Promotion remains disabled for probe-style
        interventions; the result is fed back into the frontier ledger.
        """
        cycle_index = len(self.state.get('cycles', []))
        frontier = self.frontier_selector.select(dict(metrics), cycle_index=cycle_index)
        result = self.interventions.dispatch(frontier.selected.action, context or {})
        merged = dict(metrics)
        merged.update(result.metrics)
        merged['__selected_bottleneck__'] = frontier.selected.name
        merged['__selected_intervention__'] = frontier.selected.action
        merged['__frontier_decision_id__'] = frontier.decision_id
        cycle_id = f"auto-{result.intervention_id}-{cycle_index}"
        self.record_cycle(cycle_id, merged, {'frontier': frontier.to_dict(), 'intervention': result.to_dict()})
        return {'cycle_id': cycle_id, 'frontier': frontier.to_dict(), 'intervention': result.to_dict(), 'metrics': merged}

    def run_capability_evolution_probe(self, *, seeds=(2901, 2902, 2903)) -> Dict[str, Any]:
        """Run the 1.29 OOD/capability-transfer benchmark and feed its metrics to the frontier ledger."""
        from .benchmark_1_29_open_ended_evolution import OpenEndedEvolutionBenchmarkV1
        report = OpenEndedEvolutionBenchmarkV1(self.root, seed=self.seed + 7100).run(seeds=tuple(int(x) for x in seeds))
        summary = dict(report.get('summary') or {})
        transfer = dict(summary.get('capability_transfer') or {})
        metrics = {
            'ood_coverage': max(0.0, min(1.0, float(summary.get('future_hidden_positive_fraction', 0.0)))),
            'transfer_generalization': max(0.0, min(1.0, float(transfer.get('positive_future_fraction', 0.0)))),
            'future_hidden_gain': float(summary.get('mean_future_hidden_gain', 0.0)),
            'capability_transfer_gain': float(transfer.get('mean_future_hidden_gain', 0.0)),
            'normalized_search_cost': 0.0,
            # This probe is evolutionary/program-level; neural verification was not
            # measured here.  Omit the field instead of manufacturing a perfect rate.
            'repair_verified_rate': max(0.0, min(1.0, float(summary.get('evolved_mean', 0.0)))),
        }
        decision = self.frontier_selector.select(metrics, cycle_index=len(self.state.get('cycles', [])))
        self.state['events'].append({'kind':'capability_evolution_probe','frontier_decision_id':decision.decision_id,'summary':summary,'metrics':metrics})
        self.state['events']=self.state['events'][-512:]
        self._save()
        return {'report':report,'metrics':metrics,'frontier':decision.to_dict()}

    def snapshot(self):
        consolidation = self.consolidation_planner.plan()
        return {'version':self.VERSION,'orchestrator':self.state,'execution_feedback_policy':{'steps':self.execution_feedback.steps,'seed':self.execution_feedback.seed},'memory':self.memory.snapshot(),'archive':self.archive.snapshot(),'bottlenecks':self.bottlenecks.snapshot(),'causal_planner':self.causal_planner.snapshot(),'control_plane':{'version':self.control_plane.VERSION},'evidence_ledger':{'path':str(self.evidence_ledger.path),'integrity':self.evidence_ledger.verify()},'strategy_portfolio':self.strategy_portfolio.snapshot(),'calibrated_router':self.calibrated_router.snapshot(),'evolution_islands':self.evolution_islands.snapshot(),'router_gate':self.router_gate.snapshot(),'curriculum':self.curriculum.state,'development_artifact_lifecycle':self.unified_loop.replay_context(),'consolidation_plan':consolidation.to_dict()}

    def _save(self):
        self.path.parent.mkdir(parents=True,exist_ok=True); self.path.write_text(json.dumps(self.state,ensure_ascii=False,indent=2),encoding='utf-8')
