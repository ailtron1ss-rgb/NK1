# AVATAR + MOBILE ARCHITECTURE 34.47.0

## Runtime profiles
- `quality`: original 4096 texture.
- `balanced`: canonical model with original texture; reduced viewer activity still applies.
- `mobile`: separate model file referencing canonical moc3/physics/cdi/motions/expressions and a 2048 texture.
- `auto`: selects mobile on constrained/touch-small devices using memory/viewport hints, otherwise balanced.

## Interaction
- viewer pointer upper half = TapHead.
- viewer pointer lower half = TapBody.
- parent dashboard can explicitly request expression, tap and profile.
- avatar does not fabricate speech or autonomous semantic events: expression/motion signals are derived from organism state or explicit UI test actions.

## Resource policy
The original quality asset is preserved. Mobile variant is a derived visual representation, not a new organism state or model of cognition.
