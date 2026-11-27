# NK1 Articulated Body Ground Contact — Design

**Date:** 2026-11-27  
**Status:** implementation candidate for PR #1219  
**Base:** workpass70-source@3526f61814e19f1f10766f3b2385488eb04e3d2e

## Intent

Extend the merged 18-particle articulated body so the lower limbs have explicit feet and can interact with a support plane. The goal is to prevent stance-foot penetration, reduce sliding and avoid artificial bounce while allowing a foot to lift freely during a swing pose.

## Current state

The canonical solver has 18 anatomical particles and 17 length constraints. It resolves joint motion through a fixed-step damped motor and PBD distance constraints, then feeds particle-derived corrections back into renderer channels. It has no heel/toe geometry and no unilateral ground contact.

## Approaches considered

1. **Ankle-only collision proxy.** Smallest implementation, but it treats the ankle as the sole and produces poor foot orientation/contact.
2. **Explicit heel/toe support points with unilateral PBD contact.** Adds two particles per foot and two segments per foot, projects only grounded support points, applies zero-restitution normal response and bounded tangential friction. Reuses the existing solver and remains deterministic.
3. **Replace the solver with a full rigid-body/character physics engine.** Can provide broader contact and friction features, but adds a new dependency, integration cost and a second ownership model for a small, local body simulation.

**Chosen approach:** option 2. It improves actual anatomy and support without replacing the existing motor or adding an unrelated physics engine.

## Behaviour contract

- Extend the body to 22 particles and 21 distance constraints with left/right heel and toe points.
- Keep the ankle channel as foot articulation: knee-to-ankle direction is controlled by hip/knee; ankle pitch rotates the heel-to-toe vector.
- Default support plane is local body-space groundY = -0.90; default sole contact radius is 0.04.
- Only feet whose semantic target is in the ground contact band may be grounded. A lifted target remains free; no snap-down is permitted during swing.
- Contact is unilateral: support points may be projected upward to the support plane but never pulled downward by it.
- Downward contact has zero restitution. Tangential slip is damped by a bounded friction coefficient.
- Expose finite per-foot contact state and solver correction/slip diagnostics. Do not claim full-body balance or gait control.

## Non-goals

- Full ragdoll dynamics, inverse dynamics or whole-body momentum conservation.
- Toe-by-toe animation or production skeletal artwork.
- General-purpose collision geometry, stairs, slopes, multiple moving colliders or device-proven locomotion.
- Changing canonical organism state or persistence.

## Acceptance

- A deliberately penetrated stance sole is projected above the support plane.
- Downward velocity does not create a rebound.
- Ground friction reduces horizontal foot slip.
- A raised swing foot remains above the support plane without being pulled back.
- Segment constraints remain bounded and deterministic through contact.
- Focused body tests, TypeScript validation and development build pass on the exact PR head.
