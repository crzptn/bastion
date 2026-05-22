import { useEffect, useState } from 'react';

import { fetchHealth, type HealthResult } from '../lib/health';

type Status = 'loading' | 'ok' | 'error';

export function HealthStatus() {
  const [status, setStatus] = useState<Status>('loading');
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus('loading');
      setError(null);
      try {
        const result = await fetchHealth();
        if (cancelled) return;
        setHealth(result);
        setStatus('ok');
      } catch (err) {
        if (cancelled) return;
        setHealth(null);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'API unreachable');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <h3 className="text-sm font-medium uppercase tracking-wide text-slate-400">API Health</h3>
      {status === 'loading' && <p className="mt-2 text-slate-300">Checking…</p>}
      {status === 'ok' && health && (
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-slate-400">Status</dt>
            <dd className="font-medium text-emerald-400">{health.status}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-400">Version</dt>
            <dd className="font-medium text-slate-200">{health.version}</dd>
          </div>
        </dl>
      )}
      {status === 'error' && (
        <p className="mt-2 text-sm text-red-400">{error ?? 'API unreachable'}</p>
      )}
    </div>
  );
}
