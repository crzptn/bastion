import { HealthStatus } from '../components/HealthStatus';

export function HomePage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Welcome</h2>
        <p className="mt-2 text-slate-400">
          Tower-defense game — lobby and play routes are placeholders for now.
        </p>
      </div>
      <HealthStatus />
    </section>
  );
}
