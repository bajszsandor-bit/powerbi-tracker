/**
 * @file App.jsx
 * @description Fő React alkalmazás komponens – routing, header, backend státusz.
 */

import { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import VideoDetail from './pages/VideoDetail.jsx';

/**
 * App gyökér komponens.
 * Induláskor lekérdezi a /api/health endpointot és megjeleníti a kapcsolat állapotát.
 *
 * @returns {JSX.Element} Az alkalmazás gyökér eleme
 */
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
        <span
          className={`app-header__status app-header__status--${backendStatus}`}
        >
          {backendStatus === 'ok'
            ? 'Backend: OK'
            : backendStatus === 'loading'
            ? 'Csatlakozás...'
            : 'Backend nem elérhető'}
        </span>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/video/:id" element={<VideoDetail />} />
      </Routes>
    </div>
  );
}

export default App;
