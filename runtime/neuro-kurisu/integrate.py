from pathlib import Path
p=Path('/mnt/data/up421/src/organism/core/OrganismCore.ts')
s=p.read_text()
# import
old="import { B401B420AdaptiveCognitiveResearchCore, defaultB401B420State } from '../system/B401B420AdaptiveCognitiveResearchCore.ts';"
new=old+"\nimport { B421B450ResearchAccelerationCore, defaultB421B450State, type B421Input } from '../system/B421B450ResearchAccelerationCore.ts';"
s=s.replace(old,new)
# persisted type
old="  b401B420AdaptiveCognitiveResearch?: import('../system/B401B420AdaptiveCognitiveResearchCore.ts').B401State;"
new=old+"\n  b421B450ResearchAcceleration?: import('../system/B421B450ResearchAccelerationCore.ts').B421State;"
s=s.replace(old,new)
# default state
old="      b401B420AdaptiveCognitiveResearch: defaultB401B420State(),"
new=old+"\n      b421B450ResearchAcceleration: defaultB421B450State(),"
s=s.replace(old,new,1)
# field
old="  private readonly b401B420AdaptiveCognitiveResearch = new B401B420AdaptiveCognitiveResearchCore();"
new=old+"\n  /** B421-B450: research acceleration fabric combining causal graph retrieval, procedural refinement, meta-routing, adaptive compute, hierarchical world prediction, coordinated micro-rollouts, calibration and self-experiment proposals. It is a bounded residual support layer, never a second policy owner. */\n  private readonly b421B450ResearchAcceleration = new B421B450ResearchAccelerationCore();"
s=s.replace(old,new)
# restore
old="    this.b401B420AdaptiveCognitiveResearch.restore(this.persisted.system.b401B420AdaptiveCognitiveResearch ?? defaultB401B420State());"
new=old+"\n    this.b421B450ResearchAcceleration.restore(this.persisted.system.b421B450ResearchAcceleration ?? defaultB421B450State());"
s=s.replace(old,new)
# projection context
old="      b401B420AdaptiveCognitiveResearch:this.b401B420AdaptiveCognitiveResearch.snapshot(),"
new=old+"\n      b421B450ResearchAcceleration:this.b421B450ResearchAcceleration.snapshot(),"
s=s.replace(old,new)
# public diagnostics around b401 methods
old="  b401B420Diagnostics(){ return this.b401B420AdaptiveCognitiveResearch.diagnostics(); }"
new=old+"\n  b421B450Diagnostics(){ return this.b421B450ResearchAcceleration.diagnostics(); }\n  b421B450Lesion(input:Parameters<B421B450ResearchAccelerationCore['beforeDecision']>[0], lesion:Parameters<B421B450ResearchAccelerationCore['evaluateLesion']>[1]){ return this.b421B450ResearchAcceleration.evaluateLesion(input, lesion); }\n  setB421B450Lesions(input:Parameters<B421B450ResearchAccelerationCore['setLesions']>[0]){ this.b421B450ResearchAcceleration.setLesions(input); this.persisted.system.b421B450ResearchAcceleration=this.b421B450ResearchAcceleration.snapshot(); }"
s=s.replace(old,new)
# first spine-only integration after b401 persisted
needle="    this.persisted.system.b401B420AdaptiveCognitiveResearch=this.b401B420AdaptiveCognitiveResearch.snapshot();\n    const b365NeuralProb"
insert="    this.persisted.system.b401B420AdaptiveCognitiveResearch=this.b401B420AdaptiveCognitiveResearch.snapshot();\n    const b421Decision=this.b421B450ResearchAcceleration.beforeDecision({tick:state.tick,context01:b391Context,baseProbabilities:b365Frame.actionProbabilities,baseUtilities:b365Frame.forecastUtilities,reward01:clamp(Number(observation.reward??.5)),surprise01:clamp(Number(observation.surprise??state.predictionError)),novelty01:state.needs.novelty,uncertainty01:state.needs.uncertainty,predictionError01:state.predictionError,goalVector:currentGoalVector.slice(0,8),selfVector:b391Context,memoryStrength01:b385Decision.retrievalStrength01,motivation01:b391Decision.motivation.drive01,complexity01:clamp(state.needs.cognitiveLoad+state.needs.uncertainty)});\n    this.persisted.system.b421B450ResearchAcceleration=this.b421B450ResearchAcceleration.snapshot();\n    const b365NeuralProb"
s=s.replace(needle,insert)
# candidate score add b421. Need define bias before score and include.
old="      const b401ConfidenceGate=clamp(Number(b401Decision.confidence01??.5))*.025;\n      const score=clamp(base*.27"
new="      const b401ConfidenceGate=clamp(Number(b401Decision.confidence01??.5))*.025;\n      const b421Bias=clamp(Number(b421Decision.actionBias[action]??0))*.095;\n      const b421PredictiveBias=clamp((Number(b421Decision.predictiveUtility[action]??.5)-.5))*.055;\n      const b421ConfidenceGate=(clamp(Number(b421Decision.confidence01??.5))-.5)*.018;\n      const score=clamp(base*.27"
s=s.replace(old,new)
old="+b401Bias+b401PredictiveBias+b401ConfidenceGate+requestedBoost);"
new="+b401Bias+b401PredictiveBias+b401ConfidenceGate+b421Bias+b421PredictiveBias+b421ConfidenceGate+requestedBoost);"
s=s.replace(old,new)
# feedback spine add after b401 afterOutcome
needle="    this.persisted.system.b401B420AdaptiveCognitiveResearch=this.b401B420AdaptiveCognitiveResearch.snapshot();\n    this.causalPersonalityDevelopmentB299.observeOutcome({"
insert="    this.persisted.system.b401B420AdaptiveCognitiveResearch=this.b401B420AdaptiveCognitiveResearch.snapshot();\n    const b421Diag=this.b421B450ResearchAcceleration.diagnostics();\n    this.b421B450ResearchAcceleration.afterOutcome({tick:state.tick,action:trace.selected.action,context01:b421Diag.last.context,nextContext01:outcome.worldTransition?.after?b391ContextFromWorld(outcome.worldTransition.after):undefined,reward01, surprise01:surprise, verified01:bodyVerification?1:0, salience01:clamp(.45+state.needs.novelty*.30+surprise*.25), predictionError01:surprise, goal01:clamp(trace.selected.goalId?1:.5), complexity01:clamp(state.needs.cognitiveLoad+state.needs.uncertainty), success01:success});\n    this.persisted.system.b421B450ResearchAcceleration=this.b421B450ResearchAcceleration.snapshot();\n    this.causalPersonalityDevelopmentB299.observeOutcome({"
s=s.replace(needle,insert)
# full path add b421FullDecision vars and call after b401
old="    let b401FullDecision: ReturnType<B401B420AdaptiveCognitiveResearchCore['beforeDecision']> | null = this.b401FullDecisionCache;"
new=old+"\n    let b421FullDecision: ReturnType<B421B450ResearchAccelerationCore['beforeDecision']> | null = null;"
s=s.replace(old,new)
needle="      this.b401FullDecisionCache=b401FullDecision;\n      this.persisted.system.b401B420AdaptiveCognitiveResearch=this.b401B420AdaptiveCognitiveResearch.snapshot();\n    }"
insert="      this.b401FullDecisionCache=b401FullDecision;\n      this.persisted.system.b401B420AdaptiveCognitiveResearch=this.b401B420AdaptiveCognitiveResearch.snapshot();\n      b421FullDecision=this.b421B450ResearchAcceleration.beforeDecision({tick:state.tick,context01:fullContext,baseProbabilities:b365FullFrame.actionProbabilities,baseUtilities:b365FullFrame.forecastUtilities,reward01:clamp(Number(observation.reward??.5)),surprise01:clamp(Number(observation.surprise??state.predictionError)),novelty01:state.needs.novelty,uncertainty01:state.needs.uncertainty,predictionError01:state.predictionError,goalVector:goalVectorFull,selfVector:fullContext,memoryStrength01:b385FullDecision.retrieval.strength01,motivation01:b391FullDecision.motivation.drive01,complexity01:clamp(state.needs.cognitiveLoad+state.needs.uncertainty)});\n      this.persisted.system.b421B450ResearchAcceleration=this.b421B450ResearchAcceleration.snapshot();\n    }"
s=s.replace(needle,insert)
# full bias definitions
old="    const b401FullConfidenceGate=(action:ActionKind)=>b401FullDecision ? (b401FullDecision.confidence01-.5)*0.028 : 0;"
new=old+"\n    const b421FullBias=(action:ActionKind)=>b421FullDecision ? (b421FullDecision.actionBias[action]??0)*0.070 : 0;\n    const b421FullPredictiveBias=(action:ActionKind)=>b421FullDecision ? ((b421FullDecision.predictiveUtility[action]??.5)-.5)*0.045 : 0;"
s=s.replace(old,new)
# full candidate score find second occurrence of b401Confidence? likely b401 terms in full candidate. add to score globally after b401FullConfidenceGate maybe exact line
old="+b401FullBias(action)+b401FullPredictiveBias(action)+b401FullConfidenceGate(action)"
new="+b401FullBias(action)+b401FullPredictiveBias(action)+b401FullConfidenceGate(action)+b421FullBias(action)+b421FullPredictiveBias(action)"
s=s.replace(old,new)
# full feedback likely another b401 afterOutcome at line 6254; insert by nearby exact
needle="        this.persisted.system.b401B420AdaptiveCognitiveResearch=this.b401B420AdaptiveCognitiveResearch.snapshot();"
# only replace last occurrence? use rfind
idx=s.rfind(needle)
if idx!=-1:
    pos=idx+len(needle)
    block="\n        const b421FullDiag=this.b421B450ResearchAcceleration.diagnostics();\n        this.b421B450ResearchAcceleration.afterOutcome({tick:state.tick,action:trace?.selected?.action??'wait',context01:b421FullDiag.last.context,nextContext01:outcome.worldTransition?.after?b391ContextFromWorld(outcome.worldTransition.after):undefined,reward01:fullReward01,surprise01:surprise,verified01:fullVerified?1:0,salience01:clamp(.45+state.needs.novelty*.30+surprise*.25),predictionError01:surprise,goal01:trace?.selected?.goalId?1:.5,complexity01:clamp(state.needs.cognitiveLoad+state.needs.uncertainty),success01:fullSuccess});\n        this.persisted.system.b421B450ResearchAcceleration=this.b421B450ResearchAcceleration.snapshot();"
    s=s[:pos]+block+s[pos:]
p.write_text(s)
