/**
 * @file App.jsx
 * @description Fő React alkalmazás komponens – routing, header, backend státusz.
 */

import { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import VideoDetail from './pages/VideoDetail.jsx';
import Channels from './pages/Channels.jsx';
import ImportVideo from './pages/ImportVideo.jsx';
import Archive from './pages/Archive.jsx';
import Search from './pages/Search.jsx';
import Stats from './pages/Stats.jsx';
import LearningPath from './pages/LearningPath.jsx';

function HeaderSearch({ onSearch }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  function handleSubmit(e) {
    e.preventDefault();
    if (q.trim().length >= 2) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      onSearch?.();
    }
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
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Bezárja a menüt oldalváltáskor
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setBackendStatus(data.status === 'ok' ? 'ok' : 'error');
      })
      .catch(() => setBackendStatus('error'));
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div>
      <header className="app-header">
        <Link to="/" className="app-header__title" onClick={closeMenu}>
          Power BI Tracker
        </Link>

        <button
          className={`app-header__hamburger${menuOpen ? ' app-header__hamburger--open' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menü megnyitása"
          aria-expanded={menuOpen}
        >
          <span /><span /><span />
        </button>

        <nav className={`app-header__nav${menuOpen ? ' app-header__nav--open' : ''}`}>
          <Link to="/" className="app-header__nav-link" onClick={closeMenu}>🏠 Top 10</Link>
          <Link to="/channels" className="app-header__nav-link" onClick={closeMenu}>📡 Csatornák</Link>
          <Link to="/archive" className="app-header__nav-link" onClick={closeMenu}>📁 Archívum</Link>
          <Link to="/stats" className="app-header__nav-link" onClick={closeMenu}>📊 Statisztikák</Link>
          <Link to="/learning-path" className="app-header__nav-link" onClick={closeMenu}>🗺️ Útvonal</Link>
          <Link to="/import" className="app-header__nav-link app-header__nav-link--accent" onClick={closeMenu}>+ Videó</Link>
          <div className="app-header__nav-search">
            <HeaderSearch onSearch={closeMenu} />
          </div>
        </nav>

        <div className="app-header__right">
          <HeaderSearch onSearch={closeMenu} />
          <span className={`app-header__status app-header__status--${backendStatus}`}>
            {backendStatus === 'ok' ? '● OK' : backendStatus === 'loading' ? '● ...' : '● Offline'}
          </span>
        </div>
      </header>

      {menuOpen && (
        <div className="app-header__overlay" onClick={closeMenu} aria-hidden="true" />
      )}

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
