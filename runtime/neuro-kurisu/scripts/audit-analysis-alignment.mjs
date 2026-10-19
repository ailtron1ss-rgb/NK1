import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const exists = p => fs.existsSync(path.join(root,p));
const checks = [
  ['BIG PASS 8 audit document exists', exists('docs/BIG_PASS_8_CHANGELOG_QWEN_AUDIT_RU.md')],
  ['BIG PASS 9 audit document exists', exists('docs/BIG_PASS_9_MEMORY_PERSISTENCE_EFFICIENCY_RU.md')],
  ['MemoryOS2 canonical subsystem exists', exists('src/organism/developmental/MemoryOS2.ts')],
  ['Memory substrate coordinator exists', exists('src/organism/developmental/MemorySubstrateCoordinator.ts')],
  ['Persistence projection governor exists', exists('src/organism/persistence/PersistenceProjectionGovernor.ts')],
  ['Advanced projection scheduler exists', exists('src/organism/persistence/AdvancedProjectionScheduler.ts')],
  ['Persistence branch budget auditor exists', exists('src/organism/persistence/PersistenceBranchBudget.ts')],
  ['Branch budget regression test exists', exists('tests/persistence-branch-budget.mjs')],
  ['Durability window test exists', exists('tests/persistence-durability-window.mjs')],
  ['Projection efficiency test exists', exists('tests/projection-efficiency.mjs')],
  ['Statistical long horizon test exists', exists('tests/long-horizon-statistical.mjs')],
  ['Revision graph exists', exists('src/organism/persistence/RevisionGraph.ts')],
  ['Revision token registry exists', exists('src/organism/persistence/RevisionTokenRegistry.ts')],
  ['Revision token registry regression test exists', exists('tests/revision-token-registry.mjs')],
  ['Budget feedback regression test exists', exists('tests/persistence-budget-feedback.mjs')],
  ['Warm 500-cycle benchmark exists', exists('tests/long-horizon-operational-500-warm.mjs')],
  ['Revision graph persistence test exists', exists('tests/revision-graph-persistence.mjs')],
  ['Revision-aware projection test exists', exists('tests/revision-aware-projection.mjs')],
  ['Persistence budget controller exists', exists('src/organism/persistence/PersistenceBudgetController.ts')],
  ['Budget controller test exists', exists('tests/persistence-budget-controller.mjs')],
  ['Forensics audit script exists', exists('scripts/audit-forensics.mjs')],
];
const core = read('src/organism/core/OrganismCore.ts');
const projection = read('src/organism/core/PersistenceProjectionCoordinator.ts');
const memoryOs = read('src/organism/developmental/MemoryOS2.ts');
checks.push(
  ['OrganismCore wires scheduler', core.includes('AdvancedProjectionScheduler')],
  ['OrganismCore wires revision graph', core.includes('RevisionGraph') && core.includes('revisionTokens.touch')],
  ['OrganismCore wires revision token registry', core.includes('RevisionTokenRegistry') && core.includes('revisionTokens.snapshot()')],
  ['OrganismCore wires budget controller', core.includes('PersistenceBudgetController') && core.includes('persistenceBudgetController.decide')],
  ['Budget controller drives per-branch limits', (core + projection).includes('compatibilityMemoryLimit') && (core + projection).includes('p62HistoryLimit') && (core + projection).includes('evidenceHistoryLimit') && (core + projection).includes('realityHistoryLimit')],
  ['OrganismCore persists scheduler state', core.includes('advancedProjectionSchedule')],
  ['Persistence coordinator persists revision graph', projection.includes('target.system.revisionGraph')],
  ['OrganismCore has tiered checkpoint', core.includes('projectionDecision.full') && (core.includes('syncPersistenceProjection(fullProjection') || core.includes('persistenceProjectionCoordinator.sync(this.persisted'))],
  ['flush forces checkpoint', core.includes('async flush(): Promise<void> { await this.checkpoint(true); }')],
  ['Canonical memory drives durable compatibility projection', (core + projection).includes('projectCompatibilityRecords(ctx.memorySubsystem.memoryOS.snapshot({clone:false}), budgetAction.compatibilityMemoryLimit)') || (core + projection).includes('projectCompatibilityRecords(this.memoryOS.snapshot({clone:false}), 48)')],
  ['Operational result plane exists', core.includes('observeOperational') && core.includes("resultMode: 'full'|'operational'")],
  ['Operational path avoids redundant hot snapshot sync', core.includes("if (resultMode !== 'operational') this.syncHotPersistenceProjection();")],
  ['Memory lifecycle uses statsLight instead of full snapshot clones', (core + projection).includes('memoryOS.statsLight().dormant') && (core + projection).includes('memoryOS.statsLight().reconsolidations') || memoryOs.includes('statsLight')],
  ['Checkpoint duplicate snapshot block removed', !core.includes('this.persisted.facets.learning.p26=this.p26TrueLearning.snapshot();\n    this.persisted.facets.learning.p28=this.p28Plasticity.snapshot();\n    this.persisted.facets.learning.p29=this.p29Learning.snapshot();\n    this.persisted.facets.cognition.p27=this.p27NeuralWorld.snapshot();\n    this.persisted = this.integrity.stamp')],
  ['Persistence coordinator persists revision registry independently', projection.includes('target.system.revisionTokens=this.snapshotOnce')],
  ['Revision registry restores independently', core.includes('this.revisionTokens.restore(')],
  ['Independent subsystem revision registry is v2', read('src/organism/persistence/RevisionTokenRegistry.ts').includes('version: 2')],
  ['Memory encode uses bounded candidate scan', read('src/organism/developmental/MemoryOS2.ts').includes('this.state.items.slice(0,512)')],
  ['Memory retrieve uses link-support cache', read('src/organism/developmental/MemoryOS2.ts').includes('linkSupportCacheVersion')],
  ['MultiTimescale retrieval avoids full sort', read('src/organism/memory/MultiTimescaleMemory.ts').includes('const top:Array<{m:MemoryRecord;score:number}>')],
  ['500 natural benchmark is separately available', exists('tests/long-horizon-operational-500-natural.mjs')],
  ['MultiTimescale retrieval keeps bounded top-K semantics', read('src/organism/memory/MultiTimescaleMemory.ts').includes('if(at<limit)top.splice(at,0,{m,score})')],
  ['Memory retrieve caches link support', read('src/organism/developmental/MemoryOS2.ts').includes('linkSupportCacheVersion')],
  ['BIG PASS 15 report is present', exists('docs/BIG_PASS_15_INDEPENDENT_REVISION_MEMORY_PERF_RU.md')],
  ['BIG PASS 50 cognitive frame exists', exists('src/organism/core/CognitiveFrame.ts')],
  ['BIG PASS 50 execution planner exists', exists('src/organism/core/CognitiveExecutionPlanner.ts')],
  ['BIG PASS 50 planner is wired to OrganismCore', core.includes('CognitiveExecutionPlanner') && core.includes('cognitiveExecutionPlanner.compile')],
  ['BIG PASS 50 planner state is persisted', core.includes('cognitiveExecutionPlan') && core.includes('this.persisted.system.cognitiveExecutionPlan')],
  ['BIG PASS 50 lightweight previous-state capture', core.includes('const previous: OrganismState = {') && core.includes('needs: { ...state.needs }')],
  ['Action verification contract remains explicit after later refactors', read('src/organism/system/ActionGateway.ts').includes('ToolDefinition') && read('src/organism/system/ActionGateway.ts').includes('verification.verified') && read('src/organism/system/ActionGateway.ts').includes('verificationBasis')],
  ['BIG PASS 50 regression test exists', exists('tests/big-pass-50-cognitive-execution.mjs')],
);
const failures=checks.filter(([,ok])=>!ok);
if(failures.length){
  for(const [name] of failures)console.error(`FAIL ${name}`);
  process.exit(1);
}
console.log(`ANALYSIS_ALIGNMENT=PASS checks=${checks.length} failures=0`);
