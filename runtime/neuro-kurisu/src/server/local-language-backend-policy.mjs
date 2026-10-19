/**
 * Resolve the first-choice language backend without pretending a configured
 * endpoint is healthy. The provider still reports failures through the normal
 * fallback chain; configuration only controls preference, not availability.
 */
export function chooseLanguageBackend({ localLlamaConfigured, ecologyPreferredBackend }) {
  if (localLlamaConfigured === true) return 'llama.cpp';
  return String(ecologyPreferredBackend || 'local-fallback');
}
