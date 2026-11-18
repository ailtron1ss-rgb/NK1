import {
  buildLiveArchitectureMorphogenesisGraph,
  computeArchitectureGraphDigest,
  validateArchitectureMorphogenesisGraph,
} from '../src/organism/system/ArchitectureMorphogenesisEngine.ts';

const graph = buildLiveArchitectureMorphogenesisGraph();
const validation = validateArchitectureMorphogenesisGraph(graph);
const report = {
  schemaVersion: 1,
  status: validation.ok ? 'BASELINE_VALIDATED' : 'BLOCKED',
  graphDigest: computeArchitectureGraphDigest(graph),
  canonicalGenomeDigest: graph.canonicalGenomeDigest,
  sourceCommit: graph.sourceCommit,
  modules: validation.moduleCount,
  sourceFiles: graph.modules.reduce((sum, module) => sum + module.sourcePaths.length, 0),
  contracts: validation.contractCount,
  edges: validation.edgeCount,
  sharedSourceFiles: graph.sharedSourcePaths.length,
  sharedSourcePaths: graph.sharedSourcePaths,
  structuralCyclePolicy: 'import and contract edges must be acyclic; recurrent data-flow edges are preserved',
  issues: validation.issues,
  safety: {
    readOnly: true,
    writesSourceFiles: false,
    createsBranches: false,
    mergesBranches: false,
    activatesCandidates: false,
    modifiesReleaseArtifacts: false,
  },
  limitation: 'The cognitive contract/data-flow graph is derived from CognitiveArchitectureMap and DevelopmentalGenome. The complete source import graph remains independently checked by npm run audit:architecture.',
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (!validation.ok) process.exitCode = 1;
