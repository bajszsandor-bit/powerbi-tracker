/**
 * @file Home.jsx
 * @description Főoldal – napi Top 10 Power BI videó kártyákban megjelenítve.
 * Tartalmaz szűrőt, frissítés gombot, betöltési és hibakezelési állapotot.
 */

import { useEffect, useState, useCallback } from 'react';

/**
 * Egy DAX függvény badge-et renderel.
 *
 * @param {{ name: string }} props
 * @returns {JSX.Element}
 */
function DaxBadge({ name }) {
  return <span className="dax-badge">{name}</span>;
}

/**
 * Egyetlen videókártyát renderel.
 *
 * @param {{ video: object }} props
 * @returns {JSX.Element}
 */
function VideoCard({ video }) {
  const daxFunctions = video.dax_functions
    ? JSON.parse(video.dax_functions)
    : [];

  const displayTitle = video.titleHu || video.title || '(Cím nélkül)';
  const score = typeof video.score === 'number' ? Math.round(video.score) : null;

  return (
    <article className="video-card">
      {video.thumbnail_url && (
        <a
          href={video.video_url || `https://www.youtube.com/watch?v=${video.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="video-card__thumb-link"
        >
          <img
            src={video.thumbnail_url}
            alt={displayTitle}
            className="video-card__thumb"
            loading="lazy"
          />
        </a>
      )}
      <div className="video-card__body">
        <a
          href={video.video_url || `https://www.youtube.com/watch?v=${video.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="video-card__title"
        >
          {displayTitle}
        </a>
        <p className="video-card__channel">{video.channel_title || '—'}</p>
        <div className="video-card__meta">
          {score !== null && (
            <span className="video-card__score" title="Relevancia pontszám">
              ⭐ {score} pont
            </span>
          )}
          {video.transcriptAvailable && (
            <span className="video-card__transcript-badge">📝 Felirat</span>
          )}
        </div>
        {daxFunctions.length > 0 && (
          <div className="video-card__dax">
            {daxFunctions.slice(0, 5).map((fn) => (
              <DaxBadge key={fn} name={fn} />
            ))}
            {daxFunctions.length > 5 && (
              <span className="dax-badge dax-badge--more">
                +{daxFunctions.length - 5}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Home oldal komponens – napi Top 10 videók listája.
 *
 * @returns {JSX.Element} A főoldal tartalma
 */
function Home() {
  const [videos, setVideos] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'empty' | 'error' | 'no-ytdlp'
  const [errorMessage, setErrorMessage] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'dax'
  const [refreshing, setRefreshing] = useState(false);

  /** Top 10 lista betöltése a backendről. */
  const loadVideos = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/top10');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = data.videos ?? [];
      setVideos(list);
      setLastUpdated(data.lastUpdated || null);
      setStatus(list.length === 0 ? 'empty' : 'ok');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  /** Frissítés gomb: POST /api/refresh */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) {
          setStatus('no-ytdlp');
          setErrorMessage(data.message || 'yt-dlp nincs telepítve');
          return;
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await loadVideos();
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  /** Szűrt videók */
  const filtered =
    filter === 'dax'
      ? videos.filter((v) => {
          const fns = v.dax_functions ? JSON.parse(v.dax_functions) : [];
          return fns.length > 0;
        })
      : videos;

  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleString('hu-HU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <main className="home">
      <div className="home__toolbar">
        <div className="home__filter">
          <button
            className={`filter-btn${filter === 'all' ? ' filter-btn--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Összes
          </button>
          <button
            className={`filter-btn${filter === 'dax' ? ' filter-btn--active' : ''}`}
            onClick={() => setFilter('dax')}
          >
            Csak DAX videók
          </button>
        </div>
        <div className="home__actions">
          {formattedDate && (
            <span className="home__last-updated">
              Utolsó frissítés: {formattedDate}
            </span>
          )}
          <button
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing || status === 'loading'}
          >
            {refreshing ? 'Frissítés...' : '🔄 Frissítés most'}
          </button>
        </div>
      </div>

      {status === 'loading' && (
        <div className="home__state">
          <div className="spinner" aria-label="Betöltés..." />
          <p>Betöltés...</p>
        </div>
      )}

      {status === 'no-ytdlp' && (
        <div className="home__state home__state--error">
          <p className="home__state-title">⚠️ yt-dlp nincs telepítve</p>
          <p>{errorMessage}</p>
          <a
            href="https://github.com/yt-dlp/yt-dlp/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="home__state-link"
          >
            Telepítési útmutató →
          </a>
        </div>
      )}

      {status === 'error' && (
        <div className="home__state home__state--error">
          <p className="home__state-title">❌ Hiba történt</p>
          <p>{errorMessage}</p>
          <button className="refresh-btn" onClick={loadVideos}>
            Újrapróbálás
          </button>
        </div>
      )}

      {status === 'empty' && (
        <div className="home__state">
          <p className="home__state-title">Még nincsenek videók</p>
          <p>Kattints a „Frissítés most" gombra az első gyűjtés indításához.</p>
        </div>
      )}

      {status === 'ok' && (
        <>
          <h2 className="home__subtitle">
            Napi Top {filtered.length} Power BI videó
          </h2>
          {filtered.length === 0 ? (
            <p className="home__no-results">
              Nincs DAX videó a listában. Próbáld az „Összes" nézetet.
            </p>
          ) : (
            <div className="video-grid" data-testid="video-grid">
              {filtered.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default Home;
