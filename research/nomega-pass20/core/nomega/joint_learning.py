from __future__ import annotations
"""Bounded joint-learning harness for router + program expert.

It deliberately avoids modifying the stable production checkpoint unless the
promotion gate accepts the resulting evaluation.
"""
from pathlib import Path
from typing import Any, Dict, List
import copy, json, time, torch
import torch.nn.functional as F

from .config import NOMEGAConfig
from .core import NOmegaCore
from .curriculum import generate_curriculum, CurriculumTask
from .replay import ReplayBuffer, ReplayItem
from .route_lab import evaluate_experts, best_expert
from .continual import PromotionGate, Evaluation
from .self_play import select_conflict_tasks
from .governance_runtime import record_degraded_mode

class JointLearningHarness:
    def __init__(self, root: Path, seed: int = 41):
        self.root = Path(root); self.seed = seed
        self.runtime = self.root / "runtime"; self.runtime.mkdir(parents=True, exist_ok=True)
        self.replay = ReplayBuffer(capacity=768, seed=seed)
        self.replay.load(self.runtime / "nomega_replay.json")
        self.report_path = self.runtime / "nomega_joint_learning.json"

    def collect_counterfactual(self, core: NOmegaCore, tasks: List[CurriculumTask], limit: int = 64) -> Dict[str, Any]:
        rows = []
        for t in tasks[:limit]:
            cf = evaluate_experts(core, t.text, dict(t.context))
            best = best_expert(cf)
            best_name = str(best.get("expert", "heuristic"))
            # Keep the observed utility of each route.  The previous implementation
            # accidentally assigned the winning utility to every route, destroying
            # the counterfactual learning signal.
            for c in cf:
                self.replay.add(ReplayItem(
                    t.text, dict(t.context), best_name,
                    float(c.get("reward", -0.25)), t.family
                ))
            rows.append({"task_id": t.task_id, "best": best, "family": t.family,
                         "route_count": len(cf),
                         "winner_reward": float(best.get("reward", 0.0))})
        self.replay.save(self.runtime / "nomega_replay.json")
        return {"tasks": len(rows), "families": len({x["family"] for x in rows}),
                "replay": len(self.replay.items),
                "mean_winner_reward": sum(x["winner_reward"] for x in rows)/max(1,len(rows))}

    def train_router_from_replay(self, core: NOmegaCore, epochs: int = 2, batch_size: int = 16) -> Dict[str, Any]:
        names = core.expert_bank.names(); opt = torch.optim.AdamW(core.router.parameters(), lr=2e-4, weight_decay=1e-4)
        items = list(self.replay.items); losses=[]
        if not items: return {"epochs":0,"steps":0,"loss":None}
        for _ in range(epochs):
            for start in range(0, len(items), batch_size):
                batch = items[start:start+batch_size]
                z = core.encoder([x.text for x in batch])
                out = core.router(z)
                targets = torch.tensor([names.index(x.target_expert) if x.target_expert in names else 0 for x in batch])
                ce = F.cross_entropy(out["probs"].log(), targets)
                utility = torch.tensor([max(-1., min(1., x.utility)) for x in batch], dtype=torch.float32)
                compute_target = torch.clamp((utility + 1.0) * 0.5, .1, 1.0)
                compute_loss = F.smooth_l1_loss(out["compute"], compute_target)
                loss = ce + .08 * compute_loss
                opt.zero_grad(); loss.backward(); torch.nn.utils.clip_grad_norm_(core.router.parameters(), 1.0); opt.step()
                losses.append(float(loss.detach()))
        return {"epochs":epochs,"steps":len(losses),"loss":sum(losses)/max(1,len(losses))}

    def evaluate(self, core: NOmegaCore, tasks: List[CurriculumTask]) -> Evaluation:
        verified=0; lat=[]; rows=[]
        for t in tasks:
            s=time.perf_counter(); out=core.run(t.text, dict(t.context)); lat.append((time.perf_counter()-s)*1000)
            ok=bool(out.get("verified")); verified += int(ok)
            rows.append({"task_id":t.task_id,"verified":ok,"family":t.family,"confidence":out.get("confidence",0)})
        rate=verified/max(1,len(tasks)); score=rate
        return Evaluation(score=score, verified_rate=rate, latency_ms=sum(lat)/max(1,len(lat)), params=sum(p.numel() for p in core.parameters()), details={"rows":rows})

    def run(self, train_limit: int = 48, holdout_limit: int = 24, router_epochs: int = 2, return_candidate: bool = False) -> Dict[str, Any]:
        """Train exactly the candidate that is subsequently evaluated.

        The evidence contract is paired-before/after: the candidate is evaluated
        before mutation, trained, evaluated after mutation, then reloaded in a
        fresh runtime for restart verification. Program-family tasks are held out
        from router training so the transfer measurement is a real unseen-family
        test rather than another in-distribution score.
        """
        tasks=generate_curriculum(self.seed, per_family=8)
        train=[t for t in tasks if t.split=="train" and not t.family.startswith("program_")][:train_limit]
        hold=[t for t in tasks if t.split=="holdout" and not t.family.startswith("program_")][:holdout_limit]
        transfer=[t for t in tasks if t.split=="holdout" and t.family.startswith("program_")][:max(8, holdout_limit//2)]
        regression_tasks=[t for t in generate_curriculum(self.seed+200_000, per_family=8)
                          if t.split=="holdout" and not t.family.startswith("program_")][:max(8, holdout_limit)]

        stable=NOmegaCore(NOMEGAConfig(seed=self.seed, bootstrap_routing=False))
        ckpt=self.runtime / "nomega_router.pt"
        if ckpt.exists():
            try:
                blob=torch.load(ckpt, map_location="cpu", weights_only=False)
                stable.router.load_state_dict(blob.get("router", {}), strict=False)
                stable.cfg.bootstrap_routing=False
            except Exception as exc:
                record_degraded_mode("JointLearningHarness", "STABLE_ROUTER_LOAD_DEGRADED", exc, checkpoint=str(ckpt))
        baseline=stable
        base_eval=self.evaluate(baseline, hold)
        baseline_transfer=self.evaluate(baseline, transfer)
        baseline_regression=self.evaluate(baseline, regression_tasks)

        candidate=NOmegaCore(NOMEGAConfig(seed=self.seed, bootstrap_routing=False))
        candidate.router.load_state_dict(baseline.router.state_dict(), strict=False)
        candidate_before=self.evaluate(candidate, hold)
        collect=self.collect_counterfactual(candidate, train, limit=train_limit)
        route=self.train_router_from_replay(candidate, epochs=router_epochs)
        cand_eval=self.evaluate(candidate, hold)
        candidate_transfer=self.evaluate(candidate, transfer)
        candidate_regression=self.evaluate(candidate, regression_tasks)

        candidate_ckpt=self.runtime / "nomega_joint_candidate_router.pt"
        torch.save({"format": "nomega_router_candidate_v2", "seed": self.seed,
                    "router": candidate.router.state_dict(),
                    "training": route, "collect": collect}, candidate_ckpt)

        # Fresh-process-equivalent in-memory reconstruction: no modules from the
        # trained candidate are reused except the serialized router state.
        restarted=NOmegaCore(NOMEGAConfig(seed=self.seed, bootstrap_routing=False))
        blob=torch.load(candidate_ckpt, map_location="cpu", weights_only=False)
        restarted.router.load_state_dict(blob["router"], strict=False)
        restart_eval=self.evaluate(restarted, hold)

        conflicts=select_conflict_tasks(candidate, seed=self.seed, per_family=4, limit=12)
        result={
            "protocol_evidence_version":"1.9.2",
            # Backward-compatible top-level aliases for historical callers.
            "baseline":base_eval.to_dict(),
            "candidate":cand_eval.to_dict(),
            "seed":self.seed,
            "curriculum":{"train":len(train),"holdout":len(hold),"transfer":len(transfer),"regression":len(regression_tasks),
                           "train_excludes_program_families":True},
            "collect":collect,
            "router":route,
            "before":{"candidate":candidate_before.to_dict(),"stable":base_eval.to_dict()},
            "after":{"candidate":cand_eval.to_dict()},
            "transfer":{"baseline":baseline_transfer.to_dict(),"candidate":candidate_transfer.to_dict(),
                         "delta":candidate_transfer.score-baseline_transfer.score},
            "regression":{"baseline":baseline_regression.to_dict(),"candidate":candidate_regression.to_dict(),
                           "delta":candidate_regression.score-baseline_regression.score},
            "restart":{"candidate":restart_eval.to_dict(),
                        "delta_vs_after":restart_eval.score-cand_eval.score,
                        "checkpoint":str(candidate_ckpt)},
            "self_play_conflicts":{"selected":len(conflicts["selected"]),"mean_disagreement":conflicts["mean_disagreement"]},
            "delta":cand_eval.score-base_eval.score,
            "paired_holdout_delta":cand_eval.score-candidate_before.score,
            "causal_attribution":{"same_candidate_before_after":True,
                                  "trained_candidate_evaluated_after_training":True,
                                  "fresh_runtime_reloaded_from_candidate_checkpoint":True},
        }
        if return_candidate:
            result["_candidate_core"]=candidate
            result["_baseline_core"]=baseline
        public={k:v for k,v in result.items() if not k.startswith("_")}
        self.report_path.write_text(json.dumps(public,ensure_ascii=False,indent=2,default=str),encoding="utf-8")
        return result

