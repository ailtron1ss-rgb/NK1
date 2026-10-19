import json,time,statistics,torch
from neurocore.v83 import NeuroWeaveV83,OrganismTrainerV83
from neurocore.v84 import NeuroWeaveV84,OrganismTrainerV84,mobile_v84_config

def batch(seed):
 g=torch.Generator().manual_seed(seed); return torch.randn(2,4,9,generator=g),torch.randn(2,4,8,generator=g)

def v83(seed,steps=8):
 x,g=batch(seed); m=NeuroWeaveV83(); t=OrganismTrainerV83(m); t0=time.perf_counter(); logs=[t.learning_step_v83(x*(1+0.03*i),g) for i in range(steps)]; dt=time.perf_counter()-t0
 return {'time_s':dt,'final_loss':logs[-1]['loss'],'replay_events':sum(r['replay_available'] for r in logs),'coverage_mean':statistics.fmean(r['replay_gradient_coverage'] for r in logs if r['replay_available'])}

def v84(seed,steps=8):
 x,g=batch(seed); c=mobile_v84_config(9); c.replay_interval_init_v84=2; c.replay_interval_max_v84=6; m=NeuroWeaveV84(c); t=OrganismTrainerV84(m); t0=time.perf_counter(); logs=[t.learning_step_v84(x*(1+0.03*i),g) for i in range(steps)]; dt=time.perf_counter()-t0
 return {'time_s':dt,'final_loss':logs[-1]['loss'],'replay_events':sum(r['replay_executed'] for r in logs),'diagnostic_events':sum(r['replay_extra_backward_v84'] for r in logs),'final_interval':logs[-1]['replay_interval_v84'],'coverage_diag':statistics.fmean([r['replay_gradient_coverage'] for r in logs if r['replay_mode_v84']=='diagnostic_surgery']) if any(r['replay_mode_v84']=='diagnostic_surgery' for r in logs) else 0.0}
runs=[]
for seed in (3,7):
 a=v83(seed); b=v84(seed); runs.append({'seed':seed,'v83':a,'v84':b,'time_ratio_v84_over_v83':b['time_s']/a['time_s']})
print(json.dumps({'runs':runs,'mean_time_v83':statistics.fmean(r['v83']['time_s'] for r in runs),'mean_time_v84':statistics.fmean(r['v84']['time_s'] for r in runs),'mean_ratio':statistics.fmean(r['time_ratio_v84_over_v83'] for r in runs),'mean_replay_events_v83':statistics.fmean(r['v83']['replay_events'] for r in runs),'mean_replay_events_v84':statistics.fmean(r['v84']['replay_events'] for r in runs)},indent=2))
