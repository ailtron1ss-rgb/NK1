import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const app=path.resolve(root,'../../app');
const api=await readFile(path.join(app,'src/neuro-kurisu/api.ts'),'utf8');
const server=await readFile(path.join(root,'src/server/server.mjs'),'utf8');
const ui=await readFile(path.join(app,'src/components/IntegrationConsole.tsx'),'utf8');
const hexisUi=await readFile(path.join(app,'src/components/HexisControlConsole.tsx'),'utf8');
const atlasUi=await readFile(path.join(app,'src/components/RuntimeAtlas.tsx'),'utf8');
const lettaUi=await readFile(path.join(app,'src/components/LettaGovernanceConsole.tsx'),'utf8');
const conscioUi=await readFile(path.join(app,'src/components/ConscioControlConsole.tsx'),'utf8');
const allUi=`${ui}\n${hexisUi}\n${atlasUi}\n${lettaUi}\n${conscioUi}`;
const routes=[...api.matchAll(/"(\/api\/organism\/(?:integration|will|voice)[^"]*)"/g)].map(m=>m[1]);
const unique=[...new Set(routes)];
const missing=unique.filter(r=>!server.includes(`'${r}'`)&&!server.includes(`\"${r}\"`));
const methods=['integrationOverview','integrationCapabilities','exactSearch','exportPma','validatePma','idempotency','integrationTransport','integrationReplay','integrationIntegrity','voiceSpeak','voiceListen','voiceTurn','voiceStatus','willDiagnostics','willSdk','willMcpManifest','willBenchmark','integrationCapabilityAuthorize','integrationSocial','integrationConversation','integrationOutbound','integrationWebValidate','integrationCompetence','integrationCompetenceValidate'];
const lettaMethods=['lettaGovernance','lettaSourceBoundary','lettaTelemetryPolicy','lettaSetTelemetryPolicy','lettaArtifactReview','lettaArtifactDecide'];
const conscioMethods=['conscio','conscioSyncMemory','conscioSearch','conscioSourceBoundary','conscioSkills','conscioPublishSkill','conscioTrialSkill','conscioReviewSkill','conscioPeers','conscioPairPeer','conscioDecidePeer','conscioPeerMessage','conscioPeerAck','conscioCalibration','conscioCalibrationObserve','conscioClaims','conscioRecordClaim','conscioMetabolic'];
const hexisMethods=['hexis','hexisMemories','hexisSyncMemory','hexisReviseBelief','hexisTemporalAt','hexisTemporalDiff','hexisReviews','hexisCreateReview','hexisDecideReview','hexisRetentionPropose','hexisRetentionApply','hexisHmxExport','hexisHmxStage','hexisHmxDecide','hexisOutbox','hexisOutboxEnqueue','hexisOutboxClaim','hexisOutboxAck','hexisOutboxReclaim','hexisPolicyGrant','hexisPolicyEvaluate','hexisPolicyRevoke','hexisExecutionPlan','hexisRemotePeerStatus','hexisRemotePeerConsult'];
const atlasMethods=['status','statusLite','inspect','systemGraph','subsystems','session','time','resilience','sensorium','cognitionPlan','perception','semanticIntelligence','semanticPerception','semanticWorld','neuralWorld','neuralSpine','worldGrounding','worldIdentity','temporalPerception','memoryInspector','learning','trueLearning','skills','continualIntelligence','personalCurriculum','personalWorldline','subjectContinuity','personhood','socialMind','developmentalSelf','developmentalSynthesis','developmentalExecutive','life','lifeTrajectory','scientificDevelopment','researchGradeOrganism','projectsActive','autonomousCognitiveLife','persistentReality','cognitiveContinuity','experienceContinuum','consciousness'];
const allMethods=[...methods,...lettaMethods,...conscioMethods,...hexisMethods,...atlasMethods];
const methodUsage=Object.fromEntries(allMethods.map(m=>[m, allUi.includes(`neuroApi.${m}`) || (atlasMethods.includes(m) && allUi.includes('neuroApi[key]') && allUi.includes(`\"${m}\"`))]));
const unused=allMethods.filter(m=>!methodUsage[m]);
const hmxOutcomeIsExplicit =
  hexisUi.includes('const acceptHmxStage = async () =>') &&
  hexisUi.includes('receipt.status === "uncertain"') &&
  hexisUi.includes('Do not retry this stage') &&
  hexisUi.includes('the import outcome could not be confirmed; memory changes may have survived') &&
  hexisUi.includes('Unverified bookkeeping counts (not proof of applied rows)') &&hexisUi.includes('Do not retry this stage') &&
  hexisUi.includes('receipt.status === "pending"') &&
  hexisUi.includes('onClick={() => void acceptHmxStage()}');
const operationResultSurvivesRefreshFailure =
  hexisUi.includes('catch (refreshError)') &&
  hexisUi.includes('action completed; refresh failed:') &&
  hexisUi.includes('return result;');
const result={ok:missing.length===0&&unused.length===0&&hmxOutcomeIsExplicit&&operationResultSurvivesRefreshFailure,apiRoutes:unique.length,missingServerRoutes:missing,methodUsage,unusedUiMethods:unused,hmxTerminalOutcomeIsExplicit:hmxOutcomeIsExplicit,operationResultSurvivesRefreshFailure,interfaceComponent:existsSync(path.join(app,'src/components/IntegrationConsole.tsx'))&&existsSync(path.join(app,'src/components/HexisControlConsole.tsx'))&&existsSync(path.join(app,'src/components/RuntimeAtlas.tsx'))&&existsSync(path.join(app,'src/components/LettaGovernanceConsole.tsx'))&&existsSync(path.join(app,'src/components/ConscioControlConsole.tsx')),lettaMethods,conscioMethods,hexisMethods,atlasMethods,checkedAt:new Date().toISOString()};
await import('node:fs/promises').then(fs=>fs.writeFile(path.join(root,'INTERFACE_FUNCTION_MATRIX_2026-10-08.json'),JSON.stringify(result,null,2)+'\n'));
console.log(JSON.stringify(result,null,2));
if(!result.ok) process.exitCode=1;
