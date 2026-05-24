import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  createLobby,
  listOpenLobbies,
  joinLobby,
  startLobby,
  LobbyApiError,
  type LobbyDTO,
} from './lobby';

// ---------------------------------------------------------------------------
// Stub fetch globally
// ---------------------------------------------------------------------------

function makeLobby(overrides: Partial<LobbyDTO> = {}): LobbyDTO {
  return {
    id: 'lobby-1',
    name: 'Test Lobby',
    host_player_id: 'player-host',
    max_players: 4,
    status: 'open',
    players: [{ player_id: 'player-host', display_name: 'Host', slot: 0, joined_at: '2026-01-01T00:00:00Z' }],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

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
// AC1 — createLobby POSTs to /api/lobbies with documented body and returns LobbyDTO
// ---------------------------------------------------------------------------

describe('createLobby', () => {
  it('POSTs to /api/lobbies with correct body and returns LobbyDTO', async () => {
    const dto = makeLobby();
    stubFetch(dto, 201);

    const input = {
      name: 'Test Lobby',
      host_player_id: 'player-host',
      display_name: 'Host',
      max_players: 4,
    };

    const result = await createLobby(input);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/lobbies$/);
    expect(opts.method).toBe('POST');
    expect(opts.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(opts.body as string)).toEqual(input);

    expect(result).toEqual(dto);
    expect(result.id).toBe('lobby-1');
    expect(result.host_player_id).toBe('player-host');
    expect(result.status).toBe('open');
  });

  it('throws LobbyApiError on non-2xx response', async () => {
    stubFetch({ error: 'name and host_player_id required' }, 400);

    await expect(
      createLobby({ name: '', host_player_id: '', display_name: '', max_players: 4 }),
    ).rejects.toThrow(LobbyApiError);

    await expect(
      createLobby({ name: '', host_player_id: '', display_name: '', max_players: 4 }),
    ).rejects.toMatchObject({ status: 400, code: 'name and host_player_id required' });
  });
});

// ---------------------------------------------------------------------------
// AC2 — listOpenLobbies and joinLobby request/response shape
// ---------------------------------------------------------------------------

describe('listOpenLobbies', () => {
  it('GETs /api/lobbies and returns LobbyDTO[]', async () => {
    const lobbies = [makeLobby({ id: 'lobby-1' }), makeLobby({ id: 'lobby-2', name: 'Second' })];
    stubFetch(lobbies, 200);

    const result = await listOpenLobbies();

    const fetchMock = vi.mocked(fetch);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
    expect(url).toMatch(/\/api\/lobbies$/);
    expect(opts?.method).toBeUndefined(); // GET is the default

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('lobby-1');
    expect(result[1].id).toBe('lobby-2');
  });
});

describe('joinLobby', () => {
  it('POSTs to /api/lobbies/:id/join with player_id and display_name', async () => {
    const dto = makeLobby({
      players: [
        { player_id: 'player-host', display_name: 'Host', slot: 0, joined_at: '2026-01-01T00:00:00Z' },
        { player_id: 'player-2', display_name: 'Joiner', slot: 1, joined_at: '2026-01-01T00:00:00Z' },
      ],
    });
    stubFetch(dto, 200);

    const result = await joinLobby('lobby-1', { player_id: 'player-2', display_name: 'Joiner' });

    const fetchMock = vi.mocked(fetch);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/lobbies\/lobby-1\/join$/);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string)).toEqual({ player_id: 'player-2', display_name: 'Joiner' });

    expect(result.players).toHaveLength(2);
    expect(result.players[1].player_id).toBe('player-2');
  });
});

// ---------------------------------------------------------------------------
// startLobby happy path
// ---------------------------------------------------------------------------

describe('startLobby', () => {
  it('POSTs to /api/lobbies/:id/start and returns updated lobby', async () => {
    const dto = makeLobby({ status: 'in_game', session_id: 'session-abc' });
    stubFetch(dto, 200);

    const result = await startLobby('lobby-1', 'player-host');

    const fetchMock = vi.mocked(fetch);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/lobbies\/lobby-1\/start$/);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string)).toEqual({ player_id: 'player-host' });

    expect(result.status).toBe('in_game');
    expect(result.session_id).toBe('session-abc');
  });
});
