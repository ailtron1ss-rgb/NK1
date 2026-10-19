# P27 Architecture

```text
raw/compact modalities
        ↓
local modality encoders
        ↓
16D shared latent situation
        ↓
 ┌───────────────┬────────────────┐
 ↓               ↓                ↓
policy head   transition head   counterfactual model
 ↓               ↓                ↓
action       next-state risk    alternate actions
        \          |          /
         \         |         /
          → real outcome ←
                 ↓
              learning
                 ↓
              persist
```

Dependency rule: canonical runtime may depend on cognition/learning/world/system, but P27 does not import `research` or `legacy-original`.
