import { Link } from 'react-router-dom';
import { HealthStatus } from '../components/HealthStatus';

export function HomePage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Welcome to Bastion</h2>
        <p className="mt-2 text-slate-400">
          A co-op tower-defense game. Place towers, survive the waves, protect
          your base.
        </p>
        <Link
          to="/play"
          className="mt-4 inline-block px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded transition-colors"
        >
          Start a single-player run →
        </Link>
        <Link
          to="/leaderboard"
          className="mt-3 inline-block text-sm text-slate-400 hover:text-slate-200 underline ml-4"
        >
          View leaderboard
        </Link>
      </div>
      <HealthStatus />
    </section>
  );
}
