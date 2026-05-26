import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  register,
  login,
  getMe,
  type RegisterResponse,
  type LoginResponse,
  type UserDTO,
} from './auth';

// ---------------------------------------------------------------------------
// Stub fetch globally (same pattern as lobby.test.ts)
// ---------------------------------------------------------------------------

function stubFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// AC1 — register POSTs to /api/auth/register and returns RegisterResponse
// ---------------------------------------------------------------------------

describe('register', () => {
  it('POSTs to /api/auth/register and returns RegisterResponse shape', async () => {
    const body: RegisterResponse = { user_id: 'u-1', username: 'alice' };
    stubFetch(body, 201);

    const result = await register('alice', 'secret123');

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/auth\/register$/);
    expect(opts.method).toBe('POST');
    expect(opts.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(opts.body as string)).toEqual({ username: 'alice', password: 'secret123' });

    expect(result.user_id).toBe('u-1');
    expect(result.username).toBe('alice');
  });

  it('throws AuthApiError with code duplicate_username on 409', async () => {
    stubFetch({ error: 'duplicate_username' }, 409);

    await expect(register('alice', 'secret123')).rejects.toMatchObject({
      status: 409,
      code: 'duplicate_username',
    });
  });
});

// ---------------------------------------------------------------------------
// AC1 — login POSTs to /api/auth/login and returns LoginResponse
// ---------------------------------------------------------------------------

describe('login', () => {
  it('POSTs to /api/auth/login and returns LoginResponse with token', async () => {
    const body: LoginResponse = {
      token: 'jwt.header.payload.sig',
      user: { id: 'u-1', username: 'alice', created_at: '2026-01-01T00:00:00Z' },
    };
    stubFetch(body, 200);

    const result = await login('alice', 'secret123');

    const fetchMock = vi.mocked(fetch);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/auth\/login$/);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string)).toEqual({ username: 'alice', password: 'secret123' });

    expect(result.token).toBe('jwt.header.payload.sig');
    expect(result.user.username).toBe('alice');
  });

  it('throws AuthApiError with code invalid_credentials on 401', async () => {
    stubFetch({ error: 'invalid_credentials' }, 401);

    await expect(login('alice', 'wrongpass')).rejects.toMatchObject({
      status: 401,
      code: 'invalid_credentials',
    });
  });
});

// ---------------------------------------------------------------------------
// AC1 — getMe GETs /api/auth/me and sends Authorization: Bearer <token>
// ---------------------------------------------------------------------------

describe('getMe', () => {
  it('GETs /api/auth/me with Authorization header and returns UserDTO', async () => {
    const body: UserDTO = { id: 'u-1', username: 'alice', created_at: '2026-01-01T00:00:00Z' };
    stubFetch(body, 200);

    const result = await getMe('jwt.header.payload.sig');

    const fetchMock = vi.mocked(fetch);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/auth\/me$/);
    expect((opts.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer jwt.header.payload.sig',
    );

    expect(result.id).toBe('u-1');
    expect(result.username).toBe('alice');
  });

  it('throws AuthApiError with code unauthorized on 401', async () => {
    stubFetch({ error: 'unauthorized' }, 401);

    await expect(getMe('bad-token')).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
  });
});
