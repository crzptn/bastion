import { BrowserRouter, Link, Route, Routes, useNavigate } from 'react-router-dom';

import { clearSession } from '../lib/authStore';
import { useAuth } from '../lib/useAuth';
import { HomePage } from '../pages/HomePage';
import { LobbyPage } from '../pages/LobbyPage';
import { LobbyRoomPage } from '../pages/LobbyRoomPage';
import { LoginPage } from '../pages/LoginPage';
import { PlayPage } from '../pages/PlayPage';
import { RegisterPage } from '../pages/RegisterPage';

const navLinkClass =
  'rounded px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white';

// ---------------------------------------------------------------------------
// AuthNav — shows username + Logout when signed in, otherwise Login/Register
// ---------------------------------------------------------------------------

function AuthNav() {
  const { signedIn, username } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    clearSession();
    navigate('/');
  }

  if (signedIn) {
    return (
      <>
        <span className="rounded px-3 py-2 text-sm font-medium text-slate-400">{username}</span>
        <button
          onClick={handleLogout}
          className="rounded px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          Logout
        </button>
      </>
    );
  }

  return (
    <>
      <Link to="/login" className={navLinkClass}>
        Login
      </Link>
      <Link to="/register" className={navLinkClass}>
        Register
      </Link>
    </>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
  return (
    <BrowserRouter>
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8">
        <header className="mb-8 border-b border-slate-800 pb-4">
          <h1 className="mb-4 text-2xl font-semibold tracking-tight">Bastion</h1>
          <nav className="flex gap-2">
            <Link to="/" className={navLinkClass}>
              Home
            </Link>
            <Link to="/play" className={navLinkClass}>
              Play
            </Link>
            <Link to="/lobby" className={navLinkClass}>
              Lobby
            </Link>
            <AuthNav />
          </nav>
        </header>
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/play" element={<PlayPage />} />
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/lobby/:id" element={<LobbyRoomPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
