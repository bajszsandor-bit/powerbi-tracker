/**
 * @file ImportVideo.jsx
 * @description Videó importálás oldal – YouTube URL beillesztés, fordítás és archiválás.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

function ImportVideo() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!url.trim()) return;

    setStatus('loading');
    setResult(null);
    setErrorMsg('');

    try {
      const res = await fetch('/api/import-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data.error || `HTTP ${res.status}`);
        return;
      }
      setResult(data);
      setStatus('success');
      setUrl('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  }

  return (
    <div className="import-page">
      <h2 className="import-page__title">+ Videó hozzáadása és archiválása</h2>
      <p className="import-page__desc">
        Illeszd be egy YouTube videó linkjét – automatikusan lefordítjuk magyarra,
        elemezzük (DAX függvények, témák) és archiváljuk.
      </p>

      <form onSubmit={handleSubmit} className="import-form">
        <input
          type="url"
          className="import-form__input"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={status === 'loading'}
          required
        />
        <button
          type="submit"
          className="import-form__btn"
          disabled={status === 'loading' || !url.trim()}
        >
          {status === 'loading' ? '⏳ Feldolgozás...' : '📥 Hozzáadás és elemzés'}
        </button>
      </form>

      {status === 'loading' && (
        <div className="import-state">
          <div className="spinner" aria-label="Feldolgozás..." />
          <p className="import-state__msg">
            Videó letöltése, magyar fordítás és elemzés folyamatban…
            <br />
            <small>Ez 15–40 másodpercig tarthat.</small>
          </p>
        </div>
      )}

      {status === 'success' && result && (
        <div className="import-state import-state--success">
          <span className="import-state__icon">✅</span>
          <div>
            <p className="import-state__label">Sikeresen archiválva!</p>
            <p className="import-state__title">
              {result.titleHu || result.title}
            </p>
            <Link to={`/video/${result.id}`} className="import-state__link">
              Elemzés megtekintése →
            </Link>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="import-state import-state--error">
          <span className="import-state__icon">❌</span>
          <p className="import-state__msg">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

export default ImportVideo;
