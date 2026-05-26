import { useEffect, useState } from 'react';
import { getToken, getUsername, subscribe } from './authStore';

export interface AuthState {
  token: string | null;
  username: string | null;
  signedIn: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => {
    const token = getToken();
    const username = getUsername();
    return { token, username, signedIn: token !== null };
  });

  useEffect(() => {
    const unsub = subscribe(() => {
      const token = getToken();
      const username = getUsername();
      setState({ token, username, signedIn: token !== null });
    });
    return unsub;
  }, []);

  return state;
}
