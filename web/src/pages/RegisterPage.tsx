import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthApiError, login, register } from '../lib/api/auth';
import { setSession } from '../lib/authStore';

// ---------------------------------------------------------------------------
// Pure validation helper (exported for tests)
// ---------------------------------------------------------------------------

export interface ValidateOk {
  ok: true;
}

export interface ValidateError {
  ok: false;
  error: string;
}

export type ValidateResult = ValidateOk | ValidateError;

export function validateRegisterInput(input: {
  username: string;
  password: string;
  confirm: string;
}): ValidateResult {
  if (!input.username.trim()) {
    return { ok: false, error: 'Username is required.' };
  }
  if (!input.password) {
    return { ok: false, error: 'Password is required.' };
  }
  if (input.password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }
  if (input.password !== input.confirm) {
    return { ok: false, error: 'Passwords do not match.' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// RegisterPage component
// ---------------------------------------------------------------------------

export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = validateRegisterInput({ username, password, confirm });
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    try {
      // Register the account
      await register(username, password);
      // Auto-login so the JWT lands in memory + localStorage immediately
      const loginRes = await login(username, password);
      setSession(loginRes.token, loginRes.user.username);
      navigate('/');
    } catch (err) {
      if (err instanceof AuthApiError) {
        switch (err.code) {
          case 'duplicate_username':
            setError('That username is already taken.');
            break;
          case 'invalid_input':
            setError('Invalid username or password.');
            break;
          default:
            setError('An unexpected error occurred. Please try again.');
        }
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
      <h2 className="text-xl font-semibold">Create an account</h2>

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
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="confirm" className={labelClass}>
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-sm text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="text-blue-400 hover:underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}
