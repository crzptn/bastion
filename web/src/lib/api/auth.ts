import { apiBaseUrl } from '../env';

// ---------------------------------------------------------------------------
// DTOs — mirroring internal/http/users_endpoint.go exactly
// ---------------------------------------------------------------------------

export interface UserDTO {
  id: string;
  username: string;
  created_at: string;
}

export interface RegisterResponse {
  user_id: string;
  username: string;
}

export interface LoginResponse {
  token: string;
  user: UserDTO;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'AuthApiError';
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
    throw new AuthApiError(message, res.status, code);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function register(username: string, password: string): Promise<RegisterResponse> {
  const res = await fetch(apiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse<RegisterResponse>(res);
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse<LoginResponse>(res);
}

export async function getMe(token: string): Promise<UserDTO> {
  const res = await fetch(apiUrl('/api/auth/me'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return handleResponse<UserDTO>(res);
}
