/** API base URL for fetch calls. Empty string means same-origin (production via API SPA). */
export function apiBaseUrl(): string {
  const base = import.meta.env.VITE_API_URL ?? '';
  return base.replace(/\/$/, '');
}
