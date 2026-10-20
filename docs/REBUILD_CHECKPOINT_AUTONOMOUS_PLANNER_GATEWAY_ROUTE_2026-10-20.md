# NK1 checkpoint — autonomous planner gateway route guard (2026-10-20)

## Change
Added tests/workpass97-autonomous-planner-gateway-route.mjs. It loads the current OrganismCore source and checks that the autonomous resource/tool/life planner dispatches via this.executeTool, that the wrapper canonicalizes aliases and delegates to ActionGateway, and that finalization ownership is not duplicated between keyed and unkeyed paths.

## Command
From runtime/neuro-kurisu:

npm run test:workpass97:planner-route

Expected output:

NK1_AUTONOMOUS_PLANNER_GATEWAY_ROUTE=PASS plannerUsesCoreWrapper=true canonicalGateway=true finalizerOwnership=true

The regression is wired into the rebuild cognitive regression workflow.

## Scope boundary
This specifically guards the autonomous planner's dispatch route and wrapper contract. It does not prove every skill/project path passes all authorization and EthicalGate requirements, nor does a static source test substitute for an end-to-end production cycle trace.
