# BIG PASS 190 — Semantic Coverage Audit

Functions: **5318**

| Status | Count |
|---|---:|
| VERIFIED | 34 |
| INTEGRATION_ONLY | 9 |
| UNSAFE_TO_AUTO_RUN | 317 |
| UNVERIFIED | 4958 |

Strict VERIFIED rate: **0.64%**

Evidence coverage (VERIFIED + 25% integration credit): **0.68%**

> Static presence and a test name reference do not count as behavioural proof.

## Cognitive branch

Functions: **3869**

| Status | Count |
|---|---:|
| VERIFIED | 22 |
| INTEGRATION_ONLY | 7 |
| UNSAFE_TO_AUTO_RUN | 242 |
| UNVERIFIED | 3598 |

## Critical domain backlog

| Domain | Unverified | Integration | Verified |
|---|---:|---:|---:|
| memory | 436 | 4 | 9 |
| emotion | 20 | 0 | 0 |
| world | 814 | 0 | 0 |
| self | 492 | 4 | 4 |
| agency | 369 | 0 | 0 |
| learning | 664 | 0 | 0 |
| perception | 150 | 1 | 0 |
| consciousness | 96 | 0 | 6 |
| infrastructure | 1917 | 0 | 15 |

## Automatic execution exclusions

- src/node-shims.d.ts:2:createHash
- src/node-shims.d.ts:4:access
- src/node-shims.d.ts:5:appendFile
- src/node-shims.d.ts:6:copyFile
- src/node-shims.d.ts:7:mkdir
- src/node-shims.d.ts:8:open
- src/node-shims.d.ts:9:readFile
- src/node-shims.d.ts:10:readFile
- src/node-shims.d.ts:11:rename
- src/node-shims.d.ts:12:rm
- src/node-shims.d.ts:13:stat
- src/node-shims.d.ts:14:unlink
- src/node-shims.d.ts:15:writeFile
- src/node-shims.d.ts:16:mkdtemp
- src/node-shims.d.ts:19:tmpdir
- src/node-shims.d.ts:19:totalmem
- src/node-shims.d.ts:19:freemem
- src/node-shims.d.ts:19:loadavg
- src/node-shims.d.ts:19:cpus
- src/node-shims.d.ts:19:hostname
- src/node-shims.d.ts:20:createServer
- src/node-shims.d.ts:21:spawn
- src/node-shims.d.ts:21:execFile
- src/node-shims.d.ts:22:promisify
- src/organism/body/AndroidEmbodimentBridge.ts:37:commandJson
- src/organism/body/AndroidEmbodimentBridge.ts:46:commandExists
- src/organism/body/AndroidEmbodimentBridge.ts:50:parseSensorPayload
- src/organism/body/AndroidEmbodimentBridge.ts:73:detectTermuxCapabilities
- src/organism/body/AndroidEmbodimentBridge.ts:88:sampleAndroidTelemetryDetailed
- src/organism/body/AndroidEmbodimentBridge.ts:139:sampleAndroidTelemetry
- src/organism/body/AndroidEmbodimentBridge.ts:143:certifyAndroidHardware
- src/organism/body/AndroidEmbodimentBridge.ts:156:speakViaTermux
- src/organism/body/AndroidEmbodimentBridge.ts:186:synthesizeSpeechInput
- src/organism/body/AndroidEmbodimentBridge.ts:194:captureCameraPhoto
- src/organism/body/CameraEvidenceProcessor.ts:38:readU16
- src/organism/body/CameraEvidenceProcessor.ts:68:quality
- src/organism/body/CameraEvidenceProcessor.ts:74:inspectCameraBytes
- src/organism/body/CameraEvidenceProcessor.ts:83:inspectCameraFile
- src/organism/body/CameraEvidenceProcessor.ts:88:cameraEvidenceFromResult
- src/organism/body/DeviceEvidenceLedger.ts:7:stableCaps
- src/organism/body/DeviceEvidenceLedger.ts:10:restore
- src/organism/body/EmbodiedActionExecutor.ts:33:constructor
- src/organism/body/EmbodiedActionExecutor.ts:35:execute
- src/organism/body/EmbodiedBody.ts:51:defaultBodyState
- src/organism/body/EmbodiedBody.ts:87:synthesizeBody
- src/organism/body/EmbodiedBody.ts:115:applyBodyToOrganismState
- src/organism/body/EmbodiedBody.ts:127:bodyActionPenalty
- src/organism/body/EmbodiedRecoveryController.ts:39:defaultEmbodiedRecoveryState
- src/organism/body/EmbodiedRecoveryController.ts:72:record
- src/organism/body/EmbodimentRuntime.ts:20:init
- src/organism/body/EmbodimentRuntime.ts:30:snapshot
- src/organism/body/EmbodimentRuntime.ts:31:eventLog
- src/organism/body/EmbodimentRuntime.ts:32:capabilitiesSnapshot
- src/organism/body/EmbodimentRuntime.ts:33:voiceSnapshot
- src/organism/body/EmbodimentRuntime.ts:34:sensorDiagnosticsSnapshot
- src/organism/body/EmbodimentRuntime.ts:36:sample
- src/organism/body/EmbodimentRuntime.ts:49:sampleActive
- src/organism/body/EmbodimentRuntime.ts:53:userActivity
- src/organism/body/EmbodimentRuntime.ts:121:markVoiceInterruption
- src/organism/body/EmbodimentRuntime.ts:126:captureCamera
- src/organism/body/EmbodimentRuntime.ts:128:push
- src/organism/body/GeminiVisionSemanticBackend.ts:39:analyze
- src/organism/body/MultimodalPerception.ts:22:hashText
- src/organism/body/P35SemanticWorldBody.ts:80:defaultP35SemanticWorldBody
- src/organism/body/P35SemanticWorldBody.ts:186:ingestBody
- src/organism/body/P37EmbodiedSensorium.ts:98:defaultP37EmbodiedSensorium
- src/organism/body/P37EmbodiedSensorium.ts:103:fastHash
- src/organism/body/P37EmbodiedSensorium.ts:104:id
- src/organism/body/P37EmbodiedSensorium.ts:109:restore
- src/organism/body/P37EmbodiedSensorium.ts:127:snapshot
- src/organism/body/P37EmbodiedSensorium.ts:129:ingest
- src/organism/body/P37EmbodiedSensorium.ts:143:addClaim
- src/organism/body/P37EmbodiedSensorium.ts:150:upsertEntity
- src/organism/body/P37EmbodiedSensorium.ts:187:body
- src/organism/body/P37EmbodiedSensorium.ts:193:decayPresence
- src/organism/body/P37EmbodiedSensorium.ts:195:reconcile
- src/organism/body/PerceptualEvidenceCompiler.ts:49:recordExternalEvidence
- src/organism/body/PerceptualEvidenceCompiler.ts:67:compile
- src/organism/cognition/B2509EmbodiedHomeostaticActionField.ts:46:restore
- src/organism/cognition/B2509EmbodiedHomeostaticActionField.ts:59:setEnabled
- src/organism/cognition/B2509EmbodiedHomeostaticActionField.ts:60:body
- src/organism/cognition/B2509EmbodiedHomeostaticActionField.ts:66:project
- src/organism/cognition/B2509EmbodiedHomeostaticActionField.ts:73:beforeDecision
- src/organism/cognition/B2509EmbodiedHomeostaticActionField.ts:93:afterOutcome
- src/organism/cognition/B2509EmbodiedHomeostaticActionField.ts:110:diagnostics
- src/organism/cognition/B2509EmbodiedHomeostaticActionField.ts:112:evidenceSensor
- src/organism/cognition/B2520SensorimotorImagination.ts:7:snapshot
- src/organism/cognition/B2520SensorimotorImagination.ts:7:restore
- src/organism/cognition/B2520SensorimotorImagination.ts:8:setEnabled
- src/organism/cognition/B2520SensorimotorImagination.ts:8:setLesion
- src/organism/cognition/B2520SensorimotorImagination.ts:9:beforeDecision
- src/organism/cognition/B2520SensorimotorImagination.ts:12:afterOutcome
- src/organism/cognition/B2520SensorimotorImagination.ts:13:diagnostics
- src/organism/cognition/B2520SensorimotorImagination.ts:13:lesion
- src/organism/cognition/B2522AdaptiveWorldModelMixtureRouter.ts:14:beforeDecision
- src/organism/cognition/B2522AdaptiveWorldModelMixtureRouter.ts:58:lesion
- src/organism/cognition/B279NeuralAttractorAssemblies.ts:171:learnFromOutcome
- src/organism/cognition/B282PredictiveGlobalWorkspace.ts:31:defaultB282State
- src/organism/cognition/B282PredictiveGlobalWorkspace.ts:43:step
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:542:restore
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:994:step
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1308:learnFromOutcome
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1514:recordGroundedObservation
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1560:planActivePerception
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1607:recordPerceptionPlanResult
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1621:learnActionTransition
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:2057:diagnostics
- src/organism/cognition/CanonicalNeuralSubstrate.ts:116:step
- src/organism/cognition/CanonicalNeuralSubstrate.ts:190:lesion
- src/organism/cognition/CognitiveBudgetManager.ts:12:decide
- src/organism/cognition/CognitiveBudgetManager.ts:25:estimateCost
- src/organism/cognition/CognitiveBudgetManager.ts:30:spend
- src/organism/cognition/CognitiveNetworkBus.ts:43:restore
- src/organism/cognition/CognitiveNetworkBus.ts:49:stimulate
- src/organism/cognition/CognitiveNetworkBus.ts:75:broadcast
- src/organism/cognition/CognitiveNetworkBus.ts:76:updateCapacity
- src/organism/cognition/CognitiveNetworkBus.ts:77:snapshot
- src/organism/cognition/DeviceAwareNeuralScheduler.ts:7:restore
- src/organism/cognition/DeviceAwareNeuralScheduler.ts:8:beforeDecision
- src/organism/cognition/EmbodiedCausalWorldBridge.ts:106:restore
- src/organism/cognition/EmbodiedCausalWorldBridge.ts:128:predict
- src/organism/cognition/EmbodiedCausalWorldBridge.ts:140:beforeDecision
- src/organism/cognition/EmbodiedCausalWorldBridge.ts:206:afterOutcome
- src/organism/cognition/EmbodiedCausalWorldBridge.ts:266:metrics
- src/organism/cognition/ExternalGroundingAdaptiveController.ts:12:channel
- src/organism/cognition/ExternalGroundingAdaptiveController.ts:13:beforeDecision
- src/organism/cognition/ExternalGroundingAdaptiveController.ts:27:afterOutcome
- src/organism/cognition/ExternalGroundingAdaptiveController.ts:45:metrics
- src/organism/cognition/NeuralExperienceBranch.ts:617:stepDynamics
- src/organism/cognition/NeuralExperienceBranch.ts:706:zeroActionBias
- src/organism/cognition/NeuralExperienceBranch.ts:707:meanAbs
- src/organism/cognition/NeuralExperienceBranch.ts:709:updateCrossModalBinding
- src/organism/cognition/NeuralExperienceBranch.ts:733:beforeDecision
- src/organism/cognition/NeuralExperienceBranch.ts:980:microTick
- src/organism/cognition/NeuralExperienceBranch.ts:1143:afterOutcome
- src/organism/cognition/NeuralExperienceBranch.ts:1661:evaluateHoldout
- src/organism/cognition/P27NeuralWorldFoundation.ts:66:vectorEncode
- src/organism/cognition/P27NeuralWorldFoundation.ts:67:sensorVector
- src/organism/cognition/P27NeuralWorldFoundation.ts:68:worldVector
- src/organism/cognition/P27NeuralWorldFoundation.ts:69:defaultWorld
- src/organism/cognition/P27NeuralWorldFoundation.ts:80:defaultP27NeuralWorld
- src/organism/cognition/P27NeuralWorldFoundation.ts:84:audioFeatures
- src/organism/cognition/P27NeuralWorldFoundation.ts:121:encode
- src/organism/cognition/P27NeuralWorldFoundation.ts:210:recordHoldout
- src/organism/cognition/P27NeuralWorldFoundation.ts:211:featureNames
- src/organism/cognition/P41SemanticPerception.ts:153:ingest
- src/organism/cognition/P41SemanticPerception.ts:202:ingestAudio
- src/organism/cognition/P41SemanticPerception.ts:209:ingestSensor
- src/organism/cognition/P41SemanticPerception.ts:216:ingestWorld
- src/organism/cognition/P48FunctionalAwarenessCore.ts:68:defaultP48State
- src/organism/cognition/P48FunctionalAwarenessCore.ts:88:step
- src/organism/cognition/PerceptionEngine.ts:50:defaultPerceptionState
- src/organism/cognition/PerceptionEngine.ts:66:push
- src/organism/cognition/PerceptionEngine.ts:97:perceive
- src/organism/cognition/SensorimotorLoop.ts:25:defaultSensorimotorState
- src/organism/cognition/SensorimotorLoop.ts:31:restore
- src/organism/cognition/SensorimotorLoop.ts:32:snapshot
- src/organism/cognition/SensorimotorLoop.ts:34:observe
- src/organism/cognition/SocialMindKernel.ts:200:observeRelation
- src/organism/core/EmbodimentSubsystemRuntime.ts:27:health
- src/organism/core/EmbodimentSubsystemRuntime.ts:59:restoreFromPersisted
- src/organism/core/EmbodimentSubsystemRuntime.ts:75:perceptionRoutingSnapshot
- src/organism/core/EmbodimentSubsystemRuntime.ts:77:snapshot
- src/organism/core/OperationalMicroCycleRuntime.ts:34:run
- src/organism/core/OrganismCore.ts:720:defaultMemoryFacet
- src/organism/core/OrganismCore.ts:721:defaultEmbodimentFacet
- src/organism/core/OrganismCore.ts:733:defaultLearningFacet
- src/organism/core/OrganismCore.ts:751:defaultEvolutionFacet
- src/organism/core/OrganismCore.ts:854:defaultPersisted
- src/organism/core/OrganismCore.ts:1177:constructor
- src/organism/core/OrganismCore.ts:1271:init
- src/organism/core/OrganismCore.ts:1732:projectionContext
- src/organism/core/OrganismCore.ts:1842:checkpoint
- src/organism/core/OrganismCore.ts:2274:restoreBestPolicyGene
- src/organism/core/OrganismCore.ts:2275:rollbackLearning
- src/organism/core/OrganismCore.ts:2455:setEmbodiedRecoverySnapshot
- src/organism/core/OrganismCore.ts:2459:setEmbodiment
- src/organism/core/OrganismCore.ts:2483:applyConsolidation
- src/organism/core/OrganismCore.ts:2583:observeSpineOnly
- src/organism/core/OrganismCore.ts:3104:observe
- src/organism/core/OrganismCore.ts:6755:autonomousHeartbeat
- src/organism/core/OrganismCore.ts:6918:feedback
- src/organism/core/OrganismCore.ts:8832:cameraEvidenceSnapshot
- src/organism/core/OrganismCore.ts:8833:setSemanticVisionAvailability
- src/organism/core/OrganismCore.ts:8834:recordSemanticVisionFrame
- src/organism/core/OrganismCore.ts:8835:recordCameraEvidence
- src/organism/core/OrganismCore.ts:8852:centralSubjectSnapshot
- src/organism/core/OrganismCore.ts:8853:centralSubjectDiagnostics
- src/organism/core/OrganismCore.ts:8961:p39RegisterHost
- src/organism/core/OrganismCore.ts:8962:p35Snapshot
- src/organism/core/OrganismCore.ts:8963:p37Snapshot
- src/organism/core/OrganismCore.ts:8964:p37Summary
- src/organism/core/OrganismCore.ts:8965:p37Ingest
- src/organism/core/OrganismCore.ts:8966:p37NextPerception
- src/organism/core/OrganismCore.ts:8967:p38Snapshot
- src/organism/core/OrganismCore.ts:8968:p38Diagnostics
- src/organism/core/OrganismCore.ts:8969:p38Propose
- src/organism/core/OrganismCore.ts:8973:autonomousScientificBrainDecideCurrent
- src/organism/core/OrganismCore.ts:9054:b280MultiAreaNeuralLearn
- src/organism/core/OrganismCore.ts:9055:b280MultiAreaNeuralLesion

## Priority UNVERIFIED stateful functions

- src/organism/core/OrganismCore.ts:9123:b299CausalPersonalitySetContext (refs=0, tests=11)
- src/organism/cognition/NeuralExperienceBranch.ts:560:setSelfKnowledgeCoresetEnabled (refs=0, tests=4)
- src/organism/cognition/NeuralExperienceBranch.ts:563:setSelfNormalizationStrength (refs=0, tests=4)
- src/organism/cognition/NeuralExperienceBranch.ts:1658:setHierarchicalSlowMemoryEnabled (refs=0, tests=4)
- src/organism/core/OrganismCore.ts:9557:recordCompoundSkillExecution (refs=0, tests=4)
- src/organism/memory/HippocampalFormationCircuit.ts:22:setRegionEnabled (refs=0, tests=4)
- src/organism/cognition/NeuralExperienceBranch.ts:556:setCausalPredictiveInterventionEnabled (refs=0, tests=3)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:833:setSelfModelEnabled (refs=0, tests=2)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:975:setGoalEcologyEnabled (refs=0, tests=2)
- src/organism/cognition/NeuralExperienceBranch.ts:555:setSelfOptimizingContinualEnabled (refs=0, tests=2)
- src/organism/cognition/NeuralExperienceBranch.ts:557:setUnifiedCausalWorldLoopEnabled (refs=0, tests=2)
- src/organism/cognition/NeuralExperienceBranch.ts:559:setStabilityPlasticityEnabled (refs=0, tests=2)
- src/organism/cognition/P2805StabilityPlasticityArbiter.ts:194:updateSlowEdge (refs=0, tests=2)
- src/organism/core/OrganismCore.ts:8992:b269SpikingNeuralLearn (refs=0, tests=2)
- src/organism/learning/LongitudinalSubjectTransferBattery.ts:26:recordRestart (refs=0, tests=2)
- src/organism/learning/UnifiedLearningSubstrate.ts:129:learningLoopDiagnostics (refs=0, tests=2)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:871:setGoalAuthorshipEnabled (refs=0, tests=1)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:991:setAllostaticDriveEnabled (refs=0, tests=1)
- src/organism/cognition/NeuralExperienceBranch.ts:1657:setSlowMemoryConsolidationEnabled (refs=0, tests=1)
- src/organism/core/OrganismCore.ts:9004:b270NeuralGerminalLearn (refs=0, tests=1)
- src/organism/core/OrganismCore.ts:9015:b271NeuralAutobiographyLearn (refs=0, tests=1)
- src/organism/core/OrganismCore.ts:9048:b279NeuralAttractorLearn (refs=0, tests=1)
- src/organism/core/OrganismCore.ts:9069:b283CompetingHypothesisLearn (refs=0, tests=1)
- src/organism/core/OrganismCore.ts:9981:b2525LearnedLatentTransitionFieldDiagnostics (refs=0, tests=1)
- src/organism/developmental/MemoryOS2.ts:315:observeRetrievalOutcome (refs=0, tests=1)
- src/organism/learning/LongitudinalSubjectTransferBattery.ts:17:recordSession (refs=0, tests=1)
- src/organism/learning/LongitudinalSubjectTransferBattery.ts:27:recordTransfer (refs=0, tests=1)
- src/organism/learning/P29LearningGovernance.ts:135:rollbackAvailable (refs=0, tests=1)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1732:realityActionLearningDiagnostics (refs=0, tests=0)
- src/organism/cognition/NeuralExperienceBranch.ts:284:developmentalBiasForLearning (refs=0, tests=0)
- src/organism/cognition/NeuralExperienceBranch.ts:564:setWorldDevelopmentFabricEnabled (refs=0, tests=0)
- src/organism/cognition/P34CausalPersonhood.ts:182:updateGoal (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:2121:setB384AutobiographicalValueGoalEnabled (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:2122:resetB384AutobiographicalValueGoal (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:2124:setB365DevelopmentalMemoryEnabled (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9031:b275PolicyLearn (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9040:b277NeuralOperatorLearn (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9043:b278NeuralPrimitiveLearn (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9324:p36LearningAgenda (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9325:p36LearningInvestmentDecision (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9326:p36LearningInvestmentHistory (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9333:causalExperienceConsolidate (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9334:unifiedLearningDiagnostics (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9413:unifiedLearningBeginTransferProbe (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9414:unifiedLearningRecordTransferProbe (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9415:unifiedLearningTransferMatrix (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9416:unifiedLearningTransferInferenceGate (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9417:unifiedLearningTransferDiagnostics (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9419:unifiedLearningPatterns (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:9988:b2521LearnedGenerativeOrganismLoopLesion (refs=0, tests=0)
- src/organism/developmental/P75MemoryContinuumOS.ts:28:recordForget (refs=0, tests=0)
- src/organism/learning/AutonomousCognitiveLifeEngine.ts:203:autonomousTick (refs=0, tests=0)
- src/organism/learning/CanonicalTemporalCreditAuthority.ts:223:setEligibilityLambda (refs=0, tests=0)
- src/organism/learning/CanonicalTemporalCreditAuthority.ts:224:setDiscountGamma (refs=0, tests=0)
- src/organism/learning/CausalDevelopmentLoop.ts:197:noteRollback (refs=0, tests=0)
- src/organism/learning/LongitudinalOrganismEngine.ts:109:updateHealth (refs=0, tests=0)
- src/organism/learning/P29LearningGovernance.ts:68:setResourceBudget (refs=0, tests=0)
- src/organism/system/CausalLifeGraph.ts:302:chainForTick (refs=0, tests=0)
- src/organism/system/WorldModelEnsembleController.ts:117:recordExternalOutcome (refs=0, tests=0)
- src/organism/learning/AdaptivePolicyEngine.ts:377:observeRecoveryOutcome (refs=1, tests=16)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1795:setDevelopmentalMemoryEnabled (refs=1, tests=10)
- src/organism/learning/AdaptivePolicyEngine.ts:355:observeMatchedCounterfactualCalibration (refs=1, tests=9)
- src/organism/developmental/DormantMemoryController.ts:2:apply (refs=1, tests=8)
- src/organism/developmental/P24WorldIdentityEngine.ts:40:observeBody (refs=1, tests=8)
- src/organism/developmental/P84AutobiographicalContinuityFabric.ts:206:learnFromVerifiedOutcome (refs=1, tests=8)
- src/organism/learning/P29LearningGovernance.ts:118:recordContinualTask (refs=1, tests=6)
- src/organism/learning/P30ContinualIntelligence.ts:286:recordTaskScore (refs=1, tests=6)
- src/organism/cognition/evolution/ValueEvolutionEngine.ts:57:observeExperience (refs=1, tests=5)
- src/organism/core/OrganismCore.ts:6839:applyVerifiedValueRevision (refs=1, tests=5)
- src/organism/core/WorldSubsystemRuntime.ts:233:worldLearningSnapshot (refs=1, tests=5)
- src/organism/core/OrganismCore.ts:1971:recordPrediction (refs=1, tests=4)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1969:resetContextualDevelopmentalMemory (refs=1, tests=3)
- src/organism/developmental/MemoryOS2.ts:405:applyResidencyPlan (refs=1, tests=3)
- src/organism/learning/CausalExperienceStream.ts:178:learningPacket (refs=1, tests=3)
- src/organism/learning/P30ContinualIntelligence.ts:187:observeTrajectory (refs=1, tests=3)
- src/organism/learning/P36AutonomousSelfDevelopment.ts:323:learningAgenda (refs=1, tests=3)
- src/organism/learning/P36AutonomousSelfDevelopment.ts:325:decideLearningInvestment (refs=1, tests=3)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1736:replayConsolidate (refs=1, tests=2)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1916:setAutobiographicalValueGoalEnabled (refs=1, tests=2)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1968:setContextualDevelopmentalMemoryEnabled (refs=1, tests=2)
- src/organism/cognition/P2805StabilityPlasticityArbiter.ts:144:observeNeuron (refs=1, tests=2)
- src/organism/cognition/P2805StabilityPlasticityArbiter.ts:153:shouldResetNeuron (refs=1, tests=2)
- src/organism/cognition/P33PersonhoodCore.ts:106:integrateMoment (refs=1, tests=2)
- src/organism/cognition/P34CausalPersonhood.ts:215:applyIdentityChange (refs=1, tests=2)
- src/organism/cognition/P34CausalPersonhood.ts:242:integrateExperience (refs=1, tests=2)
- src/organism/cognition/P34CausalPersonhood.ts:256:integrateOutcome (refs=1, tests=2)
- src/organism/cognition/evolution/SelfGovernanceEngine.ts:168:recordConsequence (refs=1, tests=2)
- src/organism/core/OrganismCore.ts:2142:worldAgencyLearningCausalBridgeSnapshot (refs=1, tests=2)
- src/organism/core/OrganismCore.ts:2195:realityLearningGateSnapshot (refs=1, tests=2)
- src/organism/core/OrganismRuntime.ts:829:realityLearningGateSnapshot (refs=1, tests=2)
- src/organism/learning/DevelopmentalSynthesisEngine.ts:130:observeMacro (refs=1, tests=2)
- src/organism/learning/P23LearningEngine.ts:213:recordExperience (refs=1, tests=2)
- src/organism/learning/P26TrueLearningEngine.ts:84:replayCausalRecords (refs=1, tests=2)
- src/organism/learning/P30ContinualIntelligence.ts:240:recordTransferOutcome (refs=1, tests=2)
- src/organism/learning/P30ContinualIntelligence.ts:311:captureRollback (refs=1, tests=2)
- src/organism/memory/MemoryConsolidationController.ts:38:applyOutcomeFeedback (refs=1, tests=2)
- src/organism/system/CausalAccountabilityGraph.ts:71:recordActionChain (refs=1, tests=2)
- src/organism/system/WorldModelEnsembleController.ts:90:observeOutcomeForAction (refs=1, tests=2)
- src/organism/cognition/B274AutonomousSkillLaboratory.ts:171:promoteTransferred (refs=1, tests=1)
- src/organism/cognition/B288SocialPredictiveSelfOtherBrain.ts:248:ingestLegacySources (refs=1, tests=1)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1917:resetAutobiographicalValueGoal (refs=1, tests=1)
- src/organism/cognition/GlobalWorkspaceSubstrateV2.ts:219:learnReward (refs=1, tests=1)
- src/organism/cognition/SelfModelV2.ts:39:learnGoalOutcome (refs=1, tests=1)
- src/organism/core/WorldSubsystemRuntime.ts:237:worldLearningRestore (refs=1, tests=1)
- src/organism/developmental/MemoryOS2.ts:316:observeRetrievalOutcomeV2 (refs=1, tests=1)
- src/organism/developmental/MemorySubstrateCoordinator.ts:56:consolidateCompatibility (refs=1, tests=1)
- src/organism/developmental/P24WorldIdentityEngine.ts:42:observeBoredom (refs=1, tests=1)
- src/organism/developmental/P24WorldIdentityEngine.ts:46:identityObserve (refs=1, tests=1)
- src/organism/learning/P23LearningEngine.ts:393:learningSummary (refs=1, tests=1)
- src/organism/learning/P25ScientificDevelopmentEngine.ts:257:updateCampaign (refs=1, tests=1)
- src/organism/learning/P29LearningGovernance.ts:113:recordProvenance (refs=1, tests=1)
- src/organism/learning/P29LearningGovernance.ts:137:takeRollback (refs=1, tests=1)
- src/organism/learning/P36AutonomousSelfDevelopment.ts:497:observeDevelopmentalOutcome (refs=1, tests=1)
- src/organism/learning/PersonalCurriculumEngine.ts:120:observeDevelopmentalContext (refs=1, tests=1)
- src/organism/learning/ProceduralSkillLibrary.ts:435:promoteFallbackIfReliable (refs=1, tests=1)
- src/organism/learning/UnifiedLearningSubstrate.ts:108:beginLearningLoop (refs=1, tests=1)
- src/organism/learning/UnifiedLearningSubstrate.ts:122:closeLearningLoop (refs=1, tests=1)
- src/organism/learning/UnifiedLearningSubstrate.ts:238:observeDevelopmentalSignal (refs=1, tests=1)
- src/organism/memory/MemoryFabric.ts:158:ingestCompatibility (refs=1, tests=1)
- src/organism/cognition/AdaptiveNeuralContinuityController.ts:164:applyMemoryCredit (refs=1, tests=0)
- src/organism/cognition/B269SpikingPlasticNeuralSubstrate.ts:267:applyStructuralLesion (refs=1, tests=0)
- src/organism/cognition/B281PredictiveInterAreaMessaging.ts:112:applyOnlinePlasticity (refs=1, tests=0)
- src/organism/cognition/B282PredictiveGlobalWorkspace.ts:71:applyLearning (refs=1, tests=0)
- src/organism/cognition/B283CompetingPredictiveHypotheses.ts:84:learnFromPrediction (refs=1, tests=0)
- src/organism/cognition/B287RelationshipValueDevelopmentCore.ts:133:recurrentApply (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:768:areaOffset (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:797:updateSelfModelBeforePolicy (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:813:consolidateSelfBiography (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:853:learnGoalAuthorshipOutcome (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:873:updateGoalEcologyBeforePolicy (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:935:updateGoalEcologyFromOutcome (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:977:updateAllostaticDynamics (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1888:updateAutobiographicalValueGoal (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1988:persistentLesion (refs=1, tests=0)
- src/organism/cognition/BrainSubstrate.ts:146:learnTemporal (refs=1, tests=0)
- src/organism/cognition/CanonicalNeuralSubstrate.ts:180:learningUpdatesToScale (refs=1, tests=0)
- src/organism/cognition/CentralBrainSubstrate.ts:128:learnPrediction (refs=1, tests=0)
- src/organism/cognition/HierarchicalProceduralSkillEngine.ts:116:maybeConsolidate (refs=1, tests=0)
- src/organism/cognition/P2708DeepLearningCoupler.ts:64:setSelfNormalization (refs=1, tests=0)
- src/organism/cognition/P2708DeepLearningCoupler.ts:65:setDelayProfile (refs=1, tests=0)
- src/organism/cognition/P2805StabilityPlasticityArbiter.ts:91:resetEdgeWeight (refs=1, tests=0)
- src/organism/cognition/P2805StabilityPlasticityArbiter.ts:179:consolidateEdgeWeight (refs=1, tests=0)
- src/organism/cognition/P2820SelfKnowledgeCoresetBridge.ts:258:compactCoreset (refs=1, tests=0)
- src/organism/cognition/PredictiveSelfAgencySubstrate.ts:91:learnSelf (refs=1, tests=0)
- src/organism/cognition/TransferableEmbodiedSkillSystem.ts:80:consolidateSkills (refs=1, tests=0)
- src/organism/cognition/evolution/ValueEvolutionEngine.ts:52:applyRevision (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:2161:recordGroundedWorldCausalOutcome (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:2192:setNeuralCausalTrace (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:2194:setRealityLearningGate (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:2412:recordMatchedCounterfactual (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:2426:recordCounterfactuals (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:9148:b365LearnGroundedTransition (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:9149:b365LearnEmbodiedConsequence (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:9297:p34ApplyIdentityChange (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:9302:p33SetSelfAuthoredGoal (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:9403:operationalLifeRecordCausalIntervention (refs=1, tests=0)
- src/organism/developmental/MemorySubstrateCoordinator.ts:37:ingestCompatibilityRecord (refs=1, tests=0)
- src/organism/developmental/P47TemporalMemoryMind.ts:48:updateBeliefsFromEvent (refs=1, tests=0)
- src/organism/developmental/P70MemoryLifecycleGovernor.ts:25:recordPrune (refs=1, tests=0)
- src/organism/developmental/UnifiedMemorySystem.ts:86:recordRetrieval (refs=1, tests=0)
- src/organism/developmental/UnifiedMemorySystem.ts:91:updateBelief (refs=1, tests=0)
- src/organism/learning/AdaptivePolicyEngine.ts:307:applyGeneValues (refs=1, tests=0)
- src/organism/learning/AdvancedResilienceEngine.ts:113:restoreBestGene (refs=1, tests=0)
- src/organism/learning/AdvancedResilienceEngine.ts:114:observeEvidence (refs=1, tests=0)
- src/organism/learning/AdvancedResilienceEngine.ts:117:setOfflineSurvival (refs=1, tests=0)
- src/organism/learning/AutonomousCognitiveLifeEngine.ts:211:updatePersonality (refs=1, tests=0)
- src/organism/learning/AutonomousCognitiveLifeEngine.ts:225:updateMetrics (refs=1, tests=0)
- src/organism/learning/AutonomousCognitiveLifeEngine.ts:271:learningMetric (refs=1, tests=0)
- src/organism/learning/CausalDevelopmentLoop.ts:139:updateBehavioralSequence (refs=1, tests=0)
- src/organism/learning/LongitudinalOrganismEngine.ts:82:consolidateMemory (refs=1, tests=0)
- src/organism/learning/OperationalLifeEngine.ts:351:checkpointsMatch (refs=1, tests=0)
- src/organism/learning/P23LearningEngine.ts:359:updateEvidenceDebt (refs=1, tests=0)
- src/organism/learning/P25ScientificDevelopmentEngine.ts:140:observeRuntimeOutcome (refs=1, tests=0)
- src/organism/learning/P26TrueLearningEngine.ts:52:observeTrace (refs=1, tests=0)
- src/organism/learning/P30ContinualIntelligence.ts:319:markRollback (refs=1, tests=0)
- src/organism/learning/P30ContinualIntelligence.ts:320:shouldRollback (refs=1, tests=0)
- src/organism/learning/P36AutonomousSelfDevelopment.ts:494:recordRollback (refs=1, tests=0)
- src/organism/learning/VerifiedAutonomousLifeEngine.ts:106:recordPerception (refs=1, tests=0)
- src/organism/memory/ExperienceContinuumFabric.ts:550:consolidateCold (refs=1, tests=0)
- src/organism/memory/SemanticMemoryGraph.ts:25:ingestEpisode (refs=1, tests=0)
- src/organism/system/B1101B1350SelfDevelopmentCore.ts:112:updatePredictor (refs=1, tests=0)
- src/organism/system/B1351B1600LifelongDevelopmentCore.ts:79:worldUpdate (refs=1, tests=0)
- src/organism/system/B1701B2200UnifiedLifeContinuityCore.ts:102:learnMemory (refs=1, tests=0)
- src/organism/system/B1701B2200UnifiedLifeContinuityCore.ts:107:updateSkills (refs=1, tests=0)
- src/organism/system/B2201B2500LifeCourseSelfModelCore.ts:59:updateSelfBeliefs (refs=1, tests=0)
- src/organism/system/B2201B2500LifeCourseSelfModelCore.ts:64:updateFingerprint (refs=1, tests=0)
- src/organism/system/B2201B2500LifeCourseSelfModelCore.ts:65:updateNarrative (refs=1, tests=0)
- src/organism/system/B2201B2500LifeCourseSelfModelCore.ts:69:updateCommitment (refs=1, tests=0)
- src/organism/system/B299CausalPersonalityDevelopmentLoop.ts:252:updateDevelopmentalMaturity (refs=1, tests=0)
- src/organism/system/CausalLifeGraph.ts:211:hasCompleteChainAtTick (refs=1, tests=0)
- src/organism/world/WorldModel.ts:131:learnedActionBias (refs=1, tests=0)
- src/organism/memory/ExperienceContinuumFabric.ts:410:recordReplayValidation (refs=2, tests=8)
- src/organism/memory/ExperienceContinuumFabric.ts:499:recordReplayExperimentTrial (refs=2, tests=8)
- src/organism/learning/ProceduralSkillLibrary.ts:456:recordVariantExecution (refs=2, tests=5)
- src/organism/memory/ExperienceContinuumFabric.ts:344:recordLongitudinalReplayTrial (refs=2, tests=5)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:835:setGoalAuthorshipCandidate (refs=2, tests=4)
- src/organism/core/WorldSubsystemRuntime.ts:176:observeActionOutcome (refs=2, tests=4)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1675:learnEmbodiedConsequence (refs=2, tests=3)
- src/organism/learning/P30ContinualIntelligence.ts:315:rollbackBundle (refs=2, tests=3)
- src/organism/learning/UnifiedLearningSubstrate.ts:200:recordTransferProbe (refs=2, tests=3)
- src/organism/learning/CognitiveResearchBattery.ts:264:recordEvaluatorOutcome (refs=2, tests=2)
- src/organism/learning/P25ScientificDevelopmentEngine.ts:183:recordEvaluation (refs=2, tests=2)
- src/organism/learning/ProceduralSkillLibrary.ts:383:recordCompoundExecution (refs=2, tests=2)
- src/organism/learning/ProceduralSkillLibrary.ts:405:recordCompoundRepair (refs=2, tests=2)
- src/organism/cognition/P32CausalSelfModel.ts:155:recordControlledIntervention (refs=2, tests=1)
- src/organism/cognition/P33PersonhoodCore.ts:146:setSelfAuthoredGoal (refs=2, tests=1)
- src/organism/cognition/P34CausalPersonhood.ts:151:observeSelfClaim (refs=2, tests=1)
- src/organism/cognition/P34CausalPersonhood.ts:189:recordConsent (refs=2, tests=1)
- src/organism/core/OrganismCore.ts:9675:rollbackCompoundSkill (refs=2, tests=1)
- src/organism/learning/OperationalLifeEngine.ts:221:recordCausalIntervention (refs=2, tests=1)
- src/organism/learning/P25ScientificDevelopmentEngine.ts:153:recordControlledExperiment (refs=2, tests=1)
- src/organism/learning/P25ScientificDevelopmentEngine.ts:208:recordAblation (refs=2, tests=1)
- src/organism/learning/P36AutonomousSelfDevelopment.ts:356:learningInvestmentHistory (refs=2, tests=1)
- src/organism/world/GroundedWorldState.ts:56:integrateExternalOutcome (refs=2, tests=1)
- src/organism/cognition/B261UnifiedWorldModel.ts:68:learnInternal (refs=2, tests=0)
- src/organism/cognition/B262MultiTimescaleWorldModel.ts:63:learnHorizon (refs=2, tests=0)
- src/organism/cognition/B272EndogenousGoalGenesis.ts:130:learnedGoalValue (refs=2, tests=0)
- src/organism/cognition/B274AutonomousSkillLaboratory.ts:194:promotedSkillSummaries (refs=2, tests=0)
- src/organism/cognition/P2750UnifiedCausalWorldLoop.ts:114:updateBands (refs=2, tests=0)
- src/organism/cognition/P2854HierarchicalSlowMemoryController.ts:103:nearestLearnedSchema (refs=2, tests=0)