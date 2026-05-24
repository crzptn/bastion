import { apiBaseUrl } from '../env';

// ---------------------------------------------------------------------------
// DTOs — mirroring internal/http/lobby_endpoint.go exactly
// ---------------------------------------------------------------------------

export interface LobbyPlayerDTO {
  player_id: string;
  display_name: string;
  slot: number;
  joined_at: string;
}

export interface LobbyDTO {
  id: string;
  name: string;
  host_player_id: string;
  max_players: number;
  status: 'open' | 'starting' | 'in_game' | 'closed';
  session_id?: string;
  players: LobbyPlayerDTO[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class LobbyApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'LobbyApiError';
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function apiUrl(path: string): string {
  const base = apiBaseUrl();
  return base ? `${base}${path}` : path;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let code = 'unknown_error';
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) {
        code = body.error;
        message = body.error;
      }
    } catch {
      // ignore JSON parse failures
    }
    throw new LobbyApiError(message, res.status, code);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export interface CreateLobbyInput {
  name: string;
  host_player_id: string;
  display_name: string;
  max_players: number;
}

export async function createLobby(input: CreateLobbyInput): Promise<LobbyDTO> {
  const res = await fetch(apiUrl('/api/lobbies'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<LobbyDTO>(res);
}

export async function listOpenLobbies(): Promise<LobbyDTO[]> {
  const res = await fetch(apiUrl('/api/lobbies'));
  return handleResponse<LobbyDTO[]>(res);
}

export async function getLobby(id: string): Promise<LobbyDTO> {
  const res = await fetch(apiUrl(`/api/lobbies/${id}`));
  return handleResponse<LobbyDTO>(res);
}

export interface JoinLobbyInput {
  player_id: string;
  display_name: string;
}

export async function joinLobby(id: string, input: JoinLobbyInput): Promise<LobbyDTO> {
  const res = await fetch(apiUrl(`/api/lobbies/${id}/join`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleResponse<LobbyDTO>(res);
}

export async function leaveLobby(id: string, player_id: string): Promise<LobbyDTO> {
  const res = await fetch(apiUrl(`/api/lobbies/${id}/leave`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id }),
  });
  return handleResponse<LobbyDTO>(res);
}

export async function startLobby(id: string, player_id: string): Promise<LobbyDTO> {
  const res = await fetch(apiUrl(`/api/lobbies/${id}/start`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id }),
  });
  return handleResponse<LobbyDTO>(res);
}
