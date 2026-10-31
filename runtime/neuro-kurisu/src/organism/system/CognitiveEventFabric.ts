    if(input.outcome){const e=this.append({tick:input.tick,stage:'outcome',source:input.outcome.source??'outcome',parentIds:parents(ids.action,ids.prediction),external:input.outcome.external,confidence01:input.outcome.confidence01,payload:input.outcome.payload,at:input.at});ids.outcome=e.id;}
    if(input.learning){const e=this.append({tick:input.tick,stage:'learning',source:input.learning.source??'learning',parentIds:parents(ids.outcome,ids.action),confidence01:input.learning.confidence01,payload:input.learning.payload,at:input.at});ids.learning=e.id;}
    if(input.selfUpdate){const e=this.append({tick:input.tick,stage:'self-update',source:input.selfUpdate.source??'self-update',parentIds:parents(ids.learning,ids.outcome),confidence01:input.selfUpdate.confidence01,payload:input.selfUpdate.payload,at:input.at});ids.selfUpdate=e.id;}
    return ids;
  }

  verifyOperationalCycle(stageIds: OperationalCycleStageIds, expectedTick?: number): OperationalCycleLineageCheck {
    const required = ['observation','prediction','action','outcome','learning','self-update'] as const;
    const optional = ['appraisal','attention','memory','goal','plan'] as const;
    const byId = new Map(this.events.map(event => [event.id, event] as const));
    const found = new Map<string, CognitiveEventNode>();
    const missingStages: string[] = [];
    const invalidStages: string[] = [];
    let cycleTick: number | null = null;

    for (const stage of required) {
      const id = stageIds[stage];
      const event = id ? byId.get(id) : undefined;
      if (!event) { missingStages.push(stage); continue; }
      if (event.stage !== stage) { invalidStages.push(stage + ':expected-stage-' + stage + '-got-' + event.stage); continue; }
      if (cycleTick === null) cycleTick = event.tick;
      if (event.tick !== cycleTick) { invalidStages.push(stage + ':tick-mismatch'); continue; }
      found.set(stage, event);
    }

    for (const stage of optional) {
      const id = stageIds[stage];
      if (id === undefined) continue;
      if (typeof id !== 'string' || !id) { invalidStages.push(stage + ':invalid-id'); continue; }
      const event = byId.get(id);
      if (!event) { invalidStages.push(stage + ':missing-event'); continue; }
      if (event.stage !== stage) { invalidStages.push(stage + ':expected-stage-' + stage + '-got-' + event.stage); continue; }
      if (cycleTick === null) cycleTick = event.tick;
      if (event.tick !== cycleTick) { invalidStages.push(stage + ':tick-mismatch'); continue; }
      found.set(stage, event);
    }

    // Bind this evidence graph to the runtime tick that requested verification.
    // A complete trace from a prior/adjacent tick is not evidence for this cycle.
    if (expectedTick !== undefined) {
      if (!Number.isSafeInteger(expectedTick) || expectedTick < 0) invalidStages.push('cycle:invalid-expected-tick');
      else if (cycleTick !== null && cycleTick !== expectedTick) invalidStages.push('cycle:tick-mismatch');
    }

    const requiredEdges: Array<[OperationalCycleStageName, OperationalCycleStageName, string]> = [
      ['prediction','observation','prediction->observation'],
      ['action','prediction','action->prediction'],
      ['action','observation','action->observation'],
      ['outcome','action','outcome->action'],
      ['learning','outcome','learning->outcome'],
      ['self-update','learning','self-update->learning'],
    ];
    const missingEdges: string[] = [];
    let validEdges = 0;
    for (const [childStage, parentStage, label] of requiredEdges) {
      const child = found.get(childStage);
      const parent = found.get(parentStage);
      if (child && parent && child.parentIds.includes(parent.id)) validEdges++;