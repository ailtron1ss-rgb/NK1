# NK1 checkpoint — project tool finalization route (2026-10-20)

## Defect found and fixed
The project execution branch called ActionGateway.executeTool directly. Keyed side effects were finalized inside ActionGateway, but unkeyed project tool calls (notably read-only tools) did not pass through OrganismCore.finalizeToolOutcome and its host checkpoint. The fresh-execution branch now calls OrganismCore.executeTool, which canonicalizes aliases, delegates to ActionGateway, avoids double-finalizing keyed receipts/replays, and finalizes unkeyed results.

## Regression
The WorkPass97 source-level architecture test now checks both the autonomous planner route and the project executor route. It rejects a return to direct ActionGateway execution for fresh project tools.

Command from runtime/neuro-kurisu:

npm run test:workpass97:planner-route

Expected output:

NK1_AUTONOMOUS_PLANNER_GATEWAY_ROUTE=PASS plannerUsesCoreWrapper=true projectUsesCoreWrapper=true canonicalGateway=true finalizerOwnership=true

## Remaining work
This fixes a concrete finalization bypass, not every possible authorization bypass. Continue tracing skill-step execution, provider reconciliation, EthicalGate policy application and real end-to-end project cycles. Exact-head CI remains the acceptance gate.
