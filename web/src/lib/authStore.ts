// ---------------------------------------------------------------------------
// authStore — module-scoped in-memory token with localStorage mirror
// Keys: 'bastion_auth_token', 'bastion_auth_username'
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'bastion_auth_token';
const USERNAME_KEY = 'bastion_auth_username';

// Re-hydrate from localStorage on module load
let _token: string | null = null;
let _username: string | null = null;

try {
  _token = localStorage.getItem(TOKEN_KEY);
  _username = localStorage.getItem(USERNAME_KEY);
} catch {
  // localStorage unavailable (SSR / test env without stub)
}

const _listeners = new Set<() => void>();

function _notify() {
  for (const fn of _listeners) fn();
}

export function getToken(): string | null {
  return _token;
}

export function getUsername(): string | null {
  return _username;
}

export function setSession(token: string, username: string): void {
  _token = token;
  _username = username;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USERNAME_KEY, username);
  } catch {
    // ignore
  }
  _notify();
}

export function clearSession(): void {
  _token = null;
  _username = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
  } catch {
    // ignore
  }
  _notify();
}

/** Returns an unsubscribe function. */
export function subscribe(fn: () => void): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}
