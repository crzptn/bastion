import { apiBaseUrl } from '../env';

// ---------------------------------------------------------------------------
// DTOs — mirroring internal/http/scores_endpoint.go JSON tags exactly
// ---------------------------------------------------------------------------

export interface ScoreDTO {
  id: string;
  user_id: string;
  username: string;
  wave_reached: number;
  base_hp_left: number;
  duration_ms: number;
  coop: boolean;
  created_at: string;
}

export interface SubmitScoreInput {
  wave_reached: number;
  base_hp_left: number;
  duration_ms: number;
  coop: boolean;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ScoresApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ScoresApiError';
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
    throw new ScoresApiError(message, res.status, code);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function submitScore(token: string, input: SubmitScoreInput): Promise<ScoreDTO> {
  const res = await fetch(apiUrl('/api/scores'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  return handleResponse<ScoreDTO>(res);
}

export async function getLeaderboard(limit?: number): Promise<ScoreDTO[]> {
  const path = limit !== undefined ? `/api/leaderboard?limit=${limit}` : '/api/leaderboard';
  const res = await fetch(apiUrl(path));
  return handleResponse<ScoreDTO[]>(res);
}
