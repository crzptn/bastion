import { useEffect, useState } from 'react';
import { getLeaderboard, type ScoreDTO } from '../lib/api/scores';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format duration in milliseconds to a "Xm Ys" string. Exported for testing. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// LeaderboardPage
// ---------------------------------------------------------------------------

type LoadState = 'loading' | 'done' | 'error';

export function LeaderboardPage() {
  const [entries, setEntries] = useState<ScoreDTO[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');

    getLeaderboard(50)
      .then((data) => {
        if (!cancelled) {
          setEntries(data);
          setLoadState('done');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Failed to load leaderboard');
          setLoadState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Leaderboard</h2>

      {loadState === 'loading' && (
        <p className="text-slate-400">Loading…</p>
      )}

      {loadState === 'error' && (
        <p className="text-red-400">Error loading leaderboard: {errorMsg}</p>
      )}

      {loadState === 'done' && entries.length === 0 && (
        <p className="text-slate-400">No entries yet. Play a game and submit your score!</p>
      )}

      {loadState === 'done' && entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="py-2 pr-4">Rank</th>
                <th className="py-2 pr-4">Username</th>
                <th className="py-2 pr-4">Wave</th>
                <th className="py-2 pr-4">Base HP</th>
                <th className="py-2 pr-4">Duration</th>
                <th className="py-2 pr-4">Mode</th>
                <th className="py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr
                  key={entry.id}
                  className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-2 pr-4 font-mono text-slate-300">{index + 1}</td>
                  <td className="py-2 pr-4 font-medium text-white">{entry.username}</td>
                  <td className="py-2 pr-4 text-slate-300">{entry.wave_reached}</td>
                  <td className="py-2 pr-4 text-slate-300">{entry.base_hp_left}</td>
                  <td className="py-2 pr-4 text-slate-300">{formatDuration(entry.duration_ms)}</td>
                  <td className="py-2 pr-4 text-slate-400">
                    {entry.coop ? 'Co-op' : 'Solo'}
                  </td>
                  <td className="py-2 text-slate-500 text-xs">{formatDate(entry.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
