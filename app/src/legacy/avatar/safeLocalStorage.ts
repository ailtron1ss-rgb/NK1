/**
 * Best-effort local persistence for optional avatar preferences.
 * Storage can be unavailable in privacy modes, embedded webviews, or quota/security failures.
 */
export function readAvatarPreference(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeAvatarPreference(key: string, value: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
