from __future__ import annotations
from typing import Any, Dict, Optional
import time
from pathlib import Path
import torch
import torch.nn as nn
from .config import NOMEGAConfig
from .types import LatentState, StepTrace, VerificationResult
from .encoder import TinyTextEncoder
from .memory import CognitiveMemory
from .router import CognitiveRouter
from .experts import ExpertBank
from .verifier import SafeVerifier
from .modalities import VisionAdapter, AudioAdapter, ModalityFusion
from .task_policy import classify_task
from .budget_manager import BudgetManager
from .reasoning import ReasoningAuditor, ConfidenceCalibrator
from .cache import VerifiedCache
from .working_memory import WorkingMemory
from .skill_bank import SkillBank
from .expert_manager import ExpertManager
from .world_model import TinyWorldModel
from .telemetry import CostMeter
from .tools import default_registry
from .ensemble import EvidenceEnsemble
from .capability_registry import CapabilityRegistry
from .universal_latent import UniversalLatentMixer, LatentObservation, LatentStateStore
from .attention_memory import AttentionMemory
from .self_model import SelfModel
from .skill_compiler import SkillCompiler
from .telemetry_advanced import AdvancedTelemetry
from .evolution_controller import EvolutionController
from .goal_manager import GoalManager
from .governance_runtime import record_degraded_mode
from .mobile_policy import MobilePolicy
from .planning_search import BeamPlanner
from .generalist_core import AdaptiveGeneralist, GeneralistCheckpoint, encode_text
from .program_equivalence_v2 import ProgramEquivalenceV2
from .skill_versioning import VersionedSkillRegistry
from .skill_governance_v1 import SkillGovernanceV1
from .canonical_skill_lifecycle_v1 import CanonicalSkillLifecycleV1
from .sparse_moe_v1 import SparseMoE
from .hybrid_reasoner_v2 import HybridReasonerV2
from .executable_spine_v2 import ExecutableSpineV2
from .canonical_neural_execution_v1 import CanonicalNeuralProgramBridgeV1
from .causal_evidence_ledger_v1 import CausalEvidenceLedgerV1

class NOmegaCore(nn.Module):
    """NΩ cognitive executive: sparse routing + memory + executable experts + verifier."""
    def __init__(self, cfg: Optional[NOMEGAConfig] = None, root: Optional[Path] = None):
        super().__init__(); self.cfg = cfg or NOMEGAConfig(); self.root = Path(root) if root is not None else Path(__file__).resolve().parents[2]; torch.manual_seed(self.cfg.seed)
        self.evidence_ledger = CausalEvidenceLedgerV1(self.root / "runtime" / "nomega_causal_evidence.jsonl")
        self.canonical_neural_program = (CanonicalNeuralProgramBridgeV1(
            self.root,
            seed=self.cfg.seed + 2027,
            checkpoint=(self.cfg.canonical_neural_program_checkpoint or None),
            hidden=self.cfg.canonical_neural_program_hidden,
            latent_dim=self.cfg.canonical_neural_program_hidden,
            max_len=self.cfg.canonical_neural_program_max_len,
            evidence_ledger=self.evidence_ledger,
        ) if self.cfg.enable_canonical_neural_program else None)
        self.encoder = TinyTextEncoder(self.cfg.latent_dim); self.vision = VisionAdapter(self.cfg.latent_dim); self.audio = AudioAdapter(self.cfg.latent_dim)
        self.fusion = ModalityFusion(self.cfg.latent_dim)
        self.workspace = nn.GRUCell(self.cfg.latent_dim, self.cfg.latent_dim)
        self.predictor = nn.Sequential(nn.LayerNorm(self.cfg.latent_dim), nn.Linear(self.cfg.latent_dim, self.cfg.latent_dim), nn.Tanh())
        self.expert_bank = ExpertBank(
            self.cfg.latent_dim,
            include_neural=self.cfg.enable_neural_invent,
            include_symbolic=self.cfg.enable_symbolic,
            include_planner=self.cfg.enable_planner,
            root=self.root,
            neural_bridge=self.canonical_neural_program,
        )
        self.router = CognitiveRouter(self.cfg, self.expert_bank.names())
        self.memory = CognitiveMemory(self.cfg.memory_dim, self.cfg.memory_capacity)
        self.verifier = SafeVerifier(); self.audit = ReasoningAuditor(); self.calibrator = ConfidenceCalibrator()
        self.budget_manager = BudgetManager(self.cfg.ram_gb, self.cfg.has_npu)
        self.cache = VerifiedCache(self.cfg.cache_capacity)
        self.working_memory = WorkingMemory(self.cfg.latent_dim, self.cfg.working_memory_slots)
        self.skill_governance = SkillGovernanceV1(self.root)
        self.skill_bank = SkillBank(self.cfg.skill_capacity, governance=self.skill_governance)
        self.expert_manager = ExpertManager(self.expert_bank.names())
        self.world_model = TinyWorldModel(self.cfg.latent_dim, len(self.expert_bank.names()), self.cfg.world_model_hidden)
        self.tools = default_registry()
        self.ensemble = EvidenceEnsemble()
        self.capabilities = CapabilityRegistry()
        self.latent_mixer = UniversalLatentMixer(self.cfg.latent_dim) if self.cfg.enable_universal_latent else None
        self.latent_store = LatentStateStore(32) if self.cfg.enable_universal_latent else None
        self.attention_memory = AttentionMemory(self.cfg.latent_dim, self.cfg.attention_memory_capacity) if self.cfg.enable_attention_memory else None
        self.self_model = SelfModel() if self.cfg.enable_self_model else None
        self.skill_compiler = SkillCompiler() if self.cfg.enable_skill_compiler else None
        self.advanced_telemetry = AdvancedTelemetry() if self.cfg.enable_advanced_telemetry else None
        self.evolution_controller = EvolutionController() if self.cfg.enable_evolution_controller else None
        self.goals = GoalManager()
        self.mobile_policy = MobilePolicy()
        self.beam_planner = BeamPlanner(beam=2, depth=2)
        self.generalist = AdaptiveGeneralist(self.cfg.latent_dim, self.cfg.generalist_hidden, self.cfg.generalist_vocab, self.cfg.generalist_actions) if self.cfg.enable_adaptive_generalist else None
        self._generalist_loaded = False
        self.program_equivalence = ProgramEquivalenceV2(seed=self.cfg.seed) if self.cfg.enable_verifier else None
        self.skill_versions = VersionedSkillRegistry()
        self.skill_lifecycle = CanonicalSkillLifecycleV1(self.skill_bank, self.skill_versions, self.skill_compiler, self.skill_governance)
        self.sparse_moe = SparseMoE(self.cfg.latent_dim, max(64,self.cfg.router_hidden), self.cfg.sparse_moe_experts) if self.cfg.enable_sparse_moe_v1 else None
        self.hybrid_reasoner = HybridReasonerV2(self.cfg.latent_dim, max(64,self.cfg.router_hidden), 2) if self.cfg.enable_hybrid_reasoner_v2 else None
        self.executable_spine = (ExecutableSpineV2(
            self.root,
            seed=self.cfg.seed+9021,
            max_candidates=max(2, int(self.cfg.executable_spine_candidates)),
            neural_bridge=self.canonical_neural_program,
            evidence_ledger=self.evidence_ledger,
        ) if self.cfg.enable_executable_spine_v2 else None)
        self._state = None
        self._load_generalist_checkpoint()

    def _load_generalist_checkpoint(self):
        if self.generalist is None: return
        candidates = []
        if self.cfg.generalist_checkpoint:
            candidates.append(Path(self.cfg.generalist_checkpoint))
        candidates.append(self.root/"runtime"/"nomega_generalist_v1.pt")
        for path in candidates:
            if not path.exists():
                continue
            try:
                model, _ = GeneralistCheckpoint.load(path)
                if model.latent_dim == self.cfg.latent_dim:
                    self.generalist.load_state_dict(model.state_dict(), strict=True)
                    self._generalist_loaded = True
                    return
            except Exception:
                continue

    def encode(self, text: str, image=None, audio=None) -> LatentState:
        tz = self.encoder([text]); vz = self.vision(image) if image is not None else None; az = self.audio(audio) if audio is not None else None
        fused = self.fusion(tz, vz, az)[0]
        latent_conf = 0.5
        if self.latent_mixer is not None:
            try:
                z, c = self.latent_mixer(tz, vz, az); z=z[0]; latent_conf=float(c[0].detach())
            except Exception:
                z=fused
        else: z=fused
        if self.hybrid_reasoner is not None and self.cfg.hybrid_reasoner_influence > 0:
            try:
                hz=self.hybrid_reasoner(z, self.cfg.hybrid_reasoner_steps)[0]
                a=max(0.0,min(1.0,float(self.cfg.hybrid_reasoner_influence))); z=(1-a)*z+a*hz
            except Exception as exc:
                record_degraded_mode("NOmegaCore", "HYBRID_REASONER_DEGRADED", exc)
        if self.sparse_moe is not None and self.cfg.sparse_moe_influence > 0:
            try:
                mz,_=self.sparse_moe(z.unsqueeze(0)); a=max(0.0,min(1.0,float(self.cfg.sparse_moe_influence))); z=(1-a)*z+a*mz[0]
            except Exception as exc:
                record_degraded_mode("NOmegaCore", "SPARSE_MOE_DEGRADED", exc)
        task_type = classify_task(text, {"image": image, "audio": audio})
        difficulty = min(1.0, max(0.05, len(text)/240.0))
        prior=self.self_model.prior(task_type) if self.self_model is not None else {"uncertainty":.5}
        generalist_meta = {}
        if self.generalist is not None:
            try:
                gout = self.generalist(torch.stack([encode_text(text)]), image=image, audio=audio)
                generalist_meta = gout.summary()
                gunc = float(gout.uncertainty.mean().detach())
                gdif = float((1.0-gout.value.mean()).detach())
                difficulty = min(1.0, max(.02, 0.75*difficulty + 0.25*gdif))
                if self.cfg.generalist_influence > 0:
                    alpha=max(0.0,min(1.0,float(self.cfg.generalist_influence)))
                    z = (1-alpha)*z + alpha*gout.latent[0]
                    latent_conf = (1-alpha)*latent_conf + alpha*(1.0-gunc)
            except Exception:
                generalist_meta = {"loaded":False}
        uncertainty=max(.02,min(.98,0.65*prior.get("uncertainty",.5)+0.20*(1.0-latent_conf)+0.15*float(generalist_meta.get("uncertainty",.5))))
        if self.latent_store is not None:
            self.latent_store.add(LatentObservation("text+optional_modal",z,latent_conf))
        return LatentState(z, task_type=task_type, difficulty=difficulty, uncertainty=uncertainty, novelty=.1, metadata={"latent_confidence":latent_conf, "generalist":generalist_meta, "generalist_loaded":self._generalist_loaded})

    def _merge(self, base, outputs, weights):
        vec = base; total = 0.0
        for name, out in outputs.items():
            lat = out.get("latent"); w = float(weights.get(name, 0.0))
            if torch.is_tensor(lat): vec = vec + w*lat.to(vec.device); total += w
        return vec/(1.0+total) if total > 0 else vec

    def _skill_evidence(self, *, verification_score: float, context: Dict[str, Any], winning: Optional[Dict[str, Any]] = None, contract: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Build only observed skill evidence; missing dimensions remain absent/unknown."""
        evidence: Dict[str, Any] = {
            "benchmark_id": str(context.get("benchmark_id") or "request-instance"),
            "verified_rate": float(verification_score),
            "equal_budget": context.get("equal_budget") if "equal_budget" in context else None,
        }
        if contract:
            ev_by_name = {str(e.get("name")): e for e in contract.get("evidence", []) if isinstance(e, dict)}
            for src, dst in (("program-acquisition-v2", "holdout"), ("adversarial_holdout", "adversarial"), ("hvm", "hvm")):
                if src in ev_by_name and ev_by_name[src].get("value") is not None:
                    evidence[dst] = float(ev_by_name[src]["value"])
            if "holdout" not in evidence and contract.get("holdout_fitness") is not None:
                evidence["holdout"] = float(contract["holdout_fitness"])
            if contract.get("adversarial_fitness") is not None:
                evidence["adversarial"] = float(contract["adversarial_fitness"])
            if contract.get("hvm_agreement") is not None:
                evidence["hvm"] = float(contract["hvm_agreement"])
        # Request-level execution has no OOD/multi-seed evidence. Do not synthesize it.
        if isinstance(winning, dict):
            if winning.get("benchmark_id") is not None: evidence["benchmark_id"] = str(winning["benchmark_id"])
            for k in ("holdout", "ood", "adversarial", "restart_delta", "multi_seed_count", "independent_runs", "trajectory_hashes", "equal_budget"):
                if winning.get(k) is not None: evidence[k] = winning[k]
        return evidence

    def _candidate(self, outputs):
        choice=self.ensemble.choose(outputs)
        if choice is not None:
            return choice["output"], choice["output"].get("result")
        for out in outputs.values():
            if out.get("result") is not None: return out, out.get("result")
        return None, None

    @torch.no_grad()
    def run(self, text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        context = dict(context or {}); context.setdefault("text", text)
        # Canonical executable spine gets first refusal on bounded, semantically grounded
        # math/program tasks.  It uses the same governed acquisition family as research
        # training and returns only after independent execution evidence.  Unresolved or
        # non-canonical tasks fall through to the general cognitive route unchanged.
        spine_attempt = None
        if self.executable_spine is not None and context.get("use_executable_spine", True) and context.get("image") is None and context.get("audio") is None:
            try:
                context.setdefault("enable_counterexample_refinement", bool(self.cfg.enable_counterexample_refinement_v2))
                spine_attempt = self.executable_spine.run(text, context)
                if spine_attempt.get("handled") and spine_attempt.get("verified"):
                    answer = spine_attempt.get("answer")
                    result = {
                        "type": "executable_spine",
                        "answer": answer,
                        "verified": True,
                        "confidence": float(spine_attempt.get("confidence", 0.0)),
                        "evidence_score": float(spine_attempt.get("contract", {}).get("evidence_score", 0.0)),
                        "program": spine_attempt.get("program"),
                        "family": spine_attempt.get("family"),
                        "candidate_source": spine_attempt.get("candidate_source"),
                        "contract": spine_attempt.get("contract"),
                        "latency_ms": float(spine_attempt.get("contract", {}).get("elapsed_ms", 0.0)),
                        "memory_items": len(self.memory.items),
                        "audit": {"spine_short_circuit": True, "version": "execution-spine-v2"},
                        "trace": [],
                        "route_history": [],
                    }
                    if self.cfg.cache_enabled:
                        try:
                            self.cache.put(text, context, result["answer"])
                        except Exception as exc:
                            result["cache_write_error"] = str(exc)
                    try:
                        fam = str(spine_attempt.get("family") or "program")
                        self.capabilities.observe(fam, True, result["confidence"], result["latency_ms"])
                        if self.self_model is not None:
                            self.self_model.observe(fam, True, result["confidence"], result["latency_ms"])
                        if result.get("program") is not None:
                            contract = result.get("contract") or {}
                            request_score = float(result.get("confidence", 0.0) or 0.0)
                            self.memory.put_program(text, result["program"], request_score, True, metadata={"execution_spine": contract})
                            if self.cfg.enable_skill_bank:
                                evidence = self._skill_evidence(verification_score=request_score, context=context, winning={"program": result["program"]}, contract=contract)
                                admission = self.skill_lifecycle.admit(description=text, program=result["program"], family=fam, quality=request_score, evidence=evidence)
                                result.setdefault("skill_governance", admission)
                    except Exception as exc:
                        result["post_verify_persist_error"] = str(exc)
                    return result
            except Exception as exc:
                spine_attempt = {"handled": False, "error": str(exc)}
        if self.cfg.enable_verified_cache and context.get("image") is None and context.get("audio") is None:
            cached=self.cache.get(text, context)
            if cached is not None and cached.get("verified",False):
                cached=dict(cached); cached["cache_hit"]=True; cached.setdefault("trace",[]); cached.setdefault("audit",{}); cached.setdefault("route_history",[])
                return cached
        meter=CostMeter(); meter.start()
        if self.cfg.enable_working_memory: self.working_memory.reset()
        state = self.encode(text, context.get("image"), context.get("audio"))
        battery=float(context.get("battery", .8)); thermal=float(context.get("thermal", .2))
        mobile_decision=self.mobile_policy.choose(self.cfg.ram_gb,battery,thermal,self.cfg.has_npu,"vision" if context.get("image") is not None else ("audio" if context.get("audio") is not None else "text"))
        budget = self.budget_manager.for_request(state.difficulty, state.uncertainty, battery, thermal)
        budget.max_steps=min(budget.max_steps,mobile_decision.max_steps); budget.max_experts=min(budget.max_experts,mobile_decision.max_experts); budget.max_candidates=min(budget.max_candidates,mobile_decision.max_candidates)
        goal_id=self.goals.add(text,priority=1.0,metadata={"task_type":state.task_type})
        old_budget = self.cfg.max_reason_steps; self.cfg.max_reason_steps = min(old_budget, budget.max_steps)
        x = state.vector; trace = []; final_outputs = {}; verifier_result = None; evidence_score = 0.0; answer = None; winning = None
        try:
            for step in range(self.cfg.max_reason_steps):
                state.step = step; state.vector = x
                state.metadata["skill_available"] = bool(self.skill_bank.match(state.task_type, min_quality=.85)) if self.cfg.enable_skill_bank else False
                decision = self.router.decide(state)
                # Safety floor for explicitly specified, exactly computable tasks. This is not a benchmark bypass:
                # the symbolic expert itself computes and the verifier still checks the provided expected value.
                exact_ops = {"sum","sub","mul","xor","and","or","min","max","eq","sum3","xor3","mul2","sub_offset","minmax3","parity_mix","clamp_sum","dot2_mod","nested3","sequence_inc","sequence_diff","sum_then_clamp","xor_then_parity","diff_then_offset","dot_then_mod","minmax_mix","nested_arithmetic","compose_sum_xor","compose_min_max","compose_affine","compose_mod_chain","compose_clamp_offset","compose_nested_parity","inverse_sum","invariant_xor"}
                if self.cfg.safety_expert_floor and context.get("expected") is not None and str(context.get("op","")).lower() in exact_ops and "symbolic" in self.expert_bank.names():
                    if "symbolic" not in decision.expert_ids:
                        decision.expert_ids=["symbolic"]+decision.expert_ids
                        decision.weights=[0.85]+decision.weights
                    else:
                        j=decision.expert_ids.index("symbolic"); decision.weights[j]=max(float(decision.weights[j]),0.85)
                    zsum=sum(decision.weights) or 1.0; decision.weights=[float(w)/zsum for w in decision.weights]
                # Gated policy fusion: the generalist can bias routing only when explicitly enabled.
                generalist_meta = state.metadata.get("generalist", {}) if isinstance(state.metadata, dict) else {}
                if self.generalist is not None and self.cfg.generalist_influence > 0 and generalist_meta:
                    route_map = {0:"symbolic", 1:"symbolic", 2:"symbolic", 3:"planner", 4:"neural_invent", 5:"memory", 6:"heuristic", 7:"planner"}
                    gname = route_map.get(int(generalist_meta.get("policy_id", -1)))
                    strength = float(self.cfg.generalist_influence) * max(0.0, 1.0-float(generalist_meta.get("uncertainty", .5)))
                    if gname in self.expert_bank.names() and strength > 0:
                        if gname in decision.expert_ids:
                            j = decision.expert_ids.index(gname); decision.weights[j] = decision.weights[j] + strength
                        else:
                            decision.expert_ids = [gname] + decision.expert_ids
                            decision.weights = [strength] + decision.weights
                        zsum = sum(decision.weights) or 1.0
                        decision.weights = [float(w)/zsum for w in decision.weights]
                context["program_family"] = state.task_type
                decision.expert_ids = decision.expert_ids[:budget.max_experts]
                decision.weights = decision.weights[:len(decision.expert_ids)]
                context["memory_hits"] = self.memory.retrieve(text, min(self.cfg.retrieval_k, budget.max_memory_hits)) if decision.use_memory else []
                if self.attention_memory is not None and decision.use_memory:
                    context["latent_memory_hits"] = self.attention_memory.search(x, min(3, budget.max_memory_hits))
                else:
                    context["latent_memory_hits"] = []
                context["skill_hits"] = self.skill_lifecycle.coalition(
                    state.task_type,
                    max_items=max(1, int(getattr(self.cfg, "retrieval_k", 4))),
                ) if self.cfg.enable_skill_bank else []
                context["max_candidates"] = budget.max_candidates
                outputs = {}
                for name, _weight in zip(decision.expert_ids, decision.weights):
                    expert = self.expert_bank.get(name)
                    if expert is None: continue
                    outputs[name] = expert.run(state, context)
                final_outputs = outputs
                if self.cfg.enable_working_memory:
                    self.working_memory.write(f"step:{step}", x, salience=max(decision.confidence, .1), step=step)
                wmap = {n:w for n,w in zip(decision.expert_ids, decision.weights)}
                proposal = self._merge(x, outputs, wmap)
                x = self.workspace(x.unsqueeze(0), proposal.unsqueeze(0)).squeeze(0)
                if self.cfg.experimental_predictive_workspace:
                    x = .85*x + .15*self.predictor(x)
                candidate, candidate_value = self._candidate(outputs)
                elapsed = 0.0; verifier_result = None
                if decision.use_verifier and candidate is not None:
                    verifier_result = self.verifier.verify(candidate, context)
                    evidence_score = max(evidence_score, float(verifier_result.score))
                meter.steps=step+1; meter.expert_calls += len(outputs)
                trace.append(StepTrace(step, decision, outputs, context.get("memory_hits", []), verifier_result,
                    {"difficulty": state.difficulty, "uncertainty": state.uncertainty, "budget": budget.to_dict()}, elapsed).__dict__)
                for ename,eout in outputs.items():
                    lat=float(eout.get("latency_ms",0.0) or 0.0)
                    rew=1.0 if (verifier_result and verifier_result.verified and eout.get("verified_candidate")) else (0.25 if eout.get("candidate_score") else 0.0)
                    if self.cfg.enable_expert_governance: self.expert_manager.observe(ename, rew, lat, bool(eout.get("verified_candidate",False)))
                if self.cfg.enable_skill_bank:
                    skill_output = outputs.get("skill")
                    if isinstance(skill_output, dict) and skill_output.get("skill_id"):
                        self.skill_lifecycle.observe(
                            str(skill_output["skill_id"]),
                            success=bool(skill_output.get("verified_candidate", False)),
                            evidence={"task_family": state.task_type, "expected": context.get("expected")},
                            transfer_delta=context.get("skill_transfer_delta"),
                            evaluation_id=context.get("evaluation_id"),
                        )
                if verifier_result and verifier_result.verified:
                    answer = candidate_value; winning = candidate; break
                halt_score = float(decision.metadata.get("halt_score", 0.0))
                if decision.confidence >= self.cfg.confidence_threshold and step+1 >= decision.reason_steps and halt_score > .55: break
            if answer is None:
                candidate, candidate_value = self._candidate(final_outputs)
                if verifier_result and verifier_result.verified: answer = candidate_value
                elif candidate_value is not None and self.cfg.allow_unverified_answers: answer = candidate_value
                else: answer = "No verified candidate yet; route to training/tool search."
        finally:
            self.cfg.max_reason_steps = old_budget
        meter.finish(); verified = bool(verifier_result and verifier_result.verified)
        confidence = self.calibrator.score(verified, evidence_score, state.uncertainty, state.novelty)
        audit = self.audit.summarize(trace) if self.cfg.enable_reasoning_audit else {}
        skill_admission = None
        if winning and winning.get("program") is not None:
            request_score = float(verifier_result.score if verifier_result is not None else 0.0)
            self.memory.put_program(text, winning.get("program"), request_score if verified else 0.0, verified, metadata={"dual_runtime": winning.get("dual_runtime"),"skill_candidate":verified})
            if verified and self.cfg.enable_skill_bank:
                evidence = self._skill_evidence(verification_score=request_score, context=context, winning=winning)
                skill_admission = self.skill_lifecycle.admit(description=text, program=winning.get("program"), family=state.task_type, quality=request_score, evidence=evidence)
            if verified and self.skill_compiler is not None:
                compiler_status = str((skill_admission or {}).get("status", "probation"))
                self.skill_compiler.compile(winning.get("program"), state.task_type, request_score, {"text":text,"verified":True,"skill_governance":skill_admission}, status=compiler_status)
        else:
            self.memory.put(text + " => " + str(answer), kind="episode", reward=1.0 if verified else 0.0, verified=verified, metadata={"trace_steps":len(trace), "task_type":state.task_type, "confidence":confidence})
        if len(self.memory.items) > int(self.cfg.memory_capacity*.85): self.memory.consolidate()
        self.capabilities.observe(state.task_type, verified, confidence, meter.elapsed_ms)
        if self.self_model is not None:
            self.self_model.observe(state.task_type, verified, confidence, meter.elapsed_ms)
        if self.attention_memory is not None:
            self.attention_memory.put(text, state.vector, answer, confidence, {"verified":verified,"family":state.task_type})
        if self.advanced_telemetry is not None:
            self.advanced_telemetry.observe(state.task_type, meter.elapsed_ms, verified, meter.expert_calls)
        self.goals.close(goal_id, success=verified)
        out = {"answer": answer, "verified": verified, "confidence": round(confidence,4),
                "verification": verifier_result.__dict__ if verifier_result else None, "trace": trace,
                "audit": audit, "budget": budget.to_dict(), "mobile_policy": mobile_decision.to_dict(), "goal": {"id":goal_id,"status":"done" if verified else "failed"}, "goal_stack": self.goals.report(), "state": {"task_type": state.task_type, "difficulty": state.difficulty, "uncertainty": state.uncertainty},
                "route_history": [{"experts": t["route"].expert_ids, "weights": t["route"].weights, "reason_steps": t["route"].reason_steps} for t in trace],
                "experts": list(final_outputs.keys()), "memory": self.memory.stats(), "skills": self.skill_bank.stats(), "skill_governance": (skill_admission or {}), "skill_lifecycle": self.skill_lifecycle.stats(), "skill_versions": self.skill_versions.stats(), "skill_compiler": (self.skill_compiler.best()[:5] if self.skill_compiler is not None else []), "program_equivalence": (self.program_equivalence.check(winning.get("program"), winning.get("program")) if self.program_equivalence is not None and winning and winning.get("program") is not None else None), "expert_governance": self.expert_manager.report(), "working_memory": self.working_memory.stats(), "capabilities": self.capabilities.report(), "self_model": (self.self_model.report() if self.self_model is not None else {}), "latent_memory": (self.attention_memory.stats() if self.attention_memory is not None else {}), "telemetry": (self.advanced_telemetry.report() if self.advanced_telemetry is not None else {}), "cost": meter.report(), "cache_hit": False}
        if verified and self.cfg.enable_verified_cache and context.get("image") is None and context.get("audio") is None and self.cfg.cache_verified_only:
            self.cache.put(text, context, out)
        return out

    def save_state(self) -> Dict[str, Any]:
        return {"config": self.cfg.to_dict(), "memory": self.memory.export(), "cache": self.cache.export(), "skills": self.skill_bank.export(), "skill_governance": self.skill_governance.snapshot(), "skill_compiler": (self.skill_compiler.export() if self.skill_compiler is not None else {}), "skill_versions": self.skill_versions.export(), "expert_governance": self.expert_manager.export(), "attention_memory": (self.attention_memory.export() if self.attention_memory is not None else []), "self_model": (self.self_model.report() if self.self_model is not None else {}), "capabilities": self.capabilities.report(), "goals": self.goals.report()}
