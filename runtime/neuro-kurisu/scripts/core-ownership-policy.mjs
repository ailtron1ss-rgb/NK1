/**
 * Policy for counting direct constructor ownership in OrganismCore.
 *
 * Exemptions are intentionally exact pairs. A field name alone is not authority:
 * renaming the field or reusing it for a different constructor must not bypass
 * the architecture-boundary audit.
 */
export const EXPLICIT_DIRECT_CONSTRUCTOR_EXEMPTIONS = Object.freeze([
  Object.freeze({
    field: 'operationalMicroCycle',
    constructor: 'OperationalMicroCycleRuntime',
  }),
]);

export function isExplicitDirectConstructorExemption(owner) {
  return EXPLICIT_DIRECT_CONSTRUCTOR_EXEMPTIONS.some(
    allowed => allowed.field === owner?.field && allowed.constructor === owner?.constructor,
  );
}

export function getCountedDirectConstructorOwners(owners) {
  return owners.filter(owner => !isExplicitDirectConstructorExemption(owner));
}
