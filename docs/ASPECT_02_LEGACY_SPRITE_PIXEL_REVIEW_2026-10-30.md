# Aspect 02 — direct pixel review of seven legacy sprites (2026-10-30)

## Method and scope

The seven PNGs that had no exact semantic match in the earlier WorkPass622 audit were fetched from the exact `workpass70-source` Git ref using the GitHub Contents API with Base64 encoding, decoded, and inspected as images in this pass. Their Git blob SHA-1 values and decoded byte sizes were recorded in `app/public/kurisu-original/existing-assets-audit.json`.

This is a visual description of the files as they exist in that source ref. It does **not** establish who authored the images, whether redistribution is permitted, which prompts or source models produced them, or whether editable layered originals exist. All seven remain legacy static pose references, not production masters or 2.5D source layers.

## Pixel observations

| Manifest ID | Observed content | Suggested reference role |
|---|---|---|
| `embarrassed` | Upper-body portrait with arms folded across the chest; composed, guarded expression, not visibly embarrassed | Reserved or mildly defensive crossed-arms pose |
| `phone_look` | Tight close-up looking down at a handheld smartphone; lips slightly parted | Phone interaction and screen-directed gaze |
| `thinking_chin` | Leaning cheek/head into one hand while reclining on a pale surface; faint relaxed smile | Relaxed resting/reclining pose, not analytical hand-on-chin thinking |
| `soft_smile` | Bright outdoor upper-body portrait, eyes closed, smiling warmly; lab shirt and loosened red tie under a coat | Warm happy/relieved expression |
| `city_stand` | Full-body city street portrait, standing front-facing with arms folded; long coat, shorts and boots | Full-body silhouette, street outfit and guarded stance |
| `phone_lean` | Three-quarter side view at sunset, looking down at a smartphone while leaning against a railing | Phone-use gesture, side/three-quarter profile and sunset lighting |
| `street_walk` | Full-body front-facing street scene; standing or pausing mid-step with arms relaxed, city signage and pedestrians behind | Streetwear/full-body proportion; reads as a paused stance rather than a clear walking stride |

## Result

- All seven previously unmatched manifest IDs now have direct pixel-review descriptions.
- The inventory now distinguishes 25 descriptions carried forward from WorkPass622 from seven images inspected in this pass.
- No filename-derived labels are used for the seven reviewed images.
- License and provenance remain unresolved; do not redistribute or promote these files to production artwork on the strength of this visual review.
