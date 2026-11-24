from core.nomega.train_router import train_router

def test_router_training_runs():
    r = train_router(steps=3)
    assert r["steps"] == 3
    assert r["loss_end"] >= 0.0


def test_runtime_loads_router_checkpoint(tmp_path):
    from pathlib import Path
    from core.nomega.runtime import NOmegaRuntime
    from core.nomega.trace_trainer import RouterTraceTrainer
    root = Path(tmp_path)
    trainer = RouterTraceTrainer(root=root, seed=41)
    trainer.collect(4)
    trainer.train(epochs=1, batch_size=4, collect_each_epoch=False)
    rt = NOmegaRuntime(root=root)
    assert rt.core.router is not None
    assert (root / "runtime" / "nomega_router.pt").exists()
