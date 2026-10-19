from pathlib import Path
root=Path('/mnt/data/p32work')
# Release contract/version/package
p=root/'src/organism/system/ReleaseContract.ts'
s=p.read_text()
s=s.replace("application: '8.1.0',\n  organismCore: '28.0.0-p31-functional-consciousness-mega-pack',\n  stateSchema: 34,\n  phase: 'P31-functional-consciousness-mega-pack',", "application: '8.2.0',\n  organismCore: '29.0.0-p32-causal-self-model-mega-pack',\n  stateSchema: 35,\n  phase: 'P32-causal-self-model-mega-pack',")
p.write_text(s)

p=root/'VERSION.json'; s=p.read_text();
s=s.replace('8.1.0','8.2.0').replace('28.0.0-p31-functional-consciousness-mega-pack','29.0.0-p32-causal-self-model-mega-pack').replace('"stateSchema": 34','"stateSchema": 35').replace('P31-functional-consciousness-mega-pack','P32-causal-self-model-mega-pack')
p.write_text(s)

p=root/'package.json'; import json
j=json.loads(p.read_text()); j['version']='8.2.0'; j['description']='Neuro-Kurisu unified artificial organism: persistent embodied continual intelligence with causal self-modeling, functional consciousness, governed lifelong learning, multi-timescale plasticity and safe development.'
scripts=j['scripts']; scripts['test:p32:causal']='node --experimental-strip-types tests/p32-causal-self-model.mjs'; scripts['test:p32:migration']='node --experimental-strip-types tests/p32-migration.mjs'; scripts['test:p32:integration']='node --experimental-strip-types tests/p32-integration.mjs'; scripts['test:p32:lesion']='node --experimental-strip-types tests/p32-lesion.mjs'; scripts['test:p32:truthfulness']='node --experimental-strip-types tests/p32-truthfulness.mjs'
p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')

p=root/'package-lock.json'; j=json.loads(p.read_text()); j['version']='8.2.0';
if 'packages' in j and '' in j['packages']: j['packages']['']['version']='8.2.0'
p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')

# Types
p=root/'src/organism/core/types.ts'; s=p.read_text();
s=s.replace("  p31: import('../cognition/P31FunctionalConsciousness.ts').ConsciousnessFunctionalState;", "  p31: import('../cognition/P31FunctionalConsciousness.ts').ConsciousnessFunctionalState;\n  p32: import('../cognition/P32CausalSelfModel.ts').CausalSelfModelState;")
p.write_text(s)

# Migrations imports/default/raw/normalization
p=root/'src/organism/persistence/StateMigrations.ts'; s=p.read_text()
s=s.replace("import { defaultP31Consciousness } from '../cognition/P31FunctionalConsciousness.ts';", "import { defaultP31Consciousness } from '../cognition/P31FunctionalConsciousness.ts';\nimport { defaultP32CausalSelfModel } from '../cognition/P32CausalSelfModel.ts';")
s=s.replace("p1?: any; p2?: any; p3?: any; p4?: any; p5?: any; p6?: any; p7?: any; p8?: any; p9?: any; p10?: any; p11?: any; p12?: any; p13?: any; p14?: any; p15?: any; p16?: any; p17?: any; p18?: any; p19?: any; p20?: any; p21?: any; p22?: any; p23?: any; p24?: any; p25?: any; p26?: any; p27?: any; p28?: any; p29?: any; p30?: any; p31?: any;", "p1?: any; p2?: any; p3?: any; p4?: any; p5?: any; p6?: any; p7?: any; p8?: any; p9?: any; p10?: any; p11?: any; p12?: any; p13?: any; p14?: any; p15?: any; p16?: any; p17?: any; p18?: any; p19?: any; p20?: any; p21?: any; p22?: any; p23?: any; p24?: any; p25?: any; p26?: any; p27?: any; p28?: any; p29?: any; p30?: any; p31?: any; p32?: any;")
s=s.replace("p31:defaultP31Consciousness(), causalExperiments:[], researchQuestionsCompleted:[]", "p31:defaultP31Consciousness(), p32:defaultP32CausalSelfModel(), causalExperiments:[], researchQuestionsCompleted:[]")
needle="  consciousness.p31={\n"
insert="""  const p32Raw=(raw.facets as any)?.consciousness?.p32 ?? raw.p32?.causalSelfModel ?? {};
  const p32Default=defaultP32CausalSelfModel();
  consciousness.p32={
    ...p32Default, ...p32Raw, version:1,
    nodes:Array.isArray(p32Raw.nodes)?p32Raw.nodes.slice(-96):[],
    edges:Array.isArray(p32Raw.edges)?p32Raw.edges.slice(-192):[],
    interventions:Array.isArray(p32Raw.interventions)?p32Raw.interventions.slice(-96):[],
    revisions:Array.isArray(p32Raw.revisions)?p32Raw.revisions.slice(-96):[],
    pendingPrediction:p32Raw.pendingPrediction??null,
    predictions:{...p32Default.predictions,...(p32Raw.predictions??{})},
    metrics:{...p32Default.metrics,...(p32Raw.metrics??{})},
  };
"""
s=s.replace(needle,insert+needle)
p.write_text(s)

# Core import/field/default/restore/checkpoint/integration/api methods
p=root/'src/organism/core/OrganismCore.ts'; s=p.read_text()
s=s.replace("import { P31FunctionalConsciousnessEngine, defaultP31Consciousness } from '../cognition/P31FunctionalConsciousness.ts';", "import { P31FunctionalConsciousnessEngine, defaultP31Consciousness } from '../cognition/P31FunctionalConsciousness.ts';\nimport { P32CausalSelfModelEngine, defaultP32CausalSelfModel } from '../cognition/P32CausalSelfModel.ts';")
s=s.replace("consciousnessEvidence: defaultConsciousnessEvidence(), p31: defaultP31Consciousness(), causalExperiments", "consciousnessEvidence: defaultConsciousnessEvidence(), p31: defaultP31Consciousness(), p32: defaultP32CausalSelfModel(), causalExperiments")
s=s.replace("private readonly p31Consciousness = new P31FunctionalConsciousnessEngine();", "private readonly p31Consciousness = new P31FunctionalConsciousnessEngine();\n  private readonly p32CausalSelf = new P32CausalSelfModelEngine();")
s=s.replace("    this.p31Consciousness.restore(this.persisted.facets.consciousness.p31);", "    this.p31Consciousness.restore(this.persisted.facets.consciousness.p31);\n    this.p32CausalSelf.restore(this.persisted.facets.consciousness.p32);")
# before p31 preview, make prediction from selected action
old="""    const p31Preview = this.p31Consciousness.preview({
      items: governedCandidates.slice(0,8).map(c=>({ id:c.id, source:observation.text?'external':'internal', salience:c.score, content:{ action:c.action, goalId:c.goalId } })),
      capacity:5, selectedAction:governedCandidates[0]?.action ?? 'none', externalInput:Boolean(observation.text),
    });"""
new="""    const p32Prediction = selectedIntent ? this.p32CausalSelf.predict({
      state,
      action:selectedIntent.action,
      autonomy01:autonomousOverride ? 0.82 : (observation.text ? 0.34 : 0.72),
      p31SelfAccess01:this.p31Consciousness.snapshot().metrics.selfAccess01,
      p31Agency01:this.p31Consciousness.snapshot().metrics.agencyBinding01,
      uncertainty01:n.uncertainty,
    }) : null;
    const p31Preview = this.p31Consciousness.preview({
      items: governedCandidates.slice(0,8).map(c=>({ id:c.id, source:observation.text?'external':'internal', salience:c.score, content:{ action:c.action, goalId:c.goalId } })),
      capacity:5, selectedAction:governedCandidates[0]?.action ?? 'none', externalInput:Boolean(observation.text),
    });"""
s=s.replace(old,new)
# workspace include causal self info
s=s.replace("p11: { governance: governanceRecord, futureSelf: futureForecast, regretMean: this.selfGovernance.snapshot().regretMean, governanceScore: this.selfGovernance.snapshot().governanceScore }", "p11: { governance: governanceRecord, futureSelf: futureForecast, regretMean: this.selfGovernance.snapshot().regretMean, governanceScore: this.selfGovernance.snapshot().governanceScore }, p32CausalSelf: p32Prediction ? { action:p32Prediction.action, expectedSuccess01:p32Prediction.expectedSuccess01, expectedAgency01:p32Prediction.expectedAgency01, confidence01:p32Prediction.confidence01 } : null")
# checkpoint persist p32 before save
s=s.replace("    this.persisted.facets.consciousness.p31 = this.p31Consciousness.snapshot();", "    this.persisted.facets.consciousness.p31 = this.p31Consciousness.snapshot();\n    this.persisted.facets.consciousness.p32 = this.p32CausalSelf.snapshot();")
# This replacement may affect multiple occurrences; acceptable.
# feedback p32 observe before p31 observe
needle="""      this.p31Consciousness.observeOutcome({ action:trace.selected.action, success01:success, reward01:clamp((outcome.reward ?? success + 0.5) / 1.5), surprise01:surprise, predictedSameAction:trace.selected.action===state.predictedNextAction, externallyRequested:Boolean(trace.userRequestedAction) });"""
rep="""      this.p32CausalSelf.observeOutcome({ action:trace.selected.action, success01:success, reward01:clamp((outcome.reward ?? success + 0.5) / 1.5), surprise01:surprise, externallyRequested:Boolean(trace.userRequestedAction), observationId:trace.id, state });
      this.persisted.facets.consciousness.p32=this.p32CausalSelf.snapshot();
      this.p31Consciousness.observeOutcome({ action:trace.selected.action, success01:success, reward01:clamp((outcome.reward ?? success + 0.5) / 1.5), surprise01:surprise, predictedSameAction:trace.selected.action===state.predictedNextAction, externallyRequested:Boolean(trace.userRequestedAction) });"""
s=s.replace(needle,rep)
# public methods near p31
needle="  p31Snapshot(){ return this.p31Consciousness.snapshot(); }"
insert="""  p31Snapshot(){ return this.p31Consciousness.snapshot(); }
  p32Snapshot(){ return this.p32CausalSelf.snapshot(); }
  p32Diagnostics(){ return this.p32CausalSelf.diagnostics(); }
  p32PredictSelf(action:ActionKind){ const s=this.persisted.state; return this.p32CausalSelf.predict({ state:s, action, autonomy01:s.autonomyScore, p31SelfAccess01:this.p31Consciousness.snapshot().metrics.selfAccess01, p31Agency01:this.p31Consciousness.snapshot().metrics.agencyBinding01, uncertainty01:s.needs.uncertainty }); }
  p32RecordIntervention(input:Parameters<P32CausalSelfModelEngine['recordControlledIntervention']>[0]){ const r=this.p32CausalSelf.recordControlledIntervention(input); this.persisted.facets.consciousness.p32=this.p32CausalSelf.snapshot(); return r; }
  p32LesionSelfCausal(){ const r=this.p32CausalSelf.lesionSelfCausalLinks(); this.persisted.facets.consciousness.p32=this.p32CausalSelf.snapshot(); return r; }
"""
s=s.replace(needle,insert)
p.write_text(s)

# server status/routes
p=root/'src/server/server.mjs'; s=p.read_text()
s=s.replace("functionalConsciousness: runtime.core.p31Snapshot(),", "functionalConsciousness: runtime.core.p31Snapshot(),\n        causalSelfModel: runtime.core.p32Snapshot(),")
needle="""    if (req.method === 'POST' && url.pathname === '/api/organism/consciousness/lesion') {"""
insert="""    if (req.method === 'GET' && url.pathname === '/api/organism/causal-self') {
      return json(res,200,{ok:true,phase:'P32-causal-self-model-mega-pack', causalSelfModel:runtime.core.p32Snapshot(), diagnostics:runtime.core.p32Diagnostics(), note:'Функциональная причинная модель собственного поведения; не доказательство субъективного опыта.'});
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/causal-self/predict') {
      const input=await body(req); const allowed=['respond','explore','verify','rest','reflect','wait','defer'];
      const action=allowed.includes(String(input.action)) ? String(input.action) : 'wait';
      try { const prediction=runtime.core.p32PredictSelf(action); return json(res,200,{ok:true,prediction,diagnostics:runtime.core.p32Diagnostics()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/causal-self/intervention') {
      const input=await body(req);
      try { const intervention=runtime.core.p32RecordIntervention({variable:String(input.variable||'unknown').slice(0,120),control01:Number(input.control01),treatment01:Number(input.treatment01),independent:Boolean(input.independent),repetitions:Number(input.repetitions||1)}); await runtime.core.flush(); return json(res,200,{ok:true,intervention,diagnostics:runtime.core.p32Diagnostics()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
    if (req.method === 'POST' && url.pathname === '/api/organism/causal-self/lesion') {
      try { const result=runtime.core.p32LesionSelfCausal(); await runtime.core.flush(); return json(res,200,{ok:true,result,diagnostics:runtime.core.p32Diagnostics()}); }
      catch(error){ return json(res,400,{ok:false,error:String(error?.message||error)}); }
    }
"""
s=s.replace(needle,insert+needle)
p.write_text(s)

# Add docs
(root/'docs').mkdir(exist_ok=True)
(root/'docs/P32_CAUSAL_SELF_MODEL_RU.md').write_text('''# P32 — Причинная модель собственного Я\n\nP32 связывает собственное действие, ожидаемый результат, фактический outcome, телесное состояние и revisions в один persistent causal-self слой.\n\n## Что реально реализовано\n- self-action → outcome/body causal edges;\n- self-prediction before outcome;\n- prediction error after outcome;\n- grounded revisions;\n- controlled intervention records with evidence levels;\n- bounded causal graph;\n- lesion of self-causal links;\n- persistence via schema 35.\n\n## Что это НЕ доказывает\nНикакая метрика P32 сама по себе не доказывает subjective experience, qualia или biological consciousness. Causal records называются observational, counterfactual или controlled только по фактическому источнику evidence.\n\n## Phone principle\nВ P32 нет тяжёлого ML framework: граф bounded, prediction cheap, persistence bounded. Основной бюджет телефона по-прежнему связан с LLM/I/O/Android runtime.\n''')
(root/'docs/P32_GAP_MATRIX_RU.md').write_text('''# P32 — Карта дефицитов\n\n| Область | Состояние | Следующий уровень |\n|---|---|---|\n| Causal self-model | реализовано | multi-step learned self-model |\n| Self-prediction | реализовано | calibration across many contexts |\n| Agency/ownership | реализовано | intervention-based attribution |\n| Global workspace | функциональный | recurrent cross-module broadcast |\n| Identity provenance | частично | full autobiographical evidence graph |\n| Learned world | реализовано | latent multi-agent simulator |\n| Vision/audio semantics | scaffold | semantic encoders |\n| Continual learning | реализовано | long-horizon anti-forgetting |\n| Subjective experience | неизвестно | фундаментально не доказано |\n| Device gate | не верифицирован физически | 24h/72h/168h/30d POCO |\n''')
(root/'docs/P32_FINAL_REPORT_RU.md').write_text('''# P32 Final Report\n\nP32 переводит P31 от преимущественно функционального consciousness scaffold к проверяемому causal-self loop. Ключевая связка: prediction → action → outcome → self-model revision.\n\nНовая версия: 8.2.0; schema 35.\n\nРелиз нельзя интерпретировать как доказательство субъективного сознания. Он даёт функциональные и причинно-структурные свойства, которые можно подвергать вмешательствам.\n''')

print('patched')
