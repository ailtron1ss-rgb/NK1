import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

function run(condition) {
  const core = new OrganismCore(new MemoryStateStore(), { enableSemanticMemory: condition !== 'memory-graph-lesion', enableUnifiedMemory: condition !== 'memory-graph-lesion', enableSocialDevelopment: condition !== 'social-lesion' });
  return core.init().then(async () => {
    for (const text of ['Как это работает?', 'Мне важно понять причину.', 'Спасибо за проверку.', 'Почему результат изменился?']) {
      await core.observe({ text, socialSignal: .55, surprise: .2, novelty: .3 });
      await core.feedback({ success: .68, reward: .68, surprise: .2 });
    }
    const s=core.snapshot();
    return { condition, beliefs:s.facets.advanced.unifiedMemory.beliefs.length, predictions:s.facets.advanced.socialDevelopment.predictions.length, repairs:s.facets.advanced.socialDevelopment.repairHistory.length, graphNodes:s.facets.memory.semanticGraph.nodes.length };
  });
}
const results=[];
for (const c of ['baseline','memory-graph-lesion','social-lesion']) results.push(await run(c));
console.log(JSON.stringify({suite:'p12-memory-social', results}, null, 2));
console.log('P12_MEMORY_SOCIAL_LAB=PASS');
