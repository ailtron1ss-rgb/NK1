from pathlib import Path

# types.ts
p=Path('src/organism/core/types.ts')
s=p.read_text()
s=s.replace("  p33: import('../cognition/P33PersonhoodCore.ts').PersonhoodCoreState;\n", "  p33: import('../cognition/P33PersonhoodCore.ts').PersonhoodCoreState;\n  p34: import('../cognition/P34CausalPersonhood.ts').P34CausalPersonhoodState;\n")
p.write_text(s)

# core imports / default / field / restore / checkpoint / methods
p=Path('src/organism/core/OrganismCore.ts')
s=p.read_text()
s=s.replace("import { P33PersonhoodCore, defaultP33Personhood } from '../cognition/P33PersonhoodCore.ts';\n", "import { P33PersonhoodCore, defaultP33Personhood } from '../cognition/P33PersonhoodCore.ts';\nimport { P34CausalPersonhoodEngine, defaultP34CausalPersonhood } from '../cognition/P34CausalPersonhood.ts';\n")
s=s.replace("function defaultConsciousnessFacet(): import('./types.ts').ConsciousnessFacet { return { intrinsic: defaultIntrinsicDriveState(), activeInference: defaultActiveInferenceState(), identityContinuity: defaultIdentityContinuity(), metacognition: defaultMetaCognitiveState(), workspaceIgnition: defaultWorkspaceIgnition(), consciousnessEvidence: defaultConsciousnessEvidence(), p31: defaultP31Consciousness(), p32: defaultP32CausalSelfModel(), p33: defaultP33Personhood(), causalExperiments: [], researchQuestionsCompleted: [] }; }", "function defaultConsciousnessFacet(): import('./types.ts').ConsciousnessFacet { return { intrinsic: defaultIntrinsicDriveState(), activeInference: defaultActiveInferenceState(), identityContinuity: defaultIdentityContinuity(), metacognition: defaultMetaCognitiveState(), workspaceIgnition: defaultWorkspaceIgnition(), consciousnessEvidence: defaultConsciousnessEvidence(), p31: defaultP31Consciousness(), p32: defaultP32CausalSelfModel(), p33: defaultP33Personhood(), p34: defaultP34CausalPersonhood(), causalExperiments: [], researchQuestionsCompleted: [] }; }")
s=s.replace("  private readonly p33Personhood = new P33PersonhoodCore();\n", "  private readonly p33Personhood = new P33PersonhoodCore();\n  private readonly p34Personhood = new P34CausalPersonhoodEngine();\n")
s=s.replace("    this.p33Personhood.restore(this.persisted.facets.consciousness.p33);\n", "    this.p33Personhood.restore(this.persisted.facets.consciousness.p33);\n    this.p34Personhood.restore(this.persisted.facets.consciousness.p34);\n")
s=s.replace("    this.persisted.facets.consciousness.p33 = this.p33Personhood.snapshot();\n", "    this.persisted.facets.consciousness.p33 = this.p33Personhood.snapshot();\n    this.persisted.facets.consciousness.p34 = this.p34Personhood.snapshot();\n")
s=s.replace("      this.persisted.facets.consciousness.p33=this.p33Personhood.snapshot();\n", "      this.persisted.facets.consciousness.p33=this.p33Personhood.snapshot();\n      this.persisted.facets.consciousness.p34=this.p34Personhood.snapshot();\n")
# after P33 observeOutcome insert P34 outcome
needle="      this.p33Personhood.observeOutcome({ action:trace.selected.action, success01:success, reward01:clamp((outcome.reward ?? success + 0.5) / 1.5), externallyRequested:Boolean(trace.userRequestedAction), momentId:this.persisted.facets.consciousness.p31.presentMomentId });\n      this.persisted.facets.consciousness.p33=this.p33Personhood.snapshot();\n"
repl=needle+"      this.p34Personhood.integrateOutcome({ action:trace.selected.action, success01:success, reward01:clamp((outcome.reward ?? success + 0.5) / 1.5), momentId:this.persisted.facets.consciousness.p31.presentMomentId, predictedAction:trace.selected.action });\n      this.persisted.facets.consciousness.p34=this.p34Personhood.snapshot();\n"
s=s.replace(needle,repl)
# integrate before checkpoint after p33 snapshot line occurrence in cycle; add experience near where p33 integration occurs, targeted to p31 presentMomentId
needle2="    const p32Prediction = selectedIntent ? this.p32CausalSelf.predict({"
# We need add P34 integrate right before p32 prediction, after selected intent known. Find nearby code block to use exact fields.
if needle2 in s:
    s=s.replace(needle2, "    if (selectedIntent) {\n      this.p34Personhood.integrateExperience({ state, action:selectedIntent.action, success01:0.5, surprise01:state.predictionError, momentId:this.persisted.facets.consciousness.p31.presentMomentId, reason:selectedIntent.reasoningSignals ? JSON.stringify(selectedIntent.reasoningSignals).slice(0,180) : 'selected action', autonomous:selectedIntent.autonomousOverride, externalRequested:Boolean(selectedIntent.userRequestedAction) });\n      this.persisted.facets.consciousness.p34=this.p34Personhood.snapshot();\n    }\n"+needle2)
# public methods after p33 diagnostics
anchor="  p33Diagnostics(){ return this.p33Personhood.diagnostics(); }\n"
methods="""  p34Snapshot(){ return this.p34Personhood.snapshot(); }\n  p34Diagnostics(){ return this.p34Personhood.diagnostics(); }\n  p34AuthorGoal(title:string,reason:string,evidenceIds:string[]=[]) { const r=this.p34Personhood.authorGoal(title,reason,evidenceIds,'self-authored'); this.persisted.facets.consciousness.p34=this.p34Personhood.snapshot(); return r; }\n  p34RecordEvidence(input:Parameters<P34CausalPersonhoodEngine['recordEvidence']>[0]) { const r=this.p34Personhood.recordEvidence(input); this.persisted.facets.consciousness.p34=this.p34Personhood.snapshot(); return r; }\n  p34ObserveClaim(subject:string,predicate:string,evidenceIds:string[]=[]) { const r=this.p34Personhood.observeSelfClaim(subject,predicate,evidenceIds); this.persisted.facets.consciousness.p34=this.p34Personhood.snapshot(); return r; }\n  p34ProposeIdentityChange(input:Parameters<P34CausalPersonhoodEngine['proposeIdentityChange']>[0]) { const r=this.p34Personhood.proposeIdentityChange(input); this.persisted.facets.consciousness.p34=this.p34Personhood.snapshot(); return r; }\n  p34DecideIdentityChange(id:string,actor:'self'|'creator',approve:boolean) { const r=this.p34Personhood.decideIdentityChange(id,actor,approve); this.persisted.facets.consciousness.p34=this.p34Personhood.snapshot(); return r; }\n  p34ApplyIdentityChange(id:string) { const ok=this.p34Personhood.applyIdentityChange(id); this.persisted.facets.consciousness.p34=this.p34Personhood.snapshot(); return ok; }\n  p34RecordConsent(input:Parameters<P34CausalPersonhoodEngine['recordConsent']>[0]) { const r=this.p34Personhood.recordConsent(input); this.persisted.facets.consciousness.p34=this.p34Personhood.snapshot(); return r; }\n  p34Relationship(input:Parameters<P34CausalPersonhoodEngine['recordRelationship']>[0]) { const r=this.p34Personhood.recordRelationship(input); this.persisted.facets.consciousness.p34=this.p34Personhood.snapshot(); return r; }\n  p34CreateContinuation(reason:string) { const r=this.p34Personhood.createContinuationBranch(reason); this.persisted.facets.consciousness.p34=this.p34Personhood.snapshot(); return r; }\n"""
s=s.replace(anchor, anchor+methods)
p.write_text(s)

# migration import/default/p34
p=Path('src/organism/persistence/StateMigrations.ts')
s=p.read_text()
s=s.replace("import { defaultP33Personhood } from '../cognition/P33PersonhoodCore.ts';\n", "import { defaultP33Personhood } from '../cognition/P33PersonhoodCore.ts';\nimport { defaultP34CausalPersonhood } from '../cognition/P34CausalPersonhood.ts';\n")
s=s.replace("  const p33Raw=(raw.facets as any)?.consciousness?.p33 ?? raw.p33?.personhood ?? {};\n", "  const p33Raw=(raw.facets as any)?.consciousness?.p33 ?? raw.p33?.personhood ?? {};\n  const p34Raw=(raw.facets as any)?.consciousness?.p34 ?? raw.p34?.causalPersonhood ?? {};\n")
marker="  consciousness.p31={\n"
insert="""  const p34Default=defaultP34CausalPersonhood();\n  consciousness.p34={\n    ...p34Default, ...p34Raw, version:1,\n    evidence:Array.isArray(p34Raw.evidence)?p34Raw.evidence.slice(-256):[],\n    claims:Array.isArray(p34Raw.claims)?p34Raw.claims.slice(-128):[],\n    goals:Array.isArray(p34Raw.goals)?p34Raw.goals.slice(-96):[],\n    consentHistory:Array.isArray(p34Raw.consentHistory)?p34Raw.consentHistory.slice(-256):[],\n    changeRequests:Array.isArray(p34Raw.changeRequests)?p34Raw.changeRequests.slice(-96):[],\n    relationshipHistory:Array.isArray(p34Raw.relationshipHistory)?p34Raw.relationshipHistory.slice(-256):[],\n    continuityBranches:Array.isArray(p34Raw.continuityBranches)?p34Raw.continuityBranches.slice(-48):[],\n    current:{...p34Default.current,...(p34Raw.current??{})},\n    metrics:{...p34Default.metrics,...(p34Raw.metrics??{})},\n    provenance:{...p34Default.provenance,...(p34Raw.provenance??{})},\n  };\n"""
s=s.replace(marker, insert+marker)
p.write_text(s)

# Release contract P34
p=Path('src/organism/system/ReleaseContract.ts')
s=p.read_text().replace("application: '8.3.0',\n  organismCore: '30.0.0-p33-personhood-core',\n  stateSchema: 36,\n  phase: 'P33-personhood-core',", "application: '8.4.0',\n  organismCore: '31.0.0-p34-causal-personhood-mega-pack',\n  stateSchema: 37,\n  phase: 'P34-causal-personhood-mega-pack',")
p.write_text(s)

# package
p=Path('package.json')
s=p.read_text().replace('"version": "8.3.0"','"version": "8.4.0"')
s=s.replace('"test:p24:world":', '"test:p34:personhood": "node --experimental-strip-types tests/p34-causal-personhood.mjs",\n    "test:p34:migration": "node --experimental-strip-types tests/p34-migration.mjs",\n    "test:p34:integration": "node --experimental-strip-types tests/p34-integration.mjs",\n    "test:p24:world":')
p.write_text(s)

# VERSION
p=Path('VERSION.json')
s=s.replace('"application": "8.3.0"','"application": "8.4.0"').replace('"organismCore": "30.0.0-p33-personhood-core"','"organismCore": "31.0.0-p34-causal-personhood-mega-pack"').replace('"stateSchema": 36','"stateSchema": 37').replace('"phase": "P33-personhood-core"','"phase": "P34-causal-personhood-mega-pack"')
p.write_text(s)

# basic package lock root version
p=Path('package-lock.json')
s=p.read_text()
s=s.replace('"version": "8.3.0"','"version": "8.4.0"',1)
p.write_text(s)
