# BIG PASS 190 — Semantic Coverage Audit

Functions: **5876**

| Status | Count |
|---|---:|
| VERIFIED | 31 |
| INTEGRATION_ONLY | 9 |
| UNSAFE_TO_AUTO_RUN | 369 |
| UNVERIFIED | 5467 |

Strict VERIFIED rate: **0.53%**

Evidence coverage (VERIFIED + 25% integration credit): **0.57%**

> Static presence and a test name reference do not count as behavioural proof.

## Cognitive branch

Functions: **4152**

| Status | Count |
|---|---:|
| VERIFIED | 22 |
| INTEGRATION_ONLY | 7 |
| UNSAFE_TO_AUTO_RUN | 254 |
| UNVERIFIED | 3869 |

## Critical domain backlog

| Domain | Unverified | Integration | Verified |
|---|---:|---:|---:|
| memory | 520 | 4 | 9 |
| emotion | 23 | 0 | 0 |
| world | 847 | 0 | 0 |
| self | 496 | 4 | 4 |
| agency | 392 | 0 | 0 |
| learning | 679 | 0 | 0 |
| perception | 150 | 1 | 0 |
| consciousness | 96 | 0 | 6 |
| infrastructure | 2264 | 0 | 12 |

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
- src/node-shims.d.ts:28:lookup
- src/node-shims.d.ts:29:isIP
- src/node-shims.d.ts:30:request
- src/node-sqlite-shim.d.ts:3:constructor
- src/node-sqlite-shim.d.ts:4:exec
- src/node-sqlite-shim.d.ts:5:prepare
- src/organism/body/AndroidEmbodimentBridge.ts:37:commandJson
- src/organism/body/AndroidEmbodimentBridge.ts:46:commandExists
- src/organism/body/AndroidEmbodimentBridge.ts:50:parseSensorPayload
- src/organism/body/AndroidEmbodimentBridge.ts:73:detectTermuxCapabilities
- src/organism/body/AndroidEmbodimentBridge.ts:88:sampleAndroidTelemetryDetailed
- src/organism/body/AndroidEmbodimentBridge.ts:146:sampleAndroidTelemetry
- src/organism/body/AndroidEmbodimentBridge.ts:150:certifyAndroidHardware
- src/organism/body/AndroidEmbodimentBridge.ts:163:speakViaTermux
- src/organism/body/AndroidEmbodimentBridge.ts:193:synthesizeSpeechInput
- src/organism/body/AndroidEmbodimentBridge.ts:201:captureCameraPhoto
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
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:547:restore
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1017:step
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1331:learnFromOutcome
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1546:recordGroundedObservation
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1592:planActivePerception
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1639:recordPerceptionPlanResult
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1653:learnActionTransition
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:2107:diagnostics
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
- src/organism/cognition/NeuralExperienceBranch.ts:622:stepDynamics
- src/organism/cognition/NeuralExperienceBranch.ts:711:zeroActionBias
- src/organism/cognition/NeuralExperienceBranch.ts:712:meanAbs
- src/organism/cognition/NeuralExperienceBranch.ts:714:updateCrossModalBinding
- src/organism/cognition/NeuralExperienceBranch.ts:738:beforeDecision
- src/organism/cognition/NeuralExperienceBranch.ts:979:microTick
- src/organism/cognition/NeuralExperienceBranch.ts:1139:afterOutcome
- src/organism/cognition/NeuralExperienceBranch.ts:1680:evaluateHoldout
- src/organism/cognition/P2750UnifiedCausalWorldLoop.ts:218:learningScale01
- src/organism/cognition/P2750UnifiedCausalWorldLoop.ts:219:observeEmbodiedOutcome
- src/organism/cognition/P2750UnifiedCausalWorldLoop.ts:233:replayScore
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
- src/organism/core/ObservationInputAssembler.ts:5:buildP35BodyInput
- src/organism/core/ObservationInputAssembler.ts:15:buildP37Input
- src/organism/core/ObservationInputAssembler.ts:42:buildPerceptionBody
- src/organism/core/OperationalMicroCycleRuntime.ts:34:run
- src/organism/core/OrganismCore.ts:755:defaultMemoryFacet
- src/organism/core/OrganismCore.ts:756:defaultEmbodimentFacet
- src/organism/core/OrganismCore.ts:768:defaultLearningFacet
- src/organism/core/OrganismCore.ts:785:defaultEvolutionFacet
- src/organism/core/OrganismCore.ts:885:defaultPersisted
- src/organism/core/OrganismCore.ts:1218:constructor
- src/organism/core/OrganismCore.ts:1312:init
- src/organism/core/OrganismCore.ts:1784:projectionContext
- src/organism/core/OrganismCore.ts:1913:checkpoint
- src/organism/core/OrganismCore.ts:2701:hexisDecideHmx
- src/organism/core/OrganismCore.ts:2817:restoreBestPolicyGene
- src/organism/core/OrganismCore.ts:2824:rollbackLearning
- src/organism/core/OrganismCore.ts:3046:setEmbodiedRecoverySnapshot
- src/organism/core/OrganismCore.ts:3051:setEmbodiment
- src/organism/core/OrganismCore.ts:3092:applyConsolidation
- src/organism/core/OrganismCore.ts:3196:observeSpineOnly
- src/organism/core/OrganismCore.ts:3769:observe
- src/organism/core/OrganismCore.ts:7733:autonomousHeartbeat
- src/organism/core/OrganismCore.ts:7897:feedback
- src/organism/core/OrganismCore.ts:9885:cameraEvidenceSnapshot
- src/organism/core/OrganismCore.ts:9886:setSemanticVisionAvailability
- src/organism/core/OrganismCore.ts:9887:recordSemanticVisionFrame
- src/organism/core/OrganismCore.ts:9888:recordCameraEvidence
- src/organism/core/OrganismCore.ts:9906:centralSubjectSnapshot

## Priority UNVERIFIED stateful functions

- src/organism/core/OrganismCore.ts:10190:b299CausalPersonalitySetContext (refs=0, tests=11)
- src/organism/system/MemoryRetentionEconomy.ts:127:learnedPolicyDiagnostics (refs=0, tests=9)
- src/organism/core/OrganismCore.ts:10707:recordCompoundSkillExecution (refs=0, tests=5)
- src/organism/cognition/NeuralExperienceBranch.ts:565:setSelfKnowledgeCoresetEnabled (refs=0, tests=4)
- src/organism/cognition/NeuralExperienceBranch.ts:568:setSelfNormalizationStrength (refs=0, tests=4)
- src/organism/cognition/NeuralExperienceBranch.ts:1676:setHierarchicalSlowMemoryEnabled (refs=0, tests=4)
- src/organism/memory/HippocampalFormationCircuit.ts:22:setRegionEnabled (refs=0, tests=4)
- src/organism/cognition/NeuralExperienceBranch.ts:561:setCausalPredictiveInterventionEnabled (refs=0, tests=3)
- src/organism/core/OrganismCore.ts:11495:b2525LearnedLatentTransitionFieldDiagnostics (refs=0, tests=3)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:856:setSelfModelEnabled (refs=0, tests=2)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:998:setGoalEcologyEnabled (refs=0, tests=2)
- src/organism/cognition/NeuralExperienceBranch.ts:560:setSelfOptimizingContinualEnabled (refs=0, tests=2)
- src/organism/cognition/NeuralExperienceBranch.ts:562:setUnifiedCausalWorldLoopEnabled (refs=0, tests=2)
- src/organism/cognition/NeuralExperienceBranch.ts:564:setStabilityPlasticityEnabled (refs=0, tests=2)
- src/organism/cognition/P2805StabilityPlasticityArbiter.ts:194:updateSlowEdge (refs=0, tests=2)
- src/organism/core/OrganismCore.ts:10058:b269SpikingNeuralLearn (refs=0, tests=2)
- src/organism/learning/LongitudinalSubjectTransferBattery.ts:26:recordRestart (refs=0, tests=2)
- src/organism/learning/UnifiedLearningSubstrate.ts:129:learningLoopDiagnostics (refs=0, tests=2)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:894:setGoalAuthorshipEnabled (refs=0, tests=1)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1014:setAllostaticDriveEnabled (refs=0, tests=1)
- src/organism/cognition/NeuralExperienceBranch.ts:1675:setSlowMemoryConsolidationEnabled (refs=0, tests=1)
- src/organism/core/OrganismCore.ts:10070:b270NeuralGerminalLearn (refs=0, tests=1)
- src/organism/core/OrganismCore.ts:10082:b271NeuralAutobiographyLearn (refs=0, tests=1)
- src/organism/core/OrganismCore.ts:10115:b279NeuralAttractorLearn (refs=0, tests=1)
- src/organism/core/OrganismCore.ts:10136:b283CompetingHypothesisLearn (refs=0, tests=1)
- src/organism/developmental/MemoryOS2.ts:750:observeRetrievalOutcome (refs=0, tests=1)
- src/organism/learning/LongitudinalSubjectTransferBattery.ts:17:recordSession (refs=0, tests=1)
- src/organism/learning/LongitudinalSubjectTransferBattery.ts:27:recordTransfer (refs=0, tests=1)
- src/organism/learning/P29LearningGovernance.ts:135:rollbackAvailable (refs=0, tests=1)
- src/organism/system/CausalLifeGraph.ts:314:chainForTick (refs=0, tests=1)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1764:realityActionLearningDiagnostics (refs=0, tests=0)
- src/organism/cognition/NeuralExperienceBranch.ts:288:developmentalBiasForLearning (refs=0, tests=0)
- src/organism/cognition/NeuralExperienceBranch.ts:569:setWorldDevelopmentFabricEnabled (refs=0, tests=0)
- src/organism/cognition/P34CausalPersonhood.ts:182:updateGoal (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:2239:setB384AutobiographicalValueGoalEnabled (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:2240:resetB384AutobiographicalValueGoal (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:2242:setB365DevelopmentalMemoryEnabled (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10098:b275PolicyLearn (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10107:b277NeuralOperatorLearn (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10110:b278NeuralPrimitiveLearn (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10290:b262WorldModelSequenceTrain (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10399:p36LearningAgenda (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10400:p36LearningInvestmentDecision (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10401:p36LearningInvestmentHistory (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10409:causalExperienceConsolidate (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10410:unifiedLearningDiagnostics (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10488:unifiedLearningBeginTransferProbe (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10489:unifiedLearningRecordTransferProbe (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10490:unifiedLearningTransferMatrix (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10491:unifiedLearningTransferInferenceGate (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10492:unifiedLearningTransferDiagnostics (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:10494:unifiedLearningPatterns (refs=0, tests=0)
- src/organism/core/OrganismCore.ts:11503:b2521LearnedGenerativeOrganismLoopLesion (refs=0, tests=0)
- src/organism/developmental/MemorySubstrateCoordinator.ts:94:ingestCompatibilityRecord (refs=0, tests=0)
- src/organism/developmental/P75MemoryContinuumOS.ts:28:recordForget (refs=0, tests=0)
- src/organism/learning/AutonomousCognitiveLifeEngine.ts:203:autonomousTick (refs=0, tests=0)
- src/organism/learning/CanonicalTemporalCreditAuthority.ts:226:setEligibilityLambda (refs=0, tests=0)
- src/organism/learning/CanonicalTemporalCreditAuthority.ts:227:setDiscountGamma (refs=0, tests=0)
- src/organism/learning/CausalDevelopmentLoop.ts:197:noteRollback (refs=0, tests=0)
- src/organism/learning/LongitudinalOrganismEngine.ts:109:updateHealth (refs=0, tests=0)
- src/organism/learning/P29LearningGovernance.ts:68:setResourceBudget (refs=0, tests=0)
- src/organism/system/WorldModelEnsembleController.ts:117:recordExternalOutcome (refs=0, tests=0)
- src/organism/learning/AdaptivePolicyEngine.ts:377:observeRecoveryOutcome (refs=1, tests=16)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1845:setDevelopmentalMemoryEnabled (refs=1, tests=10)
- src/organism/learning/AdaptivePolicyEngine.ts:355:observeMatchedCounterfactualCalibration (refs=1, tests=9)
- src/organism/developmental/P24WorldIdentityEngine.ts:40:observeBody (refs=1, tests=8)
- src/organism/developmental/P84AutobiographicalContinuityFabric.ts:206:learnFromVerifiedOutcome (refs=1, tests=8)
- src/organism/learning/P29LearningGovernance.ts:118:recordContinualTask (refs=1, tests=6)
- src/organism/learning/P30ContinualIntelligence.ts:286:recordTaskScore (refs=1, tests=6)
- src/organism/cognition/evolution/ValueEvolutionEngine.ts:57:observeExperience (refs=1, tests=5)
- src/organism/core/OrganismCore.ts:7814:applyVerifiedValueRevision (refs=1, tests=5)
- src/organism/core/WorldSubsystemRuntime.ts:233:worldLearningSnapshot (refs=1, tests=5)
- src/organism/cognition/B284NeuralAutobiographicalIdentityCore.ts:181:observeVerifiedRevisionEvidence (refs=1, tests=4)
- src/organism/core/OrganismCore.ts:2077:recordPrediction (refs=1, tests=4)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:2019:resetContextualDevelopmentalMemory (refs=1, tests=3)
- src/organism/developmental/MemoryOS2.ts:895:applyResidencyPlan (refs=1, tests=3)
- src/organism/learning/CausalExperienceStream.ts:178:learningPacket (refs=1, tests=3)
- src/organism/learning/P30ContinualIntelligence.ts:187:observeTrajectory (refs=1, tests=3)
- src/organism/learning/P36AutonomousSelfDevelopment.ts:323:learningAgenda (refs=1, tests=3)
- src/organism/learning/P36AutonomousSelfDevelopment.ts:325:decideLearningInvestment (refs=1, tests=3)
- src/organism/memory/MemoryFabric.ts:355:ingestCompatibility (refs=1, tests=3)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1786:replayConsolidate (refs=1, tests=2)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1966:setAutobiographicalValueGoalEnabled (refs=1, tests=2)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:2018:setContextualDevelopmentalMemoryEnabled (refs=1, tests=2)
- src/organism/cognition/P2805StabilityPlasticityArbiter.ts:144:observeNeuron (refs=1, tests=2)
- src/organism/cognition/P2805StabilityPlasticityArbiter.ts:153:shouldResetNeuron (refs=1, tests=2)
- src/organism/cognition/P33PersonhoodCore.ts:106:integrateMoment (refs=1, tests=2)
- src/organism/cognition/P34CausalPersonhood.ts:215:applyIdentityChange (refs=1, tests=2)
- src/organism/cognition/P34CausalPersonhood.ts:242:integrateExperience (refs=1, tests=2)
- src/organism/cognition/P34CausalPersonhood.ts:256:integrateOutcome (refs=1, tests=2)
- src/organism/cognition/evolution/SelfGovernanceEngine.ts:168:recordConsequence (refs=1, tests=2)
- src/organism/core/OrganismCore.ts:2260:worldAgencyLearningCausalBridgeSnapshot (refs=1, tests=2)
- src/organism/core/OrganismCore.ts:2336:realityLearningGateSnapshot (refs=1, tests=2)
- src/organism/core/OrganismRuntime.ts:851:realityLearningGateSnapshot (refs=1, tests=2)
- src/organism/learning/DevelopmentalSynthesisEngine.ts:130:observeMacro (refs=1, tests=2)
- src/organism/learning/P23LearningEngine.ts:213:recordExperience (refs=1, tests=2)
- src/organism/learning/P26TrueLearningEngine.ts:84:replayCausalRecords (refs=1, tests=2)
- src/organism/learning/P30ContinualIntelligence.ts:240:recordTransferOutcome (refs=1, tests=2)
- src/organism/learning/P30ContinualIntelligence.ts:311:captureRollback (refs=1, tests=2)
- src/organism/memory/MemoryConsolidationController.ts:38:applyOutcomeFeedback (refs=1, tests=2)
- src/organism/system/CausalAccountabilityGraph.ts:71:recordActionChain (refs=1, tests=2)
- src/organism/system/WorldModelEnsembleController.ts:90:observeOutcomeForAction (refs=1, tests=2)
- src/organism/cognition/B274AutonomousSkillLaboratory.ts:172:promoteTransferred (refs=1, tests=1)
- src/organism/cognition/B288SocialPredictiveSelfOtherBrain.ts:248:ingestLegacySources (refs=1, tests=1)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1967:resetAutobiographicalValueGoal (refs=1, tests=1)
- src/organism/cognition/GlobalWorkspaceSubstrateV2.ts:208:learnReward (refs=1, tests=1)
- src/organism/cognition/SelfModelV2.ts:39:learnGoalOutcome (refs=1, tests=1)
- src/organism/core/OrganismCore.ts:2287:recordGroundedWorldCausalOutcome (refs=1, tests=1)
- src/organism/core/OrganismCore.ts:2610:hexisCreateLearningReview (refs=1, tests=1)
- src/organism/core/OrganismCore.ts:11035:integrateExternalResearchMemory (refs=1, tests=1)
- src/organism/core/WorldSubsystemRuntime.ts:237:worldLearningRestore (refs=1, tests=1)
- src/organism/developmental/MemoryOS2.ts:751:observeRetrievalOutcomeV2 (refs=1, tests=1)
- src/organism/developmental/P24WorldIdentityEngine.ts:42:observeBoredom (refs=1, tests=1)
- src/organism/developmental/P24WorldIdentityEngine.ts:46:identityObserve (refs=1, tests=1)
- src/organism/integration/hexis/HexisAdaptationFabric.ts:306:createLearningReview (refs=1, tests=1)
- src/organism/integration/hexis/HexisAdaptationFabric.ts:312:decideLearningReview (refs=1, tests=1)
- src/organism/learning/P23LearningEngine.ts:393:learningSummary (refs=1, tests=1)
- src/organism/learning/P25ScientificDevelopmentEngine.ts:257:updateCampaign (refs=1, tests=1)
- src/organism/learning/P29LearningGovernance.ts:113:recordProvenance (refs=1, tests=1)
- src/organism/learning/P29LearningGovernance.ts:137:takeRollback (refs=1, tests=1)
- src/organism/learning/P36AutonomousSelfDevelopment.ts:498:observeDevelopmentalOutcome (refs=1, tests=1)
- src/organism/learning/PersonalCurriculumEngine.ts:120:observeDevelopmentalContext (refs=1, tests=1)
- src/organism/learning/ProceduralSkillLibrary.ts:435:promoteFallbackIfReliable (refs=1, tests=1)
- src/organism/learning/UnifiedLearningSubstrate.ts:108:beginLearningLoop (refs=1, tests=1)
- src/organism/learning/UnifiedLearningSubstrate.ts:238:observeDevelopmentalSignal (refs=1, tests=1)
- src/organism/cognition/AdaptiveNeuralContinuityController.ts:164:applyMemoryCredit (refs=1, tests=0)
- src/organism/cognition/B269SpikingPlasticNeuralSubstrate.ts:267:applyStructuralLesion (refs=1, tests=0)
- src/organism/cognition/B281PredictiveInterAreaMessaging.ts:112:applyOnlinePlasticity (refs=1, tests=0)
- src/organism/cognition/B282PredictiveGlobalWorkspace.ts:71:applyLearning (refs=1, tests=0)
- src/organism/cognition/B283CompetingPredictiveHypotheses.ts:84:learnFromPrediction (refs=1, tests=0)
- src/organism/cognition/B287RelationshipValueDevelopmentCore.ts:133:recurrentApply (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:791:areaOffset (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:820:updateSelfModelBeforePolicy (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:836:consolidateSelfBiography (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:876:learnGoalAuthorshipOutcome (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:896:updateGoalEcologyBeforePolicy (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:958:updateGoalEcologyFromOutcome (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1000:updateAllostaticDynamics (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1938:updateAutobiographicalValueGoal (refs=1, tests=0)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:2038:persistentLesion (refs=1, tests=0)
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
- src/organism/core/OrganismCore.ts:2333:setNeuralCausalTrace (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:2335:setRealityLearningGate (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:2631:hexisDecideLearningReview (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:2664:hexisApplyRetention (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:2988:recordMatchedCounterfactual (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:3011:recordCounterfactuals (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:10220:b365LearnGroundedTransition (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:10221:b365LearnEmbodiedConsequence (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:10373:p34ApplyIdentityChange (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:10378:p33SetSelfAuthoredGoal (refs=1, tests=0)
- src/organism/core/OrganismCore.ts:10478:operationalLifeRecordCausalIntervention (refs=1, tests=0)
- src/organism/developmental/P47TemporalMemoryMind.ts:48:updateBeliefsFromEvent (refs=1, tests=0)
- src/organism/developmental/P70MemoryLifecycleGovernor.ts:25:recordPrune (refs=1, tests=0)
- src/organism/developmental/UnifiedMemorySystem.ts:86:recordRetrieval (refs=1, tests=0)
- src/organism/developmental/UnifiedMemorySystem.ts:91:updateBelief (refs=1, tests=0)
- src/organism/integration/hexis/HexisAdaptationFabric.ts:318:setRetentionStatus (refs=1, tests=0)
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
- src/organism/learning/P36AutonomousSelfDevelopment.ts:495:recordRollback (refs=1, tests=0)
- src/organism/learning/VerifiedAutonomousLifeEngine.ts:106:recordPerception (refs=1, tests=0)
- src/organism/memory/ExperienceContinuumFabric.ts:550:consolidateCold (refs=1, tests=0)
- src/organism/memory/MemoryRetrievalBenchmark.ts:143:inspectDataset (refs=1, tests=0)
- src/organism/memory/SemanticMemoryGraph.ts:25:ingestEpisode (refs=1, tests=0)
- src/organism/system/B1101B1350SelfDevelopmentCore.ts:113:updatePredictor (refs=1, tests=0)
- src/organism/system/B1351B1600LifelongDevelopmentCore.ts:80:worldUpdate (refs=1, tests=0)
- src/organism/system/B1701B2200UnifiedLifeContinuityCore.ts:102:learnMemory (refs=1, tests=0)
- src/organism/system/B1701B2200UnifiedLifeContinuityCore.ts:107:updateSkills (refs=1, tests=0)
- src/organism/system/B2201B2500LifeCourseSelfModelCore.ts:59:updateSelfBeliefs (refs=1, tests=0)
- src/organism/system/B2201B2500LifeCourseSelfModelCore.ts:64:updateFingerprint (refs=1, tests=0)
- src/organism/system/B2201B2500LifeCourseSelfModelCore.ts:65:updateNarrative (refs=1, tests=0)
- src/organism/system/B2201B2500LifeCourseSelfModelCore.ts:69:updateCommitment (refs=1, tests=0)
- src/organism/system/B299CausalPersonalityDevelopmentLoop.ts:252:updateDevelopmentalMaturity (refs=1, tests=0)
- src/organism/system/CausalLifeGraph.ts:223:hasCompleteChainAtTick (refs=1, tests=0)
- src/organism/world/WorldModel.ts:138:learnedActionBias (refs=1, tests=0)
- src/organism/memory/ExperienceContinuumFabric.ts:410:recordReplayValidation (refs=2, tests=8)
- src/organism/memory/ExperienceContinuumFabric.ts:499:recordReplayExperimentTrial (refs=2, tests=8)
- src/organism/learning/ProceduralSkillLibrary.ts:456:recordVariantExecution (refs=2, tests=5)
- src/organism/memory/ExperienceContinuumFabric.ts:344:recordLongitudinalReplayTrial (refs=2, tests=5)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:858:setGoalAuthorshipCandidate (refs=2, tests=4)
- src/organism/core/WorldSubsystemRuntime.ts:176:observeActionOutcome (refs=2, tests=4)
- src/organism/cognition/B365UnifiedNeuroCausalCore.ts:1707:learnEmbodiedConsequence (refs=2, tests=3)
- src/organism/developmental/MemorySubstrateCoordinator.ts:98:consolidateCompatibility (refs=2, tests=3)
- src/organism/learning/P30ContinualIntelligence.ts:315:rollbackBundle (refs=2, tests=3)
- src/organism/learning/UnifiedLearningSubstrate.ts:200:recordTransferProbe (refs=2, tests=3)
- src/organism/memory/MemoryFabric.ts:362:consolidateCompatibility (refs=2, tests=3)
- src/organism/learning/CognitiveResearchBattery.ts:264:recordEvaluatorOutcome (refs=2, tests=2)
- src/organism/learning/P25ScientificDevelopmentEngine.ts:183:recordEvaluation (refs=2, tests=2)
- src/organism/learning/ProceduralSkillLibrary.ts:383:recordCompoundExecution (refs=2, tests=2)
- src/organism/learning/ProceduralSkillLibrary.ts:405:recordCompoundRepair (refs=2, tests=2)
- src/organism/system/CausalLifeGraph.ts:143:recordCycle (refs=2, tests=2)
- src/organism/cognition/P32CausalSelfModel.ts:155:recordControlledIntervention (refs=2, tests=1)
- src/organism/cognition/P33PersonhoodCore.ts:146:setSelfAuthoredGoal (refs=2, tests=1)
- src/organism/cognition/P34CausalPersonhood.ts:151:observeSelfClaim (refs=2, tests=1)
- src/organism/cognition/P34CausalPersonhood.ts:189:recordConsent (refs=2, tests=1)
- src/organism/core/OrganismCore.ts:10879:rollbackCompoundSkill (refs=2, tests=1)