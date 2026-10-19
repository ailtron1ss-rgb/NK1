from core.nomega.continual_replay_policy_v2 import ContinualReplayPolicyV2

def test_policy_protects_anchor_and_diversity():
    p = ContinualReplayPolicyV2()
    rows=[]
    for i in range(6):
        rows.append({'key':f'a{i}','family':'sum3','semantic_group':f's{i}','verified':True,'anchor':i==0,'uncertainty':0.9,'transfer_to_current':0.5,'reward':1.0,'confidence':0.9,'recency':1.0})
    for i in range(6):
        rows.append({'key':f'b{i}','family':'xor3','semantic_group':f'x{i}','verified':True,'anchor':False,'uncertainty':0.5,'transfer_to_current':-0.9,'reward':1.0,'confidence':0.9,'recency':1.0})
    for i in range(6):
        rows.append({'key':f'c{i}','family':'mul2','semantic_group':f'm{i}','verified':True,'anchor':False,'uncertainty':0.6,'transfer_to_current':0.4,'reward':0.9,'confidence':0.8,'recency':1.0})
    chosen=p.rank(rows,current_family='sum3',anchor_keys={'a0'},max_items=4)
    assert len(chosen) == 4
    assert chosen[0]['key'] == 'a0'
    assert all(c['key'] not in {f'b{i}' for i in range(6)} for c in chosen)
    assert len({c['family'] for c in chosen}) >= 1
