/**
 * @file App.jsx
 * @description Fő React alkalmazás komponens.
 * Kezeli a backend kapcsolat állapotát és rendereli a főoldalt.
 */

import { useEffect, useState } from 'react';
import Home from './pages/Home.jsx';

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
        if (data.status === 'ok') {
          setBackendStatus('ok');
        } else {
          setBackendStatus('error');
        }
      })
      .catch(() => {
        setBackendStatus('error');
      });
  }, []);

  return (
    <div>
      <header
        style={{
          background: '#1a73e8',
          color: 'white',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Power BI Learning Tracker</h1>
        <span
          style={{
            fontSize: '0.8rem',
            background: backendStatus === 'ok' ? '#34a853' : backendStatus === 'loading' ? '#fbbc05' : '#ea4335',
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
          }}
        >
          {backendStatus === 'ok' ? 'Backend: OK' : backendStatus === 'loading' ? 'Csatlakozás...' : 'Backend nem elérhető'}
        </span>
      </header>
      <Home />
    </div>
  );
}

export default App;
