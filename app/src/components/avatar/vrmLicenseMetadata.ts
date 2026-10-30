export interface VrmLicenseSummary {
  metadataPresent: boolean;
  modelName: string;
  authors: string[];
  licenseUrlPresent: boolean;
  creditNotation: "required" | "unnecessary" | "unspecified";
  redistribution: "allowed-in-metadata" | "disallowed-in-metadata" | "unspecified";
  commercialUsage: string;
  modification: string;
  avatarPermission: string;
    summary: metadataPresent ? `VRM metadata: ${modelName} · ${authorSummary} · ${licenseSummary} · ${creditSummary} · ${redistributionSummary}. Verify the creator original terms before using or distributing this model.` : `No VRM license metadata found for ${modelName}. Verify the creator, source, and usage rights before using or distributing this model.`,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeText(value: unknown, maxLength = 96): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function safeAuthors(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((author) => safeText(author, 72))
      .filter(Boolean)
      .slice(0, 3);
  }
  const single = safeText(value, 72);
  return single ? [single] : [];
}

/**
 * Read only self-declared VRM metadata. This does not validate the license,
 * fetch external URLs, or grant permissions; it creates a visible reminder
 * that uploaded avatar provenance/usage must be checked by the user.
 */
export function summarizeVrmLicenseMetadata(
  input: unknown,
  fileName = "avatar.vrm",
): VrmLicenseSummary {
  const metadataPresent = isRecord(input) && ["name", "title", "authors", "author", "licenseUrl", "otherLicenseUrl", "licenseName", "metaVersion"].some((key) => metadata[key] !== undefined);
  const metadata = isRecord(input) ? input : {};
  const modelName = safeText(metadata.name ?? metadata.title, 96) || safeText(fileName, 96) || "avatar";
  const authors = safeAuthors(metadata.authors ?? metadata.author);
  const licenseUrl = safeText(metadata.licenseUrl, 256) || safeText(metadata.otherLicenseUrl, 256) || safeText(metadata.otherPermissionUrl, 256);
  const licenseUrlPresent = /^https?:\/\//iu.test(licenseUrl);
  const creditNotation = metadata.creditNotation === "required"
    ? "required"
    : metadata.creditNotation === "unnecessary"
      ? "unnecessary"
      : "unspecified";
  const redistribution = metadata.allowRedistribution === true
    ? "allowed-in-metadata"
    : metadata.allowRedistribution === false
      ? "disallowed-in-metadata"
      : "unspecified";
  const commercialUsage = safeText(metadata.commercialUsage ?? metadata.commercialUsageName, 64) || "unspecified";
  const modification = safeText(metadata.modification, 64) || "unspecified";
  const avatarPermission = safeText(metadata.avatarPermission, 64) || "unspecified";

  const authorSummary = authors.length ? authors.join(", ") : "author not listed";
  const creditSummary = creditNotation === "required"
    ? "credit required by metadata"
    : creditNotation === "unnecessary"
      ? "credit marked unnecessary in metadata"
      : "credit requirement unspecified";
  const redistributionSummary = redistribution === "allowed-in-metadata"
    ? "redistribution marked allowed in metadata"
    : redistribution === "disallowed-in-metadata"
      ? "redistribution marked disallowed in metadata"
      : "redistribution rule unspecified";
  const licenseSummary = licenseUrlPresent ? "license URL metadata present" : "no valid license URL metadata";

  return {
    modelName,
    metadataPresent,
    authors,
    licenseUrlPresent,
    creditNotation,
    redistribution,
    commercialUsage,
    modification,
    avatarPermission,
    summary: `VRM metadata: ${modelName} · ${authorSummary} · ${licenseSummary} · ${creditSummary} · ${redistributionSummary}. Verify the creator's original terms before using or distributing this model.`,
  };
}
