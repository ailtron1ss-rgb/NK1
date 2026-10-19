from src.neurocore.v14.qualification_v14 import QualificationRunner
def test_small_qualification():
 r=QualificationRunner(d=6,seq=12,batch=2).run(seeds=(0,),tasks=("delayed_association",)); s=QualificationRunner.summary(r); assert len(s)==5
