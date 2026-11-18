import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';
import { cognitiveNeuralProfileFingerprint } from '../src/organism/cognition/CognitiveToNeuralBridge.ts';

async function runRuntime(enabled, receiptEnabled = true, mutateProfileAfterReceipt = false, usageMode = 'normal') {
  const dir = await mkdtemp(path.join(tmpdir(), 'nk-cognitive-neural-bridge-'));
  const requests = [];
  const responses = [];
  const runtime = new OrganismRuntime({
    stateFile: path.join(dir, 'state.json'),
    worldStateFile: path.join(dir, 'world.json'),
    enableLanguage: true,
    languageInvoker: async request => {
      requests.push(request);
      let providerUsage={promptTokens:90,completionTokens:32,totalTokens:122};
      if(usageMode==='missing') providerUsage=undefined;
      else if(usageMode==='invalid') providerUsage={promptTokens:-1,completionTokens:10,totalTokens:9};
      else if((usageMode==='over-budget'||usageMode==='truncated') && request.cognitiveControl) {
        const completionTokens=request.cognitiveControl.maxTokens+(usageMode==='over-budget'?3:0);
        providerUsage={promptTokens:90,completionTokens,totalTokens:90+completionTokens};
      }
      const response = {
        text: 'Verified local language response.',
        backend: 'llama.cpp:bridge-test-model',
        latencyMs: 1,
        providerFinishReason: usageMode==='over-budget'||usageMode==='truncated'?'length':'stop',
        ...(providerUsage ? {providerUsage} : {}),
        ...(request.cognitiveControl && request.cognitiveControlRequestId && receiptEnabled ? {
          providerControlReceipt: {
            provider: 'llama.cpp',
            templateKwargsSent: true,
            featureSchema: request.cognitiveControl.featureSchema,
            requestId: request.cognitiveControlRequestId,
            profileFingerprint: cognitiveNeuralProfileFingerprint(request.cognitiveControl),
          },
        } : {}),
      };
      responses.push(response);
      if(mutateProfileAfterReceipt && request.cognitiveControl) {
        // Simulate a provider mutating caller-owned request metadata after producing its receipt.
        request.cognitiveControl.temperature=Math.min(.85,request.cognitiveControl.temperature+.001);
      }
      return response;
    },
    stateStore: new MemoryStateStore(),
    worldStateStore: new MemoryStateStore(),
    journal: new BoundedOperationalJournal(),
    performanceProfile: 'mobile',
    cycleResultMode: 'summary',
    ...(enabled ? {} : { cognitiveToNeuralBridge: { enabled: false } }),
  });
  try {
    await runtime.init();
    await runtime.step('Please reason about this controlled test observation.', { deliberate: true });
    assert.ok(requests.length > 0, 'the runtime must reach its injected LanguageInvoker');
    if (enabled && receiptEnabled && !mutateProfileAfterReceipt && usageMode === 'normal') {
      const request = requests.find(value => value.cognitiveControl);
      assert.ok(request, 'enabled runtime must attach cognitive control to LanguageRequest');
      assert.equal(request.cognitiveControl.version, 2);
      assert.equal(request.cognitiveControl.featureVector01.length, 43);
      assert.equal(request.cognitiveControl.neuralSnapshotAvailable, true);
      assert.ok(Number.isSafeInteger(request.cognitiveControl.neuralSnapshotVersion));
      assert.equal(request.cognitiveControl.controlsConfigured.samplingParameters, true);
      assert.equal(request.cognitiveControl.controlsConfigured.activationSteering, false);
      const diagnostics = runtime.cognitiveToNeuralBridgeDiagnostics();
      assert.ok(diagnostics.projected > 0);
      assert.ok(diagnostics.samplingControlsConfigured > 0);
      assert.ok(diagnostics.neuralSnapshotsAvailable > 0);
      assert.ok(Number.isSafeInteger(diagnostics.lastNeuralSnapshotVersion));
      assert.equal(diagnostics.lastFeatureDimensions, 43);
      assert.equal(diagnostics.activationSteeringApplied, 0);
      assert.equal(diagnostics.residualBlockApplied, 0);
      assert.ok(diagnostics.llamaCppTemplateKwargsSent > 0);
      assert.ok(diagnostics.providerControlReceiptsAccepted > 0);
      assert.equal(diagnostics.providerControlReceiptsRejected,0);
      assert.equal(diagnostics.providerControlReceiptsDuplicate,0);
      assert.ok(diagnostics.providerUsageObservations>0);
      assert.equal(diagnostics.providerUsageUnavailable,0);
      assert.equal(diagnostics.providerUsageInvalid,0);
      assert.equal(diagnostics.providerUsageDuplicates,0);
      assert.equal(diagnostics.providerUsageRequestIdUnavailable,0);
      assert.ok(diagnostics.providerPromptTokensTotal>=90);
      assert.ok(diagnostics.providerCompletionTokensTotal>=32);
      assert.ok(diagnostics.providerTotalTokensTotal>=122);
      assert.ok(diagnostics.providerCompletionBudgetUtilizationMean>=0);
      assert.equal(diagnostics.providerCompletionBudgetExceeded,0);
      assert.ok(diagnostics.providerBudgetFeedbackObservations>0);
      assert.ok(diagnostics.providerBudgetFeedback.some(item=>item.mode===request.cognitiveControl.mode
        && item.sampleCount>0));
      assert.equal(diagnostics.lastTemplateControlSchema, 'nk1-cognitive-neural-43-v2');
      assert.match(request.cognitiveControlRequestId,/^[a-f0-9-]{36}:\d+:\d+$/i);
      assert.equal(responses[requests.indexOf(request)].providerControlReceipt.requestId,
        request.cognitiveControlRequestId);

      const acceptedBeforeReplay=diagnostics.providerControlReceiptsAccepted;
      const selectedResponse=responses[requests.indexOf(request)];
      const usageObservationsBeforeReplay=diagnostics.providerUsageObservations;
      const totalTokensBeforeReplay=diagnostics.providerTotalTokensTotal;
      runtime.recordCognitiveProviderUsage(request,selectedResponse);
      const afterUsageReplay=runtime.cognitiveToNeuralBridgeDiagnostics();
      assert.equal(afterUsageReplay.providerUsageObservations,usageObservationsBeforeReplay,
        'replaying the same provider usage receipt must not count token usage twice');
      assert.equal(afterUsageReplay.providerUsageDuplicates,1);
      assert.equal(afterUsageReplay.providerTotalTokensTotal,totalTokensBeforeReplay);
      runtime.recordCognitiveProviderUsage({
        ...request,cognitiveControlRequestId:undefined,
      },selectedResponse);
      assert.equal(runtime.cognitiveToNeuralBridgeDiagnostics().providerUsageRequestIdUnavailable,1,
        'usage observations without a runtime request ID must not enter the ledger');
      runtime.recordCognitiveProviderControlReceipt(request,selectedResponse);
      const afterReplay=runtime.cognitiveToNeuralBridgeDiagnostics();
      assert.equal(afterReplay.providerControlReceiptsAccepted,acceptedBeforeReplay,
        'replaying the same request receipt must not increment the hand-off counter');
      assert.equal(afterReplay.providerControlReceiptsDuplicate,1);

      runtime.recordCognitiveProviderControlReceipt({
        ...request, cognitiveControlRequestId: request.cognitiveControlRequestId + ':stale',
      },selectedResponse);
      runtime.recordCognitiveProviderControlReceipt(request,{
        ...selectedResponse,
        providerControlReceipt:{
          ...selectedResponse.providerControlReceipt,
          profileFingerprint:'0'.repeat(64),
        },
      });
      runtime.recordCognitiveProviderControlReceipt(request,{
        ...selectedResponse,
        backend:'gemini:wrong-provider',
      });
      const afterTampering=runtime.cognitiveToNeuralBridgeDiagnostics();
      assert.equal(afterTampering.providerControlReceiptsRejected,3,
        'stale IDs, mismatched fingerprints and non-llama.cpp responses must be rejected');
      assert.equal(afterTampering.llamaCppTemplateKwargsSent,acceptedBeforeReplay);


    } else if (enabled && receiptEnabled && mutateProfileAfterReceipt) {
      const diagnostics=runtime.cognitiveToNeuralBridgeDiagnostics();
      assert.ok(requests.some(value=>value.cognitiveControl));
      assert.equal(diagnostics.llamaCppTemplateKwargsSent,0,
        'provider receipts must be rejected when async code mutates the originally projected profile');
      assert.equal(diagnostics.providerControlReceiptsAccepted,0);
      assert.ok(diagnostics.providerControlReceiptsRejected>0);
      assert.equal(diagnostics.providerUsageObservations,0,
        'mutated control profiles must not contribute trusted usage statistics');
      assert.ok(diagnostics.providerUsageInvalid>0);
    } else if (enabled && receiptEnabled && usageMode === 'missing') {
      const diagnostics=runtime.cognitiveToNeuralBridgeDiagnostics();
      assert.ok(diagnostics.providerControlReceiptsAccepted>0);
      assert.equal(diagnostics.providerUsageObservations,0);
      assert.ok(diagnostics.providerUsageUnavailable>0);
      assert.equal(diagnostics.providerUsageInvalid,0);
    } else if (enabled && receiptEnabled && usageMode === 'invalid') {
      const diagnostics=runtime.cognitiveToNeuralBridgeDiagnostics();
      assert.ok(diagnostics.providerControlReceiptsAccepted>0);
      assert.equal(diagnostics.providerUsageObservations,0);
      assert.equal(diagnostics.providerUsageUnavailable,0);
      assert.ok(diagnostics.providerUsageInvalid>0);
    } else if (enabled && receiptEnabled && usageMode === 'over-budget') {
      const diagnostics=runtime.cognitiveToNeuralBridgeDiagnostics();
      assert.ok(diagnostics.providerControlReceiptsAccepted>0);
      assert.ok(diagnostics.providerUsageObservations>0);
      assert.ok(diagnostics.providerCompletionBudgetExceeded>0);
      assert.ok(diagnostics.providerCompletionBudgetUtilizationMax>1);
      assert.equal(diagnostics.providerBudgetFeedbackTruncations,0,
        'over-budget provider anomalies must never increase future token allocation');
      assert.ok(diagnostics.providerBudgetFeedbackRejected>0,
        'over-budget provider usage must be excluded from adaptive feedback');
    } else if (enabled && receiptEnabled && usageMode === 'truncated') {
      const diagnostics=runtime.cognitiveToNeuralBridgeDiagnostics();
      assert.ok(diagnostics.providerControlReceiptsAccepted>0);
      assert.ok(diagnostics.providerUsageObservations>0);
      assert.ok(diagnostics.providerBudgetFeedbackTruncations>0,
        'valid length finish reasons at the configured cap must drive bounded feedback');
      const truncationFeedback=diagnostics.providerBudgetFeedback.find(item=>item.sampleCount>0&&item.truncatedCount>0);
      assert.ok(truncationFeedback,'valid finish_reason=length usage must enter the per-mode feedback window');
      if(truncationFeedback.sampleCount<4)
        assert.equal(truncationFeedback.truncationPressure01,0,'adaptive pressure must remain dormant during the four-sample warm-up');
      else
        assert.ok(truncationFeedback.truncationPressure01>0,'adaptive pressure activates only after the minimum evidence window');

    } else if (enabled) {
      const request=requests.find(value=>value.cognitiveControl);
      assert.ok(request,'bridge projection must remain active when template controls are disabled');
      assert.ok(request.cognitiveControlRequestId,'request correlation remains available for token usage');
      const diagnostics=runtime.cognitiveToNeuralBridgeDiagnostics();
      assert.ok(diagnostics.providerUsageObservations>0,
        'actual llama.cpp token usage must be counted independently of Jinja template-control receipts');
      assert.ok(diagnostics.providerCompletionTokensTotal>0);
      assert.equal(diagnostics.llamaCppTemplateKwargsSent,0);
      assert.equal(diagnostics.providerControlReceiptsAccepted,0);
      assert.equal(diagnostics.providerUsageUnavailable,0);
    } else {
      assert.ok(requests.every(value => value.cognitiveControl === undefined),
        'emergency bypass must pass requests to the provider without mutation');
      const diagnostics = runtime.cognitiveToNeuralBridgeDiagnostics();
      assert.equal(diagnostics.projected, 0);
      assert.ok(diagnostics.bypassed > 0);
      assert.equal(diagnostics.llamaCppTemplateKwargsSent, 0, 'provider receipts must not be attributed when the bridge was bypassed');
      assert.equal(diagnostics.providerControlReceiptsAccepted,0);
    }
  } finally {
    await runtime.stop();
    await rm(dir, { recursive:true, force:true });
  }
}

await runRuntime(true);
await runRuntime(true,false);
await runRuntime(true,true,true);
await runRuntime(true,true,false,'missing');
await runRuntime(true,true,false,'invalid');
await runRuntime(true,true,false,'over-budget');
await runRuntime(true,true,false,'truncated');
await runRuntime(false);
console.log('COGNITIVE_TO_NEURAL_RUNTIME_INTEGRATION_PASS');
