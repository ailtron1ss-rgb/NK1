from src.neurocore.v14.tasks_v14 import make_task
def test_tasks():
 for i,n in enumerate(["delayed_association","interference","change_point","temporal_composition","cross_modal_binding","action_dynamics","long_horizon","noise_recovery"]):
  t=make_task(n,2,20,8,7,i); assert t.x.shape==(2,20,8) and t.target.shape==(2,8)
