const DEVICE_KEY = "testnix.deviceKey";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Stable anonymous key that links this browser's speed results to their cloud copies. */
export function getDeviceKey(): string {
  try {
    let key = window.localStorage.getItem(DEVICE_KEY);
    if (key && /^[A-Za-z0-9_-]{8,64}$/.test(key)) return key;
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    key = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
    window.localStorage.setItem(DEVICE_KEY, key);
    return key;
  } catch {
    // No storage available: use a session-only key so results still save for this visit.
    const g = window as unknown as { __testnixSessionKey?: string };
    if (!g.__testnixSessionKey) {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      g.__testnixSessionKey = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
    }
    return g.__testnixSessionKey;
  }
}
