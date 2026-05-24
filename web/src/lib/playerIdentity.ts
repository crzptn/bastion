// ---------------------------------------------------------------------------
// Player identity — backed by localStorage so identity persists across tabs
// ---------------------------------------------------------------------------

const PLAYER_ID_KEY = 'bastion_player_id';
const DISPLAY_NAME_KEY = 'bastion_display_name';

/**
 * Returns a stable UUID for this browser. Generates and persists one on first
 * call. Safe to call multiple times — always returns the same value.
 */
export function getOrCreatePlayerId(): string {
  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;
  const id = generateUUID();
  localStorage.setItem(PLAYER_ID_KEY, id);
  return id;
}

/**
 * Returns the persisted display name, or an empty string if never set.
 * Call setDisplayName to persist a new name.
 */
export function getOrCreateDisplayName(fallback?: string): string {
  const existing = localStorage.getItem(DISPLAY_NAME_KEY);
  if (existing) return existing;
  const name = fallback ?? '';
  if (name) localStorage.setItem(DISPLAY_NAME_KEY, name);
  return name;
}

/** Persists a display name. */
export function setDisplayName(name: string): void {
  localStorage.setItem(DISPLAY_NAME_KEY, name);
}

// ---------------------------------------------------------------------------
// Crypto-UUID helper (no external deps)
// ---------------------------------------------------------------------------

function generateUUID(): string {
  // Use crypto.randomUUID when available (modern browsers + Node 19+)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: manual v4 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
