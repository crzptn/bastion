import { apiBaseUrl } from './env';

export type HealthResult = {
  status: string;
  version: string;
};

export async function fetchHealth(): Promise<HealthResult> {
  const base = apiBaseUrl();
  const url = base ? `${base}/health` : '/health';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }
  return (await res.json()) as HealthResult;
}
