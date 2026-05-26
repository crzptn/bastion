import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthApiError, login } from '../lib/api/auth';
import { setSession } from '../lib/authStore';

// ---------------------------------------------------------------------------
// Pure helper — maps error codes to user-facing messages (exported for tests)
// ---------------------------------------------------------------------------

export function formatLoginError(code: string): string {
  switch (code) {
    case 'invalid_credentials':
      return 'Invalid username or password.';
    case 'invalid_input':
      return 'Username and password are required.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

// ---------------------------------------------------------------------------
// LoginPage component
// ---------------------------------------------------------------------------

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login(username, password);
      setSession(res.token, res.user.username);
      navigate('/');
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(formatLoginError(err.code));
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none';
  const labelClass = 'mb-1 block text-sm font-medium text-slate-300';

  return (
    <section className="mx-auto max-w-sm space-y-6">
      <h2 className="text-xl font-semibold">Sign in</h2>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className={labelClass}>
            Username
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-sm text-slate-400">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="text-blue-400 hover:underline">
          Register
        </Link>
      </p>
    </section>
  );
}
