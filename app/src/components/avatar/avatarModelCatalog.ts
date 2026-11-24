/** Pinned, content-addressed built-in 3D avatar assets hosted in the NK1 media workspace. */
export const KURISU_HYBRID_MODEL = Object.freeze({
  id: "neuro-kurisu-hybrid-v5",
  label: "Neuro Kurisu · Hybrid 3D v5",
  filename: "NeuroKurisu_3D_v5.glb",
  format: "glb" as const,
  revision: 5,
  sizeBytes: 2_035_768,
  sha256: "sha256:4cc4c34a62f72122b34c1d896d42bf10eddcba6f10f66563e4fc5e213a37e743",
  url: "https://d2ol7oe51mr4n9.cloudfront.net/user_3LTKlQrHJFFxzAMNuCHI3842j5m/ce925a97-0020-4335-8378-14eb3ec95931.glb",
  source: "Higgsfield 3D Jutsu project 5cb8f13d-0f7d-4bf6-98cf-9b84503ce1ba, revision 5",
});

/**
 * Structurally verified v7 NLA export for explicit visual comparison only.
 * It is deliberately non-canonical until browser/device/visual and license gates pass.
 */
export const KURISU_HYBRID_MODEL_V7_CANDIDATE = Object.freeze({
  id: "neuro-kurisu-hybrid-v7-nla-candidate",
  label: "Neuro Kurisu · Hybrid 3D v7 NLA candidate",
  filename: "NeuroKurisu_3D_v7_NLA.glb",
  format: "glb" as const,
  revision: 7,
  sizeBytes: 1_876_476,
  sha256: "sha256:9eb90244a35db827334c65a2101e5e4640875b9a25f53836876f1ca20972f8a0",
  url: "https://d2ol7oe51mr4n9.cloudfront.net/user_3LTKlQrHJFFxzAMNuCHI3842j5m/3e7b233a-31c8-4121-be63-1ef5f911f017.glb",
  source: "Higgsfield 3D Jutsu project 5cb8f13d-0f7d-4bf6-98cf-9b84503ce1ba, revision 7, NLA_TRACKS",
  canonical: false as const,
  acceptance: "structural-only" as const,
});

/**
 * Morph-ready v12 export. Explicit preview only; v5 remains canonical until
 * visual/device, runtime-expression and provenance gates are accepted.
 */
export const KURISU_HYBRID_MODEL_V12_CANDIDATE = Object.freeze({
  id: "neuro-kurisu-hybrid-v12-morph-ready-candidate",
  label: "Neuro Kurisu · Hybrid 3D v12 morph-ready candidate",
  filename: "NeuroKurisu_3D_v12_morph_ready.glb",
  format: "glb" as const,
  revision: 12,
  sizeBytes: 7_330_996,
  sha256: "sha256:6c37e675f33009623f2671fce041a850c1d6dd871cf36252025a0b71374df509",
  url: "https://d2ol7oe51mr4n9.cloudfront.net/user_3LTKlQrHJFFxzAMNuCHI3842j5m/4fa929b7-eca1-4b14-831b-700416ab16db.glb",
  source: "Higgsfield 3D Jutsu project 5cb8f13d-0f7d-4bf6-98cf-9b84503ce1ba, revision 12",
  canonical: false as const,
  acceptance: "morph-ready-structural" as const,
});
