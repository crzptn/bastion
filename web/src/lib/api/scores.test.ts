import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  submitScore,
  getLeaderboard,
  ScoresApiError,
  type ScoreDTO,
  type SubmitScoreInput,
} from './scores';

// ---------------------------------------------------------------------------
// Stub fetch globally (same pattern as auth.test.ts)
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
// AC2 — submitScore POSTs /api/scores with Authorization: Bearer <token>
// ---------------------------------------------------------------------------

describe('submitScore', () => {
  it('POSTs to /api/scores with Authorization Bearer header and correct JSON body', async () => {
    const dto: ScoreDTO = {
      id: 's-1',
      user_id: 'u-1',
      username: 'alice',
      wave_reached: 5,
      base_hp_left: 80,
      duration_ms: 120000,
      coop: false,
      created_at: '2026-01-01T00:00:00Z',
    };
    stubFetch(dto, 201);

    const input: SubmitScoreInput = {
      wave_reached: 5,
      base_hp_left: 80,
      duration_ms: 120000,
      coop: false,
    };

    const result = await submitScore('jwt.header.payload', input);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/scores$/);
    expect(opts.method).toBe('POST');
    expect(opts.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect((opts.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer jwt.header.payload',
    );
    expect(JSON.parse(opts.body as string)).toEqual(input);

    expect(result.id).toBe('s-1');
    expect(result.username).toBe('alice');
    expect(result.wave_reached).toBe(5);
  });

  it('throws ScoresApiError on non-2xx response', async () => {
    stubFetch({ error: 'unauthorized' }, 401);

    await expect(
      submitScore('bad-token', { wave_reached: 1, base_hp_left: 0, duration_ms: 1000, coop: false }),
    ).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
  });

  it('throws ScoresApiError with code from server error field', async () => {
    stubFetch({ error: 'invalid_input' }, 400);

    await expect(
      submitScore('tok', { wave_reached: 0, base_hp_left: 0, duration_ms: 0, coop: false }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid_input' });
  });
});

// ---------------------------------------------------------------------------
// AC1 — getLeaderboard GETs /api/leaderboard and returns ScoreDTO[]
// ---------------------------------------------------------------------------

describe('getLeaderboard', () => {
  it('GETs /api/leaderboard and returns parsed ScoreDTO[]', async () => {
    const scores: ScoreDTO[] = [
      {
        id: 's-1',
        user_id: 'u-1',
        username: 'alice',
        wave_reached: 10,
        base_hp_left: 100,
        duration_ms: 300000,
        coop: false,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 's-2',
        user_id: 'u-2',
        username: 'bob',
        wave_reached: 7,
        base_hp_left: 30,
        duration_ms: 180000,
        coop: true,
        created_at: '2026-01-02T00:00:00Z',
      },
    ];
    stubFetch(scores, 200);

    const result = await getLeaderboard();

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toMatch(/\/api\/leaderboard/);

    expect(result).toHaveLength(2);
    expect(result[0].username).toBe('alice');
    expect(result[1].coop).toBe(true);
  });

  it('appends limit query param when provided', async () => {
    stubFetch([], 200);

    await getLeaderboard(5);

    const fetchMock = vi.mocked(fetch);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/\/api\/leaderboard\?limit=5$/);
  });

  it('throws ScoresApiError on server error', async () => {
    stubFetch({ error: 'internal_error' }, 500);

    await expect(getLeaderboard()).rejects.toMatchObject({ status: 500, code: 'internal_error' });
  });
});

// ---------------------------------------------------------------------------
// ScoresApiError surfaces server `error` code on non-2xx
// ---------------------------------------------------------------------------

describe('ScoresApiError', () => {
  it('is an instance of Error with name ScoresApiError', () => {
    const err = new ScoresApiError('test message', 422, 'validation_failed');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ScoresApiError');
    expect(err.status).toBe(422);
    expect(err.code).toBe('validation_failed');
    expect(err.message).toBe('test message');
  });
});
