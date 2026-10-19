import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { PersistenceBranchBudgetAuditor, DEFAULT_PERSISTENCE_BRANCH_BUDGETS } from '../src/organism/persistence/PersistenceBranchBudget.ts';

const core = new OrganismCore(new MemoryStateStore());
await core.init();
for (let i=0;i<80;i++) await core.observe({text:`budget profile ${i} persistent state economics semantic provenance ${i%11}`});
const report = new PersistenceBranchBudgetAuditor(DEFAULT_PERSISTENCE_BRANCH_BUDGETS).inspect(core.snapshot());
assert.equal(report.overBudget, 0, report.branches.filter(x=>x.overBudget).map(x=>`${x.path}=${x.bytes}>${x.budget}`).join(', '));
assert.ok(report.totalBytes < 2_500_000, `total snapshot too large: ${report.totalBytes}`);
assert.ok(report.maxUtilization01 < 1, `branch utilization reached/exceeded budget: ${report.maxUtilization01}`);
console.log(`PERSISTENCE_BRANCH_BUDGET=PASS total=${report.totalBytes} maxUtilization=${report.maxUtilization01.toFixed(3)}`);
for (const branch of report.branches) console.log(`  ${branch.path}=${branch.bytes}/${branch.budget}`);
