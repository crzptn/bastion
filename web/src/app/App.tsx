import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';

import { HomePage } from '../pages/HomePage';
import { LobbyPage } from '../pages/LobbyPage';
import { PlayPage } from '../pages/PlayPage';

const navLinkClass =
  'rounded px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white';

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
          </nav>
        </header>
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/play" element={<PlayPage />} />
            <Route path="/lobby" element={<LobbyPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
