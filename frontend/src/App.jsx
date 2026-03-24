/**
 * @file App.jsx
 * @description Fő React alkalmazás komponens – routing, header, backend státusz.
 */

import { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import VideoDetail from './pages/VideoDetail.jsx';
import Channels from './pages/Channels.jsx';
import ImportVideo from './pages/ImportVideo.jsx';
import Archive from './pages/Archive.jsx';
import Search from './pages/Search.jsx';
import Stats from './pages/Stats.jsx';
import LearningPath from './pages/LearningPath.jsx';

/**
 * App gyökér komponens.
 * Induláskor lekérdezi a /api/health endpointot és megjeleníti a kapcsolat állapotát.
 *
 * @returns {JSX.Element} Az alkalmazás gyökér eleme
 */
function HeaderSearch() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  function handleSubmit(e) {
    e.preventDefault();
    if (q.trim().length >= 2) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  }
  return (
    <form className="header-search" onSubmit={handleSubmit}>
      <input
        className="header-search__input"
        type="search"
        placeholder="🔍 Keresés..."
        value={q}
        onChange={e => setQ(e.target.value)}
      />
    </form>
  );
}

function App() {
  const [backendStatus, setBackendStatus] = useState('loading');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setBackendStatus(data.status === 'ok' ? 'ok' : 'error');
      })
      .catch(() => setBackendStatus('error'));
  }, []);

  return (
    <div>
      <header className="app-header">
        <Link to="/" className="app-header__title">
          Power BI Learning Tracker
        </Link>
        <nav className="app-header__nav">
          <Link to="/" className="app-header__nav-link">Top 10 Videók</Link>
          <Link to="/channels" className="app-header__nav-link">Top Csatornák</Link>
          <Link to="/archive" className="app-header__nav-link">📁 Archívum</Link>
          <Link to="/stats" className="app-header__nav-link">📊 Statisztikák</Link>
          <Link to="/learning-path" className="app-header__nav-link">🗺️ Útvonal</Link>
          <Link to="/import" className="app-header__nav-link app-header__nav-link--accent">+ Videó hozzáadása</Link>
        </nav>
        <HeaderSearch />
        <span className={`app-header__status app-header__status--${backendStatus}`}>
          {backendStatus === 'ok' ? 'Backend: OK' : backendStatus === 'loading' ? 'Csatlakozás...' : 'Backend nem elérhető'}
        </span>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/video/:id" element={<VideoDetail />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/import" element={<ImportVideo />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/search" element={<Search />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/learning-path" element={<LearningPath />} />
      </Routes>
    </div>
  );
}

export default App;
