from .qualification_v14 import QualificationRunner
import argparse,json
def main():
 p=argparse.ArgumentParser(); p.add_argument('--seeds',type=int,default=2); p.add_argument('--out',default='qualification_v14.json'); a=p.parse_args(); rows=QualificationRunner().run(seeds=tuple(range(a.seeds))); data={'summary':QualificationRunner.summary(rows),'rows':[r.__dict__ for r in rows]}; open(a.out,'w').write(json.dumps(data,indent=2)); print(json.dumps(data['summary'],indent=2))
if __name__=='__main__': main()
