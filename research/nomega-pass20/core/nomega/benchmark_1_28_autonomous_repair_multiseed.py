from __future__ import annotations
from pathlib import Path
import json
import tempfile
import sys
import torch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.nomega.autonomous_repair_learning_loop_v1 import AutonomousRepairLearningLoopV1
from core.nomega.neural_substrate_v1 import ModernNeuralSubstrateV1
from core.nomega.structural_plasticity_controller_v1 import StructuralPlasticityControllerV1

FAMILIES = ("sum3", "xor3", "mul2")
SEEDS = (41, 43, 47)


def _structural_score(substrate, probe):
    out = substrate(probe, reset_state=True)
    m = substrate.metrics()
    pooled = out["pooled"]
    return -abs(float(m.mean_rate) - float(substrate.target_rate)) - 0.10 * float(m.energy_load) + 0.01 * float(pooled.detach().abs().mean())


def run(root: Path) -> dict:
    root = Path(root)
    rows = []
    for seed in SEEDS:
        loop = AutonomousRepairLearningLoopV1(root / f"seed_{seed}", seed=seed)
        episode_records = []
        # First pass establishes evidence without giving the policy a peek at current outcomes.
        for family in FAMILIES:
            for repeat in range(2):
                template = loop.engine.acq.templates(family)[0]
                broken = list(template)
                broken[0] = (0, broken[0][1], broken[0][2])
                _, hold, _ = loop.engine.acq._examples(family, seed + 101 + repeat)
                tape, expected = hold[repeat]
                out = loop.repair(family, broken, tapes=[tape], expected_rows=[(tape, expected)], max_candidates=4)
                episode_records.append({"family": family, "repeat": repeat, "expected": expected, "decision": out["decision"], "verified_rank": out["verified_rank"], "best": out["best"]})
        fit = loop.policy.fit(loop.history, epochs=16)
        # Second pass measures the policy after it has seen prior repair outcomes.
        post_records = []
        for family in FAMILIES:
            template = loop.engine.acq.templates(family)[0]
            broken = list(template)
            broken[0] = (0, broken[0][1], broken[0][2])
            _, hold, _ = loop.engine.acq._examples(family, seed + 404)
            tape, expected = hold[0]
            out = loop.repair(family, broken, tapes=[tape], expected_rows=[(tape, expected)], max_candidates=4)
            post_records.append({"family": family, "expected": expected, "decision": out["decision"], "verified_rank": out["verified_rank"], "best": out["best"], "policy": out["policy"]})

        substrate = ModernNeuralSubstrateV1(5, exc_neurons=8, inh_neurons=4, seed=seed)
        torch.manual_seed(seed + 1000)
        x = torch.randn(16, 5)
        with torch.no_grad():
            substrate.synapse_mask.view(-1)[::19] = 0.0  # create bounded dormant structure for regrowth evidence
        substrate(x, reward=torch.ones(16), local_plasticity=True)
        controller = StructuralPlasticityControllerV1(seed=seed + 1)
        plan = controller.propose(substrate, max_prune=3, max_grow=3)
        probe = torch.randn(10, 5)
        tx = controller.apply_transaction(substrate, plan, evaluator=lambda model: _structural_score(model, probe), min_gain=1e-4)
        checkpoint = root / f"seed_{seed}" / "runtime" / "substrate_final.pt"
        checkpoint.parent.mkdir(parents=True, exist_ok=True)
        torch.save(substrate.state_dict(), checkpoint)
        fresh = ModernNeuralSubstrateV1(5, exc_neurons=8, inh_neurons=4, seed=9999)
        fresh.load_state_dict(torch.load(checkpoint, map_location="cpu", weights_only=False))
        restart_ok = torch.equal(substrate.synapse_mask, fresh.synapse_mask) and torch.allclose(substrate.recurrent, fresh.recurrent)
        rows.append({
            "seed": seed,
            "pre_episodes": episode_records,
            "post_episodes": post_records,
            "policy_fit_samples": None if fit is None else int(fit.samples),
            "policy_fit_loss": None if fit is None else float(fit.loss),
            "policy_ensemble": None if fit is None else int(fit.ensemble),
            "structural": tx.to_dict(),
            "restart_ok": bool(restart_ok),
        })
    pre_verified = sum(sum(r["decision"] == "verified_repair" for r in row["pre_episodes"]) for row in rows)
    post_verified = sum(sum(r["decision"] == "verified_repair" for r in row["post_episodes"]) for row in rows)
    pre_ranks = [e["verified_rank"] for r in rows for e in r["pre_episodes"] if e["verified_rank"] is not None]
    post_ranks = [e["verified_rank"] for r in rows for e in r["post_episodes"] if e["verified_rank"] is not None]
    return {
        "version": "1.28.0-dev",
        "seeds": list(SEEDS),
        "families": list(FAMILIES),
        "runs": rows,
        "policy_fit_all": all(r["policy_fit_samples"] is not None for r in rows),
        "restart_all": all(r["restart_ok"] for r in rows),
        "pre_verified_repairs": pre_verified,
        "post_verified_repairs": post_verified,
        "pre_verified_rate": pre_verified / max(1, 2 * len(SEEDS) * len(FAMILIES)),
        "post_verified_rate": post_verified / max(1, len(SEEDS) * len(FAMILIES)),
        "pre_mean_verified_rank": sum(pre_ranks) / max(1, len(pre_ranks)),
        "post_mean_verified_rank": sum(post_ranks) / max(1, len(post_ranks)),
        "post_minus_pre_verified_repairs": post_verified - pre_verified,
        "structural_commits": sum(int(r["structural"]["accepted"]) for r in rows),
        "structural_rollbacks": sum(int(r["structural"]["rollback"]) for r in rows),
    }


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="nomega_128_multiseed_") as tmp:
        report = run(Path(tmp))
        print(json.dumps(report, indent=2, sort_keys=True))
