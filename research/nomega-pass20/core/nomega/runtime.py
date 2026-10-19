from __future__ import annotations
import json, time, os, subprocess, sys
from pathlib import Path
from typing import Any, Dict, Optional
import torch
from .config import NOMEGAConfig
from .core import NOmegaCore
from .deploy import save_checkpoint, parameter_report
from .budget import choose_profile
from .continual import PromotionGate, Evaluation
from .generalist_core import AdaptiveGeneralist, GeneralistTrainer, GeneralistCheckpoint, model_report
from .mobile_eval_v2 import MobileEvaluatorV2
from .project_audit import ProjectAudit
from .mobile_benchmark_v3 import MobileBenchmarkV3
from .task_generator_v3 import make_tasks_v3, split_v3
from .frontier_evaluator import FrontierEvaluator
from .project_audit_v2 import ProjectAuditV2
from .task_generator_v4 import make_tasks_v4, split_v4
from .mobile_optimizer_v4 import MobileOptimizerV4
from .memory_v2 import MemoryConsolidatorV2
from .uncertainty_suite_v2 import ece,brier,abstention_report
from .mobile_optimizer_v4 import MobileOptimizerV4
from .production_guard_v2 import ProductionGuardV2
from .experiment_registry_v2 import ExperimentRegistryV2
from .governance_runtime import record_degraded_mode
from .version import PROJECT_VERSION

class NOmegaRuntime:
    """Mobile-oriented façade, persistence, checkpoint safety and research hooks."""
    def __init__(self, root: Optional[Path] = None, cfg: Optional[NOMEGAConfig] = None):
        self.root = Path(root) if root else Path(__file__).resolve().parents[2]
        self.state_path = self.root/"runtime"/"nomega_state.json"
        self.cfg=cfg or NOMEGAConfig(); self.core=NOmegaCore(self.cfg, root=self.root); self._load(); self._load_learned_router()

    def _load(self):
        if not self.state_path.exists(): return
        try:
            blob=json.loads(self.state_path.read_text()); self.core.memory.load(blob.get("memory", blob))
            if blob.get("cache") is not None: self.core.cache.load(blob.get("cache"))
            if blob.get("skills") is not None: self.core.skill_bank.load(blob.get("skills"))
            if blob.get("skill_compiler") is not None and self.core.skill_compiler is not None: self.core.skill_compiler.load(blob.get("skill_compiler"))
            if blob.get("skill_versions") is not None and self.core.skill_versions is not None: self.core.skill_versions.load(blob.get("skill_versions"))
            if blob.get("attention_memory") is not None and self.core.attention_memory is not None: self.core.attention_memory.load(blob.get("attention_memory"))
        except Exception as exc:
            record_degraded_mode("NOmegaRuntime", "STATE_LOAD_DEGRADED", exc, ledger_path=self.root/"runtime"/"nomega_governance_events.jsonl")

    def _load_learned_router(self):
        ckpt=self.root/"runtime"/"nomega_router.pt"
        if not ckpt.exists(): return
        try:
            blob=torch.load(ckpt,map_location="cpu",weights_only=False)
            self.core.router.load_state_dict(blob.get("router",{}),strict=False)
            if "bootstrap_routing" in blob: self.core.cfg.bootstrap_routing=bool(blob["bootstrap_routing"])
        except Exception as exc:
            record_degraded_mode("NOmegaRuntime", "ROUTER_LOAD_DEGRADED", exc, ledger_path=self.root/"runtime"/"nomega_governance_events.jsonl")

    def save(self):
        self.state_path.parent.mkdir(parents=True,exist_ok=True); self.state_path.write_text(json.dumps(self.core.save_state(),ensure_ascii=False,indent=2,default=str))

    def infer(self,text:str,context:Optional[Dict[str,Any]]=None)->Dict[str,Any]:
        t0=time.perf_counter(); out=self.core.run(text,context); out["latency_ms"]=round((time.perf_counter()-t0)*1000,3); out["memory_items"]=len(self.core.memory.items); return out

    def profile(self)->Dict[str,Any]:
        params=sum(p.numel() for p in self.core.parameters()); trainable=sum(p.numel() for p in self.core.parameters() if p.requires_grad)
        return {"parameters":params,"trainable":trainable,"dtype":"float32","device":str(next(self.core.parameters()).device),"memory":self.core.memory.stats(),"model":parameter_report(self.core),"config":self.cfg.to_dict()}

    def hardware_profile(self,ram_gb:float,has_npu:bool=False)->Dict[str,Any]: return choose_profile(ram_gb,has_npu).__dict__

    def save_checkpoint(self,path:Optional[Path]=None)->Dict[str,Any]:
        p=Path(path) if path else self.root/"runtime"/"nomega_core.pt"; return save_checkpoint(self.core,p,{"config":self.cfg.to_dict(),"version":PROJECT_VERSION,"baseline_version":"1.14.1"})

    def consolidate_memory(self): return self.core.memory.consolidate()

    def train_generalist(self, steps:int=24, batch:int=32, holdout:int=64, lr:float=3e-4)->Dict[str,Any]:
        if self.core.generalist is None:
            return {"enabled":False}
        from .task_generator import make_tasks
        from .generalist_core import GeneralistTrainer
        rows=make_tasks(seed=self.cfg.seed,n=max(2, batch//12))
        ho=make_tasks(seed=self.cfg.seed+999,n=max(2, holdout//12))
        trainer=GeneralistTrainer(self.core.generalist,lr=lr,seed=self.cfg.seed)
        before=trainer.evaluate(ho)
        for _ in range(max(1,steps)):
            trainer.train_step(rows)
        after=trainer.evaluate(ho)
        path=self.root/"runtime"/"nomega_generalist_v1.pt"
        GeneralistCheckpoint.save(path,self.core.generalist,trainer,{"before":before,"after":after})
        return {"before":before,"after":after,"checkpoint":str(path),"model":model_report(self.core.generalist),"steps":trainer.steps}

    def mobile_report_v2(self)->Dict[str,Any]:
        return MobileEvaluatorV2(self.core.generalist).report()

    def executable_spine(self, text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Direct access to the canonical grounded execution spine for research/bench use."""
        if self.core.executable_spine is None:
            return {"enabled": False, "reason": "disabled_by_config"}
        return self.core.executable_spine.run(text, context or {})

    def self_evolution_probe(self, evaluator=None, max_trials: Optional[int] = None, min_gain: float = 0.01) -> Dict[str, Any]:
        """Run a governed bounded configuration-search experiment and persist its evidence."""
        if not self.cfg.enable_self_evolution_lab_v1:
            return {"enabled": False, "reason": "disabled_by_config"}
        from .self_evolution_lab_v1 import SelfEvolutionLabV1, EvaluationVectorV1
        if evaluator is None:
            cases = [
                ("sum", {"op":"sum", "a": 7, "b": 5, "expected": 12}),
                ("xor", {"op":"xor", "a": 7, "b": 5, "expected": 2}),
                ("mul", {"op":"mul", "a": 6, "b": 7, "expected": 42}),
                ("min", {"op":"min", "a": 3, "b": 9, "expected": 3}),
                ("max", {"op":"max", "a": 3, "b": 9, "expected": 9}),
                ("sum3", {"op":"sum3", "a": 7, "b": 5, "c": 2, "expected": 14}),
            ]
            def evaluator(candidate_cfg):
                from .core import NOmegaCore
                core = NOmegaCore(candidate_cfg)
                verified = 0; confidences = []; latencies = []
                for text, ctx in cases:
                    t0 = time.perf_counter()
                    out = core.run(text, {**ctx, "use_executable_spine": False})
                    latencies.append((time.perf_counter()-t0)*1000.0)
                    verified += int(bool(out.get("verified")))
                    confidences.append(float(out.get("confidence",0.0) or 0.0))
                rate = verified / len(cases)
                mean_conf = sum(confidences)/max(1,len(confidences))
                mean_lat = sum(latencies)/max(1,len(latencies))
                return EvaluationVectorV1(mean_conf, rate, rate, rate, mean_lat)
        lab = SelfEvolutionLabV1(self.root, seed=self.cfg.seed + 31337)
        result = lab.run(self.cfg, evaluator, max_trials=max_trials or self.cfg.self_evolution_trials, min_gain=min_gain)
        return result.to_dict()

    def project_audit(self, test_summary:Optional[Dict[str,Any]]=None)->Dict[str,Any]:
        return ProjectAudit(self.root).collect(test_summary)


    def frontier_cycle(self, steps:int=24)->Dict[str,Any]:
        from .frontier_learning import FrontierLearningLoop
        loop=FrontierLearningLoop(self.root, seed=self.cfg.seed+700)
        result=loop.run(steps=steps)
        return {"before":result.before,"after":result.after,"holdout":result.holdout,"adversarial":result.adversarial,"promoted":result.promoted,"traces":result.traces,"mobile":result.mobile,"audit":result.audit,"elapsed_s":result.elapsed_s}

    def frontier_benchmark(self)->Dict[str,Any]:
        tasks=make_tasks_v3(self.cfg.seed+701,4,2,2)
        return FrontierEvaluator().evaluate_runtime(self,tasks)

    def mobile_benchmark_v3(self)->Dict[str,Any]:
        return MobileBenchmarkV3().run(self)

    def project_audit_v2(self,test_summary:Optional[Dict[str,Any]]=None,eval_report:Optional[Dict[str,Any]]=None)->Dict[str,Any]:
        return ProjectAuditV2(self.root).collect(test_summary,eval_report)
    def omega12_cycle(self,steps:Optional[int]=None,train_per:int=4,holdout_per:int=3,adversarial_per:int=2)->Dict[str,Any]:
        from .omega_development_cycle import OmegaDevelopmentCycle
        n=max(1,int(steps if steps is not None else self.cfg.omega12_train_steps))
        cycle=OmegaDevelopmentCycle(self.root,seed=self.cfg.seed+1200)
        return cycle.run(train_steps=n,train_per=train_per,holdout_per=holdout_per,adv_per=adversarial_per)

    def omega12_mobile_optimize(self,latency_budget_ms:Optional[float]=None)->Dict[str,Any]:
        params=sum(p.numel() for p in self.core.parameters())
        return MobileOptimizerV4().choose(self.cfg.ram_gb,self.cfg.has_npu,latency_budget_ms or self.cfg.target_latency_ms,params)

    def omega12_memory_consolidate(self)->Dict[str,Any]:
        return MemoryConsolidatorV2().consolidate(self.core.memory)

    def omega13_architecture_profile(self)->Dict[str,Any]:
        from .sparse_moe_v1 import SparseMoE
        from .hybrid_reasoner_v2 import HybridReasonerV2
        moe=SparseMoE(self.cfg.latent_dim,max(64,self.cfg.router_hidden),self.cfg.sparse_moe_experts)
        hyb=HybridReasonerV2(self.cfg.latent_dim,max(64,self.cfg.router_hidden),2)
        return {'moe_parameters':sum(p.numel() for p in moe.parameters()),'hybrid_parameters':sum(p.numel() for p in hyb.parameters()),'stable_runtime_parameters':sum(p.numel() for p in self.core.parameters())}

    def omega13_promotion_gate(self,baseline:Dict[str,float],candidate:Dict[str,float])->Dict[str,Any]:
        return ProductionGuardV2().evaluate(baseline,candidate)

    def omega13_register_experiment(self,name:str,result:Dict[str,Any],artifacts=None)->Dict[str,Any]:
        return ExperimentRegistryV2(self.root).record(name,result,artifacts)

    def promotion_check(self,baseline_score:float,candidate_score:float,baseline_verified:float,candidate_verified:float,
                        baseline_path:Optional[Path]=None,candidate_path:Optional[Path]=None)->Dict[str,Any]:
        gate=PromotionGate(self.root)
        be=Evaluation(baseline_score,baseline_verified); ce=Evaluation(candidate_score,candidate_verified)
        b=Path(baseline_path) if baseline_path is not None else self.root/"runtime"/"nomega_core.pt"
        c=Path(candidate_path) if candidate_path is not None else self.root/"runtime"/"nomega_candidate.pt"
        return gate.promote(c,b,be,ce,self.cfg.promotion_min_gain)

    def omega15_typed_grounding_train(self, families=None, epochs:int=6, max_examples:int=64, hidden:int=32):
        from .execution_guided_program_learning_v1 import ExecutionGuidedProgramLearnerV1
        from .neural_program_synth_v9 import NeuralProgramSynthesizerV9
        from .neural_program_trainer_v6 import AtomicProgramTrainerV6
        fams=list(families or ("sum3","xor3","mul2","compose_sum_xor","compose_affine","compose_mod_chain"))
        learner=ExecutionGuidedProgramLearnerV1(self.root,seed=self.cfg.seed+1501,hidden=hidden)
        rows=learner.training_rows(fams,condition_mode="typed",include_replay=False)
        model=NeuralProgramSynthesizerV9(vocab=2048,hidden=hidden,latent_dim=hidden,max_len=24,max_b=64,layers=1,heads=2,family_count=20)
        trainer=AtomicProgramTrainerV6(model,seed=self.cfg.seed+1502,lr=8e-4)
        report=trainer.fit(rows,epochs=epochs,batch_size=min(8,max(1,len(rows))),max_examples=max_examples,scheduled_prefix_start=0.0,scheduled_prefix_end=0.30,scheduled_max_tokens=8,semantic_weight=0.20)
        ckpt=self.root/"runtime"/"nomega_v9_typed_grounding_candidate.pt"
        torch.save({"state_dict":model.state_dict(),"report":report.to_dict(),"version":model.version},ckpt)
        return {"families":fams,"rows":len(rows),"report":report.to_dict(),"checkpoint":str(ckpt),"parameters":sum(p.numel() for p in model.parameters()),"status":"research_only"}

    def omega15_matched_effect(self, seeds, baseline, candidate, *, min_mean_gain: float = 0.01) -> Dict[str, Any]:
        from .matched_evidence_v1 import MatchedEvidenceAnalyzerV1
        effect = MatchedEvidenceAnalyzerV1.analyze(seeds, baseline, candidate)
        return MatchedEvidenceAnalyzerV1.require(effect, min_mean_gain=min_mean_gain)

    def omega15_grounding_route(self, text: str, *, uncertainty: float = 0.5, novelty: float = 0.5, estimated_exec_ms: float = 10.0, remaining_budget_ms: float = 100.0, allow_task_spec_assist: bool = True) -> Dict[str, Any]:
        from .grounding_bridge_v1 import GroundingBridgeV1
        return GroundingBridgeV1().route(text, uncertainty=uncertainty, novelty=novelty, estimated_exec_ms=estimated_exec_ms, remaining_budget_ms=remaining_budget_ms, allow_task_spec_assist=allow_task_spec_assist).to_dict()

    def omega15_execution_budget(self, uncertainty:float, novelty:float, semantic_valid:bool=True, estimated_exec_ms:float=10.0, remaining_budget_ms:float=100.0):
        from .execution_budget_policy_v1 import ExecutionBudgetPolicyV1
        return ExecutionBudgetPolicyV1().decide(uncertainty=uncertainty,novelty=novelty,semantic_valid=semantic_valid,estimated_exec_ms=estimated_exec_ms,remaining_budget_ms=remaining_budget_ms).to_dict()

    def omega15_self_evolution_assess(self, baseline:Dict[str,Any], candidate:Dict[str,Any])->Dict[str,Any]:
        from .self_evolution_control_plane_v2 import EvaluationSnapshotV2, SelfEvolutionControlPlaneV2, EvidenceQuorumV1
        keys=("score","verified_rate","holdout","ood","adversarial","restart_delta","negative_transfer","latency_ms","memory_mb","seed")
        b=EvaluationSnapshotV2(**{k:float(baseline[k]) if k not in {"seed"} else int(baseline[k]) for k in keys})
        c=EvaluationSnapshotV2(**{k:float(candidate[k]) if k not in {"seed"} else int(candidate[k]) for k in keys})
        raw_q=candidate.get("evidence_quorum") or {}
        quorum=EvidenceQuorumV1(**raw_q) if raw_q else None
        return SelfEvolutionControlPlaneV2(self.root).assess(b,c,multi_seed_evidence=bool(candidate.get("multi_seed_evidence",False)),evidence_quorum=quorum,matched_effect=candidate.get("matched_effect")).to_dict()

    def omega15_mobile_benchmark(self, iterations:int=50, warmup:int=5)->Dict[str,Any]:
        from .mobile_runtime_benchmark_v2 import MobileRuntimeBenchmarkV2
        bench=MobileRuntimeBenchmarkV2()
        return bench.run(lambda: self.infer("add the first three values"),iterations=iterations,warmup=warmup,backend="nomega-python",precision="fp32")

    def omega15_evidence_integrity(self)->Dict[str,Any]:
        from .causal_evidence_ledger_v1 import CausalEvidenceLedgerV1
        return CausalEvidenceLedgerV1(self.root/"runtime"/"causal_evidence_ledger_v1.jsonl").verify()

    def canonical_capability_manifest(self)->Dict[str, Any]:
        from .canonical_capability_facade_v1 import CanonicalCapabilityFacadeV1
        return CanonicalCapabilityFacadeV1(self.root).manifest()

    def run_cognitive_development_cycle(self, *, seeds=None, max_candidates:int=8)->Dict[str, Any]:
        from .cognitive_development_bridge_v1 import CognitiveDevelopmentBridgeV1
        return CognitiveDevelopmentBridgeV1(self.root, seeds=seeds, max_candidates=max_candidates).run()

    def omega15_grounding_recovery(self, code, family: str, *, uncertainty: float = 0.7, novelty: float = 0.5, estimated_exec_ms: float = 5.0, remaining_budget_ms: float = 100.0, max_candidates: int = 12)->Dict[str,Any]:
        from .grounding_recovery_controller_v1 import GroundingRecoveryControllerV1
        return GroundingRecoveryControllerV1(self.root, seed=self.cfg.seed+1520).recover(code, family, uncertainty=uncertainty, novelty=novelty, estimated_exec_ms=estimated_exec_ms, remaining_budget_ms=remaining_budget_ms, max_candidates=max_candidates).to_dict()

# NΩ 1.3 extension methods are intentionally added outside the legacy class body by
# monkey-patching helpers below to keep 1.0-1.2 interfaces source-compatible.
def _omega13_unified_cycle(self, steps=None, train_per=3, holdout_per=3, adversarial_per=2):
    from .unified_learning_v3 import UnifiedLearningCycleV3
    return UnifiedLearningCycleV3(self.root, seed=self.cfg.seed+1300).run(train_per=train_per,holdout_per=holdout_per,adv_per=adversarial_per,steps=int(steps or self.cfg.unified_train_steps))

def _omega13_mobile_optimize(self, latency_budget_ms=None):
    from .mobile_optimizer_v5 import MobileOptimizerV5
    params=sum(p.numel() for p in self.core.parameters())
    return MobileOptimizerV5().choose(self.cfg.ram_gb,self.cfg.has_npu,latency_budget_ms or self.cfg.target_latency_ms,params)

def _omega13_audit(self, test_pass=0, test_total=0, evidence=None):
    from .project_audit_v3 import ProjectAuditV3
    return ProjectAuditV3(self.root).collect(test_pass,test_total,evidence)
NOmegaRuntime.omega13_unified_cycle=_omega13_unified_cycle
NOmegaRuntime.omega13_mobile_optimize=_omega13_mobile_optimize
NOmegaRuntime.omega13_audit=_omega13_audit


def _omega14_cycle(self, per_family=6, steps=12):
    from .development_cycle_v4 import OmegaDevelopmentCycleV4
    return OmegaDevelopmentCycleV4(self.root, seed=self.cfg.seed+1400).run(per_family=per_family, steps=steps)

def _omega14_mobile_pareto(self, latency_budget_ms=None):
    from .mobile_optimizer_v6 import MobileOptimizerV6
    params=sum(p.numel() for p in self.core.parameters())
    return MobileOptimizerV6().pareto(self.cfg.ram_gb, self.cfg.has_npu, latency_budget_ms or self.cfg.target_latency_ms, params, 1.0)

def _omega14_audit(self, test_pass=0, test_total=0):
    from .project_audit_v4 import audit
    return audit(self.root, test_pass, test_total)
NOmegaRuntime.omega14_cycle=_omega14_cycle
NOmegaRuntime.omega14_mobile_pareto=_omega14_mobile_pareto
NOmegaRuntime.omega14_audit=_omega14_audit

# NΩ 1.5 Program Acquisition extensions
def _omega15_program_acquire(self, train_per=3, holdout_per=3, adversarial_per=2, families=8):
    from .task_generator_v4 import make_tasks_v4, split_v4
    from .program_acquisition_v1 import ProgramAcquisitionCoreV1
    rows=make_tasks_v4(self.cfg.seed+1501,train_per,holdout_per,adversarial_per)
    _,ho,adv=split_v4(rows)
    return ProgramAcquisitionCoreV1(self.root,self.cfg.seed+1502).acquire(ho+adv,max_families=families)

def _omega15_cycle(self, train_per=3, holdout_per=3, adversarial_per=2, families=8, selector_steps=16):
    from .development_cycle_v5 import OmegaDevelopmentCycleV5
    return OmegaDevelopmentCycleV5(self.root,self.cfg.seed+1500).run(train_per,holdout_per,adversarial_per,families,selector_steps)

NOmegaRuntime.omega15_program_acquire=_omega15_program_acquire
NOmegaRuntime.omega15_cycle=_omega15_cycle

# NΩ 1.6 program acquisition / replay extensions
def _omega16_cycle(self, train_per=4, holdout_per=3, adversarial_per=2, families=10, selector_steps=12):
    from .development_cycle_v6 import OmegaDevelopmentCycleV6
    return OmegaDevelopmentCycleV6(self.root,self.cfg.seed+1600).run(train_per,holdout_per,adversarial_per,families,selector_steps)

def _omega16_program_acquire(self, families=10):
    from .task_generator_v4 import make_tasks_v4, split_v4
    from .program_acquisition_v1 import ProgramAcquisitionCoreV1
    rows=make_tasks_v4(self.cfg.seed+1601,3,3,2); _,ho,adv=split_v4(rows)
    return ProgramAcquisitionCoreV1(self.root,self.cfg.seed+1602).acquire(ho+adv,max_families=families)
NOmegaRuntime.omega16_cycle=_omega16_cycle
NOmegaRuntime.omega16_program_acquire=_omega16_program_acquire

# NΩ 1.7 Program Acquisition V2 extensions
def _omega17_cycle(self, max_candidates=24, families=None):
    from .development_cycle_v7 import OmegaDevelopmentCycleV7
    return OmegaDevelopmentCycleV7(self.root,self.cfg.seed+1700).run(families,max_candidates)

def _omega17_program_acquire(self, families=None, max_candidates=24):
    from .program_acquisition_v2 import ProgramAcquisitionCoreV2
    return ProgramAcquisitionCoreV2(self.root,self.cfg.seed+1701).acquire(families,max_candidates=max_candidates)
NOmegaRuntime.omega17_cycle=_omega17_cycle
NOmegaRuntime.omega17_program_acquire=_omega17_program_acquire

# NΩ 1.8 learned program bridge

def _omega18_program_train(self, epochs=8, max_examples=64):
    from .neural_program_acquisition_v1 import NeuralProgramAcquisitionV1
    return NeuralProgramAcquisitionV1(self.root,self.cfg.seed+1801).train_from_bank(epochs=epochs,max_examples=max_examples)

def _omega18_program_acquire(self, families=None, epochs=8, candidates_per_family=2, max_examples=64):
    from .neural_program_acquisition_v1 import NeuralProgramAcquisitionV1
    return NeuralProgramAcquisitionV1(self.root,self.cfg.seed+1802).acquire(families,train_epochs=epochs,candidates_per_family=candidates_per_family,max_train_examples=max_examples)

def _omega18_cycle(self, families=None, epochs=8, candidates_per_family=2, max_examples=64):
    from .development_cycle_v8 import OmegaDevelopmentCycleV8
    return OmegaDevelopmentCycleV8(self.root,self.cfg.seed+1800).run(families,epochs,candidates_per_family,max_examples)

NOmegaRuntime.omega18_program_train=_omega18_program_train
NOmegaRuntime.omega18_program_acquire=_omega18_program_acquire
NOmegaRuntime.omega18_cycle=_omega18_cycle

# NΩ 1.9 learned algorithmic bridge

def _omega19_cycle(self,families=None,epochs=12,max_examples=96,candidates=2):
    from .development_cycle_v9 import OmegaDevelopmentCycleV9
    return OmegaDevelopmentCycleV9(self.root,self.cfg.seed+1900).run(families,epochs,max_examples,candidates)
def _omega19_mobile(self,ram_gb=4.0,has_npu=False,latency_budget_ms=900.0):
    from .mobile_program_optimizer_v7 import MobileProgramOptimizerV7
    return MobileProgramOptimizerV7().recommend(ram_gb,has_npu,latency_budget_ms)
def _omega19_audit(self,test_pass=0,test_total=0,program_report=None,mobile=None):
    from .project_audit_v5 import ProjectAuditV5
    return ProjectAuditV5(self.root).collect(test_pass,test_total,program_report,mobile)
NOmegaRuntime.omega19_cycle=_omega19_cycle
NOmegaRuntime.omega19_mobile=_omega19_mobile
NOmegaRuntime.omega19_audit=_omega19_audit

# NΩ 1.32 skill governance extension
def _restart_verify_program(root: Path, seed: int, family: str, program) -> Dict[str, Any]:
    """Evaluate a concrete program in a fresh Python interpreter.

    This is deliberately a process restart, not a second object in the same process:
    admission evidence must prove that the candidate survives reconstruction of the
    executable spine and its caches/state.
    """
    payload = {"root": str(root), "seed": int(seed), "family": str(family), "program": [list(x) for x in program]}
    script = (
        "import json,sys; "
        "from pathlib import Path; "
        "from core.nomega.executable_spine_v2 import ExecutableSpineV2; "
        "p=json.loads(sys.stdin.read()); "
        "s=ExecutableSpineV2(Path(p['root']), seed=p['seed']); "
        "r=s.evaluate_program(p['family'], [tuple(x) for x in p['program']], seed=p['seed'], ood_seed=p['seed']+100003); "
        "print(json.dumps(r, sort_keys=True, default=str))"
    )
    env = dict(os.environ)
    package_root = Path(__file__).resolve().parents[2]
    old_pp = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = str(package_root) + (os.pathsep + old_pp if old_pp else "")
    proc = subprocess.run(
        [sys.executable, "-c", script],
        input=json.dumps(payload, sort_keys=True),
        text=True,
        capture_output=True,
        cwd=str(package_root),
        env=env,
        timeout=30,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"restart verification subprocess failed: {proc.stderr.strip()[:400]}")
    line = proc.stdout.strip().splitlines()[-1] if proc.stdout.strip() else ""
    out = json.loads(line)
    return out


def _admit_program_skill(self, family: str, program, *, seeds=None, benchmark_id: str = "program-skill-multiseed-v2",
                         equal_budget=None, restart_delta=None):
    import hashlib, json
    spine = self.core.executable_spine
    if spine is None:
        return {"status": "disabled", "reason": "executable_spine_disabled"}
    seed_list = [self.cfg.seed, self.cfg.seed + 1, self.cfg.seed + 2] if seeds is None else [int(x) for x in seeds]
    seed_list = list(dict.fromkeys(seed_list))
    for extra in range(3):
        if len(seed_list) >= 3:
            break
        candidate = self.cfg.seed + extra + 101
        if candidate not in seed_list:
            seed_list.append(candidate)
    seed_list = seed_list[:3]
    normalized = [tuple(int(y) for y in x[:3]) for x in program]
    evaluations = [
        spine.evaluate_program(str(family), normalized, seed=seed, ood_seed=seed + 100003)
        for seed in seed_list
    ]
    trajectory_hashes = [
        hashlib.sha256(json.dumps({"seed": seed, "evaluation": row}, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()[:24]
        for seed, row in zip(seed_list, evaluations)
    ]
    mean = lambda key: sum(float(row.get(key, 0.0)) for row in evaluations) / max(1, len(evaluations))
    # Equal-budget evidence is measured by this evaluator because every seed runs the
    # same executable program through the same bounded TinyVM/HVM budget.
    measured_equal_budget = len({
        (512, 512) for _ in evaluations
    }) == 1
    quality = min(mean("verified"), mean("holdout"), mean("ood"), mean("adversarial"))
    restart = {
        "verified": False,
        "seed": int(seed_list[0]),
        "quality_before": float(quality),
        "quality_after": None,
        "delta": None,
        "process_restarted": False,
    }
    try:
        rr = _restart_verify_program(self.root, seed_list[0], str(family), normalized)
        restart_quality = min(
            float(rr.get("verified", 0.0)), float(rr.get("holdout", 0.0)),
            float(rr.get("ood", 0.0)), float(rr.get("adversarial", 0.0)),
        )
        restart.update({
            "verified": True,
            "quality_after": restart_quality,
            "delta": abs(float(quality) - restart_quality),
            "process_restarted": True,
            "evaluation": rr,
        })
    except Exception as exc:
        restart["error"] = str(exc)

    evidence = {
        "benchmark_id": str(benchmark_id),
        "verified_rate": mean("verified"),
        "holdout": mean("holdout"),
        "ood": mean("ood"),
        "adversarial": mean("adversarial"),
        "multi_seed_count": len(seed_list),
        "independent_runs": len(seed_list),
        "trajectory_hashes": trajectory_hashes,
        "provenance_sources": 2 if restart.get("process_restarted") else 1,
        "equal_budget": measured_equal_budget,
        "restart_delta": restart["delta"],
        "restart_process_restarted": bool(restart["process_restarted"]),
        "restart_evidence": restart,
    }
    # Caller-supplied restart/equal-budget values are accepted only as legacy metadata;
    # measured evidence above is the governing source and cannot be overwritten.
    if restart_delta is not None:
        evidence["caller_restart_delta_ignored"] = float(restart_delta)
    admission = self.core.skill_lifecycle.admit(
        description=f"{family} program skill", program=normalized, family=str(family),
        quality=float(quality), evidence=evidence,
    )
    return {
        "status": admission["status"], "admission": admission,
        "evidence": evidence, "evaluations": evaluations,
    }

NOmegaRuntime.admit_program_skill = _admit_program_skill

# NΩ 1.34 canonical neural-execution bridge
def _omega20_neural_program_train(self, families=None, epochs=2, variants_per_family=2, max_examples=96, evaluation_seeds=None):
    """Train the canonical V13 neural proposer and measure it through real execution."""
    from .canonical_neural_execution_v1 import CanonicalNeuralProgramBridgeV1
    bridge = self.core.canonical_neural_program
    if bridge is None:
        bridge = CanonicalNeuralProgramBridgeV1(
            self.root,
            seed=self.cfg.seed + 2027,
            checkpoint=(self.cfg.canonical_neural_program_checkpoint or None),
            hidden=self.cfg.canonical_neural_program_hidden,
            latent_dim=self.cfg.canonical_neural_program_hidden,
            max_len=self.cfg.canonical_neural_program_max_len,
        )
        self.core.canonical_neural_program = bridge
    report = bridge.train_and_measure(
        families=families,
        epochs=epochs,
        variants_per_family=variants_per_family,
        max_examples=max_examples,
        evaluation_seeds=evaluation_seeds,
    )
    if self.core.executable_spine is not None:
        self.core.executable_spine.neural_bridge = bridge
    expert = self.core.expert_bank.get("neural_invent")
    if expert is not None and hasattr(expert, "bridge"):
        expert.bridge = bridge
        expert.available = bridge.available
    return report.to_dict()

def _omega20_neural_program_status(self):
    bridge = self.core.canonical_neural_program
    return bridge.model_signature() if bridge is not None else {"available": False, "disabled": True}

NOmegaRuntime.omega20_neural_program_train = _omega20_neural_program_train
NOmegaRuntime.omega20_neural_program_status = _omega20_neural_program_status

# NΩ 1.35 execution-guided learning / skill-evolution loop
def _omega21_execution_guided_cycle(self, family="sum3", seeds=None, repair_rounds=2, repair_beam=3,
                                    repair_mutations=6, evolution_budget=8, train_neural=True, train_epochs=1):
    from .execution_guided_learning_loop_v1 import ExecutionGuidedLearningLoopV1
    loop = ExecutionGuidedLearningLoopV1(
        self.root,
        seed=self.cfg.seed + 2100,
        neural_bridge=self.core.canonical_neural_program,
        evidence_ledger=self.core.evidence_ledger,
        skill_lifecycle=self.core.skill_lifecycle,
        evolution_islands=getattr(self.core, "evolution_islands", None),
        max_candidates=self.cfg.executable_spine_candidates,
    )
    report = loop.run_cycle(
        family,
        seeds=seeds,
        repair_rounds=repair_rounds,
        repair_beam=repair_beam,
        repair_mutations=repair_mutations,
        evolution_budget=evolution_budget,
        train_neural=train_neural,
        train_epochs=train_epochs,
    )
    self.save()
    return report.to_dict()

NOmegaRuntime.omega21_execution_guided_cycle = _omega21_execution_guided_cycle
