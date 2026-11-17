# Developmental Genome Implementation Plan

> **For agentic workers:** Execute this plan task-by-task in the current GitHub feature branch. Steps use checkbox syntax for tracking.

**Goal:** Add a deterministic, fail-closed Developmental Genome over NK1's live canonical system contracts and expose it through the organism composition fabric.

**Architecture:** Build the genome from existing OrganismSystemContract records, the InvariantEngine rule manifest, ReleaseContract, and the existing StateMigrations owner. Allow only bounded resource-policy inheritance; approve candidates for review, never apply them automatically.

**Tech Stack:** TypeScript, Node.js 22.16+, GitHub Actions, existing Node strip-types test convention.

**Spec:** docs/DEVELOPMENTAL_GENOME_DESIGN_2026-11-17.md

## Global Constraints

- Canonical source branch is workpass70-source; work on aspect/developmental-genome-20261117.
- Preserve one canonical owner per capability; do not create a parallel runtime, planner, persistence store, invariant authority, or migration engine.
- Runtime requires Node >=22.12.0 and npm >=10.8.0; runtime dependencies remain zero.
- State schema remains the existing RELEASE_CONTRACT.stateSchema; no migration or release-version change is introduced.
- Only estimatedCost01 and cadenceCycles are mutable genome traits in v1.
- Runtime code, system membership, dependency edges, identity, safety/invariant authority, evaluation, rollback, release and state-migration contracts are immutable.
- APPROVED means eligible for human review, not active; every candidate remains NOT_APPLIED.
- Never claim Release ZIP parity or Release inclusion from a source-branch commit.

## Review Focus

- Empty or duplicate module lists must be blocked rather than produce a partial genome.
- Dependency cycles and references to missing systems must be blocked deterministically.
- A candidate with a valid-looking but forged digest or parent digest must never be approved.
- Non-finite costs, out-of-range costs and invalid cadence values must fail closed without coercion.
- Invariant-manifest, release-contract, state-schema or migration-owner drift must block automatic approval.

---

### Task 1: Deterministic baseline genome and immutable contract manifest

**Files:**
- Create: runtime/neuro-kurisu/src/organism/system/DevelopmentalGenome.ts
- Modify: runtime/neuro-kurisu/src/organism/system/InvariantEngine.ts
- Modify: runtime/neuro-kurisu/src/organism/core/OrganismSystemFabric.ts
- Create: runtime/neuro-kurisu/tests/developmental-genome.mjs

**Interfaces:**
- invariantRuleManifest(): InvariantRuleManifest — read-only contract projection from InvariantEngine.
- buildDevelopmentalGenome(contracts?): DevelopmentalGenome — deterministic schema-v1 manifest.
- OrganismSystemFabric.developmentalGenome(): DevelopmentalGenome — genome derived from the fabric's resolved live contracts.
- OrganismSystemFabricSnapshot.developmentalGenome — read-only genome included in the diagnostic snapshot.

- [ ] **Step 1: Add the failing fabric-boundary test**
  - Assert new OrganismSystemFabric().developmentalGenome() exists.
  - Assert baseline includes exactly the seven canonical system names, all dependency targets exist, and every dependency precedes its dependent in dependencyOrder.
  - Assert repeated builds yield the same SHA-256 digest and JSON round-trip preserves validation.
  - Assert fabric.snapshot().developmentalGenome.digest equals the direct genome digest.
- [ ] **Step 2: Run the focused test and verify RED**
  - Run: node --experimental-strip-types runtime/neuro-kurisu/tests/developmental-genome.mjs
  - Expected: fail on the missing developmentalGenome fabric API, not on test setup.
- [ ] **Step 3: Implement the baseline and manifest**
  - Export the current InvariantEngine rule codes, paths and severities without transferring validation ownership.
  - Create stable canonical JSON hashing, deterministic topological sorting, structural validation and release/migration compatibility metadata.
  - Add the fabric method and snapshot field; do not modify persisted organism state.
- [ ] **Step 4: Run focused and affected tests**
  - Run: node --experimental-strip-types runtime/neuro-kurisu/tests/developmental-genome.mjs
  - Run: npm --prefix runtime/neuro-kurisu run typecheck
  - Run: npm --prefix runtime/neuro-kurisu run audit:architecture
  - Expected: the focused baseline, runtime compiler and architecture audit pass.
- [ ] **Step 5: Commit Task 1**
  - Commit message: feat(nk1): derive developmental genome from live contracts.

### Task 2: Bounded inheritance and fail-closed Evolution Gate

**Files:**
- Modify: runtime/neuro-kurisu/src/organism/system/DevelopmentalGenome.ts
- Modify: runtime/neuro-kurisu/tests/developmental-genome.mjs

**Interfaces:**
- inheritDevelopmentalGenome(parent, changes): DevelopmentalGenome — produces a child with parent digest, generation +1 and explicit trait deltas.
- evaluateDevelopmentalGenome(candidate, parent?): GenomeGateReport — returns APPROVED, BLOCKED, or NEEDS_REVIEW and always reports activation: NOT_APPLIED.

- [ ] **Step 1: Add inheritance and attack-case assertions**
  - Build a child changing only a valid module's cost/cadence; assert generation, parent digest, exact change receipt and stable digest.
  - Assert the gate approves a valid child only when its parent is supplied and matches.
  - Assert the gate blocks changes to system set, purpose, phase, dependencies, capabilities, invariant rules, release/state schema, migration owner, digest, and lineage.
  - Assert unknown/duplicate module patches, NaN, infinities, costs outside [0,1], and cadence outside integer [1,64] throw or block without normalization.
- [ ] **Step 2: Run the focused test and verify RED**
  - Run: node --experimental-strip-types runtime/neuro-kurisu/tests/developmental-genome.mjs
  - Expected: the first new inheritance assertion fails because the API is not implemented.
- [ ] **Step 3: Implement the minimal inheritance and gate behavior**
  - Copy the parent, apply only approved trait paths, capture old/new values, compute the canonical digest and validate the parent-child relation.
  - Return NEEDS_REVIEW if required parent evidence is missing; return BLOCKED for tampering or incompatibility; do not coerce malformed values.
- [ ] **Step 4: Run focused, type and architecture checks**
  - Run: node --experimental-strip-types runtime/neuro-kurisu/tests/developmental-genome.mjs
  - Run: npm --prefix runtime/neuro-kurisu run typecheck
  - Expected: all genome cases and runtime type checks pass.
- [ ] **Step 5: Commit Task 2**
  - Commit message: feat(nk1): gate inherited developmental genomes.

### Task 3: Runtime verification workflow and operational documentation

**Files:**
- Modify: runtime/neuro-kurisu/package.json
- Create: .github/workflows/developmental-genome.yml
- Modify: CHANGELOG.md
- Create: docs/DEVELOPMENTAL_GENOME_IMPLEMENTATION_2026-11-17_RU.md

**Interfaces:**
- Package script: test:developmental-genome.
- CI runs the focused suite, runtime typecheck, and architecture audit on the feature branch and pull requests targeting workpass70-source.

- [ ] **Step 1: Wire the focused test and workflow**
  - Add the package script using node --experimental-strip-types tests/developmental-genome.mjs.
  - CI uses Node 22, runs the focused test, runtime typecheck, and architecture audit, and is path-filtered to genome/runtime contract files.
- [ ] **Step 2: Run all task checks on the exact branch HEAD**
  - Run: npm --prefix runtime/neuro-kurisu run test:developmental-genome
  - Run: npm --prefix runtime/neuro-kurisu run typecheck
  - Run: npm --prefix runtime/neuro-kurisu run audit:architecture
  - Expected: all commands exit 0; every GitHub Actions check is bound to the current feature head.
- [ ] **Step 3: Record exact evidence and limitations**
  - Record branch/base/head SHA, focused test output, Actions run IDs and status.
  - Explicitly state that approval is not activation, no state schema changed, and Release parity is not established.
- [ ] **Step 4: Commit Task 3**
  - Commit message: test(nk1): verify developmental genome in CI.

## Integration boundaries

The genome is derived from the resolved contracts in OrganismSystemFabric; it does not instantiate or mutate the seven systems. Invariant validation stays in InvariantEngine, state migration stays in StateMigrations, and existing P53/P63/compiler responsibilities remain unchanged.

## Acceptance criteria

- One reproducible baseline generated from the live seven-system fabric.
- Stable SHA-256 digest over canonical JSON.
- Deterministic dependency order and fail-closed graph validation.
- Explicit parent-child lineage and bounded inherited traits.
- Immutable invariant/release/migration contracts.
- Candidate gate outcomes and NOT_APPLIED activation declaration.
- Focused behavioral tests, TypeScript runtime typecheck and architecture audit passing on the exact PR HEAD.
- Draft PR remains unmerged; no Release artifact is modified.
