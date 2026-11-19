# NK1 embodiment asset provenance — 2026-11-18

This asset-only consolidation candidate is based on workpass70-source at commit 7547f5287b84a7d9b7109c0e5fdbe20bf95c9e33. All binaries were copied as base64 Git blobs and verified by identical Git blob SHA. No image bytes were modified or re-encoded.

## Canonical Kurisu expression sprites

Source: PR #848 head 3c0164405fda67bb46d62c06fe78741b0b10f830. The same eight blob SHAs were also found in PR #856 and PR #844. These paths were absent from workpass70-source before this candidate.

| Path | Git blob SHA |
|---|---|
| app/public/sprites/kurisu/arms_crossed.png | 6f1cc8b075327dcad51919a5d227120bd468fcf4 |
| app/public/sprites/kurisu/embarrassed.png | 785cfafb9db647a4bf964d1323b488b7d665479a |
| app/public/sprites/kurisu/neutral_front.png | cfb0299b54de52340f0af4f92b4435bd6a37a374 |
| app/public/sprites/kurisu/phone_look.png | ec2b15c2c692dba83e541aab3946cbcc3c64840f |
| app/public/sprites/kurisu/shocked.png | 656d70f264149aa16836e3f24de6d71c0eac1984 |
| app/public/sprites/kurisu/thinking_chin.png | 0260c52532a5bbb5a52fc80c2bcc421d3d1de4e0 |
| app/public/sprites/kurisu/tired_rest.png | 58b1627315aba8d001e6a143ebaefece1cad884f |
| app/public/sprites/kurisu/whiteboard.png | a22e435e6a8ee60d4707645f61ded06290652963 |

## Visual evidence variants retained separately

| Destination in this branch | Source PR/head | Original path(s) | Blob SHA |
|---|---|---|---|
| docs/consolidation/visual-evidence/pr-848/kurisu_3d_avatar_screenshot.png | #848 / 3c0164405fda67bb46d62c06fe78741b0b10f830 | docs/kurisu_3d_avatar_screenshot.png | b2c3cdf84123d12840bc3484f7c13af4e2d71cab |
| docs/consolidation/visual-evidence/pr-848/kurisu_3d_avatar_render.png | #848 / 3c0164405fda67bb46d62c06fe78741b0b10f830 | kurisu_3d_avatar_render.png | a3dfd941ff9f1d6073f4bc382e33f5f7533787f7 |
| docs/consolidation/visual-evidence/pr-856/kurisu_3d_avatar_reference.png | #856 / bd831ffbb5625e6c23230e204ccfd8c84219b932 | docs/kurisu_3d_avatar_screenshot.png and kurisu_3d_avatar_render.png share the same blob | 15a13664a8de7852b566824fa5e6cbb18a0d4e0d |
| docs/consolidation/visual-evidence/pr-844/kurisu_3d_avatar_reference.png | #844 / 6e8748cad0f57a57c55f360b3b3daebd8ea072ef | docs/kurisu_3d_avatar_screenshot.png and kurisu_3d_avatar_render.png share the same blob | 9a605db6bcd0c5711828c0f8a3cb623bf6315842 |

The render variants are deliberately not deduplicated across PRs. Their visual quality, model pose, provenance and intended use must be reviewed before a canonical screenshot/render is selected.

## Scope and safety

This branch only preserves image files and provenance. It does not wire sprites into the UI, replace active avatar/VRM code, modify runtime files, or claim that any avatar is production-ready. The branch is a Draft integration candidate for review against workpass70-source.
